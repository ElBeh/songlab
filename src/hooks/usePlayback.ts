import { useRef, useState, useCallback } from 'react';
import type WaveSurfer from 'wavesurfer.js';
import { useLoopStore } from '../stores/useLoopStore';

interface UsePlaybackOptions {
  /** Called on every timeupdate with the current time in seconds */
  onTimeUpdate?: (time: number) => void;
  /** Called when playback reaches the end (and song loop is off) */
  onFinish?: () => void;
  /** Called on song loop restart instead of auto-play (e.g. for count-in) */
  onLoopRestart?: () => void;
}

export function usePlayback({ onTimeUpdate, onFinish, onLoopRestart }: UsePlaybackOptions = {}) {
  const wavesurferRef = useRef<WaveSurfer | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [songLoop, setSongLoop] = useState(false);

  const handlePlayPause = useCallback(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    ws.playPause();
    setIsPlaying(ws.isPlaying());
  }, []);

  const handleSeekTo = useCallback((time: number) => {
    wavesurferRef.current?.setTime(time);
  }, []);

  const handleReset = useCallback(() => {
    wavesurferRef.current?.setTime(0);
    setCurrentTime(0);
  }, []);

  const handleReady = useCallback((d: number) => {
    setDuration(d);
  }, []);

  const handleTimeUpdate = useCallback((t: number) => {
    setCurrentTime(t);
    setIsPlaying(wavesurferRef.current?.isPlaying() ?? false);
    onTimeUpdate?.(t);
  }, [onTimeUpdate]);

  const handleFinish = useCallback(() => {
    if (songLoop) {
      const { incrementLoopCount, loopTarget } = useLoopStore.getState();
      incrementLoopCount();
      // Read actual count after increment
      const newCount = useLoopStore.getState().loopCount;
      // Stop if target reached
      if (loopTarget !== null && newCount >= loopTarget) {
        setSongLoop(false);
        useLoopStore.getState().resetLoopCount();
        setIsPlaying(false);
        onFinish?.();
        return;
      }
      wavesurferRef.current?.setTime(0);
      if (onLoopRestart) {
        // Pause and let caller handle restart (e.g. count-in)
        wavesurferRef.current?.pause();
        setIsPlaying(false);
        onLoopRestart();
      } else {
        wavesurferRef.current?.play();
        setIsPlaying(true);
      }
    } else {
      setIsPlaying(false);
      onFinish?.();
    }
  }, [songLoop, onFinish, onLoopRestart]);

  const toggleSongLoop = useCallback(() => {
    setSongLoop((v) => !v);
    useLoopStore.getState().resetLoopCount();
  }, []);

  return {
    wavesurferRef,
    isPlaying,
    currentTime,
    duration,
    songLoop,
    handlePlayPause,
    handleSeekTo,
    handleReset,
    handleReady,
    handleTimeUpdate,
    handleFinish,
    toggleSongLoop,
    setIsPlaying,
    setCurrentTime,
  };
}