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
} from '../services/db';

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
    const raw = await getAllSongs();
    // Migrate legacy songs that predate the isDummy field
    const songs = raw.map((s) => ({ ...s, isDummy: s.isDummy ?? false }));
    const savedOrder = await getConfig<unknown>('songOrder');
    const songOrder = migrateOrder(savedOrder, songs.map((s) => s.id));
    set({ songs, songOrder });
  },

  addSong: async (song) => {
    await saveSong(song);
    set((state) => {
      const exists = state.songs.some((s) => s.id === song.id);
      const newOrder = exists
        ? state.songOrder
        : [...state.songOrder, { type: 'song' as const, songId: song.id }];
      return {
        songs: exists
          ? state.songs.map((s) => (s.id === song.id ? song : s))
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
  },

  setActiveSongId: async (id) => {
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
  },

  removeSong: async (id) => {
    await deleteSong(id);
    await deleteAudioFile(id);
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
  },

  // --- Setlist actions ---

  moveItem: async (index, direction) => {
    const { songOrder } = get();
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= songOrder.length) return;

    const newOrder = [...songOrder];
    [newOrder[index], newOrder[targetIdx]] = [newOrder[targetIdx], newOrder[index]];
    set({ songOrder: newOrder });
    await setConfig('songOrder', newOrder);
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
    await setConfig('songOrder', newOrder);
  },

  addPause: async (afterIndex, duration = 5) => {
    const id = `pause-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const pause: SetlistItem = { type: 'pause', id, duration };
    set((state) => {
      const newOrder = [...state.songOrder];
      newOrder.splice(afterIndex + 1, 0, pause);
      return { songOrder: newOrder };
    });
    await setConfig('songOrder', get().songOrder);
  },

  updatePause: async (id, duration, label) => {
    set((state) => ({
      songOrder: state.songOrder.map((item) =>
        item.type === 'pause' && item.id === id
          ? { ...item, duration, ...(label !== undefined && { label }) }
          : item,
      ),
    }));
    await setConfig('songOrder', get().songOrder);
  },

  removePause: async (id) => {
    set((state) => ({
      songOrder: state.songOrder.filter(
        (item) => !(item.type === 'pause' && item.id === id),
      ),
    }));
    await setConfig('songOrder', get().songOrder);
  },

  updateSong: async (song) => {
    await saveSong(song);
    set((state) => ({
      songs: state.songs.map((s) => (s.id === song.id ? song : s)),
    }));
  },

  addMarker: async (marker) => {
    await saveMarker(marker);
    set((state) => ({
      markersBySong: {
        ...state.markersBySong,
        [marker.songId]: [
          ...(state.markersBySong[marker.songId] ?? []),
          marker,
        ].sort((a, b) => a.startTime - b.startTime),
      },
    }));
  },

  updateMarker: async (marker) => {
    await saveMarker(marker);
    set((state) => ({
      markersBySong: {
        ...state.markersBySong,
        [marker.songId]: (state.markersBySong[marker.songId] ?? [])
          .map((m) => (m.id === marker.id ? marker : m))
          .sort((a, b) => a.startTime - b.startTime),
      },
    }));
  },

  removeMarker: async (id) => {
    await deleteMarker(id);
    set((state) => ({
      markersBySong: Object.fromEntries(
        Object.entries(state.markersBySong).map(([songId, markers]) => [
          songId,
          markers.filter((m) => m.id !== id),
        ])
      ),
    }));
  },
}));