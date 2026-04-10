// MIDI note number to note name mapping
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const note = NOTE_NAMES[midi % 12];
  return `${note}${octave}`;
}

export function midiToNoteNameShort(midi: number): string {
  return NOTE_NAMES[midi % 12];
}

// Known tuning presets: stringTuning arrays from high to low string
// (alphaTab's stringTuning order)
interface TuningPreset {
  name: string;
  // MIDI values high-to-low (as alphaTab delivers them)
  midi: number[];
}

const GUITAR_PRESETS: TuningPreset[] = [
  // 6-string guitar
  { name: 'Standard', midi: [64, 59, 55, 50, 45, 40] },
  { name: 'Drop D', midi: [64, 59, 55, 50, 45, 38] },
  { name: 'DADGAD', midi: [62, 57, 55, 50, 45, 38] },
  { name: 'Half Step Down', midi: [63, 58, 54, 49, 44, 39] },
  { name: 'Full Step Down', midi: [62, 57, 53, 48, 43, 38] },
  { name: 'Drop C', midi: [62, 57, 53, 48, 43, 36] },
  { name: 'Drop C#', midi: [63, 58, 54, 49, 44, 37] },
  { name: 'Open G', midi: [62, 59, 55, 50, 43, 38] },
  { name: 'Open D', midi: [62, 57, 54, 50, 45, 38] },
  { name: 'Open E', midi: [64, 59, 56, 52, 47, 40] },
  { name: 'Open A', midi: [64, 61, 57, 52, 45, 40] },
  { name: 'Open C', midi: [64, 60, 55, 48, 43, 36] },
  // 7-string guitar
  { name: 'Standard 7', midi: [64, 59, 55, 50, 45, 40, 35] },
  { name: 'Drop A 7', midi: [64, 59, 55, 50, 45, 40, 33] },
];

const BASS_PRESETS: TuningPreset[] = [
  // 4-string bass
  { name: 'Bass Standard', midi: [43, 38, 33, 28] },
  { name: 'Bass Drop D', midi: [43, 38, 33, 26] },
  { name: 'Bass Half Step Down', midi: [42, 37, 32, 27] },
  // 5-string bass
  { name: 'Bass Standard 5', midi: [43, 38, 33, 28, 23] },
  // 6-string bass
  { name: 'Bass Standard 6', midi: [48, 43, 38, 33, 28, 23] },
];

const ALL_PRESETS = [...GUITAR_PRESETS, ...BASS_PRESETS];

export interface TuningInfo {
  // Matched preset name or null
  presetName: string | null;
  // Note names from low to high (musician-friendly order: "E A D G B E")
  noteNames: string[];
  // Number of strings
  stringCount: number;
}

/**
 * Analyze a stringTuning array (MIDI values, high-to-low as from alphaTab)
 * and return a TuningInfo with preset name and note names.
 */
export function analyzeTuning(stringTuning: number[]): TuningInfo {
  if (stringTuning.length === 0) {
    return { presetName: null, noteNames: [], stringCount: 0 };
  }

  // Match against known presets
  const preset = ALL_PRESETS.find(
    (p) =>
      p.midi.length === stringTuning.length &&
      p.midi.every((v, i) => v === stringTuning[i]),
  );

  // Note names from low to high (reverse of alphaTab's high-to-low order)
  const noteNames = [...stringTuning].reverse().map(midiToNoteNameShort);

  return {
    presetName: preset?.name ?? null,
    noteNames,
    stringCount: stringTuning.length,
  };
}

/**
 * Format tuning for display.
 * Examples: "Standard (E A D G B E)", "Drop D (D A D G B E)", "D A D G A D"
 */
export function formatTuning(info: TuningInfo): string {
  if (info.stringCount === 0) return '';
  const notes = info.noteNames.join(' ');
  if (info.presetName) {
    return `${info.presetName} (${notes})`;
  }
  return notes;
}