import { create } from 'zustand';
import type { LoopRange } from '../types';

interface LoopStore {
  loop: LoopRange | null;
  loopEnabled: boolean;
  loopCount: number;
  loopTarget: number | null;  // e.g. 10 = stop after 10 loops
  abStart: number | null;
  abMode: boolean;        // A/B mode active

  setLoop: (loop: LoopRange | null) => void;
  toggleLoop: () => void;
  incrementLoopCount: () => void;
  resetLoopCount: () => void;
  setLoopTarget: (target: number | null) => void;
  setAbStart: (time: number | null) => void;
  clearLoop: () => void;
  toggleAbMode: () => void;
}

// Guard against rapid-fire increment calls (wavesurfer may fire finish/timeupdate
// in quick succession when looping, causing double counts)
let lastIncrementTime = 0;
const INCREMENT_DEBOUNCE_MS = 300;

export const useLoopStore = create<LoopStore>((set) => ({
  loop: null,
  loopEnabled: false,
  loopCount: 0,
  loopTarget: null,
  abStart: null,
  abMode: false,

  setLoop: (loop) => set({ loop, loopEnabled: loop !== null, loopCount: 0, loopTarget: null }),
  toggleLoop: () => set((state) => ({ loopEnabled: !state.loopEnabled })),
  incrementLoopCount: () => {
    const now = Date.now();
    if (now - lastIncrementTime < INCREMENT_DEBOUNCE_MS) return;
    lastIncrementTime = now;
    set((state) => ({ loopCount: state.loopCount + 1 }));
  },
  resetLoopCount: () => { lastIncrementTime = 0; set({ loopCount: 0 }); },
  setLoopTarget: (target) => set({ loopTarget: target, loopCount: 0 }),
  setAbStart: (time) => set({ abStart: time }),
  clearLoop: () => set({ loop: null, loopEnabled: false, loopCount: 0, loopTarget: null, abStart: null, abMode: false }),
  toggleAbMode: () => set((state) => ({
    abMode: !state.abMode,
    abStart: null,  // reset A point when toggling mode
  })),
}));