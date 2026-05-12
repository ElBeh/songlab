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