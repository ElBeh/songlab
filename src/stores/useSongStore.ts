import { create } from 'zustand';
import type { SongData, SectionMarker } from '../types';
import {
  saveSong,
  getAllSongs,
  deleteSong,
  saveMarker,
  getMarkersForSong,
  deleteMarker,
} from '../services/db';

interface SongStore {
  // --- State ---
  songs: SongData[];
  activeSongId: string | null;
  markersBySong: Record<string, SectionMarker[]>;

  // --- Derived ---
  getActiveSong: () => SongData | null;
  getActiveMarkers: () => SectionMarker[];

  // --- Song actions ---
  loadAllSongs: () => Promise<void>;
  addSong: (song: SongData) => Promise<void>;
  setActiveSongId: (id: string) => Promise<void>;
  updateSong: (song: SongData) => Promise<void>;
  removeSong: (id: string) => Promise<void>;


  // --- Marker actions ---
  addMarker: (marker: SectionMarker) => Promise<void>;
  updateMarker: (marker: SectionMarker) => Promise<void>;
  removeMarker: (id: string) => Promise<void>;
}

export const useSongStore = create<SongStore>((set, get) => ({
  songs: [],
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

  loadAllSongs: async () => {
    const songs = await getAllSongs();
    set({ songs });
  },


  addSong: async (song) => {
    await saveSong(song);
    set((state) => {
      const exists = state.songs.some((s) => s.id === song.id);
      return {
        songs: exists
          ? state.songs.map((s) => (s.id === song.id ? song : s))
          : [...state.songs, song],
        // Invalidate marker cache so next setActiveSongId reloads from DB
        markersBySong: exists
          ? Object.fromEntries(
              Object.entries(state.markersBySong).filter(([key]) => key !== song.id)
            )
          : state.markersBySong,
      };
    });
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
      activeSongId: state.activeSongId === id
        ? (state.songs.find((s) => s.id !== id)?.id ?? null)
        : state.activeSongId,
      markersBySong: Object.fromEntries(
        Object.entries(state.markersBySong).filter(([key]) => key !== id)
      ),
    }));
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