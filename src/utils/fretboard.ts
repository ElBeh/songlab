// Fretboard model shared by the voicing generator and the planned fretboard
// editor (issue #5): tunings, fret positions -> notes, notes -> chord names.

import { Chord, Note } from 'tonal';

/** Open string notes with octave, from the lowest string to the highest */
export type Tuning = readonly string[];

export const STANDARD_TUNING: Tuning = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];

/**
 * Fret positions per string (low to high), shared shape of all voicings:
 * null = muted, 0 = open, n = fret relative to baseFret (1 = first row).
 */
export interface FretPositions {
  frets: (number | null)[];
  baseFret: number;
}

/** Absolute fret number of a relative position (open strings stay 0) */
export function absoluteFret(fret: number, baseFret: number): number {
  return fret === 0 ? 0 : fret + baseFret - 1;
}

/** MIDI numbers of the open strings; throws on an invalid tuning note */
export function tuningToMidi(tuning: Tuning): number[] {
  return tuning.map((note) => {
    const midi = Note.midi(note);
    if (midi === null) throw new Error(`Invalid tuning note: ${note}`);
    return midi;
  });
}

/** True if both tunings have the same open string pitches */
export function isSameTuning(a: Tuning, b: Tuning): boolean {
  if (a.length !== b.length) return false;
  const midiA = tuningToMidi(a);
  const midiB = tuningToMidi(b);
  return midiA.every((m, i) => m === midiB[i]);
}

/**
 * Sounding notes of a voicing from low to high string, e.g. ["G2", "B2", "D3"].
 * Muted strings are skipped.
 */
export function voicingToNotes(voicing: FretPositions, tuning: Tuning = STANDARD_TUNING): string[] {
  const open = tuningToMidi(tuning);
  const notes: string[] = [];
  voicing.frets.forEach((fret, i) => {
    if (fret === null || open[i] === undefined) return;
    // Sharps as on most guitar charts (F#, not Gb)
    notes.push(Note.fromMidiSharps(open[i] + absoluteFret(fret, voicing.baseFret)));
  });
  return notes;
}

/**
 * Chord names matching a voicing, best first (tonal's Chord.detect). The lowest
 * note is treated as bass, so inversions come back as slash chords.
 * Returns [] if tonal knows no chord for these notes.
 */
export function identifyChord(voicing: FretPositions, tuning: Tuning = STANDARD_TUNING): string[] {
  const pitchClasses = voicingToNotes(voicing, tuning).map((n) => Note.pitchClass(n));
  return pitchClasses.length > 0 ? Chord.detect(pitchClasses) : [];
}

/**
 * Voicing from absolute frets (null = muted, 0 = open), as clicked on the
 * fretboard. Shapes within the first four frets keep baseFret 1 (nut shown),
 * higher shapes start at their lowest fretted note.
 */
export function positionsFromAbsolute(frets: (number | null)[]): FretPositions {
  const fretted = frets.filter((f): f is number => f !== null && f > 0);
  const highest = Math.max(0, ...fretted);
  if (highest <= 4) return { frets: [...frets], baseFret: 1 };

  const baseFret = Math.min(...fretted);
  return {
    frets: frets.map((f) => (f === null || f === 0 ? f : f - baseFret + 1)),
    baseFret,
  };
}

/** True if both voicings are played the same way, regardless of their baseFret */
export function isSameVoicing(a: FretPositions, b: FretPositions): boolean {
  if (a.frets.length !== b.frets.length) return false;
  return a.frets.every((fret, i) => {
    const other = b.frets[i];
    if (fret === null || other === null) return fret === other;
    return absoluteFret(fret, a.baseFret) === absoluteFret(other, b.baseFret);
  });
}

/**
 * Chart spelling of a tonal chord name: tonal marks major chords with "M"
 * ("CM", "CMadd9", "CM/E"), charts omit it ("C", "Cadd9", "C/E").
 * "M" before a digit is a major seventh extension and becomes "maj".
 */
export function formatChordName(name: string): string {
  return name.replace(/^([A-G][#b]*)M(?!aj)(\d?)/, (_, root: string, digit: string) =>
    digit ? `${root}maj${digit}` : root,
  );
}