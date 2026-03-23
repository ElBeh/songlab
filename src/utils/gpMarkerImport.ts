import type * as alphaTab from '@coderline/alphatab';
import type { SectionMarker, SectionType } from '../types';
import { SECTION_COLORS } from './sectionColors';

const TICKS_PER_BEAT = 960;

/** Map common GP rehearsal mark names to SongLab section types. */
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

/** Try to map a rehearsal mark name to a SectionType. */
function mapSectionType(name: string): SectionType {
  const lower = name.toLowerCase().trim();

  // Exact match
  if (SECTION_NAME_MAP[lower]) return SECTION_NAME_MAP[lower];

  // Partial match: "Verse 1", "Chorus A", "Solo 2" etc.
  for (const [key, type] of Object.entries(SECTION_NAME_MAP)) {
    if (lower.startsWith(key)) return type;
  }

  return 'custom';
}

/** Tempo segment from alphaTab's masterBars. */
interface TempoSegment {
  startTick: number;
  bpm: number;
}

/** Build tempo map from score (same logic as useExternalMediaSync). */
function buildTempoMap(score: alphaTab.model.Score): TempoSegment[] {
  const segments: TempoSegment[] = [];

  for (const mb of score.masterBars) {
    if (mb.tempoAutomation) {
      segments.push({ startTick: mb.start, bpm: mb.tempoAutomation.value });
    }
  }

  if (segments.length === 0) {
    segments.push({ startTick: 0, bpm: score.tempo });
  }

  return segments;
}

/**
 * Convert alphaTab tick to time in seconds using the tempo map.
 * Inverse of elapsedMsToTick in useExternalMediaSync.
 */
function tickToSeconds(tick: number, tempoMap: TempoSegment[]): number {
  if (tempoMap.length === 0 || tick <= 0) return 0;

  let elapsedMs = 0;

  for (let i = 0; i < tempoMap.length; i++) {
    const seg = tempoMap[i];
    const msPerTick = 60000 / (seg.bpm * TICKS_PER_BEAT);

    if (i < tempoMap.length - 1) {
      const nextSeg = tempoMap[i + 1];
      const segmentTicks = nextSeg.startTick - seg.startTick;

      if (tick <= nextSeg.startTick) {
        // Target tick is within this segment
        elapsedMs += (tick - seg.startTick) * msPerTick;
        return elapsedMs / 1000;
      }

      elapsedMs += segmentTicks * msPerTick;
    } else {
      // Last segment: extrapolate
      elapsedMs += (tick - seg.startTick) * msPerTick;
      return elapsedMs / 1000;
    }
  }

  return 0;
}

/** A rehearsal mark extracted from the GP file, before conversion to SectionMarker. */
export interface GpRehearsalMark {
  name: string;
  type: SectionType;
  color: string;
  timeSeconds: number;
}

/**
 * Extract rehearsal marks from an alphaTab score.
 * Returns markers sorted by time, with SectionType and color mapped.
 *
 * @param score      alphaTab score object
 * @param syncOffset Audio offset in ms where bar 1 starts (0 for Dummy+GP)
 * @param bpmAdjust  Additive BPM correction (0 for no adjustment)
 */
export function extractGpMarkers(
  score: alphaTab.model.Score,
  syncOffset: number = 0,
  bpmAdjust: number = 0,
): GpRehearsalMark[] {
  const baseTempoMap = buildTempoMap(score);
  const tempoMap = bpmAdjust !== 0
    ? baseTempoMap.map((seg) => ({ ...seg, bpm: seg.bpm + bpmAdjust }))
    : baseTempoMap;

  const marks: GpRehearsalMark[] = [];

  for (const mb of score.masterBars) {
    if (mb.section) {
      const name = mb.section.text || mb.section.marker || '';
      if (!name.trim()) continue;

      const type = mapSectionType(name);
      const color = SECTION_COLORS[type];
      const tickTime = tickToSeconds(mb.start, tempoMap);
      const timeSeconds = tickTime + syncOffset / 1000;

      marks.push({ name: name.trim(), type, color, timeSeconds });
    }
  }

  return marks.sort((a, b) => a.timeSeconds - b.timeSeconds);
}

/**
 * Convert extracted GP markers to SongLab SectionMarkers.
 */
export function gpMarksToSectionMarkers(
  marks: GpRehearsalMark[],
  songId: string,
): SectionMarker[] {
  return marks.map((mark) => ({
    id: `gp-${songId}-${mark.timeSeconds.toFixed(3)}`,
    songId,
    type: mark.type,
    label: mark.name,
    startTime: mark.timeSeconds,
    color: mark.color,
  }));
}