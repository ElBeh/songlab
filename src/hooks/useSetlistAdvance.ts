import { useState, useCallback, useRef, useEffect } from 'react';
import { useSongStore } from '../stores/useSongStore';
import { useModeStore } from '../stores/useModeStore';
import { useTabStore } from '../stores/useTabStore';

interface UseSetlistAdvanceOptions {
  /** Trigger playback of the new song after advancing */
  onPlay: () => void;
}

interface SetlistAdvanceResult {
  /** Call this when a song finishes (end of playback) */
  handleSongFinish: () => void;
  /** Whether a countdown to next song is active */
  isCountingDown: boolean;
  /** Remaining seconds in countdown */
  countdownRemaining: number;
  /** Skip countdown and advance immediately */
  skipCountdown: () => void;
}

/**
 * Handles auto-advancing to the next song in the setlist when in band mode.
 * Reads pause items from songOrder to determine wait time between songs.
 */
export function useSetlistAdvance({ onPlay }: UseSetlistAdvanceOptions): SetlistAdvanceResult {
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdownRemaining, setCountdownRemaining] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const mode = useModeStore((state) => state.mode);
  const autoAdvance = useModeStore((state) => state.autoAdvance);

  const clearCountdown = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsCountingDown(false);
    setCountdownRemaining(0);
  }, []);

  // Clean up on unmount
  useEffect(() => clearCountdown, [clearCountdown]);

  const loadSong = useCallback(async (songId: string) => {
    const { setActiveSongId } = useSongStore.getState();
    await setActiveSongId(songId);
    await useTabStore.getState().loadTabsForSong(songId);
    await useTabStore.getState().loadSheetsForSong(songId);
  }, []);

  /**
   * Find the next song in songOrder after the current one.
   * Returns { songId, pauseDuration } where pauseDuration is the sum of
   * consecutive pause items between the current song and the next.
   */
  const findNextSong = useCallback(() => {
    const { songOrder, activeSongId } = useSongStore.getState();
    if (!activeSongId) return null;

    // Find current song's index in songOrder
    const currentIdx = songOrder.findIndex(
      (item) => item.type === 'song' && item.songId === activeSongId,
    );
    if (currentIdx === -1) return null;

    // Walk forward: sum up pauses, find next song
    let pauseDuration = 0;
    for (let i = currentIdx + 1; i < songOrder.length; i++) {
      const item = songOrder[i];
      if (item.type === 'pause') {
        pauseDuration += item.duration;
      } else {
        return { songId: item.songId, pauseDuration };
      }
    }
    return null; // No more songs
  }, []);

  const startCountdownThenPlay = useCallback((seconds: number, songId: string) => {
    clearCountdown();

    if (seconds <= 0) {
      loadSong(songId).then(() => onPlay());
      return;
    }

    // Load the song immediately (so it's visible) but don't play yet
    loadSong(songId);

    setIsCountingDown(true);
    setCountdownRemaining(seconds);

    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const remaining = Math.max(0, seconds - elapsed);
      setCountdownRemaining(Math.ceil(remaining));

      if (remaining <= 0) {
        clearCountdown();
        onPlay();
      }
    }, 250);
  }, [clearCountdown, loadSong, onPlay]);

  const skipCountdown = useCallback(() => {
    clearCountdown();
    onPlay();
  }, [clearCountdown, onPlay]);

  const handleSongFinish = useCallback(() => {
    if (mode !== 'band') return;

    const next = findNextSong();
    if (!next) return; // Last song, nothing to do

    if (autoAdvance) {
      startCountdownThenPlay(next.pauseDuration, next.songId);
    } else {
      // Manual mode: load next song but don't play
      loadSong(next.songId);
    }
  }, [mode, autoAdvance, findNextSong, startCountdownThenPlay, loadSong]);

  return {
    handleSongFinish,
    isCountingDown,
    countdownRemaining,
    skipCountdown,
  };
}