import { useEffect, useRef } from 'react';
import { useSyncStore } from '../stores/useSyncStore';
import { useTempoStore } from '../stores/useTempoStore';
import { useModeStore } from '../stores/useModeStore';
import { emitPlaybackUpdate } from '../services/syncEmitter';
import type { PlaybackState } from '../../shared/syncProtocol';

const BROADCAST_INTERVAL_MS = 250;

interface UseSyncBroadcastOptions {
  isPlaying: boolean;
  currentTime: number;
  countdownRemaining: number | null;
  tickPosition: number | null;
  countInBeat: number | null;
}

/**
 * Periodically broadcasts playback state to all peers.
 * Only active when connected as host and playing.
 * Also emits on play/pause/seek events (state transitions).
 */
export function useSyncBroadcast({ isPlaying, currentTime, countdownRemaining, tickPosition, countInBeat }: UseSyncBroadcastOptions): void {
  const status = useSyncStore((s) => s.status);
  const role = useSyncStore((s) => s.role);
  const isHostConnected = status === 'connected' && role === 'host';

  const prevIsPlayingRef = useRef(isPlaying);
  const prevTimeRef = useRef(currentTime);
  const countdownRef = useRef(countdownRemaining);
  const tickRef = useRef(tickPosition);
  const countInBeatRef = useRef(countInBeat);

  useEffect(() => { countdownRef.current = countdownRemaining; }, [countdownRemaining]);
  useEffect(() => { tickRef.current = tickPosition; }, [tickPosition]);
  useEffect(() => { countInBeatRef.current = countInBeat; }, [countInBeat]);

  // --- Emit on state transitions (play/pause/seek) ---

  useEffect(() => {
    if (!isHostConnected) return;

    const playChanged = prevIsPlayingRef.current !== isPlaying;
    // Detect seek: large time jump while not playing, or jump backwards
    const timeDelta = Math.abs(currentTime - prevTimeRef.current);
    const seekDetected = timeDelta > 1 && !isPlaying;

    if (playChanged || seekDetected) {
      const state = buildPlaybackState(isPlaying, currentTime, countdownRef.current, tickRef.current, countInBeatRef.current);
      emitPlaybackUpdate(state);
    }

    prevIsPlayingRef.current = isPlaying;
    prevTimeRef.current = currentTime;
  }, [isPlaying, currentTime, isHostConnected]);

  // --- Broadcast countdown changes ---

  useEffect(() => {
    if (!isHostConnected) return;
    const state = buildPlaybackState(
      prevIsPlayingRef.current,
      prevTimeRef.current,
      countdownRemaining,
      tickRef.current,
      countInBeatRef.current,
    );
    emitPlaybackUpdate(state);
  }, [isHostConnected, countdownRemaining]);

  // --- Broadcast count-in beat changes ---

  useEffect(() => {
    if (!isHostConnected) return;
    const state = buildPlaybackState(
      prevIsPlayingRef.current,
      prevTimeRef.current,
      countdownRef.current,
      tickRef.current,
      countInBeat,
    );
    emitPlaybackUpdate(state);
  }, [isHostConnected, countInBeat]);

  // --- Periodic broadcast while playing ---

  useEffect(() => {
    if (!isHostConnected || !isPlaying) return;

    const interval = setInterval(() => {
      const state = buildPlaybackState(true, prevTimeRef.current, countdownRef.current, tickRef.current, countInBeatRef.current);
      emitPlaybackUpdate(state);
    }, BROADCAST_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isHostConnected, isPlaying]);
}

function buildPlaybackState(
  isPlaying: boolean,
  currentTime: number,
  countdownRemaining: number | null,
  tickPosition: number | null,
  countInBeat: number | null,
): PlaybackState {
  const { playbackRate, preservePitch } = useTempoStore.getState();
  const { autoAdvance } = useModeStore.getState();
  return {
    isPlaying,
    currentTime,
    playbackRate,
    preservePitch,
    timestamp: Date.now(),
    countdownRemaining,
    autoAdvance,
    tickPosition,
    countInBeat,
  };
}