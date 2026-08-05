import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useMetronomeStore } from '../stores/useMetronomeStore';
import { useCountInStore } from '../stores/useCountInStore';
import { startMetronome, type MetronomeHandle } from '../services/metronomeScheduler';
import { buildFixedTimeline } from '../services/tempoMap';
import type { TimelineBar } from '../types';

interface UseMetronomeOptions {
  /** Whether a song is currently loaded */
  hasSong: boolean;
  /** Song BPM (null = no BPM set) */
  bpm: number | null;
  /** Song time signature (null defaults to [4, 4]) */
  timeSignature: [number, number] | null;
  /** Current playback rate from tempo store (0.5-1.5) */
  playbackRate: number;
  /** Whether song playback is currently active */
  isPlaying: boolean;
  /** Whether to produce audible clicks */
  audible?: boolean;
  /** Musical timeline from the GP score; falls back to bpm + time signature */
  timeline?: TimelineBar[];
  /** Current playback position in seconds, as reported by the active player */
  currentTime?: number;
  /**
   * Player time of bar 1 beat 1 in seconds. Zero when the player already
   * reports score time (alphaSynth); the song's sync offset otherwise.
   */
  songTimeOffset?: number;
}

export function useMetronome({
  hasSong,
  bpm,
  timeSignature,
  playbackRate,
  isPlaying,
  audible = true,
  timeline,
  currentTime = 0,
  songTimeOffset = 0,
}: UseMetronomeOptions) {
  const enabled = useMetronomeStore((s) => s.enabled);
  const isRunning = useMetronomeStore((s) => s.isRunning);
  const volume = useMetronomeStore((s) => s.volume);
  const soloBpm = useMetronomeStore((s) => s.soloBpm);
  const soloTimeSignature = useMetronomeStore((s) => s.soloTimeSignature);
  const isCountingIn = useCountInStore((s) => s.isCountingIn);

  const handleRef = useRef<MetronomeHandle | null>(null);
  // Marks whether the current handle was created by solo mode, so stopSolo()
  // can never tear down the song-mode metronome.
  const soloOwnedRef = useRef(false);
  const volumeRef = useRef(volume);
  useEffect(() => { volumeRef.current = volume; }, [volume]);

  const isSoloMode = !hasSong;

  // Destructured to primitives so a new array identity does not rebuild the
  // timeline on every render.
  const beatsPerBar = timeSignature?.[0] ?? 4;
  const denominator = timeSignature?.[1] ?? 4;

  const songTimeline = useMemo(() => {
    if (timeline && timeline.length > 0) return timeline;
    return buildFixedTimeline(bpm, [beatsPerBar, denominator]);
  }, [timeline, bpm, beatsPerBar, denominator]);

  const soloTimeline = useMemo(
    () => buildFixedTimeline(soloBpm, soloTimeSignature),
    [soloBpm, soloTimeSignature],
  );

  const songTime = currentTime - songTimeOffset;

  const songTimelineRef = useRef(songTimeline);
  const playbackRateRef = useRef(playbackRate);
  const songTimeRef = useRef(songTime);
  useEffect(() => { songTimelineRef.current = songTimeline; }, [songTimeline]);
  useEffect(() => { playbackRateRef.current = playbackRate; }, [playbackRate]);
  useEffect(() => { songTimeRef.current = songTime; }, [songTime]);

  // Scheduler reports the effective tempo for the UI display
  const handleTempoChange = useCallback((newBpm: number, newBeatsPerBar: number) => {
    useMetronomeStore.getState().setEffective(newBpm, newBeatsPerBar);
  }, []);

  const hasSongTimeline = songTimeline.length > 0;

  // --- Song mode: start / stop ---
  useEffect(() => {
    if (isSoloMode) return;
    if (!enabled) return;
    if (!isPlaying) return;
    if (isCountingIn) return;
    if (!hasSongTimeline) return;

    const handle = startMetronome({
      timeline: songTimelineRef.current,
      playbackRate: playbackRateRef.current,
      audible,
      volume: volumeRef.current,
      onTempoChange: handleTempoChange,
    });
    handleRef.current = handle;

    const first = songTimelineRef.current[0];
    useMetronomeStore.getState().setRunning(true);
    useMetronomeStore.getState().setEffective(first.bpm, first.beatsPerBar);

    // Anchor with the last known position; every position update refines it.
    handle.sync(songTimeRef.current);

    return () => {
      handle.stop();
      handleRef.current = null;
      useMetronomeStore.getState().setRunning(false);
    };
  }, [isSoloMode, enabled, isPlaying, isCountingIn, hasSongTimeline, audible, handleTempoChange]);

  // --- Song mode: keep the click grid locked to the playback position ---
  useEffect(() => {
    if (isSoloMode) return;
    handleRef.current?.sync(songTime);
  }, [isSoloMode, songTime]);

  // --- Song mode: live timeline update without restart ---
  useEffect(() => {
    if (isSoloMode) return;
    handleRef.current?.setTimeline(songTimeline);
  }, [isSoloMode, songTimeline]);

  // --- Song mode: live playback rate update without restart ---
  useEffect(() => {
    if (isSoloMode) return;
    handleRef.current?.setPlaybackRate(playbackRate);
  }, [isSoloMode, playbackRate]);

  // --- Solo mode: start / stop ---
  const startSolo = useCallback(() => {
    if (!isSoloMode || !enabled) return;
    if (handleRef.current) return;
    if (soloTimeline.length === 0) return;

    handleRef.current = startMetronome({
      timeline: soloTimeline,
      audible,
      volume: volumeRef.current,
      autoStart: true,
    });
    soloOwnedRef.current = true;
    useMetronomeStore.getState().setRunning(true);
    useMetronomeStore.getState().setEffective(soloTimeline[0].bpm, soloTimeline[0].beatsPerBar);
  }, [isSoloMode, enabled, soloTimeline, audible]);

  const stopSolo = useCallback(() => {
    if (!soloOwnedRef.current) return;
    handleRef.current?.stop();
    handleRef.current = null;
    soloOwnedRef.current = false;
    useMetronomeStore.getState().setRunning(false);
  }, []);

  // --- Solo mode: stop when disabled or a song is loaded ---
  useEffect(() => {
    if (!isSoloMode || !enabled) {
      stopSolo();
    }
  }, [isSoloMode, enabled, stopSolo]);

  // --- Solo mode: update tempo live ---
  useEffect(() => {
    if (!isSoloMode) return;
    handleRef.current?.setTimeline(soloTimeline);
  }, [isSoloMode, soloTimeline]);

  // --- Live volume update (both modes) ---
  useEffect(() => {
    handleRef.current?.setVolume(volume);
  }, [volume]);

  // --- Cleanup on unmount ---
  useEffect(() => {
    return () => {
      handleRef.current?.stop();
      handleRef.current = null;
    };
  }, []);

  return {
    isRunning,
    isSoloMode,
    startSolo,
    stopSolo,
  };
}