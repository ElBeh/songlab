import { create } from 'zustand';

export type AppMode = 'edit' | 'session';

interface ModeStore {
  mode: AppMode;
  autoAdvance: boolean;

  setMode: (mode: AppMode) => void;
  toggleMode: () => void;
  setAutoAdvance: (enabled: boolean) => void;
}

export const useModeStore = create<ModeStore>((set) => ({
  mode: 'edit',
  autoAdvance: false,

  setMode: (mode) => set({ mode }),
  toggleMode: () => set((state) => ({
    mode: state.mode === 'edit' ? 'session' : 'edit',
  })),
  setAutoAdvance: (enabled) => set({ autoAdvance: enabled }),
}));