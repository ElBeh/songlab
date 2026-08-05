// Core data types shared across the entire app

export type SectionType =
  | 'intro'
  | 'verse'
  | 'pre-chorus'
  | 'chorus'
  | 'bridge'
  | 'solo'
  | 'interlude'
  | 'outro'
  | 'custom';

export interface SectionMarker {
  id: string;           // uuid
  songId: string;
  type: SectionType;
  label: string;        // display name, e.g. "Chorus 1"
  startTime: number;    // seconds
  color: string;        // hex color per section type
}

export interface SongData {
  id: string;
  title: string;
  fileName: string;
  fileSize: number;
  duration: number;
  createdAt: number;
  volume: number;           // 0–1, default 1.0
  normalizationGain: number; // RMS-based gain factor, default 1.0
  normalizationEnabled: boolean;
  isDummy: boolean;           // true = no audio file, simulated playback
  gpFileName: string | null;           // Guitar Pro file name, null if none
  syncPoints: SyncPoint[] | null;      // audio ↔ notation sync points
  syncOffset: number | null;  // ms offset: audio time where bar 1 beat 1 starts
  bpmAdjust: number | null;  // additive BPM correction (e.g. -0.2)
  bpm: number | null;        // song tempo in BPM, null = unknown (disables count-in)
  timeSignature: [number, number] | null; // e.g. [4, 4], null defaults to 4/4 in UI
}

export interface LoopRange {
  start: number; // seconds
  end: number;   // seconds
  label?: string; // e.g. section name for display
}

export type TabSheetType = 'Guitar' | 'Bass' | 'Keys' | 'Vocals' | 'Drums' | 'Other';

export interface TabSheet {
  id: string;
  songId: string;
  name: string;
  type: TabSheetType;
  order: number;
}

export interface SectionTab {
  id: string;
  songId: string;
  markerId: string;
  sheetId: string;  // new – links to TabSheet
  content: string;
  updatedAt: number;
}

export interface SetlistPause {
  type: 'pause';
  id: string;
  duration: number;   // seconds
  label?: string;
}

export interface SetlistSong {
  type: 'song';
  songId: string;
}

export type SetlistItem = SetlistSong | SetlistPause;

export interface Setlist {
  id: string;
  name: string;
  items: SetlistItem[];
  isDefault: boolean;
  createdAt: number;
}

export interface SyncPoint {
  audioTime: number;  // milliseconds in the audio file
  tick: number;       // alphaTab tick position in the notation
  bar: number;        // 1-based bar number (for display in SyncPointEditor)
}

/** A tempo segment derived from a GP file's masterBars (tick + bpm only). */
export interface TempoSegment {
  startTick: number;
  bpm: number;
}

/**
 * One bar of the musical timeline with absolute timing.
 * Song time is measured in seconds from bar 1 beat 1 (not from audio t=0).
 */
export interface TimelineBar {
  /** Bar index in the score (0-based) */
  index: number;
  /** Absolute alphaTab tick of the bar start */
  startTick: number;
  /** Song time of the bar start in seconds */
  startTime: number;
  /** Tempo in quarter notes per minute */
  bpm: number;
  /** Time signature numerator (beats per full bar) */
  beatsPerBar: number;
  /** Time signature denominator (4 = quarter, 8 = eighth) */
  denominator: number;
  /** Duration of one beat in seconds (denominator aware) */
  secondsPerBeat: number;
  /** Beats actually contained in this bar (smaller than beatsPerBar for a pickup bar) */
  beatCount: number;
  /** Accent index of this bar's first beat (non-zero for a pickup bar) */
  firstBeatIndex: number;
}

/** A single beat position inside a timeline. */
export interface BeatPosition {
  /** Bar index; may exceed the timeline length (extrapolated bars) */
  barIndex: number;
  /** 0-based beat index inside that bar */
  beatInBar: number;
}