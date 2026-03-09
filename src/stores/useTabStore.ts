import { create } from 'zustand';
import type { SectionTab } from '../types';
import { saveTab, getTabsForSong, deleteTab } from '../services/db';

interface TabStore {
  tabs: Record<string, SectionTab>; // markerId → SectionTab
  activeMarkerId: string | null;

  loadTabsForSong: (songId: string) => Promise<void>;
  saveTab: (tab: SectionTab) => Promise<void>;
  deleteTab: (markerId: string) => Promise<void>;
  setActiveMarker: (markerId: string | null) => void;
}

export const useTabStore = create<TabStore>((set, get) => ({
  tabs: {},
  activeMarkerId: null,

  loadTabsForSong: async (songId) => {
    const tabList = await getTabsForSong(songId);
    const tabMap = Object.fromEntries(tabList.map((t) => [t.markerId, t]));
    set({ tabs: tabMap });
  },

  saveTab: async (tab) => {
    await saveTab(tab);
    set((state) => ({
      tabs: { ...state.tabs, [tab.markerId]: tab },
    }));
  },

  deleteTab: async (markerId) => {
    const tab = get().tabs[markerId];
    if (tab) await deleteTab(tab.id);
    set((state) => {
      const tabs = { ...state.tabs };
      delete tabs[markerId];
      return { tabs };
    });
  },

  setActiveMarker: (markerId) => set({ activeMarkerId: markerId }),
}));