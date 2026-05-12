// Shared sync protocol types – imported by both server and client.
// All WebSocket events and their payloads are defined here so that
// changes to the protocol surface as type errors on both sides.

// --- Roles ---

export type SyncRole = 'host' | 'viewer';

// --- Controller commands (sent by Controller, applied by Host) ---

export type ControlCommandType =
  | 'play'
  | 'pause'
  | 'seek'
  | 'nextSong'
  | 'prevSong'
  | 'tempoChange'
  | 'songSelect';

export interface ControlCommand {
  type: ControlCommandType;
  value?: number;  // seek: seconds, tempoChange: new rate (0.5–1.5)
  songId?: string; // songSelect: target song ID
}

// --- Playback state (broadcast by host) ---
export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;    // seconds
  playbackRate: number;   // 0.5 – 1.5
  preservePitch: boolean;
  timestamp: number;      // Date.now() when state was captured – for drift compensation
  countdownRemaining: number | null;  // seconds until next song (null = no countdown)
  autoAdvance: boolean;
  tickPosition: number | null;  // alphaTab tick (Dummy+GP only, null otherwise)
  countInBeat: number | null;   // current count-in beat (e.g. 1–4), null = no count-in active
}

// --- Client → Server events ---

export interface ClientToServerEvents {
  // Connection / role
  'session:join': (payload: { role: SyncRole; displayName: string }) => void;

  // Controller role
  'controller:request': () => void;
  'controller:release': () => void;

  // Controller transport commands
  'control:command': (payload: ControlCommand) => void;

  // Playback (host only)
  'playback:update': (state: PlaybackState) => void;

  // Song / setlist selection (host only)
  'song:select': (payload: { songId: string }) => void;

  // Full song data push (host sends to viewers on song switch)
  'song:data': (payload: SongDataPayload) => void;

  // Full setlist sync (host sends all songs + order)
  'setlist:sync': (payload: SetlistSyncPayload) => void;

  // Marker CRUD (all roles)
  'marker:save': (payload: { marker: MarkerSyncPayload }) => void;
  'marker:delete': (payload: { markerId: string; songId: string }) => void;

  // Tab content CRUD (all roles)
  'tab:save': (payload: { tab: TabSyncPayload }) => void;
  'tab:delete': (payload: { tabId: string; songId: string }) => void;

  // Tab sheet CRUD (all roles)
  'sheet:save': (payload: { sheet: SheetSyncPayload }) => void;
  'sheet:delete': (payload: { sheetId: string; songId: string }) => void;
}

// --- Server → Client events ---

export interface ServerToClientEvents {
  // Session lifecycle
  'session:welcome': (payload: SessionSnapshot) => void;
  'session:peer-joined': (payload: PeerInfo) => void;
  'session:peer-left': (payload: { peerId: string }) => void;
  'session:error': (payload: { message: string }) => void;

  // Controller role
  'controller:granted': (payload: { peerId: string }) => void;
  'controller:denied': (payload: { reason: string }) => void;
  'controller:released': (payload: { peerId: string }) => void;

  // Controller command (forwarded to host)
  'control:command': (payload: ControlCommand) => void;

  // Playback
  'playback:update': (state: PlaybackState) => void;

  // Song / setlist selection
  'song:select': (payload: { songId: string }) => void;

  // Full song data (viewers receive on song switch + on join)
  'song:data': (payload: SongDataPayload) => void;

  // Full setlist sync
  'setlist:sync': (payload: SetlistSyncPayload) => void;

  // Marker sync
  'marker:save': (payload: { marker: MarkerSyncPayload }) => void;
  'marker:delete': (payload: { markerId: string; songId: string }) => void;

  // Tab sync
  'tab:save': (payload: { tab: TabSyncPayload }) => void;
  'tab:delete': (payload: { tabId: string; songId: string }) => void;

  // Sheet sync
  'sheet:save': (payload: { sheet: SheetSyncPayload }) => void;
  'sheet:delete': (payload: { sheetId: string; songId: string }) => void;
}

// --- Sync payloads (mirror the IndexedDB shapes) ---
// Deliberately duplicated from src/types to avoid cross-project import issues.
// The server has no access to the client's type system at runtime.

export interface MarkerSyncPayload {
  id: string;
  songId: string;
  type: string;
  label: string;
  startTime: number;
  color: string;
}

export interface TabSyncPayload {
  id: string;
  songId: string;
  markerId: string;
  sheetId: string;
  content: string;
  updatedAt: number;
}

export interface SheetSyncPayload {
  id: string;
  songId: string;
  name: string;
  type: string;
  order: number;
}

// --- Full song data payload (sent to viewers on song switch) ---

export interface SongSyncPayload {
  id: string;
  title: string;
  fileName: string;
  fileSize: number;
  duration: number;
  createdAt: number;
  volume: number;
  normalizationGain: number;
  normalizationEnabled: boolean;
  isDummy: boolean;
  gpFileName: string | null;
  syncOffset: number | null;
  bpmAdjust: number | null;
  bpm: number | null;
  timeSignature: [number, number] | null;
}

export interface SongDataPayload {
  song: SongSyncPayload;
  markers: MarkerSyncPayload[];
  tabs: TabSyncPayload[];
  sheets: SheetSyncPayload[];
  /** Guitar Pro file binary (null if no GP file attached) */
  gpData: ArrayBuffer | null;
  gpFileName: string | null;
}

// --- Setlist sync payload ---

export interface SetlistSyncPayload {
  songs: SongSyncPayload[];
  songOrder: unknown[];  // SetlistItem[] – kept generic for server passthrough
  activeSetlistName: string | null;
}

// --- Session snapshot (sent to late joiners) ---

export interface PeerInfo {
  peerId: string;
  displayName: string;
  role: SyncRole;
  canControl: boolean;
}

export interface SessionSnapshot {
  peerId: string;
  role: SyncRole;
  peers: PeerInfo[];
  activeSongId: string | null;
  playback: PlaybackState | null;
  songData: SongDataPayload | null;
  setlist: SetlistSyncPayload | null;
  controllerId: string | null;
}