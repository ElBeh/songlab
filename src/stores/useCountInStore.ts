import { create } from 'zustand';

interface CountInStore {
  /** Whether count-in is enabled (user toggle) */
  enabled: boolean;
  /** Whether a count-in is currently running */
  isCountingIn: boolean;
  /** Current beat number (1-based), null when not counting */
  currentBeat: number | null;
  /** Total beats in the count-in bar */
  totalBeats: number;

  toggle: () => void;
  start: (totalBeats: number) => void;
  setBeat: (beat: number) => void;
  finish: () => void;
  cancel: () => void;
}

export const useCountInStore = create<CountInStore>((set) => ({
  enabled: false,
  isCountingIn: false,
  currentBeat: null,
  totalBeats: 4,

  toggle: () => set((state) => ({ enabled: !state.enabled })),

  start: (totalBeats) => set({
    isCountingIn: true,
    currentBeat: null,
    totalBeats,
  }),

  setBeat: (beat) => set({ currentBeat: beat }),

  finish: () => set({
    isCountingIn: false,
    currentBeat: null,
  }),

  cancel: () => set({
    isCountingIn: false,
    currentBeat: null,
  }),
}));