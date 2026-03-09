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
  id: string;           // uuid
  title: string;
  fileName: string;
  fileSize: number;     // bytes
  duration: number;     // seconds, filled after waveform loads
  createdAt: number;    // unix timestamp
}

export interface LoopRange {
  start: number; // seconds
  end: number;   // seconds
  label?: string; // e.g. section name for display
}

export interface SectionTab {
  id: string;       // same as markerId
  songId: string;
  markerId: string;
  content: string;  // ASCII tab content
  updatedAt: number;
}