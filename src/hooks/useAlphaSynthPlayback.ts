import { useState, useCallback, useRef, useEffect } from 'react';
import type { AlphaTabApi } from '@coderline/alphatab';
import { synth } from '@coderline/alphatab';
import { useLoopStore } from '../stores/useLoopStore';
import { useTempoStore } from '../stores/useTempoStore';

interface UseAlphaSynthPlaybackOptions {
  /** Called on every position update with current time in seconds */
  onTimeUpdate?: (time: number) => void;
  /** Called when playback reaches the end (and song loop is off) */
  onFinish?: () => void;
  /** Called on song loop restart instead of auto-play (e.g. for count-in) */
  onLoopRestart?: () => void;
}

/**
 * Playback hook for Dummy + GP songs using alphaSynth (MIDI synthesis).
 * Return shape mirrors usePlayback / useDummyPlayback so AppShell can
 * switch between the three playback paths seamlessly.
 *
 * The AlphaTabApi instance is provided externally via setApi() – called
 * by NotationPanel once the API is ready for playback.
 */
export function useAlphaSynthPlayback({
  onTimeUpdate,
  onFinish,
  onLoopRestart,
}: UseAlphaSynthPlaybackOptions = {}) {
  const apiRef = useRef<AlphaTabApi | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentTick, setCurrentTick] = useState(0);
  const [duration, setDuration] = useState(0);
  const [songLoop, setSongLoop] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Refs for values needed inside event callbacks (avoids stale closures)
  const songLoopRef = useRef(songLoop);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onFinishRef = useRef(onFinish);
  const onLoopRestartRef = useRef(onLoopRestart);

  useEffect(() => { songLoopRef.current = songLoop; }, [songLoop]);
  useEffect(() => { onTimeUpdateRef.current = onTimeUpdate; }, [onTimeUpdate]);
  useEffect(() => { onFinishRef.current = onFinish; }, [onFinish]);
  useEffect(() => { onLoopRestartRef.current = onLoopRestart; }, [onLoopRestart]);

  // --- Sync playbackSpeed with tempo store ---
  const playbackRate = useTempoStore((s) => s.playbackRate);
  useEffect(() => {
    const api = apiRef.current;
    if (api && isReady) {
      api.playbackSpeed = playbackRate;
    }
  }, [playbackRate, isReady]);

  // --- Event handlers (stable refs, wired in setApi) ---

  const handlePositionChanged = useCallback((e: synth.PositionChangedEventArgs) => {
    const timeSec = e.currentTime / 1000;
    const endSec = e.endTime / 1000;

    setCurrentTime(timeSec);
    setCurrentTick(e.currentTick);
    if (endSec > 0) setDuration(endSec);
    onTimeUpdateRef.current?.(timeSec);
  }, []);

  const handlePlayerFinished = useCallback(() => {
    if (songLoopRef.current) {
      const { incrementLoopCount, loopTarget } = useLoopStore.getState();
      incrementLoopCount();
      const newCount = useLoopStore.getState().loopCount;

      if (loopTarget !== null && newCount >= loopTarget) {
        setSongLoop(false);
        songLoopRef.current = false;
        useLoopStore.getState().resetLoopCount();
        setIsPlaying(false);
        onFinishRef.current?.();
        return;
      }

      // Restart from beginning
      const api = apiRef.current;
      if (api) {
        api.timePosition = 0;
        if (onLoopRestartRef.current) {
          // Pause and let caller handle restart (e.g. count-in)
          api.pause();
          setIsPlaying(false);
          onLoopRestartRef.current();
        } else {
          api.play();
        }
      }
    } else {
      setIsPlaying(false);
      onFinishRef.current?.();
    }
  }, []);

  const handleStateChanged = useCallback(
    (e: { state: synth.PlayerState }) => {
      setIsPlaying(e.state === synth.PlayerState.Playing);
    },
    [],
  );

  // --- Provide the AlphaTabApi instance from NotationPanel ---
  const setApi = useCallback(
    (api: AlphaTabApi | null) => {
      // Detach previous listeners
      const prev = apiRef.current;
      if (prev) {
        prev.playerPositionChanged.off(handlePositionChanged);
        prev.playerFinished.off(handlePlayerFinished);
        prev.playerStateChanged.off(handleStateChanged);
      }

      apiRef.current = api;

      if (!api) {
        setIsReady(false);
        return;
      }

      // Attach listeners
      api.playerPositionChanged.on(handlePositionChanged);
      api.playerFinished.on(handlePlayerFinished);
      api.playerStateChanged.on(handleStateChanged);

      // If already ready (score + soundfont loaded), mark immediately
      if (api.isReadyForPlayback) {
        setIsReady(true);
        api.countInVolume = 0;
        api.metronomeVolume = 0;
        api.playbackSpeed = useTempoStore.getState().playbackRate;
      }

      // Also listen for the playerReady event (fires after soundfont load)
      api.playerReady.on(() => {
        setIsReady(true);
        api.countInVolume = 0;
        api.metronomeVolume = 0;
        api.playbackSpeed = useTempoStore.getState().playbackRate;
      });

      // Capture duration from midiLoaded if available
      api.midiLoaded.on((e: synth.PositionChangedEventArgs) => {
        const endSec = e.endTime / 1000;
        if (endSec > 0) setDuration(endSec);
      });
    },
    [handlePositionChanged, handlePlayerFinished, handleStateChanged],
  );

  // --- Transport controls ---

  const handlePlayPause = useCallback(() => {
    const api = apiRef.current;
    if (!api || !isReady) return;
    api.playPause();
  }, [isReady]);

  const handleSeekTo = useCallback(
    (time: number) => {
      const api = apiRef.current;
      if (!api || !isReady) return;
      const ms = Math.max(0, time * 1000);
      api.timePosition = ms;
      setCurrentTime(time);
      onTimeUpdate?.(time);
    },
    [isReady, onTimeUpdate],
  );

  const handleReset = useCallback(() => {
    const api = apiRef.current;
    if (!api || !isReady) return;
    api.timePosition = 0;
    setCurrentTime(0);
    onTimeUpdate?.(0);
  }, [isReady, onTimeUpdate]);

  const toggleSongLoop = useCallback(() => {
    setSongLoop((v) => !v);
    useLoopStore.getState().resetLoopCount();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const api = apiRef.current;
      if (api) {
        api.playerPositionChanged.off(handlePositionChanged);
        api.playerFinished.off(handlePlayerFinished);
        api.playerStateChanged.off(handleStateChanged);
      }
    };
  }, [handlePositionChanged, handlePlayerFinished, handleStateChanged]);

  return {
    isPlaying,
    currentTime,
    currentTick,
    duration,
    songLoop,
    isReady,
    handlePlayPause,
    handleSeekTo,
    handleReset,
    toggleSongLoop,
    setIsPlaying,
    setCurrentTime,
    setApi,
  };
}