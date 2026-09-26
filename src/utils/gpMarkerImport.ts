import type * as alphaTab from '@coderline/alphatab';
import { SECTION_COLORS } from './sectionColors';
import { mapSectionType, type ImportedMark } from './sectionImport';
import { buildTempoSegments, tickToSeconds } from '../services/tempoMap';

/** A rehearsal mark extracted from the GP file (shared import shape). */
export type GpRehearsalMark = ImportedMark;

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
  const baseTempoMap = buildTempoSegments(score);
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