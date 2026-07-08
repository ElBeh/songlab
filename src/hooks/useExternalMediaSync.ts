import { useEffect, useRef, useMemo } from 'react';
import type * as alphaTab from '@coderline/alphatab';
import type { TempoSegment } from '../types';
import { buildTempoSegments, elapsedMsToTick, tickToElapsedMs } from '../services/tempoMap';

// Re-exported so existing importers (NotationPanel) keep working.
export { tickToElapsedMs };
export type { TempoSegment };

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
  /** Optional callback fired with the computed tick on each position update */
  onTickUpdate?: (tick: number) => void;
}

/**
 * Adapter kept for NotationPanel: build the tempo map from the API's score.
 * The actual building and conversion logic lives in services/tempoMap.
 */
export function buildTempoMap(api: alphaTab.AlphaTabApi | null): TempoSegment[] {
  return buildTempoSegments(api?.score);
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
  onTickUpdate,
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

  const onTickUpdateRef = useRef(onTickUpdate);
  useEffect(() => {
    onTickUpdateRef.current = onTickUpdate;
  }, [onTickUpdate]);

  // Playback loop: push tick position every 50ms
  useEffect(() => {
    if (!api || !isPlaying || tempoMap.length === 0) return;

    const intervalId = setInterval(() => {
      const a = apiRef.current;
      if (!a) return;
      const elapsedMs = (currentTimeRef.current * 1000) - syncOffsetRef.current;
      const tick = elapsedMsToTick(elapsedMs, tempoMapRef.current);
      a.tickPosition = tick;
      onTickUpdateRef.current?.(tick);
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
    onTickUpdateRef.current?.(tick);
  }, [api, currentTime, isPlaying, syncOffset, tempoMap]);
}