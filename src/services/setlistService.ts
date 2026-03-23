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

interface SetlistEntry {
  songId: string;
  title: string;
  song: SongData;
  markers: SectionMarker[];
  tabs: SectionTab[];
  sheets: TabSheet[];
  gpFileBase64?: string | null;
  gpFileName?: string | null;
}

interface SetlistExport extends Omit<Setlist, 'entries'> {
  entries: SetlistEntry[];
}

/** ArrayBuffer → Base64 string */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** Base64 string → ArrayBuffer */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function exportSetlist(name: string, songs: SongData[]): Promise<void> {
  const entries: SetlistEntry[] = await Promise.all(
    songs.map(async (song) => {
      let gpFileBase64: string | null = null;
      let gpFileName: string | null = null;
      if (song.gpFileName) {
        const gpFile = await getGpFile(song.id);
        if (gpFile) {
          gpFileBase64 = arrayBufferToBase64(gpFile.data);
          gpFileName = gpFile.fileName;
        }
      }
      return {
        songId: song.id,
        title: song.title,
        song,
        markers: await getMarkersForSong(song.id),
        tabs: await getTabsForSong(song.id),
        sheets: await getTabSheetsForSong(song.id),
        gpFileBase64,
        gpFileName,
      };
    })
  );

  const setlist: SetlistExport = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    entries,
    createdAt: Date.now(),
  };

  const blob = new Blob([JSON.stringify(setlist, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.setlist.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importSetlist(file: File): Promise<SongData[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const setlist: SetlistExport = JSON.parse(reader.result as string);
        const importedSongs: SongData[] = [];

        for (const entry of setlist.entries ?? []) {
          if (!entry.song) continue;
          await saveSong(entry.song);
          for (const marker of entry.markers ?? []) await saveMarker(marker);

          // Restore GP file if present in export
          if (entry.gpFileBase64 && entry.gpFileName) {
            const gpBuffer = base64ToArrayBuffer(entry.gpFileBase64);
            await saveGpFile(entry.song.id, gpBuffer, entry.gpFileName);
          }

          // Migrate old exports: create default sheet if none exist
          let sheets = entry.sheets ?? [];
          const tabs = entry.tabs ?? [];

          if (sheets.length === 0 && tabs.length > 0) {
            const defaultSheet: TabSheet = {
              id: `default-${entry.song.id}`,
              songId: entry.song.id,
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

          importedSongs.push(entry.song);
        }

        resolve(importedSongs);
      } catch {
        reject(new Error('Invalid setlist file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}