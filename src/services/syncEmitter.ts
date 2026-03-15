// Module-level sync emitter.
// Holds the active socket.io reference and provides typed emit helpers.
// The remote flag prevents echo loops: when applying an incoming event
// from the server to a store, the store's emit call is suppressed.

import type { Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  PlaybackState,
  MarkerSyncPayload,
  TabSyncPayload,
  SheetSyncPayload,
  SongDataPayload,
  SetlistSyncPayload,
} from '../../shared/syncProtocol';
import { useSyncStore } from '../stores/useSyncStore';

type SyncSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let _socket: SyncSocket | null = null;
let _isRemote = false;

// --- Socket management ---

export function setSyncSocket(socket: SyncSocket | null): void {
  _socket = socket;
}

// --- Remote flag (prevents echo) ---

export function isRemoteUpdate(): boolean {
  return _isRemote;
}

/**
 * Run a callback with the remote flag set.
 * Store mutations inside `fn` will not trigger re-broadcasts.
 */
export async function runAsRemote(fn: () => void | Promise<void>): Promise<void> {
  _isRemote = true;
  try {
    await fn();
  } finally {
    _isRemote = false;
  }
}

// --- Guard: only emit when connected ---

function canEmit(): boolean {
  if (_isRemote) return false;
  if (!_socket?.connected) return false;
  return useSyncStore.getState().status === 'connected';
}

// --- Host-only guard ---

function isHost(): boolean {
  return useSyncStore.getState().role === 'host';
}

// --- Emit helpers ---

export function emitPlaybackUpdate(state: PlaybackState): void {
  if (!canEmit() || !isHost()) return;
  _socket!.emit('playback:update', state);
}

export function emitSongSelect(songId: string): void {
  if (!canEmit() || !isHost()) return;
  _socket!.emit('song:select', { songId });
}

export function emitSongData(payload: SongDataPayload): void {
  if (!canEmit() || !isHost()) return;
  _socket!.emit('song:data', payload);
}

export function emitMarkerSave(marker: MarkerSyncPayload): void {
  if (!canEmit()) return;
  _socket!.emit('marker:save', { marker });
}

export function emitMarkerDelete(markerId: string, songId: string): void {
  if (!canEmit()) return;
  _socket!.emit('marker:delete', { markerId, songId });
}

export function emitTabSave(tab: TabSyncPayload): void {
  if (!canEmit()) return;
  _socket!.emit('tab:save', { tab });
}

export function emitTabDelete(tabId: string, songId: string): void {
  if (!canEmit()) return;
  _socket!.emit('tab:delete', { tabId, songId });
}

export function emitSheetSave(sheet: SheetSyncPayload): void {
  if (!canEmit()) return;
  _socket!.emit('sheet:save', { sheet });
}

export function emitSheetDelete(sheetId: string, songId: string): void {
  if (!canEmit()) return;
  _socket!.emit('sheet:delete', { sheetId, songId });
}

export function emitSetlistSync(payload: SetlistSyncPayload): void {
  if (!canEmit() || !isHost()) return;
  _socket!.emit('setlist:sync', payload);
}
