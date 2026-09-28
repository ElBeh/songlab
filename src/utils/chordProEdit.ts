// Text operations behind the songbook editor's insert toolbar.
//
// Each operation returns an edit (replace [from, to) with insert, then select
// [selectionStart, selectionEnd] in the new text) instead of the new text, so
// the editor can apply it through the textarea and keep the native undo stack.

import { normalizeChord } from './chordSheetParser';

export interface TextEdit {
  from: number;
  to: number;
  insert: string;
  /** Selection after the edit, absolute positions in the new text */
  selectionStart: number;
  selectionEnd: number;
}

/** Apply an edit to a string (tests and the fallback without undo support) */
export function applyEdit(text: string, edit: TextEdit): string {
  return text.slice(0, edit.from) + edit.insert + text.slice(edit.to);
}

// --- Line helpers ---

function lineStart(text: string, pos: number): number {
  return text.lastIndexOf('\n', pos - 1) + 1;
}

function lineEnd(text: string, pos: number): number {
  const end = text.indexOf('\n', pos);
  return end === -1 ? text.length : end;
}

interface InsertionPoint {
  /** Start of the replaced range */
  at: number;
  /** End of the replaced range (whitespace of an empty cursor line) */
  to: number;
  /** Newline before the inserted lines, needed after a non-empty last line */
  prefix: string;
  /** Newline after the inserted lines, needed when text follows on the same line */
  suffix: string;
}

/**
 * Where new lines go: onto the cursor line if it is empty (replacing its
 * whitespace), otherwise onto a new line below it.
 */
function insertionPoint(text: string, pos: number): InsertionPoint {
  const start = lineStart(text, pos);
  const end = lineEnd(text, pos);
  if (text.slice(start, end).trim() === '') return { at: start, to: end, prefix: '', suffix: '' };
  if (end === text.length) return { at: end, to: end, prefix: '\n', suffix: '' };
  return { at: end + 1, to: end + 1, prefix: '', suffix: '\n' };
}

// --- Sections ---

/** Section kinds offered by the toolbar, with the label base used for numbering */
export const SECTION_KINDS = [
  { kind: 'intro', label: 'Intro' },
  { kind: 'verse', label: 'Verse' },
  { kind: 'pre-chorus', label: 'Pre-Chorus' },
  { kind: 'chorus', label: 'Chorus' },
  { kind: 'bridge', label: 'Bridge' },
  { kind: 'solo', label: 'Solo' },
  { kind: 'interlude', label: 'Interlude' },
  { kind: 'outro', label: 'Outro' },
] as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Next numbered label for a section: "Verse 3" if "Verse 1" and "Verse 2"
 * exist. Counts section starts and {chorus} references; an unnumbered label
 * counts as 1.
 */
export function nextSectionLabel(text: string, base: string): string {
  const re = new RegExp(
    `^\\s*\\{\\s*(?:start_of_[\\w-]+|chorus)\\s*:\\s*${escapeRegExp(base)}(?:\\s+(\\d+))?\\s*\\}\\s*$`,
    'i',
  );
  let highest = 0;
  for (const line of text.split('\n')) {
    const match = line.match(re);
    if (match) highest = Math.max(highest, match[1] ? Number(match[1]) : 1);
  }
  return `${base} ${highest + 1}`;
}

/**
 * Wrap the selected lines in {start_of_kind: label} ... {end_of_kind}.
 * Without a selection an empty section is inserted below the cursor line,
 * with the cursor on its empty content line. A null label omits it ({start_of_tab}).
 */
export function wrapInSection(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  kind: string,
  label: string | null,
): TextEdit {
  const open = label ? `{start_of_${kind}: ${label}}` : `{start_of_${kind}}`;
  const close = `{end_of_${kind}}`;

  if (selectionStart === selectionEnd) {
    const { at, to, prefix, suffix } = insertionPoint(text, selectionStart);
    const insert = `${prefix}${open}\n\n${close}${suffix}`;
    const cursor = at + prefix.length + open.length + 1;
    return { from: at, to, insert, selectionStart: cursor, selectionEnd: cursor };
  }

  // Extend to whole lines; a selection ending right after a newline excludes that line
  const from = lineStart(text, selectionStart);
  const endPos = selectionEnd > selectionStart && text[selectionEnd - 1] === '\n'
    ? selectionEnd - 1
    : selectionEnd;
  const to = lineEnd(text, endPos);
  const content = text.slice(from, to);
  const insert = `${open}\n${content}\n${close}`;
  const contentStart = from + open.length + 1;
  return {
    from, to, insert,
    selectionStart: contentStart,
    selectionEnd: contentStart + content.length,
  };
}

// --- Single-line directives ---

/**
 * Insert a directive such as {chorus: Chorus} or {comment: } on its own line
 * below the cursor line. The cursor is placed `cursorOffset` characters into
 * the directive (default: after it).
 */
export function insertDirectiveLine(
  text: string,
  position: number,
  directive: string,
  cursorOffset: number = directive.length,
): TextEdit {
  const { at, to, prefix, suffix } = insertionPoint(text, position);
  const insert = `${prefix}${directive}${suffix}`;
  const cursor = at + prefix.length + cursorOffset;
  return { from: at, to, insert, selectionStart: cursor, selectionEnd: cursor };
}

/** {comment: ...} with the selected text (single line) as content, cursor before the brace */
export function insertComment(text: string, selectionStart: number, selectionEnd: number): TextEdit {
  const selected = text.slice(selectionStart, selectionEnd);
  const content = selected.includes('\n') ? '' : selected.trim();
  const directive = `{comment: ${content}}`;
  return insertDirectiveLine(text, selectionStart, directive, directive.length - 1);
}

// --- Metadata ---

export type MetaDirective = 'title' | 'artist' | 'key' | 'capo';

/** Short and alternative names the parser accepts for each metadata directive */
const META_ALIASES: Record<MetaDirective, string[]> = {
  title: ['title', 't'],
  artist: ['artist', 'subtitle', 'st'],
  key: ['key'],
  capo: ['capo'],
};

/** Order of metadata lines at the top of the sheet */
const META_ORDER: MetaDirective[] = ['title', 'artist', 'key', 'capo'];

function metaLineRe(names: string[]): RegExp {
  return new RegExp(`^\\s*\\{\\s*(?:${names.join('|')})\\s*(?::[^}]*)?\\}\\s*$`, 'i');
}

/**
 * Set, replace or (with an empty value) remove a metadata directive. A new line
 * goes after the metadata lines that precede it in META_ORDER, else at the top.
 * The selection is kept where it was, shifted by the edit.
 */
export function setMetaDirective(
  text: string,
  name: MetaDirective,
  value: string,
  selectionStart: number,
  selectionEnd: number,
): TextEdit | null {
  const trimmed = value.trim();
  const lines = text.split('\n');
  const offsets: number[] = [];
  let offset = 0;
  for (const line of lines) { offsets.push(offset); offset += line.length + 1; }

  const shift = (pos: number, from: number, to: number, insertLength: number) =>
    pos <= from ? pos : pos >= to ? pos + insertLength - (to - from) : from + insertLength;
  const build = (from: number, to: number, insert: string): TextEdit => ({
    from, to, insert,
    selectionStart: shift(selectionStart, from, to, insert.length),
    selectionEnd: shift(selectionEnd, from, to, insert.length),
  });

  const existing = lines.findIndex((l) => metaLineRe(META_ALIASES[name]).test(l));
  if (existing !== -1) {
    const from = offsets[existing];
    const lineTo = from + lines[existing].length;
    if (trimmed) return build(from, lineTo, `{${name}: ${trimmed}}`);
    // Remove the line including its newline
    return lineTo < text.length ? build(from, lineTo + 1, '') : build(Math.max(0, from - 1), lineTo, '');
  }
  if (!trimmed) return null;

  // After the last preceding metadata line, else at the very top
  const preceding = META_ORDER.slice(0, META_ORDER.indexOf(name)).flatMap((n) => META_ALIASES[n]);
  let after = -1;
  if (preceding.length > 0) {
    const re = metaLineRe(preceding);
    lines.forEach((l, i) => { if (re.test(l)) after = i; });
  }
  const directive = `{${name}: ${trimmed}}`;
  if (after === -1) return build(0, 0, text ? `${directive}\n` : directive);
  const at = offsets[after] + lines[after].length;
  return build(at, at, `\n${directive}`);
}

// --- Chords ---

/** Replace the selection with [chord] and place the cursor after it */
export function insertChord(
  selectionStart: number,
  selectionEnd: number,
  chord: string,
): TextEdit {
  const insert = `[${normalizeChord(chord.trim())}]`;
  const cursor = selectionStart + insert.length;
  return { from: selectionStart, to: selectionEnd, insert, selectionStart: cursor, selectionEnd: cursor };
}