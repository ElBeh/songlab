import { useState, useCallback, useRef, useEffect } from 'react';

interface UseDummyPlaybackOptions {
  duration: number;
  onTimeUpdate?: (time: number) => void;
  /** Called when playback reaches the end (and song loop is off) */
  onFinish?: () => void;
}

/**
 * Simulated playback for dummy songs (no audio file).
 * Uses requestAnimationFrame to advance a virtual playhead in real time.
 * Return shape mirrors usePlayback so AppShell can switch seamlessly.
 */
export function useDummyPlayback({ duration, onTimeUpdate, onFinish }: UseDummyPlaybackOptions) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [songLoop, setSongLoop] = useState(false);

  const isPlayingRef = useRef(isPlaying);
  const currentTimeRef = useRef(currentTime);
  const songLoopRef = useRef(songLoop);

  // Keep refs in sync with state
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
  useEffect(() => { songLoopRef.current = songLoop; }, [songLoop]);

  // rAF playback loop
  useEffect(() => {
    if (!isPlaying) return;

    let lastFrame = 0;
    let raf: number;

    const tick = (timestamp: number) => {
      if (!isPlayingRef.current) return;

      // First frame: reset if at the end
      if (lastFrame === 0) {
        lastFrame = timestamp;
        if (currentTimeRef.current >= duration) {
          currentTimeRef.current = 0;
          setCurrentTime(0);
          onTimeUpdate?.(0);
        }
        raf = requestAnimationFrame(tick);
        return;
      }

      const delta = (timestamp - lastFrame) / 1000;
      lastFrame = timestamp;

      const newTime = currentTimeRef.current + delta;

      if (newTime >= duration) {
        if (songLoopRef.current) {
          currentTimeRef.current = 0;
          setCurrentTime(0);
          onTimeUpdate?.(0);
        } else {
          currentTimeRef.current = duration;
          setCurrentTime(duration);
          onTimeUpdate?.(duration);
          setIsPlaying(false);
          onFinish?.();
          return;
        }
      } else {
        currentTimeRef.current = newTime;
        setCurrentTime(newTime);
        onTimeUpdate?.(newTime);
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, duration, onTimeUpdate, onFinish]);

  const handlePlayPause = useCallback(() => {
    setIsPlaying((v) => !v);
  }, []);

  const handleSeekTo = useCallback((time: number) => {
    const clamped = Math.max(0, Math.min(duration, time));
    currentTimeRef.current = clamped;
    setCurrentTime(clamped);
    onTimeUpdate?.(clamped);
  }, [duration, onTimeUpdate]);

  const handleReset = useCallback(() => {
    currentTimeRef.current = 0;
    setCurrentTime(0);
    onTimeUpdate?.(0);
  }, [onTimeUpdate]);

  const toggleSongLoop = useCallback(() => {
    setSongLoop((v) => !v);
  }, []);

  return {
    isPlaying,
    currentTime,
    duration,
    songLoop,
    handlePlayPause,
    handleSeekTo,
    handleReset,
    toggleSongLoop,
    setIsPlaying,
    setCurrentTime,
  };
}