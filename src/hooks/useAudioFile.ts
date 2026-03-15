import { useState, useCallback } from 'react';
import { useSongStore } from '../stores/useSongStore';
import { useTabStore } from '../stores/useTabStore';
import { analyzeRmsGain } from '../services/audioAnalysis';

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
    const existingSong = useSongStore.getState().songs.find((s) => s.id === existingId);

    const song = {
      id: existingId,
      title: existingSong?.title ?? file.name.replace(/\.[^.]+$/, ''),
      fileName: file.name,
      fileSize: file.size,
      duration: existingSong?.duration ?? 0,
      createdAt: existingSong?.createdAt ?? Date.now(),
      volume: existingSong?.volume ?? 1.0,
      normalizationGain: existingSong?.normalizationGain ?? normalizationGain,
      normalizationEnabled: existingSong?.normalizationEnabled ?? (normalizationGain !== 1.0),
      isDummy: false,
    };

    await addSong(song);
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

    await updateSong(upgraded);
    setAudioUrls((prev) => ({ ...prev, [dummySongId]: url }));
    onUpgraded?.();
  }, [updateSong, onUpgraded]);

  return {
    audioUrl,
    isDragging,
    handleFile,
    handleDrop,
    handleFileInput,
    handleDragOver,
    handleDragLeave,
    upgradeDummySong,
  };
}