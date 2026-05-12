import { create } from 'zustand';
import type { SongData, SectionMarker } from '../types';
import {
  saveSong,
  getAllSongs,
  deleteSong,
  saveMarker,
  getMarkersForSong,
  deleteMarker,
  deleteAudioFile,
  deleteGpFile,
} from '../services/db';
import { emitMarkerSave, emitMarkerDelete } from '../services/syncEmitter';
import { useToastStore } from './useToastStore';

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
    try {
      const raw = await getAllSongs();
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
      set({ songs });
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
          markersBySong: exists
            ? Object.fromEntries(
                Object.entries(state.markersBySong).filter(([key]) => key !== song.id)
              )
            : state.markersBySong,
        };
      });
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
        activeSongId: state.activeSongId === id
          ? (state.songs.find((s) => s.id !== id)?.id ?? null)
          : state.activeSongId,
        markersBySong: Object.fromEntries(
          Object.entries(state.markersBySong).filter(([key]) => key !== id)
        ),
      }));
    } catch (error) {
      console.error('Failed to remove song:', error);
      useToastStore.getState().addToast('Could not delete song', 'error');
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