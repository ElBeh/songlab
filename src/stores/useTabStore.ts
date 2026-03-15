import { create } from 'zustand';
import type { SectionTab, TabSheet } from '../types';
import {
  saveTab,
  getTabsForSong,
  deleteTab,
  saveTabSheet,
  getTabSheetsForSong,
  deleteTabSheet,
} from '../services/db';
import {
  emitTabSave,
  emitTabDelete,
  emitSheetSave,
  emitSheetDelete,
} from '../services/syncEmitter';

interface TabStore {
  // --- State ---
  tabs: Record<string, SectionTab>;           // key: `${markerId}-${sheetId}`
  sheets: TabSheet[];                          // global per song
  activeMarkerId: string | null;
  activeSheetId: string | null;               // active sheet per session

  // --- Tab actions ---
  loadTabsForSong: (songId: string) => Promise<void>;
  saveTab: (tab: SectionTab) => Promise<void>;
  deleteTab: (id: string) => Promise<void>;

  // --- Sheet actions ---
  loadSheetsForSong: (songId: string) => Promise<void>;
  addSheet: (sheet: TabSheet) => Promise<void>;
  updateSheet: (sheet: TabSheet) => Promise<void>;
  removeSheet: (id: string) => Promise<void>;

  // --- Selection ---
  setActiveMarker: (id: string) => void;
  setActiveSheet: (id: string) => void;
  getTabForMarkerAndSheet: (markerId: string, sheetId: string) => SectionTab | null;
}

export const useTabStore = create<TabStore>((set, get) => ({
  tabs: {},
  sheets: [],
  activeMarkerId: null,
  activeSheetId: null,

  loadTabsForSong: async (songId) => {
    const tabs = await getTabsForSong(songId);
    const tabMap: Record<string, SectionTab> = {};
    for (const tab of tabs) {
      tabMap[`${tab.markerId}-${tab.sheetId}`] = tab;
    }
    set({ tabs: tabMap });
  },

  saveTab: async (tab) => {
    await saveTab(tab);
    emitTabSave(tab);
    set((state) => ({
      tabs: { ...state.tabs, [`${tab.markerId}-${tab.sheetId}`]: tab },
    }));
  },

  deleteTab: async (id) => {
    // Find songId before deleting (needed for sync broadcast)
    const tab = Object.values(get().tabs).find((t) => t.id === id);
    await deleteTab(id);
    if (tab) emitTabDelete(id, tab.songId);
    set((state) => {
      const updated = { ...state.tabs };
      for (const key in updated) {
        if (updated[key].id === id) delete updated[key];
      }
      return { tabs: updated };
    });
  },

  loadSheetsForSong: async (songId) => {
    const sheets = await getTabSheetsForSong(songId);
    const sorted = sheets.sort((a, b) => a.order - b.order);
    set({ sheets: sorted, activeSheetId: sorted[0]?.id ?? null });
  },

  addSheet: async (sheet) => {
    await saveTabSheet(sheet);
    emitSheetSave(sheet);
    set((state) => ({
      sheets: [...state.sheets, sheet].sort((a, b) => a.order - b.order),
      activeSheetId: state.activeSheetId ?? sheet.id,
    }));
  },

  updateSheet: async (sheet) => {
    await saveTabSheet(sheet);
    emitSheetSave(sheet);
    set((state) => ({
      sheets: state.sheets
        .map((s) => (s.id === sheet.id ? sheet : s))
        .sort((a, b) => a.order - b.order),
    }));
  },

  removeSheet: async (id) => {
    const sheet = get().sheets.find((s) => s.id === id);
    await deleteTabSheet(id);
    if (sheet) emitSheetDelete(id, sheet.songId);
    set((state) => {
      const sheets = state.sheets.filter((s) => s.id !== id);
      return {
        sheets,
        activeSheetId:
          state.activeSheetId === id ? (sheets[0]?.id ?? null) : state.activeSheetId,
      };
    });
  },

  setActiveMarker: (id) => set({ activeMarkerId: id }),

  setActiveSheet: (id) => set({ activeSheetId: id }),

  getTabForMarkerAndSheet: (markerId, sheetId) => {
    return get().tabs[`${markerId}-${sheetId}`] ?? null;
  },
}));