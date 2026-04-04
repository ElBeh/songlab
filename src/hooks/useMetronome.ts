import { useEffect, useRef, useCallback } from 'react';
import { useMetronomeStore } from '../stores/useMetronomeStore';
import { useCountInStore } from '../stores/useCountInStore';
import { startMetronome, type MetronomeHandle } from '../services/metronomeScheduler';
import type { TempoMapEntry } from '../components/Tabs/NotationPanel';

const TICKS_PER_QUARTER = 960;

interface UseMetronomeOptions {
  /** Whether a song is currently loaded */
  hasSong: boolean;
  /** Song BPM (null = no BPM set) */
  bpm: number | null;
  /** Song time signature (null defaults to [4, 4]) */
  timeSignature: [number, number] | null;
  /** Current playback rate from tempo store (0.5–1.5) */
  playbackRate: number;
  /** Whether song playback is currently active */
  isPlaying: boolean;
  /** Whether to produce audible clicks */
  audible?: boolean;
  /** Tempo map from GP file (enables internal position tracking in scheduler) */
  tempoMap?: TempoMapEntry[];
  /** Current tick position from alphaSynth or external media sync */
  currentTick?: number;
  /** Current playback time in seconds */
  currentTime?: number;
}

/** Compute beat-in-bar (0-based) from tick position and tempo map */
function beatInBarFromTick(
  tick: number,
  tempoMap: TempoMapEntry[],
): number {
  // Find the active entry
  let entry = tempoMap[0];
  for (const e of tempoMap) {
    if (e.tick <= tick) entry = e;
    else break;
  }
  const ticksSinceEntry = tick - entry.tick;
  const beatsFromEntry = Math.floor(ticksSinceEntry / TICKS_PER_QUARTER);
  return beatsFromEntry % entry.beatsPerBar;
}

/** Compute beat-in-bar (0-based) from time and fixed BPM */
function beatInBarFromTime(
  time: number,
  bpm: number,
  beatsPerBar: number,
): number {
  const beatsSinceStart = Math.floor(time / (60 / bpm));
  return beatsSinceStart % beatsPerBar;
}

export function useMetronome({
  hasSong,
  bpm,
  timeSignature,
  playbackRate,
  isPlaying,
  audible = true,
  tempoMap,
  currentTick,
  currentTime,
}: UseMetronomeOptions) {
  const enabled = useMetronomeStore((s) => s.enabled);
  const isRunning = useMetronomeStore((s) => s.isRunning);
  const volume = useMetronomeStore((s) => s.volume);
  const soloBpm = useMetronomeStore((s) => s.soloBpm);
  const soloTimeSignature = useMetronomeStore((s) => s.soloTimeSignature);
  const isCountingIn = useCountInStore((s) => s.isCountingIn);

  const handleRef = useRef<MetronomeHandle | null>(null);
  const volumeRef = useRef(volume);
  const currentTickRef = useRef(currentTick ?? 0);
  const currentTimeRef = useRef(currentTime ?? 0);

  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { currentTickRef.current = currentTick ?? 0; }, [currentTick]);
  useEffect(() => { currentTimeRef.current = currentTime ?? 0; }, [currentTime]);

  const hasSongBpm = bpm !== null && bpm > 0;
  const isSoloMode = !hasSong;

  // onTempoChange callback for scheduler → store (for UI display)
  const handleTempoChange = useCallback((newBpm: number, newBeatsPerBar: number) => {
    useMetronomeStore.getState().setEffective(newBpm, newBeatsPerBar);
  }, []);

  // --- Song mode: couple to playback ---
  useEffect(() => {
    if (!hasSongBpm) return;
    if (isSoloMode) return;
    if (!enabled) return;
    if (!isPlaying) return;
    if (isCountingIn) return;

    const beats = timeSignature ? timeSignature[0] : 4;

    // Compute current beat position for correct accent placement
    let startBeatInBar = 0;
    if (tempoMap && currentTickRef.current > 0) {
      startBeatInBar = beatInBarFromTick(currentTickRef.current, tempoMap);
    } else if (bpm! > 0 && currentTimeRef.current > 0) {
      const effectiveBpm = bpm! * playbackRate;
      startBeatInBar = beatInBarFromTime(currentTimeRef.current, effectiveBpm, beats);
    }

    handleRef.current = startMetronome({
      bpm: bpm!,
      beatsPerBar: beats,
      audible,
      volume: volumeRef.current,
      playbackRate,
      tempoMap,
      startTick: currentTickRef.current,
      startBeatInBar,
      onTempoChange: tempoMap ? handleTempoChange : undefined,
    });
    useMetronomeStore.getState().setRunning(true);
    useMetronomeStore.getState().setEffective(bpm!, beats);

    return () => {
      handleRef.current?.stop();
      handleRef.current = null;
      useMetronomeStore.getState().setRunning(false);
    };
  }, [hasSongBpm, isSoloMode, enabled, isPlaying, isCountingIn, bpm, playbackRate, timeSignature, audible, tempoMap, handleTempoChange]);

  // --- Song mode: live tempo update without restart (only when no tempo map) ---
  useEffect(() => {
    if (isSoloMode || !handleRef.current || tempoMap) return;
    const effectiveBpm = bpm! * playbackRate;
    const beats = timeSignature ? timeSignature[0] : 4;
    handleRef.current.setTempo(effectiveBpm, beats);
  }, [isSoloMode, bpm, playbackRate, timeSignature, tempoMap]);

  // --- Solo mode: start/stop ---
  const startSolo = useCallback(() => {
    if (!isSoloMode || !enabled) return;
    if (handleRef.current) return;

    const beats = soloTimeSignature[0];
    handleRef.current = startMetronome({
      bpm: soloBpm,
      beatsPerBar: beats,
      audible,
      volume: volumeRef.current,
    });
    useMetronomeStore.getState().setRunning(true);
  }, [isSoloMode, enabled, soloBpm, soloTimeSignature, audible]);

  const stopSolo = useCallback(() => {
    handleRef.current?.stop();
    handleRef.current = null;
    useMetronomeStore.getState().setRunning(false);
  }, []);

  // --- Solo mode: stop when disabled or song loaded ---
  useEffect(() => {
    if (!isSoloMode || !enabled) {
      stopSolo();
    }
  }, [isSoloMode, enabled, stopSolo]);

  // --- Solo mode: update tempo live ---
  useEffect(() => {
    if (!isSoloMode || !handleRef.current) return;
    handleRef.current.setTempo(soloBpm, soloTimeSignature[0]);
  }, [isSoloMode, soloBpm, soloTimeSignature]);

  // --- Live volume update (both modes) ---
  useEffect(() => {
    if (!handleRef.current) return;
    handleRef.current.setVolume(volume);
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