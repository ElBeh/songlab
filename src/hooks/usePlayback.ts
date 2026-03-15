import { useRef, useState, useCallback } from 'react';
import type WaveSurfer from 'wavesurfer.js';

interface UsePlaybackOptions {
  /** Called on every timeupdate with the current time in seconds */
  onTimeUpdate?: (time: number) => void;
}

export function usePlayback({ onTimeUpdate }: UsePlaybackOptions = {}) {
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
      wavesurferRef.current?.setTime(0);
      wavesurferRef.current?.play();
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  }, [songLoop]);

  const toggleSongLoop = useCallback(() => {
    setSongLoop((v) => !v);
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