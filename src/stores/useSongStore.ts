import { create } from 'zustand';
import type { SongData, SectionMarker } from '../types';
import {
  saveSong,
  getAllSongs,
  deleteSong,
  saveMarker,
  getMarkersForSong,
  deleteMarker,
  getConfig,
  setConfig,
} from '../services/db';

interface SongStore {
  // --- State ---
  songs: SongData[];
  songOrder: string[];  // song IDs in user-defined order
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
  moveSong: (id: string, direction: 'up' | 'down') => Promise<void>;


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
    // Songs in explicit order first, then any remaining (newly added) at the end
    const ordered: SongData[] = [];
    for (const id of songOrder) {
      const song = songMap.get(id);
      if (song) {
        ordered.push(song);
        songMap.delete(id);
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
    const savedOrder = await getConfig<string[]>('songOrder');
    set({ songs, songOrder: savedOrder ?? songs.map((s) => s.id) });
  },

  addSong: async (song) => {
    await saveSong(song);
    set((state) => {
      const exists = state.songs.some((s) => s.id === song.id);
      const newOrder = exists
        ? state.songOrder
        : [...state.songOrder, song.id];
      return {
        songs: exists
          ? state.songs.map((s) => (s.id === song.id ? song : s))
          : [...state.songs, song],
        songOrder: newOrder,
        // Invalidate marker cache so next setActiveSongId reloads from DB
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
    set((state) => ({
      songs: state.songs.filter((s) => s.id !== id),
      songOrder: state.songOrder.filter((sid) => sid !== id),
      activeSongId: state.activeSongId === id
        ? (state.songs.find((s) => s.id !== id)?.id ?? null)
        : state.activeSongId,
      markersBySong: Object.fromEntries(
        Object.entries(state.markersBySong).filter(([key]) => key !== id)
      ),
    }));
    await setConfig('songOrder', get().songOrder);
  },

  moveSong: async (id, direction) => {
    const { songOrder } = get();
    const idx = songOrder.indexOf(id);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= songOrder.length) return;

    const newOrder = [...songOrder];
    [newOrder[idx], newOrder[targetIdx]] = [newOrder[targetIdx], newOrder[idx]];
    set({ songOrder: newOrder });
    await setConfig('songOrder', newOrder);
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