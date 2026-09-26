import { describe, it, expect } from 'vitest';
import { Chord, Note } from 'tonal';
import { generateVoicings } from './voicingGenerator';
import { voicingToNotes } from './fretboard';
import type { ChordVoicing } from './chordLookup';

function frets(voicing: ChordVoicing | undefined) {
  return voicing?.frets ?? null;
}

/** Pitch classes (chroma) of the sounding notes */
function chromas(voicing: ChordVoicing): number[] {
  return voicingToNotes(voicing).map((n) => Note.chroma(n)!);
}

describe('generateVoicings', () => {
  it('finds the common open voicings of slash chords', () => {
    expect(frets(generateVoicings('G5/F#')[0])).toEqual([2, null, 0, 0, 3, 3]);
    expect(frets(generateVoicings('D/F#')[0])).toEqual([2, 0, 0, 2, 3, 2]);
    expect(frets(generateVoicings('G/B')[0])).toEqual([null, 2, 0, 0, 0, 3]);
    expect(frets(generateVoicings('Cmaj7/G')[0])).toEqual([3, 3, 2, 0, 0, 0]);
  });

  it.each(['G5/F#', 'Cmaj7/G', 'Am/G', 'E5', 'Dsus2/F#', 'F#m7b5', 'Bb', 'C♯m'.replace('♯', '#')])(
    'only uses chord tones with the bass lowest for %s',
    (name) => {
      const chord = Chord.get(name);
      const allowed = new Set(chord.notes.map((n) => Note.chroma(n)));
      const bass = Note.chroma(chord.bass || chord.tonic!);
      const voicings = generateVoicings(name);
      expect(voicings.length).toBeGreaterThan(0);
      for (const v of voicings) {
        const pcs = chromas(v);
        expect(pcs.every((pc) => allowed.has(pc))).toBe(true);
        expect(pcs[0]).toBe(bass);
      }
    },
  );

  it('keeps a foreign slash bass out of the upper voices', () => {
    for (const v of generateVoicings('G5/F#')) {
      expect(chromas(v).filter((pc) => pc === 6)).toHaveLength(1); // F# only once
    }
  });

  it('respects the playability limits', () => {
    for (const v of generateVoicings('Cmaj7/G', undefined, 10)) {
      const fretted = v.frets.filter((f): f is number => f !== null && f > 0);
      expect(fretted.length).toBeLessThanOrEqual(4);
      expect(Math.max(...fretted) - Math.min(...fretted)).toBeLessThanOrEqual(3);
      expect(v.frets.filter((f) => f !== null).length).toBeGreaterThanOrEqual(3);
    }
  });

  it('marks results as generated and numbers fingers', () => {
    const v = generateVoicings('G5/F#')[0];
    expect(v.source).toBe('generated');
    expect(v.fingers).toEqual([1, 0, 0, 0, 2, 3]);
  });

  it('uses a base fret for higher positions', () => {
    const high = generateVoicings('A5', undefined, 10).find((v) => v.baseFret > 1);
    expect(high).toBeDefined();
    expect(Math.min(...high!.frets.filter((f): f is number => f !== null && f > 0))).toBe(1);
  });

  it('adapts to the tuning', () => {
    const dropD = ['D2', 'A2', 'D3', 'G3', 'B3', 'E4'];
    expect(frets(generateVoicings('D', dropD)[0])?.[0]).toBe(0);
  });

  it('returns nothing for unknown chord names', () => {
    expect(generateVoicings('Hm')).toEqual([]);
    expect(generateVoicings('Cxyz')).toEqual([]);
  });
});