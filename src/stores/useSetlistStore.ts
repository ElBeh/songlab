import { create } from 'zustand';
import type { Setlist, SetlistItem } from '../types';
import {
  getAllSetlists,
  saveSetlist,
  deleteSetlist as dbDeleteSetlist,
  getConfig,
  setConfig,
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

  // --- Lifecycle ---
  loadSetlists: () => Promise<void>;

  // --- Setlist CRUD ---
  createSetlist: (name: string) => Promise<string>;
  renameSetlist: (id: string, name: string) => Promise<void>;
  duplicateSetlist: (id: string) => Promise<string>;
  deleteSetlist: (id: string) => Promise<void>;
  switchSetlist: (id: string) => void;
  moveSetlist: (id: string, direction: 'up' | 'down') => Promise<void>;

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

export const useSetlistStore = create<SetlistStore>((set, get) => {
  /** Apply an updater to a setlist by id, then persist. Return null to skip. */
  const updateSetlistById = async (
    id: string,
    updater: (setlist: Setlist) => Setlist | null,
  ): Promise<void> => {
    const target = get().setlists.find((s) => s.id === id);
    if (!target) return;
    const updated = updater(target);
    if (!updated) return;
    set((state) => ({ setlists: state.setlists.map((s) => (s.id === id ? updated : s)) }));
    await persistSetlist(updated);
  };

  /** Apply an updater to the active setlist, then persist. No-op if none active. */
  const mutateActiveSetlist = (
    updater: (setlist: Setlist) => Setlist | null,
  ): Promise<void> => {
    const id = get().activeSetlistId;
    if (!id) return Promise.resolve();
    return updateSetlistById(id, updater);
  };

  return {
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

  // --- Lifecycle ---

  loadSetlists: async () => {
    try {
      const existing = await getAllSetlists();

      if (existing.length > 0) {
        // Sort by persisted order if available
        const order = await getConfig<string[]>('setlistOrder');
        const sorted = order
          ? [...existing].sort((a, b) => {
              const ia = order.indexOf(a.id);
              const ib = order.indexOf(b.id);
              return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib);
            })
          : existing;
        set({ setlists: sorted, activeSetlistId: sorted[0].id });
        return;
      }

      // Migration: create default from legacy songOrder if present
      const savedOrder = await getConfig<unknown>('songOrder');
      if (savedOrder) {
        const songs = useSongStore.getState().songs;
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
        return;
      }

      // No setlists and no legacy data — start empty
      set({ setlists: [], activeSetlistId: null });
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
    await updateSetlistById(id, (s) => ({ ...s, name }));
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
    await dbDeleteSetlist(id);
    const { setlists, activeSetlistId } = get();
    const remaining = setlists.filter((s) => s.id !== id);
    const newActiveId = activeSetlistId === id
      ? (remaining[0]?.id ?? null)
      : activeSetlistId;
    set({ setlists: remaining, activeSetlistId: newActiveId });
  },

  switchSetlist: (id) => {
    set({ activeSetlistId: id });
  },

  moveSetlist: async (id, direction) => {
    const { setlists } = get();
    const index = setlists.findIndex((s) => s.id === id);
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= setlists.length) return;

    const reordered = [...setlists];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];

    set({ setlists: reordered });
    await setConfig('setlistOrder', reordered.map((s) => s.id));
  },

  // --- Item actions ---

  addSongToActiveSetlist: async (songId) => {
    // Lazy-create a default setlist if none exists
    if (!get().getActiveSetlist()) {
      await get().createSetlist('Default');
    }
    await mutateActiveSetlist((active) =>
      active.items.some((i) => i.type === 'song' && i.songId === songId)
        ? null
        : { ...active, items: [...active.items, { type: 'song', songId }] },
    );
  },

  removeSongFromSetlist: async (songId, setlistId) => {
    const id = setlistId ?? get().activeSetlistId;
    if (!id) return;
    await updateSetlistById(id, (target) => ({
      ...target,
      items: target.items.filter(
        (item) => !(item.type === 'song' && item.songId === songId),
      ),
    }));
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
    await mutateActiveSetlist((active) => {
      const targetIdx = direction === 'up' ? index - 1 : index + 1;
      if (targetIdx < 0 || targetIdx >= active.items.length) return null;
      const newItems = [...active.items];
      [newItems[index], newItems[targetIdx]] = [newItems[targetIdx], newItems[index]];
      return { ...active, items: newItems };
    });
  },

  reorderItem: async (fromIndex, toIndex) => {
    await mutateActiveSetlist((active) => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 || fromIndex >= active.items.length ||
        toIndex < 0 || toIndex >= active.items.length
      ) return null;
      const newItems = [...active.items];
      const [moved] = newItems.splice(fromIndex, 1);
      newItems.splice(toIndex, 0, moved);
      return { ...active, items: newItems };
    });
  },

  addPause: async (afterIndex, duration = 5) => {
    await mutateActiveSetlist((active) => {
      const id = `pause-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const pause: SetlistItem = { type: 'pause', id, duration };
      const newItems = [...active.items];
      newItems.splice(afterIndex + 1, 0, pause);
      return { ...active, items: newItems };
    });
  },

  updatePause: async (id, duration, label) => {
    await mutateActiveSetlist((active) => ({
      ...active,
      items: active.items.map((item) =>
        item.type === 'pause' && item.id === id
          ? { ...item, duration, ...(label !== undefined && { label }) }
          : item,
      ),
    }));
  },

  removePause: async (id) => {
    await mutateActiveSetlist((active) => ({
      ...active,
      items: active.items.filter(
        (item) => !(item.type === 'pause' && item.id === id),
      ),
    }));
  },

  // --- Cross-setlist actions ---

  copySongToSetlist: async (songId, targetSetlistId) => {
    await updateSetlistById(targetSetlistId, (target) =>
      target.items.some((i) => i.type === 'song' && i.songId === songId)
        ? null
        : { ...target, items: [...target.items, { type: 'song' as const, songId }] },
    );
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
    await mutateActiveSetlist((active) => ({ ...active, items }));
  },
  };
});