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
import { useToastStore } from './useToastStore';

interface TabStore {
  // --- State ---
  tabs: Record<string, SectionTab>;           // key: `${markerId}-${sheetId}`
  sheets: TabSheet[];                          // global per song
  activeMarkerId: string | null;
  activeSheetId: string | null;               // active sheet per session
  preferredSheetType: string | null;          // remembered across song switches

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
  preferredSheetType: localStorage.getItem('songlab:preferredSheetType'),

  loadTabsForSong: async (songId) => {
    try {
      const tabs = await getTabsForSong(songId);
      const tabMap: Record<string, SectionTab> = {};
      for (const tab of tabs) {
        tabMap[`${tab.markerId}-${tab.sheetId}`] = tab;
      }
      set({ tabs: tabMap });
    } catch (error) {
      console.error('Failed to load tabs:', error);
      useToastStore.getState().addToast('Could not load tabs', 'error');
    }
  },

  saveTab: async (tab) => {
    try {
      await saveTab(tab);
      emitTabSave(tab);
      set((state) => ({
        tabs: { ...state.tabs, [`${tab.markerId}-${tab.sheetId}`]: tab },
      }));
    } catch (error) {
      console.error('Failed to save tab:', error);
      useToastStore.getState().addToast('Could not save tab', 'error');
    }
  },

  deleteTab: async (id) => {
    try {
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
    } catch (error) {
      console.error('Failed to delete tab:', error);
      useToastStore.getState().addToast('Could not delete tab', 'error');
    }
  },

  loadSheetsForSong: async (songId) => {
    try {
      const sheets = await getTabSheetsForSong(songId);
      const sorted = sheets.sort((a, b) => a.order - b.order);
      // Prefer sheet matching the user's last-used type, fallback to first
      const preferred = get().preferredSheetType;
      const match = preferred ? sorted.find((s) => s.type === preferred) : null;
      set({ sheets: sorted, activeSheetId: match?.id ?? sorted[0]?.id ?? null });
    } catch (error) {
      console.error('Failed to load tab sheets:', error);
      useToastStore.getState().addToast('Could not load tab sheets', 'error');
    }
  },

  addSheet: async (sheet) => {
    try {
      await saveTabSheet(sheet);
      emitSheetSave(sheet);
      set((state) => ({
        sheets: [...state.sheets, sheet].sort((a, b) => a.order - b.order),
        activeSheetId: state.activeSheetId ?? sheet.id,
      }));
    } catch (error) {
      console.error('Failed to add tab sheet:', error);
      useToastStore.getState().addToast('Could not add tab sheet', 'error');
    }
  },

  updateSheet: async (sheet) => {
    try {
      await saveTabSheet(sheet);
      emitSheetSave(sheet);
      set((state) => ({
        sheets: state.sheets
          .map((s) => (s.id === sheet.id ? sheet : s))
          .sort((a, b) => a.order - b.order),
      }));
    } catch (error) {
      console.error('Failed to update tab sheet:', error);
      useToastStore.getState().addToast('Could not update tab sheet', 'error');
    }
  },

  removeSheet: async (id) => {
    try {
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
    } catch (error) {
      console.error('Failed to remove tab sheet:', error);
      useToastStore.getState().addToast('Could not remove tab sheet', 'error');
    }
  },

  setActiveMarker: (id) => set({ activeMarkerId: id }),

  setActiveSheet: (id) => {
    const sheet = get().sheets.find((s) => s.id === id);
    if (sheet) {
      localStorage.setItem('songlab:preferredSheetType', sheet.type);
      set({ activeSheetId: id, preferredSheetType: sheet.type });
    } else {
      set({ activeSheetId: id });
    }
  },

  getTabForMarkerAndSheet: (markerId, sheetId) => {
    return get().tabs[`${markerId}-${sheetId}`] ?? null;
  },
}));