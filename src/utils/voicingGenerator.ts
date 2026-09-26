// Computes playable guitar voicings for chords the database does not know,
// e.g. "G5/F#" or "Cmaj7/G". Brute force over fret windows with pruning:
// per string only chord tones are candidates, so the search stays small.

import { Chord, Note } from 'tonal';
import { STANDARD_TUNING, tuningToMidi, type Tuning } from './fretboard';
import type { ChordVoicing } from './chordLookup';

/** Highest fret a window may start at */
const MAX_WINDOW_START = 12;
/** Open strings are combined with fretted notes only up to this window start */
const MAX_WINDOW_WITH_OPEN = 7;
/** Frets covered by one hand position (window start + 3) */
const WINDOW_SIZE = 4;
const MAX_FINGERS = 4;
const MIN_SOUNDING_STRINGS = 3;
/** Muted strings between sounding strings (e.g. the A string in 2x0033) */
const MAX_INNER_MUTES = 1;
const DEFAULT_LIMIT = 4;

interface ChordTones {
  /** Pitch classes (chroma 0-11) every voicing must contain */
  required: Set<number>;
  /** Pitch classes allowed at all */
  allowed: Set<number>;
  /** Pitch class of the lowest sounding note */
  bass: number;
  /** Slash bass that is no tone of the chord itself (F# in G5/F#): bass only */
  bassOnly: boolean;
}

/** Chord tones from tonal; the fifth is optional for chords with 4+ notes */
function chordTones(chordName: string): ChordTones | null {
  const cleaned = chordName.replace(/[()]/g, '');
  const chord = Chord.get(cleaned);
  if (chord.empty || !chord.tonic) return null;

  const chroma = (note: string) => Note.chroma(note) ?? -1;
  const allowed = new Set(chord.notes.map(chroma));
  const tonic = chroma(chord.tonic);
  const fifth = (tonic + 7) % 12;
  const required = new Set(allowed);
  // Four-note chords are often played without the fifth, unless it is the bass
  const bass = chroma(chord.bass || chord.tonic);
  if (chord.notes.length >= 4 && fifth !== bass) required.delete(fifth);

  const upper = Chord.get(cleaned.split('/')[0]);
  const bassOnly = chord.bass !== '' && !upper.notes.some((n) => chroma(n) === bass);
  return { required, allowed, bass, bassOnly };
}

/** Absolute frets per string, null = muted */
type Shape = (number | null)[];

/** Finger count: fretted notes (open and muted strings need no finger) */
function fingerCount(shape: Shape): number {
  return shape.filter((f) => f !== null && f > 0).length;
}

function isPlayable(shape: Shape, open: number[], tones: ChordTones): boolean {
  const sounding = shape.map((f, i) => (f === null ? null : open[i] + f));
  const played = sounding.filter((m): m is number => m !== null);
  if (played.length < MIN_SOUNDING_STRINGS) return false;
  if (fingerCount(shape) > MAX_FINGERS) return false;

  // Muted strings: any number on the bass side, at most one between sounding strings
  const first = shape.findIndex((f) => f !== null);
  const last = shape.findLastIndex((f) => f !== null);
  const innerMutes = shape.slice(first, last + 1).filter((f) => f === null).length;
  if (innerMutes > MAX_INNER_MUTES) return false;

  // Lowest sounding note must be the bass (strings are ordered low to high,
  // but in non-standard tunings a higher string may sound lower)
  if (Math.min(...played) % 12 !== tones.bass) return false;

  if (tones.bassOnly && played.filter((m) => m % 12 === tones.bass).length > 1) return false;

  const present = new Set(played.map((m) => m % 12));
  for (const pc of tones.required) {
    if (!present.has(pc)) return false;
  }
  return true;
}

/**
 * Lower is better. Open position (all frets <= 4) dominates, as it is what
 * songbook players expect; then many sounding strings, few fingers, few mutes.
 */
function cost(shape: Shape): number {
  const fretted = shape.filter((f): f is number => f !== null && f > 0);
  const sounding = shape.filter((f) => f !== null).length;
  const highest = fretted.length > 0 ? Math.max(...fretted) : 0;
  const first = shape.findIndex((f) => f !== null);
  const innerMutes = shape.slice(first).filter((f) => f === null).length;
  const position = highest > WINDOW_SIZE ? 100 + highest * 5 : highest * 3;
  return position + (shape.length - sounding) * 20 + fretted.length * 2 + innerMutes * 15;
}

/** Relative frets and finger numbers for the diagram */
function toVoicing(shape: Shape): ChordVoicing {
  const fretted = shape.filter((f): f is number => f !== null && f > 0);
  const highest = fretted.length > 0 ? Math.max(...fretted) : 0;
  const lowest = fretted.length > 0 ? Math.min(...fretted) : 1;
  const baseFret = highest <= WINDOW_SIZE ? 1 : lowest;

  // Fingers by fret, then from low to high string: 1 = index finger
  const order = shape
    .map((fret, string) => ({ fret, string }))
    .filter((p): p is { fret: number; string: number } => p.fret !== null && p.fret > 0)
    .sort((a, b) => a.fret - b.fret || a.string - b.string);
  const fingers = shape.map(() => 0);
  order.forEach((p, i) => { fingers[p.string] = i + 1; });

  return {
    frets: shape.map((f) => (f === null || f === 0 ? f : f - baseFret + 1)),
    fingers,
    baseFret,
    barres: [],
    source: 'generated',
  };
}

/**
 * Playable voicings for a chord name, best first. Every voicing contains only
 * chord tones and all required ones, has the bass note lowest (a slash bass
 * foreign to the chord appears only there), at most four
 * fretted notes within four frets and at most one muted string between
 * sounding strings. Barre chords are not generated. Returns [] for chord
 * names tonal does not understand.
 */
export function generateVoicings(
  chordName: string,
  tuning: Tuning = STANDARD_TUNING,
  limit: number = DEFAULT_LIMIT,
): ChordVoicing[] {
  const tones = chordTones(chordName);
  if (!tones) return [];
  const open = tuningToMidi(tuning);

  const found = new Map<string, Shape>();

  for (let start = 1; start <= MAX_WINDOW_START; start++) {
    // Per string: muted, open, or a fret in the window, only if it is a chord tone
    const options = open.map((openMidi) => {
      const frets: (number | null)[] = [null];
      const window = Array.from({ length: WINDOW_SIZE }, (_, k) => start + k);
      for (const fret of start <= MAX_WINDOW_WITH_OPEN ? [0, ...window] : window) {
        if (tones.allowed.has((openMidi + fret) % 12)) frets.push(fret);
      }
      return frets;
    });

    const shape: Shape = [];
    const search = (string: number) => {
      if (string === open.length) {
        if (isPlayable(shape, open, tones)) found.set(shape.join(','), [...shape]);
        return;
      }
      for (const fret of options[string]) {
        shape.push(fret);
        if (fingerCount(shape) <= MAX_FINGERS) search(string + 1);
        shape.pop();
      }
    };
    search(0);
  }

  return [...found.values()]
    .sort((a, b) => cost(a) - cost(b))
    .slice(0, limit)
    .map(toVoicing);
}