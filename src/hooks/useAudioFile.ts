import { useState, useCallback } from 'react';
import { useSongStore } from '../stores/useSongStore';
import { useTabStore } from '../stores/useTabStore';
import { analyzeRmsGain } from '../services/audioAnalysis';
import { saveAudioFile, getAudioFile, getSong } from '../services/db';
import type { SongData } from '../types';
import { useSetlistStore } from '../stores/useSetlistStore';

interface UseAudioFileOptions {
  /** Called after a new file is loaded, before wavesurfer picks it up */
  onFileLoaded?: () => void;
  /** Called after a dummy song is upgraded with an audio file */
  onUpgraded?: () => void;
}

export function useAudioFile({ onFileLoaded, onUpgraded }: UseAudioFileOptions = {}) {
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const [isDragging, setIsDragging] = useState(false);

  const activeSongId = useSongStore((state) => state.activeSongId);
  const addSong = useSongStore((state) => state.addSong);
  const updateSong = useSongStore((state) => state.updateSong);
  const setActiveSongId = useSongStore((state) => state.setActiveSongId);
  const loadTabsForSong = useTabStore((state) => state.loadTabsForSong);

  const audioUrl = activeSongId ? audioUrls[activeSongId] ?? null : null;

  const handleFile = useCallback(async (file: File) => {
    const url = URL.createObjectURL(file);
    onFileLoaded?.();

    // Analyze loudness
    const normalizationGain = await analyzeRmsGain(file);

    // Preserve metadata if song was previously imported
    const existingId = `${file.name}-${file.size}`;
    const existingSong = useSongStore.getState().songs.find((s) => s.id === existingId)
      ?? await getSong(existingId);

    const song: SongData = existingSong
      ? {
          ...existingSong,
          fileName: file.name,
          fileSize: file.size,
          normalizationGain,
          normalizationEnabled: normalizationGain !== 1.0,
          isDummy: false,
        }
      : {
          id: existingId,
          title: file.name.replace(/\.[^.]+$/, ''),
          fileName: file.name,
          fileSize: file.size,
          duration: 0,
          createdAt: Date.now(),
          volume: 1.0,
          normalizationGain,
          normalizationEnabled: normalizationGain !== 1.0,
          isDummy: false,
          gpFileName: null,
          syncPoints: null,
          syncOffset: null,
          bpmAdjust: null,
          bpm: null,
          timeSignature: null,
        };

    // Persist audio data to IndexedDB
    const arrayBuffer = await file.arrayBuffer();
    await saveAudioFile(song.id, arrayBuffer, file.type || 'audio/mpeg');

    await addSong(song);
    await useSetlistStore.getState().addSongToActiveSetlist(song.id);
    await setActiveSongId(song.id);
    await loadTabsForSong(song.id);
    await useTabStore.getState().loadSheetsForSong(song.id);
    setAudioUrls((prev) => ({ ...prev, [song.id]: url }));
  }, [addSong, setActiveSongId, loadTabsForSong, onFileLoaded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  /** Attach a real audio file to an existing dummy song (upgrade flow) */
  const upgradeDummySong = useCallback(async (file: File, dummySongId: string) => {
    const url = URL.createObjectURL(file);
    const normalizationGain = await analyzeRmsGain(file);

    const existing = useSongStore.getState().songs.find((s) => s.id === dummySongId);
    if (!existing) return;

    const upgraded = {
      ...existing,
      fileName: file.name,
      fileSize: file.size,
      normalizationGain,
      normalizationEnabled: normalizationGain !== 1.0,
      isDummy: false,
    };

    // Persist audio data to IndexedDB
    const arrayBuffer = await file.arrayBuffer();
    await saveAudioFile(dummySongId, arrayBuffer, file.type || 'audio/mpeg');

    await updateSong(upgraded);
    setAudioUrls((prev) => ({ ...prev, [dummySongId]: url }));
    onUpgraded?.();
  }, [updateSong, onUpgraded]);

  /** Load persisted audio from IndexedDB for a given song */
  const loadPersistedAudio = useCallback(async (songId: string): Promise<string | null> => {
    // Already cached in memory
    if (audioUrls[songId]) return audioUrls[songId];

    const stored = await getAudioFile(songId);
    if (!stored) return null;

    const blob = new Blob([stored.data], { type: stored.mimeType });
    const url = URL.createObjectURL(blob);
    setAudioUrls((prev) => ({ ...prev, [songId]: url }));
    return url;
  }, [audioUrls]);

  return {
    audioUrl,
    isDragging,
    handleFile,
    handleDrop,
    handleFileInput,
    handleDragOver,
    handleDragLeave,
    upgradeDummySong,
    loadPersistedAudio,
  };
}