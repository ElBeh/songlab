import { create } from 'zustand';
import type { LoopRange } from '../types';

interface LoopStore {
  loop: LoopRange | null;
  loopEnabled: boolean;
  abStart: number | null;
  abMode: boolean;        // A/B mode active

  setLoop: (loop: LoopRange | null) => void;
  toggleLoop: () => void;
  setAbStart: (time: number | null) => void;
  clearLoop: () => void;
  toggleAbMode: () => void;
}

export const useLoopStore = create<LoopStore>((set) => ({
  loop: null,
  loopEnabled: false,
  abStart: null,
  abMode: false,

  setLoop: (loop) => set({ loop, loopEnabled: loop !== null }),
  toggleLoop: () => set((state) => ({ loopEnabled: !state.loopEnabled })),
  setAbStart: (time) => set({ abStart: time }),
  clearLoop: () => set({ loop: null, loopEnabled: false, abStart: null, abMode: false }),
  toggleAbMode: () => set((state) => ({
    abMode: !state.abMode,
    abStart: null,  // reset A point when toggling mode
  })),
}));