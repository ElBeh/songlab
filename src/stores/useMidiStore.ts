// MIDI input state: device tracking, command mappings, and MIDI learn mode.
// Mappings are persisted in IndexedDB via the config store.

import { create } from 'zustand';
import { getConfig, setConfig } from '../services/db';
import { useToastStore } from './useToastStore';
import type { MidiCommand, MidiDeviceInfo, MidiMapping } from '../services/midiService';
import { DEFAULT_MAPPINGS } from '../services/midiService';

const CONFIG_KEY = 'midiMappings';

interface MidiStore {
  /** Whether MIDI input is enabled (user toggle) */
  enabled: boolean;
  /** Currently detected MIDI input devices */
  devices: MidiDeviceInfo[];
  /** Active command mappings */
  mappings: MidiMapping[];
  /** Command currently in learn mode, or null */
  learnTarget: MidiCommand | null;

  toggle: () => void;
  setDevices: (devices: MidiDeviceInfo[]) => void;
  setMappings: (mappings: MidiMapping[]) => void;
  setLearnTarget: (command: MidiCommand | null) => void;
  /** Update a single mapping and persist */
  updateMapping: (mapping: MidiMapping) => Promise<void>;
  /** Reset all mappings to defaults and persist */
  resetMappings: () => Promise<void>;
  /** Load mappings from IndexedDB (call on init) */
  loadMappings: () => Promise<void>;
}

export const useMidiStore = create<MidiStore>((set, get) => ({
  enabled: false,
  devices: [],
  mappings: DEFAULT_MAPPINGS,
  learnTarget: null,

  toggle: () => set((state) => ({ enabled: !state.enabled })),
  setDevices: (devices) => set({ devices }),
  setMappings: (mappings) => set({ mappings }),
  setLearnTarget: (command) => set({ learnTarget: command }),

  updateMapping: async (mapping) => {
    try {
      const updated = get().mappings.map((m) =>
        m.command === mapping.command ? mapping : m,
      );
      set({ mappings: updated, learnTarget: null });
      await setConfig(CONFIG_KEY, updated);
    } catch (error) {
      console.error('Failed to save MIDI mapping:', error);
      useToastStore.getState().addToast(
        'MIDI mapping could not be saved',
        'error',
      );
    }
  },

  resetMappings: async () => {
    try {
      set({ mappings: DEFAULT_MAPPINGS });
      await setConfig(CONFIG_KEY, DEFAULT_MAPPINGS);
    } catch (error) {
      console.error('Failed to reset MIDI mappings:', error);
      useToastStore.getState().addToast(
        'MIDI mappings could not be reset',
        'error',
      );
    }
  },

  loadMappings: async () => {
    try {
      const saved = await getConfig<MidiMapping[]>(CONFIG_KEY);
      if (saved && saved.length > 0) {
        // Merge: keep saved mappings, fill missing commands from defaults
        const savedCommands = new Set(saved.map((m) => m.command));
        const merged = [
          ...saved,
          ...DEFAULT_MAPPINGS.filter((d) => !savedCommands.has(d.command)),
        ];
        set({ mappings: merged });
      }
    } catch (error) {
      console.error('Failed to load MIDI mappings:', error);
    }
  },
}));