// Chord name -> guitar voicings, based on the chords-db data in src/data.
// Chord names are matched by their interval structure (via tonal), so aliases
// such as "Cmin", "Cm" and "C-" or "C#" and "Db" resolve to the same entry.

import { Chord, Note } from 'tonal';
import type { Chord as DiagramChord, Finger, Barre } from 'svguitar';
import type { ChordDefinition } from './chordSheetParser';
import { generateVoicings } from './voicingGenerator';
import { STANDARD_TUNING, isSameTuning, type Tuning } from './fretboard';
import { normalizeChord } from './chordSheetParser';

// --- Model ---

export interface ChordVoicing {
  /** Per string from low E to high e; null = muted, 0 = open, n = fret relative to baseFret */
  frets: (number | null)[];
  /** Per string finger numbers (0 = none) */
  fingers: number[];
  /** Fret number of the first diagram row (1 = nut) */
  baseFret: number;
  /** Relative frets that are played as a barre */
  barres: number[];
  /** Origin: chord database, computed by the generator, or a {define} directive */
  source: 'database' | 'generated' | 'custom';
}

interface DbPosition {
  frets: number[];
  fingers: number[];
  baseFret: number;
  barres: number[];
  capo?: boolean;
}

interface DbChord {
  key: string;
  suffix: string;
  positions: DbPosition[];
}

export interface ChordDb {
  chords: Record<string, DbChord[]>;
}

// --- Data loading ---

let dbPromise: Promise<ChordDb> | null = null;

/**
 * Load the guitar chord database. The JSON (~190 kB) is a separate chunk,
 * fetched on first use only; the promise is cached for later calls.
 */
export function loadGuitarChordDb(): Promise<ChordDb> {
  dbPromise ??= import('../data/guitarChords.json').then((mod) => mod.default as ChordDb);
  return dbPromise;
}

// --- Name matching ---

const ROOT_RE = /^([A-G][#b]?)(.*)$/;

/** chords-db stores the special suffixes "major" and "minor" as words */
function dbSuffixToSymbol(suffix: string): string {
  if (suffix === 'major') return '';
  if (suffix === 'minor') return 'm';
  return suffix;
}

/**
 * Tonic-independent key for a chord suffix: the interval structure if tonal
 * knows the chord, otherwise the cleaned suffix text itself.
 */
function suffixKey(suffix: string): string {
  const cleaned = suffix.replace(/[()]/g, '');
  const chord = Chord.get(`C${cleaned}`);
  return chord.empty ? `raw:${cleaned}` : chord.intervals.join(',');
}

/** Map of suffix key -> chords-db suffix, built once per database */
const suffixIndex = new WeakMap<ChordDb, Map<string, string>>();

function getSuffixIndex(db: ChordDb): Map<string, string> {
  let index = suffixIndex.get(db);
  if (!index) {
    index = new Map();
    for (const chord of db.chords.C ?? []) {
      if (chord.suffix.includes('/')) continue; // slash chords are matched separately
      const key = suffixKey(dbSuffixToSymbol(chord.suffix));
      if (!index.has(key)) index.set(key, chord.suffix);
    }
    suffixIndex.set(db, index);
  }
  return index;
}

/** chords-db key ("C", "Csharp", "Eb", ...) with the same pitch class as the note */
function dbKeyForNote(db: ChordDb, note: string): string | null {
  const chroma = Note.chroma(note);
  if (chroma === undefined || Number.isNaN(chroma)) return null;
  for (const key of Object.keys(db.chords)) {
    if (Note.chroma(key.replace('sharp', '#')) === chroma) return key;
  }
  return null;
}

function toVoicing(position: DbPosition): ChordVoicing {
  return {
    frets: position.frets.map((f) => (f < 0 ? null : f)),
    fingers: position.fingers,
    baseFret: position.baseFret,
    barres: position.barres,
    source: 'database',
  };
}

/** Slash chord entry such as "/E" or "m/C", matched by bass pitch class */
function findSlashChord(chords: DbChord[], isMinor: boolean, bass: string): DbChord | null {
  const bassChroma = Note.chroma(bass);
  return chords.find((c) => {
    const [quality, bassNote] = c.suffix.split('/');
    if (bassNote === undefined) return false;
    return (quality === 'm') === isMinor && Note.chroma(bassNote) === bassChroma;
  }) ?? null;
}

/**
 * Database voicings for a chord name, best first. Slash chords only match a
 * database entry with the same bass note. Unknown chords return [].
 */
export function findVoicings(db: ChordDb, chordName: string): ChordVoicing[] {
  const [main, bass] = normalizeChord(chordName).split('/');
  const match = main.match(ROOT_RE);
  if (!match) return [];
  const [, root, suffix] = match;

  const dbKey = dbKeyForNote(db, root);
  if (!dbKey) return [];
  const chords = db.chords[dbKey] ?? [];

  const typeKey = suffixKey(suffix);

  if (bass !== undefined) {
    if (Note.chroma(bass) === undefined) return [];
    const isMinor = typeKey === suffixKey('m');
    const isMajor = typeKey === suffixKey('');
    const slash = isMinor || isMajor ? findSlashChord(chords, isMinor, bass) : null;
    return slash ? slash.positions.map(toVoicing) : [];
  }

  const dbSuffix = getSuffixIndex(db).get(typeKey);
  const entry = dbSuffix ? chords.find((c) => c.suffix === dbSuffix) : undefined;
  return entry ? entry.positions.map(toVoicing) : [];
}

export interface ResolveOptions {
  /** Custom voicing from a {define} directive, shown first */
  definition?: ChordDefinition;
  /** Tuning of the instrument; the database only covers standard tuning */
  tuning?: Tuning;
}

/**
 * All voicings to offer for a chord, best first:
 * 1. a {define} voicing, 2. database entries, 3. generated voicings,
 * 4. as a last resort the database chord without its bass note.
 * With a non-standard tuning only the generator is used, because the database
 * shapes would sound wrong.
 */
export function resolveVoicings(
  db: ChordDb | null,
  chordName: string,
  options: ResolveOptions = {},
): ChordVoicing[] {
  const tuning = options.tuning ?? STANDARD_TUNING;
  const custom = options.definition ? [definitionToVoicing(options.definition)] : [];
  const useDatabase = db !== null && isSameTuning(tuning, STANDARD_TUNING);

  const fromDb = useDatabase ? findVoicings(db, chordName) : [];
  if (fromDb.length > 0) return [...custom, ...fromDb];

  const generated = generateVoicings(normalizeChord(chordName), tuning);
  if (generated.length > 0) return [...custom, ...generated];

  const withoutBass = useDatabase && chordName.includes('/')
    ? findVoicings(db, chordName.split('/')[0])
    : [];
  return [...custom, ...withoutBass];
}

/**
 * Convert a ChordPro {define} voicing into the common voicing shape.
 * ChordPro has no barre notation, so a barre is derived from the fingers:
 * the same finger on several strings at the same fret.
 */
export function definitionToVoicing(def: ChordDefinition): ChordVoicing {
  const fingers = def.fingers.length === def.frets.length ? def.fingers : def.frets.map(() => 0);

  const usage = new Map<string, number>();
  def.frets.forEach((fret, index) => {
    const finger = fingers[index];
    if (!fret || !finger) return;
    const key = `${finger}:${fret}`;
    usage.set(key, (usage.get(key) ?? 0) + 1);
  });
  const barres = [...usage.entries()]
    .filter(([, count]) => count > 1)
    .map(([key]) => Number(key.split(':')[1]));

  return {
    frets: def.frets,
    fingers,
    baseFret: def.baseFret,
    barres: [...new Set(barres)],
    source: 'custom',
  };
}

// --- Diagram conversion ---

/** Minimum number of frets shown in a diagram */
const MIN_DIAGRAM_FRETS = 4;

export interface DiagramData {
  chord: DiagramChord;
  /** Number of frets the diagram needs to show all fingers */
  frets: number;
}

/**
 * Convert a voicing into svguitar's chord shape. svguitar numbers strings
 * from high e (1) to low E (6), the voicing lists them low to high.
 * Fingers covered by a barre are omitted, the barre is drawn instead.
 */
export function toDiagramData(voicing: Omit<ChordVoicing, 'source'>): DiagramData {
  const count = voicing.frets.length;
  const toString = (index: number) => count - index;

  const barres: Barre[] = [];
  for (const fret of voicing.barres) {
    const first = voicing.frets.findIndex((f) => f === fret);
    const last = voicing.frets.findLastIndex((f) => f === fret);
    if (first === -1 || first === last) continue;
    barres.push({ fromString: toString(first), toString: toString(last), fret });
  }

  const isOnBarre = (index: number, fret: number) => barres.some(
    (b) => b.fret === fret && toString(index) <= b.fromString && toString(index) >= b.toString,
  );

  const fingers: Finger[] = [];
  voicing.frets.forEach((fret, index) => {
    if (fret === null) {
      fingers.push([toString(index), 'x']);
    } else if (fret === 0) {
      fingers.push([toString(index), 0]);
    } else if (!isOnBarre(index, fret)) {
      const finger = voicing.fingers[index];
      fingers.push(finger ? [toString(index), fret, String(finger)] : [toString(index), fret]);
    }
  });

  const maxFret = Math.max(0, ...voicing.frets.map((f) => f ?? 0));
  return {
    chord: { fingers, barres, position: voicing.baseFret },
    frets: Math.max(MIN_DIAGRAM_FRETS, maxFret),
  };
}