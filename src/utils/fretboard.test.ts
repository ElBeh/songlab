import { describe, it, expect } from 'vitest';
import {
  voicingToNotes,
  identifyChord,
  isSameTuning,
  absoluteFret,
  positionsFromAbsolute,
  isSameVoicing,
  formatChordName,
  STANDARD_TUNING,
} from './fretboard';

describe('fretboard', () => {
  it('converts relative frets to absolute ones', () => {
    expect(absoluteFret(1, 5)).toBe(5);
    expect(absoluteFret(0, 5)).toBe(0);
  });

  it('lists the sounding notes from low to high, skipping muted strings', () => {
    expect(voicingToNotes({ frets: [null, 3, 2, 0, 1, 0], baseFret: 1 })).toEqual(['C3', 'E3', 'G3', 'C4', 'E4']);
  });

  it('respects the base fret', () => {
    // A-shape barre at the 5th fret: D major
    expect(voicingToNotes({ frets: [null, 1, 3, 3, 3, 1], baseFret: 5 })).toEqual(['D3', 'A3', 'D4', 'F#4', 'A4']);
  });

  it('uses the given tuning', () => {
    const dropD = ['D2', 'A2', 'D3', 'G3', 'B3', 'E4'];
    expect(voicingToNotes({ frets: [0, null, null, null, null, null], baseFret: 1 }, dropD)).toEqual(['D2']);
  });

  it('identifies chords from a voicing', () => {
    expect(identifyChord({ frets: [null, 0, 2, 2, 1, 0], baseFret: 1 })[0]).toBe('Am');
    expect(identifyChord({ frets: [0, 2, 2, 0, 3, 0], baseFret: 1 })).toContain('Em7');
    expect(identifyChord({ frets: [null, null, null, null, null, null], baseFret: 1 })).toEqual([]);
  });

  it('compares tunings by pitch', () => {
    expect(isSameTuning(STANDARD_TUNING, ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'])).toBe(true);
    expect(isSameTuning(STANDARD_TUNING, ['Fb2', 'A2', 'D3', 'G3', 'B3', 'E4'])).toBe(true);
    expect(isSameTuning(STANDARD_TUNING, ['D2', 'A2', 'D3', 'G3', 'B3', 'E4'])).toBe(false);
  });

  it('keeps baseFret 1 for shapes within the first four frets', () => {
    expect(positionsFromAbsolute([null, 3, 2, 0, 1, 0])).toEqual({ frets: [null, 3, 2, 0, 1, 0], baseFret: 1 });
    expect(positionsFromAbsolute([null, null, null, null, null, null])).toEqual({
      frets: [null, null, null, null, null, null],
      baseFret: 1,
    });
  });

  it('starts higher shapes at their lowest fretted note, open strings stay open', () => {
    // A-shape barre at the 5th fret
    expect(positionsFromAbsolute([null, 5, 7, 7, 7, 5])).toEqual({ frets: [null, 1, 3, 3, 3, 1], baseFret: 5 });
    expect(positionsFromAbsolute([0, 7, 9, null, null, 0])).toEqual({ frets: [0, 1, 3, null, null, 0], baseFret: 7 });
  });

  it('compares voicings by absolute frets', () => {
    const relative = { frets: [null, 1, 3, 3, 3, 1], baseFret: 5 };
    expect(isSameVoicing(relative, { frets: [null, 5, 7, 7, 7, 5], baseFret: 1 })).toBe(true);
    expect(isSameVoicing(relative, { frets: [5, 5, 7, 7, 7, 5], baseFret: 1 })).toBe(false);
    expect(isSameVoicing({ frets: [0, 2], baseFret: 1 }, { frets: [0, 1], baseFret: 2 })).toBe(true);
    expect(isSameVoicing({ frets: [0, 2], baseFret: 1 }, { frets: [0, 2, 2], baseFret: 1 })).toBe(false);
  });

  it('spells tonal major chords the chart way', () => {
    expect(formatChordName('CM')).toBe('C');
    expect(formatChordName('F#M/A#')).toBe('F#/A#');
    expect(formatChordName('CMadd9')).toBe('Cadd9');
    expect(formatChordName('BbM7')).toBe('Bbmaj7');
    expect(formatChordName('Cmaj7')).toBe('Cmaj7');
    expect(formatChordName('Am7/C')).toBe('Am7/C');
    expect(formatChordName('E5')).toBe('E5');
  });

  it('yields chart names for identified voicings', () => {
    expect(formatChordName(identifyChord({ frets: [null, 3, 2, 0, 1, 0], baseFret: 1 })[0])).toBe('C');
  });
});