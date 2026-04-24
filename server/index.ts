import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  PeerInfo,
  PlaybackState,
  SongDataPayload,
  SetlistSyncPayload,
  SessionSnapshot,
} from '../shared/syncProtocol.js';

// --- Config ---

const PORT = Number(process.env.PORT) || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, '..', 'dist');

// --- Express ---

const app = express();
const httpServer = createServer(app);

// Serve Vite production build
app.use(express.static(DIST_DIR));

// --- API: Fetch setlist from external URL ---

const MAX_SETLIST_SIZE = 50 * 1024 * 1024; // 50 MB
const FETCH_TIMEOUT_MS = 15_000;

// CORS for API routes (allow Vite dev server)
const API_CORS_ORIGINS = [
  'http://localhost:5173', 'http://127.0.0.1:5173',
  'http://localhost:5174', 'http://127.0.0.1:5174',
];

function isPrivateUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    const hostname = parsed.hostname;
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      hostname.endsWith('.local')
    );
  } catch {
    return true;
  }
}

/** Transform cloud sharing links into direct download URLs */
function toDirectDownloadUrl(url: string): string {
  // Dropbox: replace dl=0 with dl=1 to force direct download
  if (url.match(/^https:\/\/(www\.)?dropbox\.com\//)) {
    return url.replace(/[?&]dl=0/, (m) => m[0] + 'dl=1');
  }

  // Google Drive: https://drive.google.com/file/d/{fileId}/...
  // → https://drive.google.com/uc?export=download&id={fileId}
  const gdMatch = url.match(/^https:\/\/drive\.google\.com\/file\/d\/([^/]+)/);
  if (gdMatch) {
    return `https://drive.google.com/uc?export=download&id=${gdMatch[1]}`;
  }

  return url;
}

app.get('/api/fetch-setlist', async (req, res) => {
  // CORS
  const origin = req.headers.origin;
  if (origin && API_CORS_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  const url = req.query.url;
  if (typeof url !== 'string' || !url) {
    res.status(400).json({ error: 'Missing "url" query parameter' });
    return;
  }

  if (!url.startsWith('https://')) {
    res.status(400).json({ error: 'Only HTTPS URLs are allowed' });
    return;
  }

  if (isPrivateUrl(url)) {
    res.status(400).json({ error: 'Private/local URLs are not allowed' });
    return;
  }

  try {
    const downloadUrl = toDirectDownloadUrl(url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(downloadUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json, */*',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36',
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      res.status(502).json({ error: `Remote server returned ${response.status}` });
      return;
    }

    // Check content length if available
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_SETLIST_SIZE) {
      res.status(413).json({ error: 'File exceeds 50 MB size limit' });
      return;
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_SETLIST_SIZE) {
      res.status(413).json({ error: 'File exceeds 50 MB size limit' });
      return;
    }

    const text = new TextDecoder().decode(buffer);
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      res.status(422).json({ error: 'Response is not valid JSON' });
      return;
    }

    // Basic setlist format validation: must be an object with an entries array
    if (
      typeof data !== 'object' || data === null ||
      !Array.isArray((data as Record<string, unknown>).entries)
    ) {
      res.status(422).json({ error: 'Invalid setlist format: expected { entries: [...] }' });
      return;
    }

    console.log(`[api] Fetched setlist from ${url} (${buffer.byteLength} bytes)`);
    res.json(data);
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      res.status(504).json({ error: 'Request timed out after 15 seconds' });
      return;
    }
    console.error('[api] Fetch setlist error:', error);
    res.status(502).json({ error: 'Failed to fetch from the provided URL' });
  }
});

// SPA fallback – all non-asset routes serve index.html
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

// --- Socket.io ---

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    // Allow Vite dev server to connect during development
    origin: [
      'http://localhost:5173', 'http://127.0.0.1:5173',
      'http://localhost:5174', 'http://127.0.0.1:5174',
    ],
  },
});

// --- Session state (in-memory, single room) ---

const peers = new Map<string, PeerInfo>();
let hostId: string | null = null;
let controllerId: string | null = null;
let activeSongId: string | null = null;
let playbackState: PlaybackState | null = null;
let songData: SongDataPayload | null = null;
let setlistData: SetlistSyncPayload | null = null;

function isHost(socketId: string): boolean {
  return socketId === hostId;
}

function isController(socketId: string): boolean {
  return socketId === controllerId;
}

function canControl(socketId: string): boolean {
  return isHost(socketId) || isController(socketId);
}

// --- Connection handling ---

io.on('connection', (socket) => {
  console.log(`[sync] Client connected: ${socket.id}`);

  // --- Join session ---

  socket.on('session:join', ({ role, displayName }) => {
    // First joiner with role 'host' becomes the host.
    // If a host already exists, downgrade to viewer.
    const assignedRole = (role === 'host' && hostId === null) ? 'host' : 'viewer';

    if (assignedRole === 'host') {
      hostId = socket.id;
    }

    const peer: PeerInfo = {
      peerId: socket.id,
      displayName,
      role: assignedRole,
      canControl: assignedRole === 'host',
    };
    peers.set(socket.id, peer);

    // Send snapshot to the joining client
    const snapshot: SessionSnapshot = {
      peerId: socket.id,
      role: assignedRole,
      peers: Array.from(peers.values()),
      activeSongId,
      playback: playbackState,
      songData,
      setlist: setlistData,
      controllerId,
    };
    socket.emit('session:welcome', snapshot);

    // Notify everyone else
    socket.broadcast.emit('session:peer-joined', peer);

    console.log(`[sync] ${displayName} joined as ${assignedRole} (${socket.id})`);
  });

  // --- Controller role (mutex, first-come-first-served) ---

  socket.on('controller:request', () => {
    if (isHost(socket.id)) return;

    if (controllerId !== null) {
      socket.emit('controller:denied', { reason: 'Another controller is already active' });
      return;
    }

    controllerId = socket.id;
    const peer = peers.get(socket.id);
    if (peer) {
      peer.canControl = true;
      peers.set(socket.id, peer);
    }

    socket.emit('controller:granted', { peerId: socket.id });
    socket.broadcast.emit('controller:granted', { peerId: socket.id });
    console.log(`[sync] ${peer?.displayName ?? socket.id} became controller`);
  });

  socket.on('controller:release', () => {
    if (!isController(socket.id)) return;

    const peer = peers.get(socket.id);
    if (peer) {
      peer.canControl = false;
      peers.set(socket.id, peer);
    }

    controllerId = null;
    io.emit('controller:released', { peerId: socket.id });
    console.log(`[sync] ${peer?.displayName ?? socket.id} released controller`);
  });

  // --- Controller commands (forwarded to host) ---

  socket.on('control:command', (payload) => {
    if (!canControl(socket.id)) return;
    if (hostId === null) return;
    io.to(hostId).emit('control:command', payload);
  });

  // --- Playback (host only) ---

  socket.on('playback:update', (state) => {
    if (!isHost(socket.id)) return;
    playbackState = state;
    socket.broadcast.emit('playback:update', state);
  });

  // --- Song selection (host only) ---

  socket.on('song:select', ({ songId }) => {
    if (!isHost(socket.id)) return;
    activeSongId = songId;
    socket.broadcast.emit('song:select', { songId });
  });

  // --- Song data (host pushes full song data to viewers) ---

  socket.on('song:data', (payload) => {
    if (!isHost(socket.id)) return;
    songData = payload;
    activeSongId = payload.song.id;
    socket.broadcast.emit('song:data', payload);
  });

  // --- Setlist sync (host pushes full song list + order) ---

  socket.on('setlist:sync', (payload) => {
    if (!isHost(socket.id)) return;
    setlistData = payload;
    socket.broadcast.emit('setlist:sync', payload);
  });

  // --- Marker CRUD (all roles) ---

  socket.on('marker:save', (payload) => {
    socket.broadcast.emit('marker:save', payload);
  });

  socket.on('marker:delete', (payload) => {
    socket.broadcast.emit('marker:delete', payload);
  });

  // --- Tab CRUD (all roles) ---

  socket.on('tab:save', (payload) => {
    socket.broadcast.emit('tab:save', payload);
  });

  socket.on('tab:delete', (payload) => {
    socket.broadcast.emit('tab:delete', payload);
  });

  // --- Sheet CRUD (all roles) ---

  socket.on('sheet:save', (payload) => {
    socket.broadcast.emit('sheet:save', payload);
  });

  socket.on('sheet:delete', (payload) => {
    socket.broadcast.emit('sheet:delete', payload);
  });

  // --- Disconnect ---

  socket.on('disconnect', (reason) => {
    const peer = peers.get(socket.id);
    peers.delete(socket.id);
    io.emit('session:peer-left', { peerId: socket.id });

    if (isController(socket.id)) {
      controllerId = null;
      io.emit('controller:released', { peerId: socket.id });
      console.log(`[sync] Controller disconnected (${reason}). Controller role released.`);
    }

    if (isHost(socket.id)) {
      hostId = null;
      console.log(`[sync] Host disconnected (${reason}). Session has no host.`);
    }

    console.log(`[sync] ${peer?.displayName ?? socket.id} disconnected (${reason})`);
  });
});

// --- Start ---

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[sync] SongLab sync server listening on http://0.0.0.0:${PORT}`);
});