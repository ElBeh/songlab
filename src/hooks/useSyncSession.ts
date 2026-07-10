import { useEffect, useRef, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SyncRole,
  ControlCommand,
} from '../../shared/syncProtocol';
import { useSyncStore } from '../stores/useSyncStore';
import { useSongStore } from '../stores/useSongStore';
import { useTabStore } from '../stores/useTabStore';
import { useTempoStore } from '../stores/useTempoStore';
import { setSyncSocket, runAsRemote } from '../services/syncEmitter';
import type { SongData, SectionMarker, SectionTab, TabSheet, SetlistItem } from '../types';
import { useSetlistStore } from '../stores/useSetlistStore';

type SyncSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface UseSyncSessionOptions {
  /** Called when the server selects a different song */
  onSongSelect?: (songId: string) => void;
  /** Called when host sends playback state (viewer applies it) */
  onPlaybackSync?: (isPlaying: boolean, currentTime: number) => void;
  /** Called on host when a controller sends a transport command */
  onControlCommand?: (command: ControlCommand) => void;
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
  onControlCommand,
}: UseSyncSessionOptions = {}) {
  const socketRef = useRef<SyncSocket | null>(null);
  const onSongSelectRef = useRef(onSongSelect);
  onSongSelectRef.current = onSongSelect;
  const onPlaybackSyncRef = useRef(onPlaybackSync);
  onPlaybackSyncRef.current = onPlaybackSync;
  const onControlCommandRef = useRef(onControlCommand);
  onControlCommandRef.current = onControlCommand;

  const {
    setStatus,
    setSession,
    setServerUrl,
    addPeer,
    removePeer,
    setError,
    setController,
    clearController,
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
        const markers = payload.markers as SectionMarker[];
        const gp = payload.gpData && payload.gpFileName
          ? { data: payload.gpData, fileName: payload.gpFileName }
          : null;

        const firstMarkerId = await useSongStore.getState().applyRemoteSongData(song, markers, gp);
        await useTabStore.getState().applyRemoteTabsAndSheets(
          payload.tabs as SectionTab[],
          payload.sheets as TabSheet[],
          firstMarkerId,
        );
      });
    }

    // --- Helper: apply setlist from host ---

    function applySetlist(payload: import('../../shared/syncProtocol').SetlistSyncPayload) {
      // Keep the host's full setlist collection in the sync store (ephemeral,
      // not persisted) so controllers can browse and switch setlists.
      useSyncStore.getState().setSyncedSetlists(
        payload.setlists ?? [],
        payload.activeSetlistId ?? null,
      );
      runAsRemote(async () => {
        useSongStore.getState().applyRemoteSongs(payload.songs as SongData[]);
        await useSetlistStore.getState().setActiveItems(
          payload.songOrder as SetlistItem[],
          payload.activeSetlistName ?? undefined,
        );
      });
    }

    // --- Session events ---

    socket.on('session:welcome', (snapshot) => {
      setSession(snapshot.peerId, snapshot.role, snapshot.peers);

      // Restore controller state from snapshot
      if (snapshot.controllerId) {
        setController(snapshot.controllerId);
      } else {
        clearController();
      }

      // Apply setlist first (so song store has all songs)
      if (snapshot.setlist) {
        applySetlist(snapshot.setlist);
      }
      // Apply initial song data from host (for late joiners)
      if (snapshot.songData) {
        applySongData(snapshot.songData);
      }
      if (snapshot.playback) {
        setSyncedPlayback(snapshot.playback.currentTime, snapshot.playback.isPlaying, snapshot.playback.countdownRemaining, snapshot.playback.autoAdvance, snapshot.playback.tickPosition, snapshot.playback.countInBeat);
        onPlaybackSyncRef.current?.(snapshot.playback.isPlaying, snapshot.playback.currentTime);
      }
    });

    socket.on('session:peer-joined', (peer) => {
      addPeer(peer);
    });

    socket.on('session:peer-left', ({ peerId }) => {
      removePeer(peerId);
      // Controller disconnect is handled by controller:released from server
    });

    socket.on('session:error', ({ message }) => {
      setError(message);
    });

    // --- Controller events ---

    socket.on('controller:granted', ({ peerId }) => {
      setController(peerId);
    });

    socket.on('controller:denied', ({ reason }) => {
      setError(reason);
    });

    socket.on('controller:released', () => {
      clearController();
    });

    // --- Control commands (host receives from controller via server) ---

    socket.on('control:command', (command) => {
      onControlCommandRef.current?.(command);
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
      setSyncedPlayback(state.currentTime, state.isPlaying, state.countdownRemaining, state.autoAdvance, state.tickPosition, state.countInBeat);
      useTempoStore.getState().setPlaybackRate(state.playbackRate);
      onPlaybackSyncRef.current?.(state.isPlaying, state.currentTime);
    });

    // --- Marker sync ---

    socket.on('marker:save', ({ marker }) => {
      runAsRemote(() => useSongStore.getState().applyRemoteMarker(marker as SectionMarker));
    });

    socket.on('marker:delete', ({ markerId, songId }) => {
      runAsRemote(() => useSongStore.getState().applyRemoteMarkerDelete(markerId, songId));
    });

    // --- Tab sync ---

    socket.on('tab:save', ({ tab }) => {
      runAsRemote(() => useTabStore.getState().applyRemoteTab(tab as SectionTab));
    });

    socket.on('tab:delete', ({ tabId }) => {
      runAsRemote(() => useTabStore.getState().applyRemoteTabDelete(tabId));
    });

    // --- Sheet sync ---

    socket.on('sheet:save', ({ sheet }) => {
      runAsRemote(() => useTabStore.getState().applyRemoteSheet(sheet as TabSheet));
    });

    socket.on('sheet:delete', ({ sheetId }) => {
      runAsRemote(() => useTabStore.getState().applyRemoteSheetDelete(sheetId));
    });

  }, [setStatus, setServerUrl, setSession, addPeer, removePeer, setError, setController, clearController, setSyncedPlayback]);

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