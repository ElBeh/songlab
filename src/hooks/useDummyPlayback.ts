import { useState, useCallback, useRef, useEffect } from 'react';
import { useLoopStore } from '../stores/useLoopStore';

interface UseDummyPlaybackOptions {
  duration: number;
  onTimeUpdate?: (time: number) => void;
  /** Called when playback reaches the end (and song loop is off) */
  onFinish?: () => void;
  /** Called on song loop restart instead of auto-play (e.g. for count-in) */
  onLoopRestart?: () => void;
}

/**
 * Simulated playback for dummy songs (no audio file).
 * Uses requestAnimationFrame to advance a virtual playhead in real time.
 * Return shape mirrors usePlayback so AppShell can switch seamlessly.
 */
export function useDummyPlayback({ duration, onTimeUpdate, onFinish, onLoopRestart }: UseDummyPlaybackOptions) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [songLoop, setSongLoop] = useState(false);

  const isPlayingRef = useRef(isPlaying);
  const currentTimeRef = useRef(currentTime);
  const songLoopRef = useRef(songLoop);
  const onLoopRestartRef = useRef(onLoopRestart);
  // Callbacks live in refs so a new caller identity on every render does not
  // restart the rAF loop. Each restart drops one frame of elapsed time, which
  // made the playhead (and the metronome locked to it) run at roughly half speed.
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onFinishRef = useRef(onFinish);

  // Keep refs in sync with state
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
  useEffect(() => { songLoopRef.current = songLoop; }, [songLoop]);
  useEffect(() => { onLoopRestartRef.current = onLoopRestart; }, [onLoopRestart]);
  useEffect(() => { onTimeUpdateRef.current = onTimeUpdate; }, [onTimeUpdate]);
  useEffect(() => { onFinishRef.current = onFinish; }, [onFinish]);

  // rAF playback loop
  useEffect(() => {
    const onTimeUpdate = (time: number) => onTimeUpdateRef.current?.(time);
    const onFinish = () => onFinishRef.current?.();

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
          const { incrementLoopCount, loopTarget } = useLoopStore.getState();
          incrementLoopCount();
          // Read actual count after increment
          const newCount = useLoopStore.getState().loopCount;
          // Stop if target reached
          if (loopTarget !== null && newCount >= loopTarget) {
            songLoopRef.current = false;
            setSongLoop(false);
            useLoopStore.getState().resetLoopCount();
            currentTimeRef.current = duration;
            setCurrentTime(duration);
            onTimeUpdate?.(duration);
            setIsPlaying(false);
            onFinish?.();
            return;
          }
          currentTimeRef.current = 0;
          setCurrentTime(0);
          onTimeUpdate?.(0);
          if (onLoopRestartRef.current) {
            // Pause and let caller handle restart (e.g. count-in)
            setIsPlaying(false);
            onLoopRestartRef.current();
            return;
          }
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
  }, [isPlaying, duration]);

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
    useLoopStore.getState().resetLoopCount();
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