import { describe, it, expect } from 'vitest';
import { songbookSectionsToMarks } from './songbookMarkerImport';
import { parseChordPro } from './chordSheetParser';

function marks(text: string, duration = 100) {
  return songbookSectionsToMarks(parseChordPro(text).sections, duration);
}

const SONG = `{start_of_part: Intro}
[G] [D]
{end_of_part}
{start_of_verse: Verse 1}
[G]One
[C]Two
[D]Three
{end_of_verse}
{start_of_chorus: Chorus}
[C]La
[G]La
{end_of_chorus}
{start_of_verse: Verse 2}
[G]Four
[C]Five
[D]Six
{end_of_verse}
{chorus}`;

describe('songbookSectionsToMarks', () => {
  it('creates one mark per occurrence and numbers repeated labels', () => {
    expect(marks(SONG).map((m) => m.name)).toEqual([
      'Intro', 'Verse 1', 'Chorus 1', 'Verse 2', 'Chorus 2',
    ]);
  });

  it('maps section types and colors', () => {
    const result = marks(SONG);
    expect(result.map((m) => m.type)).toEqual(['intro', 'verse', 'chorus', 'verse', 'chorus']);
    expect(result[2].color).toBe('#ef4444');
  });

  it('distributes start times by text length, starting at 0', () => {
    // Weights: Intro 1, Verse 3, Chorus 2, Verse 3, Chorus ref -> 2 (borrowed) = 11
    const times = marks(SONG, 110).map((m) => m.timeSeconds);
    expect(times).toEqual([0, 10, 40, 60, 90]);
  });

  it('numbers unnumbered duplicate blocks in song order', () => {
    const text = '[Verse]\n[G]a\n[Chorus]\n[C]b\n[Verse]\n[G]c\n[Chorus]\n[C]d';
    expect(marks(text).map((m) => m.name)).toEqual(['Verse 1', 'Chorus 1', 'Verse 2', 'Chorus 2']);
  });

  it('keeps labels that already carry a number', () => {
    const text = '{start_of_verse: Verse 1}\n[G]a\n{end_of_verse}\n{start_of_verse: Verse 2}\n[G]b\n{end_of_verse}';
    expect(marks(text).map((m) => m.name)).toEqual(['Verse 1', 'Verse 2']);
  });

  it('skips unlabeled content and tab blocks', () => {
    const text = '[G]Before any section\n{sot}\ne|--0--|\n{eot}\n[Chorus]\n[C]x';
    expect(marks(text).map((m) => m.name)).toEqual(['Chorus']);
  });

  it('uses the section kind for custom labels', () => {
    const text = '{start_of_chorus: Refrain A}\n[C]x\n{end_of_chorus}';
    expect(marks(text)[0].type).toBe('chorus');
  });

  it('returns an empty list without labeled sections', () => {
    expect(marks('[G]Just lyrics')).toEqual([]);
  });

  it('puts all marks at 0 for an unknown duration', () => {
    expect(marks(SONG, 0).every((m) => m.timeSeconds === 0)).toBe(true);
  });
});