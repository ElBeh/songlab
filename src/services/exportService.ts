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

interface SongBundle {
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

export interface SetlistImportResult {
  songs: SongData[];
  items: SetlistItem[];
  name: string;
}

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

/** Restore a single song bundle into IndexedDB (song, markers, tabs, sheets, GP file) */
async function restoreBundle(bundle: SongBundle): Promise<void> {
  // Audio files are never exported, so treat non-dummy songs as dummy on import.
  // When the user later drops an audio file, isDummy is set back to false.
  if (!bundle.song.isDummy) {
    bundle.song = { ...bundle.song, isDummy: true };
  }

  await saveSong(bundle.song);
  for (const marker of bundle.markers ?? []) await saveMarker(marker);

  // Restore GP file if present in export
  if (bundle.gpFileBase64 && bundle.gpFileName) {
    const gpBuffer = base64ToArrayBuffer(bundle.gpFileBase64);
    await saveGpFile(bundle.song.id, gpBuffer, bundle.gpFileName);
  }

  // Migrate old exports: create default sheet if none exist
  let sheets = bundle.sheets ?? [];
  const tabs = bundle.tabs ?? [];

  if (sheets.length === 0 && tabs.length > 0) {
    const defaultSheet: TabSheet = {
      id: `default-${bundle.song.id}`,
      songId: bundle.song.id,
      name: 'Guitar',
      type: 'Guitar',
      order: 0,
    };
    sheets = [defaultSheet];
  }

  for (const sheet of sheets) await saveTabSheet(sheet);

  const defaultSheetId = sheets[0]?.id ?? null;
  for (const tab of tabs) {
    const fixed = tab.sheetId ? tab : { ...tab, sheetId: defaultSheetId! };
    await saveTab(fixed);
  }
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

// --- Song export/import ---

export async function exportSong(song: SongData): Promise<void> {
  const bundle = await bundleSong(song);
  const data: SongExport = { version: 3, ...bundle };
  downloadJson(data, `${song.title}.songlab.json`);
}

export async function importSong(file: File): Promise<SongData> {
  const text = await readFileAsText(file);
  const data: SongExport = JSON.parse(text);
  await restoreBundle(data);
  return data.song;
}

// --- Setlist export/import ---

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

  downloadJson(data, `${name}.setlist.json`);
}

/** Detect format and restore songs, returning structured result */
async function restoreSetlistData(
  raw: SetlistExportV2 | SetlistExportLegacy,
): Promise<SetlistImportResult> {
  // v2 format: has version field and setlists array
  if ('version' in raw && raw.version === 2 && 'setlists' in raw) {
    const v2 = raw as SetlistExportV2;
    const importedSongs: SongData[] = [];

    for (const bundle of v2.songs ?? []) {
      if (!bundle.song) continue;
      await restoreBundle(bundle);
      importedSongs.push(bundle.song);
    }

    const firstSetlist = v2.setlists[0];
    return {
      songs: importedSongs,
      items: firstSetlist?.items ?? importedSongs.map((s) => ({
        type: 'song' as const,
        songId: s.id,
      })),
      name: firstSetlist?.name ?? 'Imported',
    };
  }

  // Legacy format: entries array with embedded song bundles
  const legacy = raw as SetlistExportLegacy;
  const importedSongs: SongData[] = [];

  for (const entry of legacy.entries ?? []) {
    if (!entry.song) continue;
    await restoreBundle(entry);
    importedSongs.push(entry.song);
  }

  return {
    songs: importedSongs,
    items: importedSongs.map((s) => ({ type: 'song' as const, songId: s.id })),
    name: legacy.name ?? 'Imported',
  };
}

export async function importSetlist(file: File): Promise<SetlistImportResult> {
  const text = await readFileAsText(file);
  const raw = JSON.parse(text);
  return restoreSetlistData(raw);
}

export async function importSetlistFromUrl(
  serverUrl: string,
  setlistUrl: string,
): Promise<SetlistImportResult> {
  const base = serverUrl.replace(/\/+$/, '');
  const endpoint = `${base}/api/fetch-setlist?url=${encodeURIComponent(setlistUrl)}`;

  const response = await fetch(endpoint);

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = (body as { error?: string })?.error ?? `Server returned ${response.status}`;
    throw new Error(message);
  }

  const raw = await response.json();
  return restoreSetlistData(raw);
}

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

  downloadJson(data, 'gig.setlist.json');
}