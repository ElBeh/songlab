import { useState, useCallback } from 'react';
import { useSongStore } from '../stores/useSongStore';
import { useTabStore } from '../stores/useTabStore';
import { saveGpFile, getGpFile, deleteGpFile } from '../services/db';
import type { SongData } from '../types';

const GP_EXTENSIONS = ['.gp', '.gp3', '.gp4', '.gp5', '.gpx', '.gp8'];

export function isGpFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return GP_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function useGpFile() {
  // songId → ArrayBuffer (in-memory cache)
  const [gpData, setGpData] = useState<Record<string, ArrayBuffer>>({});

  const activeSongId = useSongStore((state) => state.activeSongId);
  const updateSong = useSongStore((state) => state.updateSong);

  const activeGpData = activeSongId ? gpData[activeSongId] ?? null : null;

  /** Load a new GP file and attach it to the active song */
  const handleGpFile = useCallback(async (file: File) => {
    const song = useSongStore.getState().getActiveSong();
    if (!song) return;

    const arrayBuffer = await file.arrayBuffer();
    await saveGpFile(song.id, arrayBuffer, file.name);
    await updateSong({ ...song, gpFileName: file.name, syncPoints: null });
    setGpData((prev) => ({ ...prev, [song.id]: arrayBuffer }));
  }, [updateSong]);

/** Load persisted GP file from IndexedDB */
const loadPersistedGp = useCallback(async (songId: string): Promise<ArrayBuffer | null> => {
    if (gpData[songId]) return gpData[songId];

    const stored = await getGpFile(songId);
    if (!stored) return null;

    setGpData((prev) => ({ ...prev, [songId]: stored.data }));
    return stored.data;
}, [gpData]);

  /** Remove GP file from song */
  const removeGp = useCallback(async (songId: string) => {
    const song = useSongStore.getState().songs.find((s) => s.id === songId);
    if (!song) return;

    await deleteGpFile(songId);
    await updateSong({ ...song, gpFileName: null, syncPoints: null });
    setGpData((prev) => {
      const next = { ...prev };
      delete next[songId];
      return next;
    });
  }, [updateSong]);

  /** Handle file input change event */
  const handleGpFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleGpFile(file);
  }, [handleGpFile]);

  /** Create a new dummy song from a GP file (direct import flow) */
  const createSongFromGpFile = useCallback(async (file: File) => {
    const id = `gp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const title = file.name.replace(/\.[^.]+$/, '');

    const song: SongData = {
      id,
      title,
      fileName: '',
      fileSize: 0,
      duration: 0,
      createdAt: Date.now(),
      volume: 1.0,
      normalizationGain: 1.0,
      normalizationEnabled: false,
      isDummy: true,
      gpFileName: file.name,
      syncOffset: null,
      bpmAdjust: null,
      syncPoints: null,
      bpm: null,
      timeSignature: null,
    };

    const arrayBuffer = await file.arrayBuffer();
    await saveGpFile(id, arrayBuffer, file.name);

    const { addSong, setActiveSongId } = useSongStore.getState();
    await addSong(song);
    await setActiveSongId(id);
    await useTabStore.getState().loadSheetsForSong(id);
    setGpData((prev) => ({ ...prev, [id]: arrayBuffer }));
  }, []);

  return {
    activeGpData,
    handleGpFile,
    handleGpFileInput,
    loadPersistedGp,
    removeGp,
    createSongFromGpFile,
  };
}