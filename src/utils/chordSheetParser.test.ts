import { describe, it, expect } from 'vitest';
import {
  isChord,
  isChordLine,
  parseChordPro,
  looksLikeChordsOverWords,
  chordsOverWordsToChordPro,
} from './chordSheetParser';

describe('isChord', () => {
  it.each(['A', 'Am', 'C/G', 'D/F#', 'F#m7b5', 'Bbmaj7', 'Dsus4', 'Cadd9', 'E7#9', 'G6', 'Asus2', 'Cdim7', 'Eaug', 'Em7(b5)', 'A5'])(
    'accepts %s',
    (chord) => expect(isChord(chord)).toBe(true),
  );

  it.each(['Hello', 'am', 'H7', 'Chorus', 'N.C.', '|', 'Be'])(
    'rejects %s',
    (token) => expect(isChord(token)).toBe(false),
  );
});

describe('isChordLine', () => {
  it('detects chord rows including bar lines and no-chord markers', () => {
    expect(isChordLine('   Am      F   |  C  G')).toBe(true);
    expect(isChordLine('N.C.   Am')).toBe(true);
  });

  it('rejects lyric lines and rows without a real chord', () => {
    expect(isChordLine('Let it be, let it be')).toBe(false);
    expect(isChordLine('| / / / |')).toBe(false);
    expect(isChordLine('')).toBe(false);
  });
});

describe('parseChordPro', () => {
  const sheet = `{title: Let It Be}
{artist: The Beatles}
{key: C}
{capo: 2}

{start_of_verse: Verse 1}
When I find myself in [C]times of [G]trouble
[Am]Mother Mary [F]comes to me
{end_of_verse}

{start_of_chorus}
Let it [Am]be, let it [C/G]be
{end_of_chorus}

{c: Repeat twice}`;

  it('reads metadata', () => {
    const parsed = parseChordPro(sheet);
    expect(parsed).toMatchObject({ title: 'Let It Be', artist: 'The Beatles', key: 'C', capo: 2 });
  });

  it('builds labeled sections with default labels', () => {
    const labels = parseChordPro(sheet).sections.map((s) => [s.label, s.kind]);
    expect(labels).toEqual([['Verse 1', 'verse'], ['Chorus', 'chorus'], [null, null]]);
  });

  it('splits lyric lines into chord segments', () => {
    const line = parseChordPro(sheet).sections[0].lines[0];
    expect(line).toEqual({
      type: 'lyrics',
      segments: [
        { chord: null, lyric: 'When I find myself in ' },
        { chord: 'C', lyric: 'times of ' },
        { chord: 'G', lyric: 'trouble' },
      ],
    });
  });

  it('collects unique chords in order of first appearance', () => {
    expect(parseChordPro(sheet).chords).toEqual(['C', 'G', 'Am', 'F', 'C/G']);
  });

  it('keeps comments as comment lines', () => {
    const last = parseChordPro(sheet).sections[2];
    expect(last.lines).toEqual([{ type: 'comment', text: 'Repeat twice' }]);
  });

  it('supports short environment directives and chord-only lines', () => {
    const parsed = parseChordPro('{soc: Refrain}\n[G] [D] [Em]\n{eoc}');
    expect(parsed.sections[0].label).toBe('Refrain');
    expect(parsed.chords).toEqual(['G', 'D', 'Em']);
  });

  it('treats a lone bracketed section name as header', () => {
    const parsed = parseChordPro('[Chorus]\n[G]Hey');
    expect(parsed.sections[0]).toMatchObject({ label: 'Chorus', kind: 'chorus' });
  });

  it('keeps tab sections verbatim', () => {
    const parsed = parseChordPro('{sot}\ne|--0--|\nB|--1--|\n{eot}');
    expect(parsed.sections[0].lines).toEqual([
      { type: 'raw', text: 'e|--0--|' },
      { type: 'raw', text: 'B|--1--|' },
    ]);
    expect(parsed.chords).toEqual([]);
  });

  it('excludes chord-row tokens from the chord list', () => {
    expect(parseChordPro('[Am] [|] [N.C.] [F]').chords).toEqual(['Am', 'F']);
  });

  it('parses {define} voicings', () => {
    const parsed = parseChordPro('{define: Bm base-fret 2 frets x 1 3 3 2 1 fingers 0 1 3 4 2 1}');
    expect(parsed.definitions.Bm).toEqual({
      name: 'Bm', baseFret: 2, frets: [null, 1, 3, 3, 2, 1], fingers: [0, 1, 3, 4, 2, 1],
    });
  });

  it('turns {chorus} into a reference section', () => {
    const parsed = parseChordPro('{soc}\n[G]La\n{eoc}\n[C]Verse line\n{chorus}\n{chorus: Final chorus}');
    expect(parsed.sections.map((s) => [s.label, s.isReference ?? false])).toEqual([
      ['Chorus', false], [null, false], ['Chorus', true], ['Final chorus', true],
    ]);
  });

  it('ignores unknown directives', () => {
    expect(parseChordPro('{new_page}\n[C]Hi').chords).toEqual(['C']);
  });
});

describe('chords over words', () => {
  const pasted = `[Verse 1]
C                G
When I find myself in times of trouble
Am            F
Mother Mary comes to me

Chorus:
Am   C/G   F   C
Let it be, let it be
G  F  C`;

  it('is detected as chords-over-words, ChordPro is not', () => {
    expect(looksLikeChordsOverWords(pasted)).toBe(true);
    expect(looksLikeChordsOverWords('{title: X}\n[C]Hi')).toBe(false);
    expect(looksLikeChordsOverWords('just some text')).toBe(false);
  });

  it('converts to ChordPro with sections and chords at their columns', () => {
    expect(chordsOverWordsToChordPro(pasted)).toBe(`{start_of_verse: Verse 1}
[C]When I find mysel[G]f in times of trouble
[Am]Mother Mary co[F]mes to me
{end_of_verse}

{start_of_chorus: Chorus}
[Am]Let i[C/G]t be, [F]let [C]it be
[G]   [F]   [C]
{end_of_chorus}`);
  });

  it('round-trips through the parser', () => {
    const parsed = parseChordPro(chordsOverWordsToChordPro(pasted));
    expect(parsed.sections.map((s) => s.label)).toEqual(['Verse 1', 'Chorus']);
    expect(parsed.chords).toEqual(['C', 'G', 'Am', 'F', 'C/G']);
  });

  it('pads short lyric lines so trailing chords are kept', () => {
    expect(chordsOverWordsToChordPro('Am        F\nHey')).toBe('[Am]Hey       [F]');
  });

  it('wraps tab blocks', () => {
    const converted = chordsOverWordsToChordPro('e|--0--|\nB|--1--|\n\nC\nHi');
    expect(converted).toBe('{start_of_tab}\ne|--0--|\nB|--1--|\n{end_of_tab}\n\n[C]Hi');
  });

  it('does not treat lyric lines starting with a section word as headers', () => {
    const converted = chordsOverWordsToChordPro('C\nBreak my heart');
    expect(converted).toBe('[C]Break my heart');
  });
});

describe('unicode accidentals', () => {
  it('recognizes ♯ and ♭ as chords', () => {
    expect(isChord('C♯m')).toBe(true);
    expect(isChord('A♭')).toBe(true);
    expect(isChord('B♭maj7/F')).toBe(true);
    expect(isChordLine('E   C♯m   A♭   A')).toBe(true);
  });

  it('normalizes them to ASCII when parsing ChordPro', () => {
    const parsed = parseChordPro('[C♯m]Hey [A♭]you');
    expect(parsed.chords).toEqual(['C#m', 'Ab']);
    expect(parsed.sections[0].lines[0]).toEqual({
      type: 'lyrics',
      segments: [{ chord: 'C#m', lyric: 'Hey ' }, { chord: 'Ab', lyric: 'you' }],
    });
  });

  it('normalizes them to ASCII when converting chords over words', () => {
    expect(chordsOverWordsToChordPro('C♯m   A♭\nHello world')).toBe('[C#m]Hello [Ab]world');
  });
});