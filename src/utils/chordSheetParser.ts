// Parser for the songbook view: a ChordPro subset plus a converter for pasted
// "chords over words" sheets (Ultimate Guitar style). No dependencies; the
// parsed model is derived on render from the raw text stored on SongData.

// --- Model ---

export interface ChordSegment {
  /** Chord (or chord-row token such as "|" or "N.C.") above the lyric, null if none */
  chord: string | null;
  lyric: string;
}

export type SheetLine =
  | { type: 'lyrics'; segments: ChordSegment[] }
  | { type: 'comment'; text: string }
  | { type: 'raw'; text: string }      // tab/grid content, rendered verbatim
  | { type: 'empty' };

export interface SheetSection {
  /** Display label, e.g. "Chorus 1"; null for content before the first section */
  label: string | null;
  /** Section kind from the directive, e.g. "verse", "chorus", "tab" */
  kind: string | null;
  lines: SheetLine[];
  /** True for a {chorus} directive: "repeat the chorus here", no own lines */
  isReference?: boolean;
}

export interface ChordDefinition {
  name: string;
  /** Fret number of the first diagram row (1 = nut) */
  baseFret: number;
  /** Per string from low to high; null = muted, 0 = open, n = fret relative to baseFret */
  frets: (number | null)[];
  /** Per string finger numbers (0 = none), empty if not given */
  fingers: number[];
}

export interface ParsedChordSheet {
  title: string | null;
  artist: string | null;
  key: string | null;
  capo: number | null;
  sections: SheetSection[];
  /** Unique chords in order of first appearance (chord-row tokens excluded) */
  chords: string[];
  /** Custom voicings from {define} directives, keyed by chord name */
  definitions: Record<string, ChordDefinition>;
}

// --- Chord recognition ---

const CHORD_RE =
  /^[A-G][#b]?(?:maj|min|dim|aug|sus|add|m|M|\+|°|ø|[0-9]|[#b](?=[0-9])|\((?:[#b]?[0-9]+,?)+\))*(?:\/[A-G][#b]?)?$/;

/** Non-chord tokens allowed in a chord row: bar lines, rhythm, repeats, no-chord */
const CHORD_ROW_TOKEN_RE = /^(?:\|+|\|:|:\||\/|x|-|N\.?C\.?|\(\d+x\)|x\d+)$/i;

/**
 * Normalize typographic chord symbols to ASCII: "C♯m" -> "C#m", "A♭" -> "Ab".
 * Sheets copied from websites or PDFs often use the Unicode accidentals.
 */
export function normalizeChord(token: string): string {
  return token.replace(/♯/g, '#').replace(/♭/g, 'b');
}

/** True if the token is a chord name such as "Am", "F#m7b5", "D/F#" or "C♯m" */
export function isChord(token: string): boolean {
  return CHORD_RE.test(normalizeChord(token));
}

function isChordRowToken(token: string): boolean {
  return isChord(token) || CHORD_ROW_TOKEN_RE.test(token);
}

// --- Section keywords (shared by both formats) ---

const SECTION_KEYWORDS = [
  'intro', 'verse', 'pre-chorus', 'prechorus', 'chorus', 'refrain', 'bridge',
  'solo', 'interlude', 'instrumental', 'outro', 'coda', 'hook', 'break',
];

const PLAIN_HEADER_RE = new RegExp(
  `^(?:${SECTION_KEYWORDS.join('|')})(?:\\s*\\d+)?(?:\\s*\\(?x\\d+\\)?)?\\s*:?$`,
  'i',
);

const DEFAULT_LABELS: Record<string, string> = {
  verse: 'Verse',
  chorus: 'Chorus',
  bridge: 'Bridge',
  tab: 'Tab',
  grid: 'Grid',
};

const SHORT_ENVIRONMENTS: Record<string, [string, 'start' | 'end']> = {
  soc: ['chorus', 'start'], eoc: ['chorus', 'end'],
  sov: ['verse', 'start'], eov: ['verse', 'end'],
  sob: ['bridge', 'start'], eob: ['bridge', 'end'],
  sot: ['tab', 'start'], eot: ['tab', 'end'],
  sog: ['grid', 'start'], eog: ['grid', 'end'],
};

/** Section kind for a header label like "Pre-Chorus 2", null if not a known section */
function sectionKindFromLabel(label: string): string | null {
  const word = label.trim().toLowerCase().split(/[\s\d:]+/)[0] ?? '';
  if (!SECTION_KEYWORDS.includes(word)) return null;
  return word === 'prechorus' ? 'pre-chorus' : word === 'refrain' ? 'chorus' : word;
}

/** Header line in a pasted sheet: "[Verse 1]", "Chorus:" or "Intro" */
function parseSectionHeader(line: string): string | null {
  const trimmed = line.trim();
  const bracketed = trimmed.match(/^\[([^\]]+)\]$/);
  if (bracketed) {
    const label = bracketed[1].trim();
    return isChordRowToken(label) ? null : label;
  }
  // Unbracketed: only "Keyword", "Keyword 2", "Keyword x2" with optional colon,
  // so lyric lines such as "Break my heart" are not mistaken for headers
  return PLAIN_HEADER_RE.test(trimmed) ? trimmed.replace(/\s*:$/, '') : null;
}

// --- ChordPro parsing ---

function parseDirective(line: string): { name: string; value: string } | null {
  const match = line.trim().match(/^\{\s*([\w-]+)\s*(?::\s*(.*?))?\s*\}$/);
  if (!match) return null;
  return { name: match[1].toLowerCase(), value: match[2] ?? '' };
}

/** {define: Am base-fret 1 frets x 0 2 2 1 0 fingers 0 0 2 3 1 0} */
function parseDefine(value: string): ChordDefinition | null {
  const tokens = value.trim().split(/\s+/);
  const name = tokens.shift();
  if (!name) return null;

  let baseFret = 1;
  const frets: (number | null)[] = [];
  const fingers: number[] = [];
  let mode: 'frets' | 'fingers' | null = null;

  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (lower === 'base-fret') { mode = null; continue; }
    if (lower === 'frets') { mode = 'frets'; continue; }
    if (lower === 'fingers') { mode = 'fingers'; continue; }
    if (mode === null) {
      const n = Number(token);
      if (Number.isInteger(n) && n > 0) baseFret = n;
      continue;
    }
    if (mode === 'frets') {
      frets.push(lower === 'x' || lower === 'n' || token === '-1' ? null : Number(token));
    } else {
      fingers.push(Number(token) || 0);
    }
  }

  if (frets.length === 0 || frets.some((f) => f !== null && !Number.isInteger(f))) return null;
  return { name, baseFret, frets, fingers };
}

/** Split "Let it [Am]be" into chord/lyric segments */
function parseLyricsLine(line: string): ChordSegment[] {
  const segments: ChordSegment[] = [];
  const re = /\[([^\]]*)\]/g;
  let lastIndex = 0;
  let pendingChord: string | null = null;
  let match: RegExpExecArray | null;

  while ((match = re.exec(line)) !== null) {
    const lyric = line.slice(lastIndex, match.index);
    if (pendingChord !== null || lyric.length > 0) {
      segments.push({ chord: pendingChord, lyric });
    }
    pendingChord = normalizeChord(match[1].trim().replace(/^\*/, ''));
    lastIndex = re.lastIndex;
  }
  const rest = line.slice(lastIndex);
  if (pendingChord !== null || rest.length > 0) {
    segments.push({ chord: pendingChord, lyric: rest });
  }
  return segments;
}

/** Drop leading and trailing empty lines of a section */
function trimEmptyLines(lines: SheetLine[]): SheetLine[] {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].type === 'empty') start++;
  while (end > start && lines[end - 1].type === 'empty') end--;
  return lines.slice(start, end);
}

/** Parse a ChordPro text (subset) into the songbook model */
export function parseChordPro(text: string): ParsedChordSheet {
  const result: ParsedChordSheet = {
    title: null, artist: null, key: null, capo: null,
    sections: [], chords: [], definitions: {},
  };
  const seenChords = new Set<string>();

  let current: SheetSection = { label: null, kind: null, lines: [] };
  const sections: SheetSection[] = [current];
  let rawMode = false;

  const openSection = (label: string | null, kind: string | null) => {
    current = { label, kind, lines: [] };
    sections.push(current);
  };
  const closeSection = () => {
    rawMode = false;
    openSection(null, null);
  };

  for (const rawLine of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = rawLine.replace(/\s+$/, '');
    const directive = parseDirective(line);

    if (directive) {
      const { name, value } = directive;
      const short = SHORT_ENVIRONMENTS[name];
      const env = short
        ?? (name.startsWith('start_of_') ? [name.slice(9), 'start'] as [string, 'start']
          : name.startsWith('end_of_') ? [name.slice(7), 'end'] as [string, 'end']
            : null);

      if (env) {
        const [kind, edge] = env;
        if (edge === 'start') {
          openSection(value || DEFAULT_LABELS[kind] || kind, kind);
          rawMode = kind === 'tab' || kind === 'grid';
        } else {
          closeSection();
        }
        continue;
      }

      switch (name) {
        case 'title': case 't': result.title = value || null; break;
        case 'artist': case 'subtitle': case 'st':
          result.artist = result.artist ?? (value || null); break;
        case 'key': result.key = value || null; break;
        case 'capo': {
          const capo = Number(value);
          result.capo = Number.isInteger(capo) && capo > 0 ? capo : null;
          break;
        }
        case 'comment': case 'c': case 'comment_italic': case 'ci':
        case 'comment_box': case 'cb': case 'highlight':
          current.lines.push({ type: 'comment', text: value });
          break;
        case 'chorus':
          // Repeat reference: its own (empty) section, so it counts as an
          // occurrence for highlighting and marker import
          sections.push({ label: value || 'Chorus', kind: 'chorus', lines: [], isReference: true });
          rawMode = false;
          openSection(null, null);
          break;
        case 'define': {
          const def = parseDefine(value);
          if (def) result.definitions[def.name] = def;
          break;
        }
        default:
          // Unsupported directives are ignored so foreign files still render
          break;
      }
      continue;
    }

    if (rawMode) {
      current.lines.push(line === '' ? { type: 'empty' } : { type: 'raw', text: line });
      continue;
    }

    if (line.trim() === '') {
      current.lines.push({ type: 'empty' });
      continue;
    }
    if (line.startsWith('#')) continue; // ChordPro file comment

    // A lone "[Chorus]" is a section header, a lone "[Am]" is a chord line
    const header = parseSectionHeader(line);
    if (header && line.trim().startsWith('[')) {
      openSection(header, sectionKindFromLabel(header) ?? 'custom');
      continue;
    }

    const segments = parseLyricsLine(line);
    for (const seg of segments) {
      if (seg.chord && isChord(seg.chord) && !seenChords.has(seg.chord)) {
        seenChords.add(seg.chord);
        result.chords.push(seg.chord);
      }
    }
    current.lines.push({ type: 'lyrics', segments });
  }

  result.sections = sections
    .map((s) => ({ ...s, lines: trimEmptyLines(s.lines) }))
    .filter((s) => s.lines.length > 0 || s.label !== null);
  return result;
}

// --- Chords over words (paste) ---

function tokenize(line: string): { token: string; column: number }[] {
  const tokens: { token: string; column: number }[] = [];
  const re = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(line)) !== null) {
    tokens.push({ token: match[0], column: match.index });
  }
  return tokens;
}

/** A line that holds only chords (and chord-row tokens), with at least one real chord */
export function isChordLine(line: string): boolean {
  const tokens = tokenize(line);
  return tokens.length > 0
    && tokens.every((t) => isChordRowToken(t.token))
    && tokens.some((t) => isChord(t.token));
}

function isTabLine(line: string): boolean {
  return /^\s*[a-gA-G][#b]?\s*\|[-\d|hpbrsx/\\~()^.\s]*$/.test(line) && line.includes('-');
}

/** Insert the chords of a chord row into the lyric line below at their columns */
function mergeChordLine(chordLine: string, lyricLine: string): string {
  const tokens = tokenize(chordLine);
  const width = Math.max(...tokens.map((t) => t.column));
  let merged = lyricLine.padEnd(width, ' ');
  // Right to left so earlier columns stay valid
  for (const { token, column } of [...tokens].reverse()) {
    merged = `${merged.slice(0, column)}[${normalizeChord(token)}]${merged.slice(column)}`;
  }
  return merged.replace(/\s+$/, '');
}

function splitLines(text: string): string[] {
  return text.replace(/\r\n?/g, '\n').split('\n');
}

/** True if any line holds a {directive} or an inline [chord] (a lone "[Verse]" header does not count) */
function hasChordProMarkup(lines: string[]): boolean {
  return lines.some((l) => parseDirective(l) !== null
    || (/\[[^\]]+\]/.test(l) && !parseSectionHeader(l)));
}

/** Append {end_of_kind} before trailing blank lines so they separate sections, not end them */
function appendSectionEnd(out: string[], kind: string): void {
  let blanks = 0;
  while (out.length > 0 && out[out.length - 1].trim() === '') { out.pop(); blanks++; }
  out.push(`{end_of_${kind}}`);
  for (let b = 0; b < blanks; b++) out.push('');
}

/**
 * True if the text looks like a pasted chords-over-words sheet rather than
 * ChordPro: no inline [chords] or {directives}, but at least one chord row.
 */
export function looksLikeChordsOverWords(text: string): boolean {
  const lines = splitLines(text);
  return !hasChordProMarkup(lines) && lines.some(isChordLine);
}

/** Convert a pasted chords-over-words sheet into ChordPro */
export function chordsOverWordsToChordPro(text: string): string {
  const lines = splitLines(text.replace(/\t/g, '    '));
  const out: string[] = [];
  let openKind: string | null = null;
  let inTab = false;

  const closeOpen = () => {
    if (inTab) { out.push('{end_of_tab}'); inTab = false; }
    if (!openKind) return;
    appendSectionEnd(out, openKind);
    openKind = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\s+$/, '');

    if (isTabLine(line)) {
      if (!inTab) { out.push('{start_of_tab}'); inTab = true; }
      out.push(line);
      continue;
    }
    if (inTab) { out.push('{end_of_tab}'); inTab = false; }

    const header = line.trim() ? parseSectionHeader(line) : null;
    if (header) {
      closeOpen();
      openKind = sectionKindFromLabel(header) ?? 'part';
      out.push(`{start_of_${openKind}: ${header}}`);
      continue;
    }

    if (isChordLine(line)) {
      const next = lines[i + 1]?.replace(/\s+$/, '') ?? '';
      const nextIsLyric = next.trim() !== ''
        && !isChordLine(next) && !parseSectionHeader(next) && !isTabLine(next);
      out.push(mergeChordLine(line, nextIsLyric ? next : ''));
      if (nextIsLyric) i++;
      continue;
    }

    out.push(line);
  }
  closeOpen();

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
// --- Stacked chords (paste) ---
//
// Copying a chord view rendered as one element per chord/syllable pair
// (e.g. Songsterr) yields one line per element: a chord line, then the text
// fragment under that chord. Blank lines separate song lines, a whitespace-only
// fragment is a chord without text, and word boundaries live in the fragments
// ("earth" + "quakes and " -> "earthquakes and"), so fragments are joined raw.

/** Minimum number of mid-line chord changes before a text counts as stacked */
const STACKED_MIN_EVIDENCE = 3;

/**
 * True if the text looks like a stacked chord sheet: every chord line holds a
 * single chord at column 0, and text fragments are regularly continued by a
 * chord within the same line (trailing space, whitespace-only fragment, or a
 * lowercase continuation after the chord).
 *
 * Sheets with only one chord per song line produce no such evidence; they
 * fall back to chords-over-words, which converts them identically.
 */
export function looksLikeStackedChords(text: string): boolean {
  const lines = splitLines(text);
  if (hasChordProMarkup(lines)) return false;

  let transitions = 0;
  let evidence = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isChordLine(line)) {
      if (tokenize(line).length !== 1 || /^\s/.test(line)) return false;
      continue;
    }
    if (line === '' || !isChordLine(lines[i + 1] ?? '')) continue;

    // Text directly followed by a chord: a new lyric line or a mid-line chord change
    transitions++;
    if (/\s$/.test(line) || /^[a-z]/.test(lines[i + 2] ?? '')) evidence++;
  }
  return evidence >= STACKED_MIN_EVIDENCE && evidence * 2 >= transitions;
}

/** Convert a pasted stacked chord sheet into ChordPro, one song line per block */
export function stackedChordsToChordPro(text: string): string {
  const lines = splitLines(text);
  const out: string[] = [];
  let openKind: string | null = null;
  let current = '';
  let hasContent = false;
  let expectText = false;

  const flushLine = () => {
    if (hasContent && current.trim() !== '') out.push(current.trim());
    current = '';
    hasContent = false;
    expectText = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Only truly empty lines end a song line; " " is a fragment
    if (line === '') {
      flushLine();
      // No blank line directly after a section start
      if (!out[out.length - 1]?.startsWith('{start_of_')) out.push('');
      continue;
    }

    // The line after a chord is always its text fragment, even if it looks like a chord
    if (expectText) {
      current += line;
      expectText = false;
      continue;
    }

    // A header is never a chord's fragment (handled above), so it always
    // starts its own section, also directly above chords or inside a block
    const header = parseSectionHeader(line);
    if (header) {
      flushLine();
      if (openKind) appendSectionEnd(out, openKind);
      openKind = sectionKindFromLabel(header) ?? 'part';
      out.push(`{start_of_${openKind}: ${header}}`);
      continue;
    }

    if (isChordLine(line)) {
      current += `[${normalizeChord(line.trim())}]`;
      expectText = true;
    } else {
      current += line;
    }
    hasContent = true;
  }
  flushLine();
  if (openKind) appendSectionEnd(out, openKind);

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// --- Paste format dispatch ---

export type PastedSheetFormat = 'stacked' | 'chordsOverWords';

export const PASTED_SHEET_FORMAT_LABELS: Record<PastedSheetFormat, string> = {
  stacked: 'stacked chords',
  chordsOverWords: 'chords-over-words',
};

/** Detect a convertible plain-text sheet; stacked is checked first since it also has chord lines */
export function detectPastedSheetFormat(text: string): PastedSheetFormat | null {
  if (looksLikeStackedChords(text)) return 'stacked';
  if (looksLikeChordsOverWords(text)) return 'chordsOverWords';
  return null;
}

/** Convert pasted or imported text to ChordPro; format is null if it was left unchanged */
export function convertPastedSheet(text: string): { text: string; format: PastedSheetFormat | null } {
  const format = detectPastedSheetFormat(text);
  if (format === 'stacked') return { text: stackedChordsToChordPro(text), format };
  if (format === 'chordsOverWords') return { text: chordsOverWordsToChordPro(text), format };
  return { text, format: null };
}