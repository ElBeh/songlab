import { useEffect, useRef, useMemo } from 'react';
import type * as alphaTab from '@coderline/alphatab';

/** Tempo segment derived from alphaTab's masterBars. */
interface TempoSegment {
  startTick: number;
  bpm: number;
}

interface UseExternalMediaSyncOptions {
  /** alphaTab API instance (null when not in Audio+GP mode) */
  api: alphaTab.AlphaTabApi | null;
  /** Audio time offset in ms where bar 1 beat 1 starts in the audio */
  syncOffset: number;
  /** Additive BPM correction applied to all tempo segments (e.g. -0.2) */
  bpmAdjust: number;
  /** Whether audio is currently playing */
  isPlaying: boolean;
  /** Current audio position in seconds (from wavesurfer) */
  currentTime: number;
}

const TICKS_PER_BEAT = 960;

/**
 * Extract tempo map from alphaTab score.
 * Returns sorted segments with startTick and bpm.
 * Only bars with explicit tempoAutomation create new segments;
 * all other bars inherit the previous tempo.
 */
function buildTempoMap(api: alphaTab.AlphaTabApi | null): TempoSegment[] {
  if (!api?.score) return [];

  const segments: TempoSegment[] = [];

  for (const mb of api.score.masterBars) {
    if (mb.tempoAutomation) {
      segments.push({ startTick: mb.start, bpm: mb.tempoAutomation.value });
    }
  }

  // Fallback: if no tempo automation found, use score tempo
  if (segments.length === 0) {
    segments.push({ startTick: 0, bpm: api.score.tempo });
  }

  return segments;
}

/**
 * Convert elapsed audio time (ms since bar 1 beat 1) to alphaTab tick
 * using the tempo map from the GP file.
 *
 * Walks through tempo segments, accumulating time consumed by each,
 * until the elapsed time is located within a segment.
 */
function elapsedMsToTick(elapsedMs: number, tempoMap: TempoSegment[]): number {
  if (tempoMap.length === 0 || elapsedMs <= 0) return 0;

  let remaining = elapsedMs;

  for (let i = 0; i < tempoMap.length; i++) {
    const seg = tempoMap[i];
    const msPerTick = 60000 / (seg.bpm * TICKS_PER_BEAT);

    // Calculate how many ms this segment covers (until next segment)
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
 * Synchronizes the alphaTab notation cursor with wavesurfer playback
 * using a BPM-based offset approach.
 *
 * The user provides a single syncOffset (ms) indicating where bar 1 beat 1
 * starts in the audio. All tick positions are calculated mathematically
 * from the GP file's tempo map.
 *
 * During playback: pushes calculated tick position every 50ms.
 * When paused/seeking: updates cursor immediately on currentTime change.
 */
export function useExternalMediaSync({
  api,
  syncOffset,
  bpmAdjust,
  isPlaying,
  currentTime,
}: UseExternalMediaSyncOptions) {
  // Build base tempo map from GP file, then apply BPM adjustment
  const baseTempoMap = useMemo(() => buildTempoMap(api), [api]);
  const tempoMap = useMemo(
    () => baseTempoMap.map((seg) => ({ ...seg, bpm: seg.bpm + bpmAdjust })),
    [baseTempoMap, bpmAdjust],
  );

  // Keep refs for values accessed inside interval
  const apiRef = useRef(api);
  useEffect(() => {
    apiRef.current = api;
  }, [api]);

  const currentTimeRef = useRef(currentTime);
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  const syncOffsetRef = useRef(syncOffset);
  useEffect(() => {
    syncOffsetRef.current = syncOffset;
  }, [syncOffset]);

  const tempoMapRef = useRef(tempoMap);
  useEffect(() => {
    tempoMapRef.current = tempoMap;
  }, [tempoMap]);

  // Playback loop: push tick position every 50ms
  useEffect(() => {
    if (!api || !isPlaying || tempoMap.length === 0) return;

    const intervalId = setInterval(() => {
      const a = apiRef.current;
      if (!a) return;
      const elapsedMs = (currentTimeRef.current * 1000) - syncOffsetRef.current;
      const tick = elapsedMsToTick(elapsedMs, tempoMapRef.current);
      a.tickPosition = tick;
    }, 50);

    return () => clearInterval(intervalId);
  }, [api, isPlaying, tempoMap]);

  // Seek update: move cursor immediately when paused
  useEffect(() => {
    if (!api || tempoMap.length === 0) return;
    if (isPlaying) return;

    const a = apiRef.current;
    if (!a) return;
    const elapsedMs = (currentTime * 1000) - syncOffset;
    const tick = elapsedMsToTick(elapsedMs, tempoMap);
    a.tickPosition = tick;
  }, [api, currentTime, isPlaying, syncOffset, tempoMap]);
}