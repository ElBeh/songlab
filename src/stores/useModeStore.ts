import { create } from 'zustand';

export type AppMode = 'practice' | 'band';

interface ModeStore {
  mode: AppMode;
  autoAdvance: boolean;

  setMode: (mode: AppMode) => void;
  toggleMode: () => void;
  setAutoAdvance: (enabled: boolean) => void;
}

export const useModeStore = create<ModeStore>((set) => ({
  mode: 'practice',
  autoAdvance: false,

  setMode: (mode) => set({ mode }),
  toggleMode: () => set((state) => ({
    mode: state.mode === 'practice' ? 'band' : 'practice',
  })),
  setAutoAdvance: (enabled) => set({ autoAdvance: enabled }),
}));