import { create } from 'zustand';
import type { SongData, SectionMarker, SetlistItem } from '../types';
import {
  saveSong,
  getAllSongs,
  deleteSong,
  saveMarker,
  getMarkersForSong,
  deleteMarker,
  getConfig,
  setConfig,
  deleteAudioFile,
  deleteGpFile,
} from '../services/db';
import { emitMarkerSave, emitMarkerDelete } from '../services/syncEmitter';
import { useToastStore } from './useToastStore';

// Helper: migrate legacy string[] order to SetlistItem[]
function migrateOrder(raw: unknown, fallbackIds: string[]): SetlistItem[] {
  if (!Array.isArray(raw)) {
    return fallbackIds.map((id) => ({ type: 'song' as const, songId: id }));
  }
  // Already migrated?
  if (raw.length > 0 && typeof raw[0] === 'object') {
    return raw as SetlistItem[];
  }
  // Legacy string[]
  return (raw as string[]).map((id) => ({ type: 'song' as const, songId: id }));
}

interface SongStore {
  // --- State ---
  songs: SongData[];
  songOrder: SetlistItem[];
  activeSongId: string | null;
  markersBySong: Record<string, SectionMarker[]>;

  // --- Derived ---
  getActiveSong: () => SongData | null;
  getActiveMarkers: () => SectionMarker[];
  getOrderedSongs: () => SongData[];

  // --- Song actions ---
  loadAllSongs: () => Promise<void>;
  addSong: (song: SongData) => Promise<void>;
  setActiveSongId: (id: string) => Promise<void>;
  updateSong: (song: SongData) => Promise<void>;
  removeSong: (id: string) => Promise<void>;

  // --- Setlist actions ---
  moveItem: (index: number, direction: 'up' | 'down') => Promise<void>;
  reorderItem: (fromIndex: number, toIndex: number) => Promise<void>;
  addPause: (afterIndex: number, duration?: number) => Promise<void>;
  updatePause: (id: string, duration: number, label?: string) => Promise<void>;
  removePause: (id: string) => Promise<void>;

  // --- Marker actions ---
  addMarker: (marker: SectionMarker) => Promise<void>;
  updateMarker: (marker: SectionMarker) => Promise<void>;
  removeMarker: (id: string) => Promise<void>;
}

export const useSongStore = create<SongStore>((set, get) => ({
  songs: [],
  songOrder: [],
  activeSongId: null,
  markersBySong: {},

  getActiveSong: () => {
    const { songs, activeSongId } = get();
    return songs.find((s) => s.id === activeSongId) ?? null;
  },

  getActiveMarkers: () => {
    const { markersBySong, activeSongId } = get();
    return activeSongId ? (markersBySong[activeSongId] ?? []) : [];
  },

  getOrderedSongs: () => {
    const { songs, songOrder } = get();
    const songMap = new Map(songs.map((s) => [s.id, s]));
    const ordered: SongData[] = [];
    for (const item of songOrder) {
      if (item.type === 'song') {
        const song = songMap.get(item.songId);
        if (song) {
          ordered.push(song);
          songMap.delete(item.songId);
        }
      }
    }
    // Append songs not yet in the order array
    for (const song of songMap.values()) {
      ordered.push(song);
    }
    return ordered;
  },

  loadAllSongs: async () => {
    try {
      const raw = await getAllSongs();
      // Migrate legacy songs that predate the isDummy field
      const songs = raw.map((s) => ({
        ...s,
        isDummy: s.isDummy ?? false,
        gpFileName: s.gpFileName ?? null,
        syncPoints: s.syncPoints ?? null,
        syncOffset: s.syncOffset ?? null,
        bpmAdjust: s.bpmAdjust ?? null,
        bpm: s.bpm ?? null,
        timeSignature: s.timeSignature ?? null,
      }));
      const savedOrder = await getConfig<unknown>('songOrder');
      const songOrder = migrateOrder(savedOrder, songs.map((s) => s.id));
      set({ songs, songOrder });
    } catch (error) {
      console.error('Failed to load songs:', error);
      useToastStore.getState().addToast('Could not load song library', 'error');
    }
  },

  addSong: async (song) => {
    try {
      await saveSong(song);
      set((state) => {
        const exists = state.songs.some((s) => s.id === song.id);
        const newOrder = exists
          ? state.songOrder
          : [...state.songOrder, { type: 'song' as const, songId: song.id }];
        return {
          songs: exists
            ? state.songs.map((s) => {
                if (s.id !== song.id) return s;
                const defined = Object.fromEntries(
                  Object.entries(song).filter(([, v]) => v !== undefined),
                );
                return { ...s, ...defined };
              })
            : [...state.songs, song],
          songOrder: newOrder,
          markersBySong: exists
            ? Object.fromEntries(
                Object.entries(state.markersBySong).filter(([key]) => key !== song.id)
              )
            : state.markersBySong,
        };
      });
      await setConfig('songOrder', get().songOrder);
    } catch (error) {
      console.error('Failed to add song:', error);
      useToastStore.getState().addToast('Could not save song', 'error');
    }
  },

  setActiveSongId: async (id) => {
    try {
      const { markersBySong } = get();
      if (!markersBySong[id]) {
        const markers = await getMarkersForSong(id);
        set((state) => ({
          activeSongId: id,
          markersBySong: {
            ...state.markersBySong,
            [id]: markers.sort((a, b) => a.startTime - b.startTime),
          },
        }));
      } else {
        set({ activeSongId: id });
      }
    } catch (error) {
      console.error('Failed to set active song:', error);
      useToastStore.getState().addToast('Could not load song markers', 'error');
    }
  },

  removeSong: async (id) => {
    try {
      await deleteSong(id);
      await deleteAudioFile(id);
      await deleteGpFile(id);
      set((state) => ({
        songs: state.songs.filter((s) => s.id !== id),
        songOrder: state.songOrder.filter(
          (item) => !(item.type === 'song' && item.songId === id),
        ),
        activeSongId: state.activeSongId === id
          ? (state.songs.find((s) => s.id !== id)?.id ?? null)
          : state.activeSongId,
        markersBySong: Object.fromEntries(
          Object.entries(state.markersBySong).filter(([key]) => key !== id)
        ),
      }));
      await setConfig('songOrder', get().songOrder);
    } catch (error) {
      console.error('Failed to remove song:', error);
      useToastStore.getState().addToast('Could not delete song', 'error');
    }
  },

  // --- Setlist actions ---

  moveItem: async (index, direction) => {
    const { songOrder } = get();
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= songOrder.length) return;

    const newOrder = [...songOrder];
    [newOrder[index], newOrder[targetIdx]] = [newOrder[targetIdx], newOrder[index]];
    set({ songOrder: newOrder });
    try {
      await setConfig('songOrder', newOrder);
    } catch (error) {
      console.error('Failed to persist setlist order:', error);
      useToastStore.getState().addToast('Could not save setlist order', 'error');
    }
  },

  reorderItem: async (fromIndex, toIndex) => {
    const { songOrder } = get();
    if (
      fromIndex === toIndex ||
      fromIndex < 0 || fromIndex >= songOrder.length ||
      toIndex < 0 || toIndex >= songOrder.length
    ) return;

    const newOrder = [...songOrder];
    const [moved] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, moved);
    set({ songOrder: newOrder });
    try {
      await setConfig('songOrder', newOrder);
    } catch (error) {
      console.error('Failed to persist setlist reorder:', error);
      useToastStore.getState().addToast('Could not save setlist order', 'error');
    }
  },

  addPause: async (afterIndex, duration = 5) => {
    const id = `pause-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const pause: SetlistItem = { type: 'pause', id, duration };
    set((state) => {
      const newOrder = [...state.songOrder];
      newOrder.splice(afterIndex + 1, 0, pause);
      return { songOrder: newOrder };
    });
    try {
      await setConfig('songOrder', get().songOrder);
    } catch (error) {
      console.error('Failed to persist pause entry:', error);
      useToastStore.getState().addToast('Could not save pause entry', 'error');
    }
  },

  updatePause: async (id, duration, label) => {
    set((state) => ({
      songOrder: state.songOrder.map((item) =>
        item.type === 'pause' && item.id === id
          ? { ...item, duration, ...(label !== undefined && { label }) }
          : item,
      ),
    }));
    try {
      await setConfig('songOrder', get().songOrder);
    } catch (error) {
      console.error('Failed to persist pause update:', error);
      useToastStore.getState().addToast('Could not update pause entry', 'error');
    }
  },

  removePause: async (id) => {
    set((state) => ({
      songOrder: state.songOrder.filter(
        (item) => !(item.type === 'pause' && item.id === id),
      ),
    }));
    try {
      await setConfig('songOrder', get().songOrder);
    } catch (error) {
      console.error('Failed to persist pause removal:', error);
      useToastStore.getState().addToast('Could not remove pause entry', 'error');
    }
  },

  updateSong: async (song) => {
    try {
      await saveSong(song);
      set((state) => ({
        songs: state.songs.map((s) => {
          if (s.id !== song.id) return s;
          const defined = Object.fromEntries(
            Object.entries(song).filter(([, v]) => v !== undefined),
          );
          return { ...s, ...defined };
        }),
      }));
    } catch (error) {
      console.error('Failed to update song:', error);
      useToastStore.getState().addToast('Could not update song', 'error');
    }
  },

  addMarker: async (marker) => {
    try {
      await saveMarker(marker);
      emitMarkerSave(marker);
      set((state) => ({
        markersBySong: {
          ...state.markersBySong,
          [marker.songId]: [
            ...(state.markersBySong[marker.songId] ?? []),
            marker,
          ].sort((a, b) => a.startTime - b.startTime),
        },
      }));
    } catch (error) {
      console.error('Failed to save marker:', error);
      useToastStore.getState().addToast('Could not save marker', 'error');
    }
  },

  updateMarker: async (marker) => {
    try {
      await saveMarker(marker);
      emitMarkerSave(marker);
      set((state) => ({
        markersBySong: {
          ...state.markersBySong,
          [marker.songId]: (state.markersBySong[marker.songId] ?? [])
            .map((m) => (m.id === marker.id ? marker : m))
            .sort((a, b) => a.startTime - b.startTime),
        },
      }));
    } catch (error) {
      console.error('Failed to update marker:', error);
      useToastStore.getState().addToast('Could not update marker', 'error');
    }
  },

  removeMarker: async (id) => {
    try {
      // Find songId before deleting (needed for sync broadcast)
      const songId = Object.entries(get().markersBySong)
        .find(([, markers]) => markers.some((m) => m.id === id))?.[0] ?? '';
      await deleteMarker(id);
      emitMarkerDelete(id, songId);
      set((state) => ({
        markersBySong: Object.fromEntries(
          Object.entries(state.markersBySong).map(([songId, markers]) => [
            songId,
            markers.filter((m) => m.id !== id),
          ])
        ),
      }));
    } catch (error) {
      console.error('Failed to delete marker:', error);
      useToastStore.getState().addToast('Could not delete marker', 'error');
    }
  },
}));