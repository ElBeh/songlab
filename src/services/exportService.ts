import type { Setlist, SongData, SectionMarker, SectionTab, TabSheet } from '../types';
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

interface SetlistExport extends Omit<Setlist, 'entries'> {
  entries: (SongBundle & { songId: string; title: string })[];
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

export async function exportSetlist(name: string, songs: SongData[]): Promise<void> {
  const entries = await Promise.all(
    songs.map(async (song) => {
      const bundle = await bundleSong(song);
      return { songId: song.id, title: song.title, ...bundle };
    }),
  );

  const setlist: SetlistExport = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    entries,
    createdAt: Date.now(),
  };

  downloadJson(setlist, `${name}.setlist.json`);
}

/** Restore all songs from a parsed setlist export into IndexedDB */
async function restoreSetlist(setlist: SetlistExport): Promise<SongData[]> {
  const importedSongs: SongData[] = [];

  for (const entry of setlist.entries ?? []) {
    if (!entry.song) continue;
    await restoreBundle(entry);
    importedSongs.push(entry.song);
  }

  return importedSongs;
}

export async function importSetlist(file: File): Promise<SongData[]> {
  const text = await readFileAsText(file);
  const setlist: SetlistExport = JSON.parse(text);
  return restoreSetlist(setlist);
}

export async function importSetlistFromUrl(
  serverUrl: string,
  setlistUrl: string,
): Promise<SongData[]> {
  const base = serverUrl.replace(/\/+$/, '');
  const endpoint = `${base}/api/fetch-setlist?url=${encodeURIComponent(setlistUrl)}`;

  const response = await fetch(endpoint);

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = (body as { error?: string })?.error ?? `Server returned ${response.status}`;
    throw new Error(message);
  }

  const setlist: SetlistExport = await response.json();
  return restoreSetlist(setlist);
}