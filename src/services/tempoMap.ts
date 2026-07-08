// Single owner for tempo-map handling derived from Guitar Pro scores.
// Previously this logic was duplicated across useExternalMediaSync.ts and
// gpMarkerImport.ts; both now delegate here.
import type * as alphaTab from '@coderline/alphatab';
import type { TempoSegment } from '../types';

const TICKS_PER_BEAT = 960;

/**
 * Build a tempo map from an alphaTab score.
 * Only bars with explicit tempoAutomation start a new segment; all other
 * bars inherit the previous tempo. Falls back to the score tempo when no
 * automation exists.
 */
export function buildTempoSegments(score: alphaTab.model.Score | null | undefined): TempoSegment[] {
  if (!score) return [];

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
 * Convert elapsed time (ms since bar 1 beat 1) to an alphaTab tick.
 * Walks the segments accumulating ticks until the elapsed time is located.
 */
export function elapsedMsToTick(elapsedMs: number, tempoMap: TempoSegment[]): number {
  if (tempoMap.length === 0 || elapsedMs <= 0) return 0;

  let remaining = elapsedMs;

  for (let i = 0; i < tempoMap.length; i++) {
    const seg = tempoMap[i];
    const msPerTick = 60000 / (seg.bpm * TICKS_PER_BEAT);

    if (i < tempoMap.length - 1) {
      const nextSeg = tempoMap[i + 1];
      const segmentTicks = nextSeg.startTick - seg.startTick;
      const segmentMs = segmentTicks * msPerTick;

      if (remaining <= segmentMs) {
        return Math.round(seg.startTick + remaining / msPerTick);
      }
      remaining -= segmentMs;
    } else {
      // Last segment: extrapolate
      return Math.round(seg.startTick + remaining / msPerTick);
    }
  }

  return 0;
}

/**
 * Convert an alphaTab tick to elapsed time in ms (inverse of elapsedMsToTick).
 */
export function tickToElapsedMs(tick: number, tempoMap: TempoSegment[]): number {
  if (tempoMap.length === 0 || tick <= 0) return 0;

  let elapsedMs = 0;

  for (let i = 0; i < tempoMap.length; i++) {
    const seg = tempoMap[i];
    const msPerTick = 60000 / (seg.bpm * TICKS_PER_BEAT);

    if (i < tempoMap.length - 1) {
      const nextSeg = tempoMap[i + 1];
      if (tick < nextSeg.startTick) {
        elapsedMs += (tick - seg.startTick) * msPerTick;
        return elapsedMs;
      }
      elapsedMs += (nextSeg.startTick - seg.startTick) * msPerTick;
    } else {
      elapsedMs += (tick - seg.startTick) * msPerTick;
      return elapsedMs;
    }
  }

  return elapsedMs;
}

/** Convenience wrapper: tick to elapsed time in seconds. */
export function tickToSeconds(tick: number, tempoMap: TempoSegment[]): number {
  return tickToElapsedMs(tick, tempoMap) / 1000;
}
