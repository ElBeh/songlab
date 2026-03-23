import { useEffect, useRef, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SyncRole,
} from '../../shared/syncProtocol';
import { useSyncStore } from '../stores/useSyncStore';
import { useSongStore } from '../stores/useSongStore';
import { useTabStore } from '../stores/useTabStore';
import { useTempoStore } from '../stores/useTempoStore';
import { setSyncSocket, runAsRemote } from '../services/syncEmitter';
import {
  saveSong as dbSaveSong,
  saveMarker as dbSaveMarker,
  deleteMarker as dbDeleteMarker,
  saveTab as dbSaveTab,
  deleteTab as dbDeleteTab,
  saveTabSheet as dbSaveTabSheet,
  deleteTabSheet as dbDeleteTabSheet,
  saveGpFile as dbSaveGpFile,
  deleteGpFile as dbDeleteGpFile,
} from '../services/db';
import type { SongData, SectionMarker, SectionTab, TabSheet } from '../types';

type SyncSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface UseSyncSessionOptions {
  /** Called when the server selects a different song */
  onSongSelect?: (songId: string) => void;
  /** Called when host sends playback state (viewer applies it) */
  onPlaybackSync?: (isPlaying: boolean, currentTime: number) => void;
}

/**
 * Manages the socket.io connection for Band Sync.
 *
 * Returns connect / disconnect helpers plus a ref to the raw socket
 * for other hooks to emit events through.
 */
export function useSyncSession({
  onSongSelect,
  onPlaybackSync,
}: UseSyncSessionOptions = {}) {
  const socketRef = useRef<SyncSocket | null>(null);
  const onSongSelectRef = useRef(onSongSelect);
  onSongSelectRef.current = onSongSelect;
  const onPlaybackSyncRef = useRef(onPlaybackSync);
  onPlaybackSyncRef.current = onPlaybackSync;

  const {
    setStatus,
    setSession,
    setServerUrl,
    addPeer,
    removePeer,
    setError,
    setSyncedPlayback,
    reset,
  } = useSyncStore.getState();

  // --- Connect ---

  const connect = useCallback((serverUrl: string, role: SyncRole, displayName: string) => {
    // Prevent duplicate connections
    if (socketRef.current?.connected) {
      socketRef.current.disconnect();
    }

    setStatus('connecting');
    setServerUrl(serverUrl);

    const socket: SyncSocket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;
    setSyncSocket(socket);

    // --- Lifecycle events ---

    socket.on('connect', () => {
      setStatus('connecting'); // Still waiting for session:welcome
      socket.emit('session:join', { role, displayName });
    });

    socket.on('disconnect', () => {
      setStatus('disconnected');
    });

    socket.io.on('reconnect_attempt', () => {
      setStatus('connecting');
    });

    socket.io.on('reconnect', () => {
      // Re-join after reconnect
      socket.emit('session:join', { role, displayName });
    });

    socket.io.on('reconnect_failed', () => {
      setError('Reconnection failed');
      setStatus('disconnected');
    });

    socket.on('connect_error', (err) => {
      setError(`Connection error: ${err.message}`);
      setStatus('disconnected');
    });

    // --- Helper: apply full song data from host ---

    async function applySongData(payload: import('../../shared/syncProtocol').SongDataPayload) {
      await runAsRemote(async () => {
        const song = payload.song as SongData;
        // Persist song + markers + sheets + tabs to local IndexedDB
        await dbSaveSong(song);
        for (const m of payload.markers) await dbSaveMarker(m as SectionMarker);
        for (const s of payload.sheets) await dbSaveTabSheet(s as TabSheet);
        for (const t of payload.tabs) await dbSaveTab(t as SectionTab);

        // Persist GP file (or remove if host has none)
        if (payload.gpData && payload.gpFileName) {
          await dbSaveGpFile(song.id, payload.gpData, payload.gpFileName);
        } else {
          await dbDeleteGpFile(song.id);
        }

        // Update song store (add or update the song, set active)
        const { songs } = useSongStore.getState();
        const exists = songs.some((s) => s.id === song.id);
        const sortedMarkers = (payload.markers as SectionMarker[])
          .sort((a, b) => a.startTime - b.startTime);
        useSongStore.setState({
          songs: exists
            ? songs.map((s) => (s.id === song.id ? song : s))
            : [...songs, song],
          activeSongId: song.id,
          markersBySong: {
            ...useSongStore.getState().markersBySong,
            [song.id]: sortedMarkers,
          },
        });

        // Update tab store
        const tabMap: Record<string, SectionTab> = {};
        for (const t of payload.tabs) {
          tabMap[`${t.markerId}-${t.sheetId}`] = t as SectionTab;
        }
        const sheets = (payload.sheets as TabSheet[]).sort((a, b) => a.order - b.order);
        useTabStore.setState({
          tabs: tabMap,
          sheets,
          activeSheetId: sheets[0]?.id ?? null,
          // Set first marker as active so tabs render immediately
          activeMarkerId: sortedMarkers[0]?.id ?? null,
        });
      });
    }

    // --- Helper: apply setlist from host ---

    function applySetlist(payload: import('../../shared/syncProtocol').SetlistSyncPayload) {
      runAsRemote(() => {
        const songs = payload.songs as SongData[];
        const songOrder = payload.songOrder as import('../types').SetlistItem[];
        useSongStore.setState({ songs, songOrder });
      });
    }

    // --- Session events ---

    socket.on('session:welcome', (snapshot) => {
      setSession(snapshot.peerId, snapshot.role, snapshot.peers);

      // Apply setlist first (so song store has all songs)
      if (snapshot.setlist) {
        applySetlist(snapshot.setlist);
      }
      // Apply initial song data from host (for late joiners)
      if (snapshot.songData) {
        applySongData(snapshot.songData);
      }
      if (snapshot.playback) {
        setSyncedPlayback(snapshot.playback.currentTime, snapshot.playback.isPlaying, snapshot.playback.countdownRemaining, snapshot.playback.autoAdvance, snapshot.playback.tickPosition);
        onPlaybackSyncRef.current?.(snapshot.playback.isPlaying, snapshot.playback.currentTime);
      }
    });

    socket.on('session:peer-joined', (peer) => {
      addPeer(peer);
    });

    socket.on('session:peer-left', ({ peerId }) => {
      removePeer(peerId);
    });

    socket.on('session:error', ({ message }) => {
      setError(message);
    });

    // --- Song selection ---

    socket.on('song:select', ({ songId }) => {
      onSongSelectRef.current?.(songId);
    });

    // --- Full song data (viewer receives complete song + markers + tabs + sheets) ---

    socket.on('song:data', (payload) => {
      applySongData(payload);
    });

    // --- Setlist sync ---

    socket.on('setlist:sync', (payload) => {
      applySetlist(payload);
    });

    // --- Playback sync (viewer receives from host) ---

    socket.on('playback:update', (state) => {
      setSyncedPlayback(state.currentTime, state.isPlaying, state.countdownRemaining, state.autoAdvance, state.tickPosition);
      useTempoStore.getState().setPlaybackRate(state.playbackRate);
      onPlaybackSyncRef.current?.(state.isPlaying, state.currentTime);
    });

    // --- Marker sync ---

    socket.on('marker:save', ({ marker }) => {
      runAsRemote(async () => {
        // Persist to local IndexedDB
        await dbSaveMarker(marker as SectionMarker);
        // Update store directly (avoid re-emit via store method)
        const { markersBySong } = useSongStore.getState();
        const existing = markersBySong[marker.songId] ?? [];
        const updated = existing.some((m) => m.id === marker.id)
          ? existing.map((m) => (m.id === marker.id ? marker as SectionMarker : m))
          : [...existing, marker as SectionMarker];
        useSongStore.setState({
          markersBySong: {
            ...markersBySong,
            [marker.songId]: updated.sort((a, b) => a.startTime - b.startTime),
          },
        });
      });
    });

    socket.on('marker:delete', ({ markerId, songId }) => {
      runAsRemote(async () => {
        await dbDeleteMarker(markerId);
        const { markersBySong } = useSongStore.getState();
        useSongStore.setState({
          markersBySong: {
            ...markersBySong,
            [songId]: (markersBySong[songId] ?? []).filter((m) => m.id !== markerId),
          },
        });
      });
    });

    // --- Tab sync ---

    socket.on('tab:save', ({ tab }) => {
      runAsRemote(async () => {
        await dbSaveTab(tab as SectionTab);
        const { tabs } = useTabStore.getState();
        useTabStore.setState({
          tabs: { ...tabs, [`${tab.markerId}-${tab.sheetId}`]: tab as SectionTab },
        });
      });
    });

    socket.on('tab:delete', ({ tabId }) => {
      runAsRemote(async () => {
        await dbDeleteTab(tabId);
        const { tabs } = useTabStore.getState();
        const updated = { ...tabs };
        for (const key in updated) {
          if (updated[key].id === tabId) delete updated[key];
        }
        useTabStore.setState({ tabs: updated });
      });
    });

    // --- Sheet sync ---

    socket.on('sheet:save', ({ sheet }) => {
      runAsRemote(async () => {
        await dbSaveTabSheet(sheet as TabSheet);
        const { sheets } = useTabStore.getState();
        const existing = sheets.some((s) => s.id === sheet.id);
        const updated = existing
          ? sheets.map((s) => (s.id === sheet.id ? sheet as TabSheet : s))
          : [...sheets, sheet as TabSheet];
        useTabStore.setState({
          sheets: updated.sort((a, b) => a.order - b.order),
        });
      });
    });

    socket.on('sheet:delete', ({ sheetId }) => {
      runAsRemote(async () => {
        await dbDeleteTabSheet(sheetId);
        const { sheets, activeSheetId } = useTabStore.getState();
        const updated = sheets.filter((s) => s.id !== sheetId);
        useTabStore.setState({
          sheets: updated,
          activeSheetId: activeSheetId === sheetId ? (updated[0]?.id ?? null) : activeSheetId,
        });
      });
    });

  }, [setStatus, setServerUrl, setSession, addPeer, removePeer, setError, setSyncedPlayback]);

  // --- Disconnect ---

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setSyncSocket(null);
    reset();
  }, [reset]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSyncSocket(null);
    };
  }, []);

  return {
    socketRef,
    connect,
    disconnect,
  };
}