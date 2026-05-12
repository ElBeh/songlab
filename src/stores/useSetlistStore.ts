import { create } from 'zustand';
import type { Setlist, SetlistItem, SongData } from '../types';
import {
  getAllSetlists,
  saveSetlist,
  deleteSetlist as dbDeleteSetlist,
  getConfig,
} from '../services/db';
import { useToastStore } from './useToastStore';
import { useSongStore } from './useSongStore';

// Helper: migrate legacy string[] order to SetlistItem[]
function migrateOrder(raw: unknown, fallbackIds: string[]): SetlistItem[] {
  if (!Array.isArray(raw)) {
    return fallbackIds.map((id) => ({ type: 'song' as const, songId: id }));
  }
  if (raw.length > 0 && typeof raw[0] === 'object') {
    return raw as SetlistItem[];
  }
  return (raw as string[]).map((id) => ({ type: 'song' as const, songId: id }));
}

function generateId(): string {
  return `setlist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

interface SetlistStore {
  // --- State ---
  setlists: Setlist[];
  activeSetlistId: string | null;

  // --- Derived ---
  getActiveSetlist: () => Setlist | null;
  getActiveItems: () => SetlistItem[];
  getOrderedSongs: () => SongData[];
  getTotalDuration: () => number;

  // --- Lifecycle ---
  loadSetlists: () => Promise<void>;

  // --- Setlist CRUD ---
  createSetlist: (name: string) => Promise<string>;
  renameSetlist: (id: string, name: string) => Promise<void>;
  duplicateSetlist: (id: string) => Promise<string>;
  deleteSetlist: (id: string) => Promise<void>;
  switchSetlist: (id: string) => void;

  // --- Item actions (operate on active setlist) ---
  addSongToActiveSetlist: (songId: string) => Promise<void>;
  removeSongFromSetlist: (songId: string, setlistId?: string) => Promise<void>;
  removeSongFromAllSetlists: (songId: string) => Promise<void>;
  getSetlistsContainingSong: (songId: string) => Setlist[];
  moveItem: (index: number, direction: 'up' | 'down') => Promise<void>;
  reorderItem: (fromIndex: number, toIndex: number) => Promise<void>;
  addPause: (afterIndex: number, duration?: number) => Promise<void>;
  updatePause: (id: string, duration: number, label?: string) => Promise<void>;
  removePause: (id: string) => Promise<void>;

  // --- Cross-setlist actions ---
  copySongToSetlist: (songId: string, targetSetlistId: string) => Promise<void>;
  moveSongToSetlist: (songId: string, targetSetlistId: string) => Promise<void>;

  // --- Bulk update (for sync) ---
  setActiveItems: (items: SetlistItem[]) => Promise<void>;
}

/** Persist a single setlist to IndexedDB */
async function persistSetlist(setlist: Setlist): Promise<void> {
  try {
    await saveSetlist(setlist);
  } catch (error) {
    console.error('Failed to persist setlist:', error);
    useToastStore.getState().addToast('Could not save setlist', 'error');
  }
}

export const useSetlistStore = create<SetlistStore>((set, get) => ({
  setlists: [],
  activeSetlistId: null,

  // --- Derived ---

  getActiveSetlist: () => {
    const { setlists, activeSetlistId } = get();
    return setlists.find((s) => s.id === activeSetlistId) ?? null;
  },

  getActiveItems: () => {
    return get().getActiveSetlist()?.items ?? [];
  },

  getOrderedSongs: () => {
    const items = get().getActiveItems();
    const songs = useSongStore.getState().songs;
    const songMap = new Map(songs.map((s) => [s.id, s]));
    const ordered: SongData[] = [];
    for (const item of items) {
      if (item.type === 'song') {
        const song = songMap.get(item.songId);
        if (song) {
          ordered.push(song);
          songMap.delete(item.songId);
        }
      }
    }
    return ordered;
  },

  getTotalDuration: () => {
    const items = get().getActiveItems();
    const songs = useSongStore.getState().songs;
    const songMap = new Map(songs.map((s) => [s.id, s]));
    let total = 0;
    for (const item of items) {
      if (item.type === 'song') {
        total += songMap.get(item.songId)?.duration ?? 0;
      } else if (item.type === 'pause') {
        total += item.duration;
      }
    }
    return total;
  },

  // --- Lifecycle ---

  loadSetlists: async () => {
    try {
      const existing = await getAllSetlists();

      if (existing.length > 0) {
        // Use first setlist as active (per decision: always open first)
        set({ setlists: existing, activeSetlistId: existing[0].id });
        return;
      }

      // Migration: no setlists yet — create default from legacy songOrder
      const songs = useSongStore.getState().songs;
      const savedOrder = await getConfig<unknown>('songOrder');
      const items = migrateOrder(savedOrder, songs.map((s) => s.id));

      const defaultSetlist: Setlist = {
        id: generateId(),
        name: 'Default',
        items,
        isDefault: true,
        createdAt: Date.now(),
      };

      await saveSetlist(defaultSetlist);
      set({ setlists: [defaultSetlist], activeSetlistId: defaultSetlist.id });
    } catch (error) {
      console.error('Failed to load setlists:', error);
      useToastStore.getState().addToast('Could not load setlists', 'error');
    }
  },

  // --- Setlist CRUD ---

  createSetlist: async (name) => {
    const newSetlist: Setlist = {
      id: generateId(),
      name,
      items: [],
      isDefault: false,
      createdAt: Date.now(),
    };
    await persistSetlist(newSetlist);
    set((state) => ({
      setlists: [...state.setlists, newSetlist],
      activeSetlistId: newSetlist.id,
    }));
    return newSetlist.id;
  },

  renameSetlist: async (id, name) => {
    set((state) => ({
      setlists: state.setlists.map((s) =>
        s.id === id ? { ...s, name } : s,
      ),
    }));
    const updated = get().setlists.find((s) => s.id === id);
    if (updated) await persistSetlist(updated);
  },

  duplicateSetlist: async (id) => {
    const source = get().setlists.find((s) => s.id === id);
    if (!source) return '';

    const duplicate: Setlist = {
      ...source,
      id: generateId(),
      name: `${source.name} (Copy)`,
      isDefault: false,
      createdAt: Date.now(),
    };
    await persistSetlist(duplicate);
    set((state) => ({
      setlists: [...state.setlists, duplicate],
      activeSetlistId: duplicate.id,
    }));
    return duplicate.id;
  },

  deleteSetlist: async (id) => {
    const { setlists, activeSetlistId } = get();
    if (setlists.length <= 1) {
      useToastStore.getState().addToast('Cannot delete the last setlist', 'error');
      return;
    }

    await dbDeleteSetlist(id);
    const remaining = setlists.filter((s) => s.id !== id);
    const newActiveId = activeSetlistId === id ? remaining[0].id : activeSetlistId;
    set({ setlists: remaining, activeSetlistId: newActiveId });
  },

  switchSetlist: (id) => {
    set({ activeSetlistId: id });
  },

  // --- Item actions ---

  addSongToActiveSetlist: async (songId) => {
    const active = get().getActiveSetlist();
    if (!active) return;

    // Don't add if already in this setlist
    if (active.items.some((i) => i.type === 'song' && i.songId === songId)) return;

    const updated: Setlist = {
      ...active,
      items: [...active.items, { type: 'song', songId }],
    };
    set((state) => ({
      setlists: state.setlists.map((s) => (s.id === updated.id ? updated : s)),
    }));
    await persistSetlist(updated);
  },

  removeSongFromSetlist: async (songId, setlistId) => {
    const id = setlistId ?? get().activeSetlistId;
    const target = get().setlists.find((s) => s.id === id);
    if (!target) return;

    const updated: Setlist = {
      ...target,
      items: target.items.filter(
        (item) => !(item.type === 'song' && item.songId === songId),
      ),
    };
    set((state) => ({
      setlists: state.setlists.map((s) => (s.id === updated.id ? updated : s)),
    }));
    await persistSetlist(updated);
  },

  removeSongFromAllSetlists: async (songId) => {
    const { setlists } = get();
    const updatedSetlists = setlists.map((s) => ({
      ...s,
      items: s.items.filter(
        (item) => !(item.type === 'song' && item.songId === songId),
      ),
    }));
    set({ setlists: updatedSetlists });
    for (const s of updatedSetlists) {
      await persistSetlist(s);
    }
  },

  getSetlistsContainingSong: (songId) => {
    return get().setlists.filter((s) =>
      s.items.some((i) => i.type === 'song' && i.songId === songId),
    );
  },

  moveItem: async (index, direction) => {
    const active = get().getActiveSetlist();
    if (!active) return;

    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= active.items.length) return;

    const newItems = [...active.items];
    [newItems[index], newItems[targetIdx]] = [newItems[targetIdx], newItems[index]];
    const updated = { ...active, items: newItems };
    set((state) => ({
      setlists: state.setlists.map((s) => (s.id === updated.id ? updated : s)),
    }));
    await persistSetlist(updated);
  },

  reorderItem: async (fromIndex, toIndex) => {
    const active = get().getActiveSetlist();
    if (!active) return;

    if (
      fromIndex === toIndex ||
      fromIndex < 0 || fromIndex >= active.items.length ||
      toIndex < 0 || toIndex >= active.items.length
    ) return;

    const newItems = [...active.items];
    const [moved] = newItems.splice(fromIndex, 1);
    newItems.splice(toIndex, 0, moved);
    const updated = { ...active, items: newItems };
    set((state) => ({
      setlists: state.setlists.map((s) => (s.id === updated.id ? updated : s)),
    }));
    await persistSetlist(updated);
  },

  addPause: async (afterIndex, duration = 5) => {
    const active = get().getActiveSetlist();
    if (!active) return;

    const id = `pause-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const pause: SetlistItem = { type: 'pause', id, duration };
    const newItems = [...active.items];
    newItems.splice(afterIndex + 1, 0, pause);
    const updated = { ...active, items: newItems };
    set((state) => ({
      setlists: state.setlists.map((s) => (s.id === updated.id ? updated : s)),
    }));
    await persistSetlist(updated);
  },

  updatePause: async (id, duration, label) => {
    const active = get().getActiveSetlist();
    if (!active) return;

    const updated: Setlist = {
      ...active,
      items: active.items.map((item) =>
        item.type === 'pause' && item.id === id
          ? { ...item, duration, ...(label !== undefined && { label }) }
          : item,
      ),
    };
    set((state) => ({
      setlists: state.setlists.map((s) => (s.id === updated.id ? updated : s)),
    }));
    await persistSetlist(updated);
  },

  removePause: async (id) => {
    const active = get().getActiveSetlist();
    if (!active) return;

    const updated: Setlist = {
      ...active,
      items: active.items.filter(
        (item) => !(item.type === 'pause' && item.id === id),
      ),
    };
    set((state) => ({
      setlists: state.setlists.map((s) => (s.id === updated.id ? updated : s)),
    }));
    await persistSetlist(updated);
  },

  // --- Cross-setlist actions ---

  copySongToSetlist: async (songId, targetSetlistId) => {
    const target = get().setlists.find((s) => s.id === targetSetlistId);
    if (!target) return;
    if (target.items.some((i) => i.type === 'song' && i.songId === songId)) return;

    const updated = {
      ...target,
      items: [...target.items, { type: 'song' as const, songId }],
    };
    set((state) => ({
      setlists: state.setlists.map((s) => (s.id === updated.id ? updated : s)),
    }));
    await persistSetlist(updated);
  },

  moveSongToSetlist: async (songId, targetSetlistId) => {
    const { activeSetlistId } = get();
    if (!activeSetlistId) return;

    // Copy to target
    await get().copySongToSetlist(songId, targetSetlistId);
    // Remove from active
    await get().removeSongFromSetlist(songId, activeSetlistId);
  },

  // --- Bulk update (for sync) ---

  setActiveItems: async (items) => {
    const active = get().getActiveSetlist();
    if (!active) return;

    const updated = { ...active, items };
    set((state) => ({
      setlists: state.setlists.map((s) => (s.id === updated.id ? updated : s)),
    }));
    await persistSetlist(updated);
  },
}));