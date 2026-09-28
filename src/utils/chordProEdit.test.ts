import { describe, it, expect } from 'vitest';
import {
  applyEdit,
  insertChord,
  insertComment,
  insertDirectiveLine,
  nextSectionLabel,
  setMetaDirective,
  wrapInSection,
  type TextEdit,
} from './chordProEdit';
import { parseChordPro } from './chordSheetParser';

// "|" marks the cursor, two "|" mark a selection, in input and expected output
function select(marked: string): { text: string; start: number; end: number } {
  const start = marked.indexOf('|');
  const second = marked.indexOf('|', start + 1);
  const text = marked.replace(/\|/g, '');
  return { text, start, end: second === -1 ? start : second - 1 };
}

function show(text: string, edit: TextEdit): string {
  const result = applyEdit(text, edit);
  if (edit.selectionStart === edit.selectionEnd) {
    return `${result.slice(0, edit.selectionStart)}|${result.slice(edit.selectionStart)}`;
  }
  return `${result.slice(0, edit.selectionStart)}|${result.slice(edit.selectionStart, edit.selectionEnd)}|`
    + result.slice(edit.selectionEnd);
}

function wrap(marked: string, kind: string, label: string | null): string {
  const { text, start, end } = select(marked);
  return show(text, wrapInSection(text, start, end, kind, label));
}

describe('nextSectionLabel', () => {
  it('starts at 1 and continues after the highest number', () => {
    expect(nextSectionLabel('', 'Verse')).toBe('Verse 1');
    expect(nextSectionLabel('{start_of_verse: Verse 1}\n{end_of_verse}\n{start_of_verse: Verse 3}', 'Verse'))
      .toBe('Verse 4');
  });

  it('counts unnumbered labels and chorus references, ignores other bases', () => {
    const text = '{start_of_chorus: Chorus}\n{end_of_chorus}\n{chorus: Chorus 2}\n{start_of_part: Pre-Chorus 1}';
    expect(nextSectionLabel(text, 'Chorus')).toBe('Chorus 3');
    expect(nextSectionLabel(text, 'Pre-Chorus')).toBe('Pre-Chorus 2');
  });
});

describe('wrapInSection', () => {
  it('wraps the selected lines, extended to whole lines', () => {
    expect(wrap('Intro\n[G]I s|ee bad\n[D]moo|n rising\nEnd', 'verse', 'Verse 1'))
      .toBe('Intro\n{start_of_verse: Verse 1}\n|[G]I see bad\n[D]moon rising|\n{end_of_verse}\nEnd');
  });

  it('excludes a line that is only touched by a trailing newline', () => {
    expect(wrap('|a\nb\n|c', 'chorus', 'Chorus 1'))
      .toBe('{start_of_chorus: Chorus 1}\n|a\nb|\n{end_of_chorus}\nc');
  });

  it('inserts an empty section below a non-empty cursor line', () => {
    expect(wrap('a|bc\nnext', 'bridge', 'Bridge 1'))
      .toBe('abc\n{start_of_bridge: Bridge 1}\n|\n{end_of_bridge}\nnext');
  });

  it('uses an empty cursor line and appends at the end of the text', () => {
    expect(wrap('a\n  |\nb', 'verse', 'Verse 2')).toBe('a\n{start_of_verse: Verse 2}\n|\n{end_of_verse}\nb');
    expect(wrap('last|', 'outro', 'Outro 1')).toBe('last\n{start_of_outro: Outro 1}\n|\n{end_of_outro}');
    expect(wrap('|', 'intro', 'Intro 1')).toBe('{start_of_intro: Intro 1}\n|\n{end_of_intro}');
  });

  it('omits the label for tab blocks', () => {
    // "|" is the cursor marker here, so the tab lines use no bar lines
    expect(wrap('|e--0--\nB--1--|', 'tab', null)).toBe('{start_of_tab}\n|e--0--\nB--1--|\n{end_of_tab}');
  });

  it('produces sections the parser reads', () => {
    const { text, start, end } = select('|[G]Line one\n[D]Line two|');
    const parsed = parseChordPro(applyEdit(text, wrapInSection(text, start, end, 'verse', 'Verse 1')));
    expect(parsed.sections.map((s) => [s.label, s.kind, s.lines.length])).toEqual([['Verse 1', 'verse', 2]]);
  });
});

describe('single-line directives', () => {
  it('inserts a chorus reference below the cursor line', () => {
    const { text, start } = select('[G]Hi|\n[D]There');
    expect(show(text, insertDirectiveLine(text, start, '{chorus: Chorus 1}')))
      .toBe('[G]Hi\n{chorus: Chorus 1}|\n[D]There');
  });

  it('turns a single-line selection into a comment, cursor before the brace', () => {
    const { text, start, end } = select('[G]Hi |softly|\nnext');
    expect(show(text, insertComment(text, start, end))).toBe('[G]Hi softly\n{comment: softly|}\nnext');
  });

  it('starts an empty comment for multi-line or no selection', () => {
    const { text, start, end } = select('|a\nb|');
    expect(show(text, insertComment(text, start, end))).toBe('a\n{comment: |}\nb');
  });
});

describe('setMetaDirective', () => {
  function meta(marked: string, name: 'title' | 'artist' | 'key' | 'capo', value: string): string | null {
    const { text, start, end } = select(marked);
    const edit = setMetaDirective(text, name, value, start, end);
    return edit && show(text, edit);
  }

  it('inserts at the top, in title/artist/key/capo order', () => {
    expect(meta('[G]H|i', 'title', 'Bad Moon')).toBe('{title: Bad Moon}\n[G]H|i');
    expect(meta('{title: X}\n{capo: 2}\n[G]H|i', 'key', 'D')).toBe('{title: X}\n{key: D}\n{capo: 2}\n[G]H|i');
    expect(meta('{key: D}\n|', 'capo', '3')).toBe('{key: D}\n{capo: 3}\n|');
  });

  it('replaces an existing line, also under an alias', () => {
    expect(meta('{t: Old}\n[G]H|i', 'title', 'New')).toBe('{title: New}\n[G]H|i');
    expect(meta('{subtitle: Old}\n|x', 'artist', ' CCR ')).toBe('{artist: CCR}\n|x');
  });

  it('removes the line for an empty value, and does nothing if there is none', () => {
    expect(meta('{title: X}\n{key: D}\n|x', 'key', '')).toBe('{title: X}\n|x');
    expect(meta('x\n{key: D}|', 'key', '')).toBe('x|');
    expect(meta('|x', 'key', '')).toBeNull();
  });
});

describe('insertChord', () => {
  it('replaces the selection and normalizes accidentals', () => {
    const { text, start, end } = select('I |see| bad');
    expect(show(text, insertChord(start, end, ' C♯m7 '))).toBe('I [C#m7]| bad');
  });
});