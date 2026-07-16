import { useState, useCallback, useEffect } from 'react';
import { useSongStore } from '../stores/useSongStore';
import { useToastStore } from '../stores/useToastStore';
import { analyzeRmsGain } from '../services/audioAnalysis';
import { saveAudioFile, getAudioFile, getSong } from '../services/db';
import type { SongData } from '../types';
import { useSetlistStore } from '../stores/useSetlistStore';
import { navigateToSong } from '../utils/songNavigation';

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
  const updateSong = useSongStore((state) => state.updateSong);

  const audioUrl = activeSongId ? audioUrls[activeSongId] ?? null : null;

  // Revoke object URLs of songs that no longer exist in the library,
  // otherwise their audio blobs (up to ~30 MB each) stay referenced forever.
  // Implemented as a store subscription so the cleanup runs on song removal
  // without subscribing this hook's render to the songs array.
  useEffect(() => {
    return useSongStore.subscribe((state, prevState) => {
      if (state.songs === prevState.songs) return;
      const ids = new Set(state.songs.map((s) => s.id));
      setAudioUrls((prev) => {
        const stale = Object.entries(prev).filter(([id]) => !ids.has(id));
        if (stale.length === 0) return prev;
        for (const [, url] of stale) URL.revokeObjectURL(url);
        return Object.fromEntries(Object.entries(prev).filter(([id]) => ids.has(id)));
      });
    });
  }, []);

  /** Publish a fresh object URL for a song, revoking a replaced one.
   *  revokeObjectURL is idempotent, so a double-invoked updater
   *  (React StrictMode) is harmless. */
  const publishAudioUrl = useCallback((songId: string, url: string) => {
    setAudioUrls((prev) => {
      if (prev[songId] && prev[songId] !== url) URL.revokeObjectURL(prev[songId]);
      return { ...prev, [songId]: url };
    });
  }, []);

  const handleFile = useCallback(async (file: File) => {
    onFileLoaded?.();
    try {
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

      await useSongStore.getState().addSong(song);
      await useSetlistStore.getState().addSongToActiveSetlist(song.id);
      // Unified activation sequence (sets active song, loads tabs + sheets)
      await navigateToSong(song.id);
      publishAudioUrl(song.id, URL.createObjectURL(file));
    } catch (error) {
      console.error('Failed to load audio file:', file.name, error);
      useToastStore.getState().addToast('Could not load audio file', 'error');
    }
  }, [onFileLoaded, publishAudioUrl]);

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
    try {
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
      publishAudioUrl(dummySongId, URL.createObjectURL(file));
      onUpgraded?.();
    } catch (error) {
      console.error('Failed to upgrade dummy song:', file.name, error);
      useToastStore.getState().addToast('Could not attach audio file', 'error');
    }
  }, [updateSong, onUpgraded, publishAudioUrl]);

  /** Load persisted audio from IndexedDB for a given song */
  const loadPersistedAudio = useCallback(async (songId: string): Promise<string | null> => {
    // Already cached in memory
    if (audioUrls[songId]) return audioUrls[songId];

    try {
      const stored = await getAudioFile(songId);
      if (!stored) return null;

      const blob = new Blob([stored.data], { type: stored.mimeType });
      const url = URL.createObjectURL(blob);
      publishAudioUrl(songId, url);
      return url;
    } catch (error) {
      console.error('Failed to load persisted audio:', songId, error);
      useToastStore.getState().addToast('Could not load stored audio', 'error');
      return null;
    }
  }, [audioUrls, publishAudioUrl]);

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
