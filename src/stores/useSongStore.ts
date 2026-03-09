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
  activeSong: SongData | null;
  markers: SectionMarker[];

  // --- Song actions ---
  loadAllSongs: () => Promise<void>;
  addSong: (song: SongData) => Promise<void>;
  setActiveSong: (song: SongData) => Promise<void>;
  removeSong: (id: string) => Promise<void>;

  // --- Marker actions ---
  addMarker: (marker: SectionMarker) => Promise<void>;
  updateMarker: (marker: SectionMarker) => Promise<void>;
  removeMarker: (id: string) => Promise<void>;
}

export const useSongStore = create<SongStore>((set) => ({
  songs: [],
  activeSong: null,
  markers: [],

  loadAllSongs: async () => {
    const songs = await getAllSongs();
    set({ songs });
  },

  addSong: async (song) => {
    await saveSong(song);
    set((state) => ({ songs: [...state.songs, song] }));
  },

  setActiveSong: async (song) => {
    const markers = await getMarkersForSong(song.id);
    set({ activeSong: song, markers: markers.sort((a, b) => a.startTime - b.startTime) });
  },
  
  removeSong: async (id) => {
    await deleteSong(id);
    set((state) => ({
      songs: state.songs.filter((s) => s.id !== id),
      activeSong: state.activeSong?.id === id ? null : state.activeSong,
      markers: state.activeSong?.id === id ? [] : state.markers,
    }));
  },

  addMarker: async (marker) => {
    await saveMarker(marker);
    set((state) => ({
      markers: [...state.markers, marker].sort((a, b) => a.startTime - b.startTime),
    }));
  },

  updateMarker: async (marker) => {
    await saveMarker(marker);
    set((state) => ({
      markers: state.markers
        .map((m) => (m.id === marker.id ? marker : m))
        .sort((a, b) => a.startTime - b.startTime),
    }));
  },

  removeMarker: async (id) => {
    await deleteMarker(id);
    set((state) => ({
      markers: state.markers.filter((m) => m.id !== id),
    }));
  },
}));