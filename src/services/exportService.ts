import type { SongData, SectionMarker, SectionTab, TabSheet, SetlistItem } from '../types';
import {
  getMarkersForSong,
  getTabsForSong,
  getTabSheetsForSong,
  getGpFile,
  saveSong,
  saveMarker,
  saveTab,
  saveTabSheet,
  saveGpFile,
} from './db';
import { arrayBufferToBase64, base64ToArrayBuffer } from '../utils/encoding';

// --- Shared types ---

export interface SongBundle {
  song: SongData;
  markers: SectionMarker[];
  tabs: SectionTab[];
  sheets: TabSheet[];
  gpFileBase64?: string | null;
  gpFileName?: string | null;
}

interface SongExport extends SongBundle {
  version: number;
}

// v2 multi-setlist export format
interface SetlistExportV2 {
  version: 2;
  setlists: { name: string; items: SetlistItem[] }[];
  songs: SongBundle[];
}

// Legacy single-setlist export format (for import detection)
interface SetlistExportLegacy {
  id?: string;
  name?: string;
  entries?: (SongBundle & { songId: string; title: string })[];
  createdAt?: number;
}

// Setlist entry as stored in an export file
export interface ImportedSetlist {
  name: string;
  items: SetlistItem[];
}

// Parsed (normalized, not yet persisted) import — auto-detected from file structure
export type ParsedImport =
  | { type: 'song'; bundle: SongBundle }
  | { type: 'gig'; bundles: SongBundle[]; setlists: ImportedSetlist[] };

// --- Shared helpers ---

/** Trigger a JSON file download in the browser */
function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Collect all data for a single song (metadata, markers, tabs, sheets, GP file) */
async function bundleSong(song: SongData): Promise<SongBundle> {
  const markers = await getMarkersForSong(song.id);
  const tabs = await getTabsForSong(song.id);
  const sheets = await getTabSheetsForSong(song.id);

  let gpFileBase64: string | null = null;
  let gpFileName: string | null = null;
  if (song.gpFileName) {
    const gpFile = await getGpFile(song.id);
    if (gpFile) {
      gpFileBase64 = arrayBufferToBase64(gpFile.data);
      gpFileName = gpFile.fileName;
    }
  }

  return { song, markers, tabs, sheets, gpFileBase64, gpFileName };
}

/**
 * Normalize a song bundle without touching IndexedDB:
 * - Audio files are never exported, so non-dummy songs become dummy songs.
 *   When the user later drops an audio file, isDummy is set back to false.
 * - Old exports without sheets get a default sheet; orphan tabs are assigned to it.
 */
function normalizeBundle(bundle: SongBundle): SongBundle {
  const song = bundle.song.isDummy ? bundle.song : { ...bundle.song, isDummy: true };
  const tabs = bundle.tabs ?? [];
  let sheets = bundle.sheets ?? [];

  if (sheets.length === 0 && tabs.length > 0) {
    sheets = [{
      id: `default-${song.id}`,
      songId: song.id,
      name: 'Guitar',
      type: 'Guitar',
      order: 0,
    }];
  }

  const defaultSheetId = sheets[0]?.id ?? null;

  return {
    ...bundle,
    song,
    markers: bundle.markers ?? [],
    sheets,
    tabs: tabs.map((tab) => (tab.sheetId ? tab : { ...tab, sheetId: defaultSheetId! })),
  };
}

/** Write a normalized song bundle into IndexedDB (song, markers, tabs, sheets, GP file) */
async function writeBundle(bundle: SongBundle): Promise<void> {
  await saveSong(bundle.song);
  await Promise.all(bundle.markers.map((marker) => saveMarker(marker)));

  if (bundle.gpFileBase64 && bundle.gpFileName) {
    const gpBuffer = base64ToArrayBuffer(bundle.gpFileBase64);
    await saveGpFile(bundle.song.id, gpBuffer, bundle.gpFileName);
  }

  await Promise.all(bundle.sheets.map((sheet) => saveTabSheet(sheet)));
  await Promise.all(bundle.tabs.map((tab) => saveTab(tab)));
}

/** Read a File as text via FileReader (Promise wrapper) */
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

// --- Format detection ---

/** Song exports have a top-level `song` object with `markers` alongside it */
function isSongExport(raw: object): raw is SongExport {
  return 'song' in raw && 'markers' in raw;
}

/** v2 exports have `version: 2` and a `setlists` array */
function isV2Export(raw: object): raw is SetlistExportV2 {
  return 'version' in raw && (raw as { version: unknown }).version === 2 && 'setlists' in raw;
}

// --- Song export ---

export async function exportSong(song: SongData): Promise<void> {
  const bundle = await bundleSong(song);
  const data: SongExport = { version: 3, ...bundle };
  downloadJson(data, `${song.title}.json`);
}

// --- Setlist export ---

export async function exportSetlist(
  name: string,
  items: SetlistItem[],
  songs: SongData[],
): Promise<void> {
  const bundles = await Promise.all(songs.map((song) => bundleSong(song)));

  const data: SetlistExportV2 = {
    version: 2,
    setlists: [{ name, items }],
    songs: bundles,
  };

  downloadJson(data, `${name}.json`);
}

// --- Gig export ---

export async function exportGig(
  setlists: { name: string; items: SetlistItem[] }[],
  songs: SongData[],
): Promise<void> {
  // Deduplicate songs (same song can be in multiple setlists)
  const uniqueSongs = new Map(songs.map((s) => [s.id, s]));
  const bundles = await Promise.all(
    [...uniqueSongs.values()].map((song) => bundleSong(song)),
  );

  const data: SetlistExportV2 = {
    version: 2,
    setlists,
    songs: bundles,
  };

  downloadJson(data, 'gig.json');
}

// --- Import: parse (pure) and commit (writes to IndexedDB) are separate steps ---
// This allows conflict resolution (e.g. setlist name clashes) before anything is persisted.

/** Detect the export format and return a normalized, not yet persisted import */
function parseImportData(raw: object): ParsedImport {
  // Song export: top-level `song` + `markers`
  if (isSongExport(raw)) {
    return { type: 'song', bundle: normalizeBundle(raw) };
  }

  // v2 format: setlists[] + songs[]
  if (isV2Export(raw)) {
    const bundles = (raw.songs ?? []).filter((b) => b.song).map(normalizeBundle);

    // Fall back to a flat song list if the setlists array is empty
    const setlists = raw.setlists.length > 0
      ? raw.setlists.map((sl) => ({ name: sl.name, items: sl.items }))
      : [{ name: 'Imported', items: toSongItems(bundles) }];

    return { type: 'gig', bundles, setlists };
  }

  // Legacy format: entries[] with embedded song bundles -> single setlist
  const legacy = raw as SetlistExportLegacy;
  const bundles = (legacy.entries ?? []).filter((e) => e.song).map(normalizeBundle);

  return {
    type: 'gig',
    bundles,
    setlists: [{ name: legacy.name ?? 'Imported', items: toSongItems(bundles) }],
  };
}

/** Build plain song items (no pauses) in bundle order */
function toSongItems(bundles: SongBundle[]): SetlistItem[] {
  return bundles.map((b) => ({ type: 'song' as const, songId: b.song.id }));
}

/** Parse an export file picked by the user. Nothing is written to IndexedDB. */
export async function parseImportFile(file: File): Promise<ParsedImport> {
  const text = await readFileAsText(file);
  return parseImportData(JSON.parse(text));
}

/**
 * Fetch a setlist export via the sync server proxy and parse it.
 * Only the first setlist of a v2 export is kept (URL import is single-setlist).
 * Nothing is written to IndexedDB.
 */
export async function parseSetlistFromUrl(
  serverUrl: string,
  setlistUrl: string,
): Promise<ParsedImport> {
  const base = serverUrl.replace(/\/+$/, '');
  const endpoint = `${base}/api/fetch-setlist?url=${encodeURIComponent(setlistUrl)}`;

  const response = await fetch(endpoint);

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = (body as { error?: string })?.error ?? `Server returned ${response.status}`;
    throw new Error(message);
  }

  const parsed = parseImportData(await response.json());
  if (parsed.type === 'song') {
    throw new Error('URL does not point to a setlist export');
  }
  return { ...parsed, setlists: parsed.setlists.slice(0, 1) };
}

/** Persist the given song bundles and return their songs */
export async function commitBundles(bundles: SongBundle[]): Promise<SongData[]> {
  for (const bundle of bundles) {
    await writeBundle(bundle);
  }
  return bundles.map((b) => b.song);
}


/**
 * Pick the bundles to persist when some imported setlists were skipped.
 * A song is dropped only if every setlist referencing it was skipped;
 * songs not referenced by any setlist (e.g. library songs in a gig export) are kept.
 */
export function selectBundlesToCommit(
  bundles: SongBundle[],
  allSetlists: ImportedSetlist[],
  keptSetlists: ImportedSetlist[],
): SongBundle[] {
  const songIds = (setlists: ImportedSetlist[]) => new Set(
    setlists.flatMap((sl) => sl.items.flatMap((i) => (i.type === 'song' ? [i.songId] : []))),
  );
  const referenced = songIds(allSetlists);
  const kept = songIds(keptSetlists);
  return bundles.filter((b) => kept.has(b.song.id) || !referenced.has(b.song.id));
}