import { create } from 'zustand';

interface MetronomeStore {
  /** Whether metronome is enabled (user toggle) */
  enabled: boolean;
  /** Whether the metronome is currently producing clicks */
  isRunning: boolean;
  /** Metronome volume (0–1) */
  volume: number;
  /** BPM for solo mode (no song active) */
  soloBpm: number;
  /** Time signature for solo mode */
  soloTimeSignature: [number, number];
  /** Current effective BPM (reflects tempo map changes during playback) */
  effectiveBpm: number | null;
  /** Current effective beats per bar (reflects time sig changes during playback) */
  effectiveBeatsPerBar: number | null;

  toggle: () => void;
  setRunning: (running: boolean) => void;
  setVolume: (volume: number) => void;
  setSoloBpm: (bpm: number) => void;
  setSoloTimeSignature: (ts: [number, number]) => void;
  setEffective: (bpm: number, beatsPerBar: number) => void;
}

export const useMetronomeStore = create<MetronomeStore>((set) => ({
  enabled: false,
  isRunning: false,
  volume: 0.7,
  soloBpm: 120,
  soloTimeSignature: [4, 4],
  effectiveBpm: null,
  effectiveBeatsPerBar: null,

  toggle: () => set((state) => ({ enabled: !state.enabled })),
  setRunning: (running) => set({ isRunning: running }),
  setVolume: (volume) => set({ volume: Math.min(1, Math.max(0, volume)) }),
  setSoloBpm: (bpm) => set({ soloBpm: Math.min(300, Math.max(20, bpm)) }),
  setSoloTimeSignature: (ts) => set({ soloTimeSignature: ts }),
  setEffective: (bpm, beatsPerBar) => set({ effectiveBpm: bpm, effectiveBeatsPerBar: beatsPerBar }),
}));