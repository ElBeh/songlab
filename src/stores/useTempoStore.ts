import { create } from 'zustand';

interface TempoStore {
  playbackRate: number;   // 0.5 – 1.5
  preservePitch: boolean;

  setPlaybackRate: (rate: number) => void;
  togglePreservePitch: () => void;
}

export const useTempoStore = create<TempoStore>((set) => ({
  playbackRate: 1,
  preservePitch: true,

  setPlaybackRate: (rate) => set({ playbackRate: Math.min(1.5, Math.max(0.5, rate)) }),
  togglePreservePitch: () => set((state) => ({ preservePitch: !state.preservePitch })),
}));