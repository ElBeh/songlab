// Shared helpers for importing section markers from external sources
// (Guitar Pro rehearsal marks, songbook sections).

import type { SectionMarker, SectionType } from '../types';

/** Map common section names to SongLab section types. */
const SECTION_NAME_MAP: Record<string, SectionType> = {
  // English
  intro: 'intro',
  introduction: 'intro',
  verse: 'verse',
  'pre-chorus': 'pre-chorus',
  prechorus: 'pre-chorus',
  chorus: 'chorus',
  refrain: 'chorus',
  bridge: 'bridge',
  solo: 'solo',
  interlude: 'interlude',
  outro: 'outro',
  ending: 'outro',
  coda: 'outro',
  // German
  strophe: 'verse',
  refr: 'chorus',
  zwischenspiel: 'interlude',
};

/** Map a section name such as "Verse 1" or "Refrain" to a SectionType. */
export function mapSectionType(name: string): SectionType {
  const lower = name.toLowerCase().trim();

  // Exact match
  if (SECTION_NAME_MAP[lower]) return SECTION_NAME_MAP[lower];

  // Partial match: "Verse 1", "Chorus A", "Solo 2" etc.
  for (const [key, type] of Object.entries(SECTION_NAME_MAP)) {
    if (lower.startsWith(key)) return type;
  }

  return 'custom';
}

/** A section extracted from an import source, before conversion to SectionMarker. */
export interface ImportedMark {
  name: string;
  type: SectionType;
  color: string;
  timeSeconds: number;
}

/**
 * Convert imported marks to SongLab SectionMarkers.
 * The prefix keeps ids distinguishable by source (e.g. "gp", "sb").
 */
export function importedMarksToSectionMarkers(
  marks: ImportedMark[],
  songId: string,
  idPrefix: string,
): SectionMarker[] {
  return marks.map((mark, index) => ({
    id: `${idPrefix}-${songId}-${index}-${mark.timeSeconds.toFixed(3)}`,
    songId,
    type: mark.type,
    label: mark.name,
    startTime: mark.timeSeconds,
    color: mark.color,
  }));
}