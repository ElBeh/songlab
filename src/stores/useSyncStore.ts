import { create } from 'zustand';
import type { SyncRole, PeerInfo } from '../../shared/syncProtocol';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

interface SyncStore {
  // Connection
  status: ConnectionStatus;
  serverUrl: string | null;
  peerId: string | null;
  role: SyncRole | null;
  peers: PeerInfo[];
  error: string | null;

  // Synced playback (viewer receives from host)
  syncedTime: number;
  syncedIsPlaying: boolean;
  syncedCountdown: number | null;
  syncedAutoAdvance: boolean;
  syncedTickPosition: number | null;

  // Actions
  setStatus: (status: ConnectionStatus) => void;
  setSession: (peerId: string, role: SyncRole, peers: PeerInfo[]) => void;
  setServerUrl: (url: string | null) => void;
  addPeer: (peer: PeerInfo) => void;
  removePeer: (peerId: string) => void;
  setError: (error: string | null) => void;
  setSyncedPlayback: (time: number, isPlaying: boolean, countdown?: number | null, autoAdvance?: boolean, tickPosition?: number | null) => void;
  reset: () => void;
}

const initialState = {
  status: 'disconnected' as ConnectionStatus,
  serverUrl: null,
  peerId: null,
  role: null,
  peers: [],
  error: null,
  syncedTime: 0,
  syncedIsPlaying: false,
  syncedCountdown: null,
  syncedAutoAdvance: false,
  syncedTickPosition: null,
};

export const useSyncStore = create<SyncStore>((set) => ({
  ...initialState,

  setStatus: (status) => set({ status, error: status === 'connected' ? null : undefined }),
  setSession: (peerId, role, peers) => set({ peerId, role, peers, status: 'connected', error: null }),
  setServerUrl: (url) => set({ serverUrl: url }),
  addPeer: (peer) => set((state) => ({
    peers: [...state.peers.filter((p) => p.peerId !== peer.peerId), peer],
  })),
  removePeer: (peerId) => set((state) => ({
    peers: state.peers.filter((p) => p.peerId !== peerId),
  })),
  setError: (error) => set({ error }),
  setSyncedPlayback: (time, isPlaying, countdown, autoAdvance, tickPosition) => set({
    syncedTime: time,
    syncedIsPlaying: isPlaying,
    syncedCountdown: countdown ?? null,
    syncedAutoAdvance: autoAdvance ?? false,
    syncedTickPosition: tickPosition ?? null,
  }),
  reset: () => set(initialState),
}));