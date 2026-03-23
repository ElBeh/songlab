import type { SongData, SectionMarker, SectionTab, TabSheet } from '../types';
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

interface SongExport {
  version: number;
  song: SongData;
  markers: SectionMarker[];
  tabs: SectionTab[];
  sheets: TabSheet[];
  gpFileBase64?: string | null;
  gpFileName?: string | null;
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

export async function exportSong(song: SongData): Promise<void> {
  const markers = await getMarkersForSong(song.id);
  const tabs = await getTabsForSong(song.id);
  const sheets = await getTabSheetsForSong(song.id);

  // Include GP file if attached
  let gpFileBase64: string | null = null;
  let gpFileName: string | null = null;
  if (song.gpFileName) {
    const gpFile = await getGpFile(song.id);
    if (gpFile) {
      gpFileBase64 = arrayBufferToBase64(gpFile.data);
      gpFileName = gpFile.fileName;
    }
  }

  const data: SongExport = { version: 3, song, markers, tabs, sheets, gpFileBase64, gpFileName };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${song.title}.songlab.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importSong(file: File): Promise<SongData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data: SongExport = JSON.parse(reader.result as string);
        await saveSong(data.song);
        for (const marker of data.markers ?? []) await saveMarker(marker);

        // Restore GP file if present in export
        if (data.gpFileBase64 && data.gpFileName) {
          const gpBuffer = base64ToArrayBuffer(data.gpFileBase64);
          await saveGpFile(data.song.id, gpBuffer, data.gpFileName);
        }

        // Migrate old exports: if no sheets exist, create a default sheet
        // and assign its id to all tabs that are missing a sheetId
        let sheets = data.sheets ?? [];
        const tabs = data.tabs ?? [];

        if (sheets.length === 0 && tabs.length > 0) {
          const defaultSheet: TabSheet = {
            id: `default-${data.song.id}`,
            songId: data.song.id,
            name: 'Guitar',
            type: 'Guitar',
            order: 0,
          };
          sheets = [defaultSheet];
        }

        for (const sheet of sheets) await saveTabSheet(sheet);

        const defaultSheetId = sheets[0]?.id ?? null;
        for (const tab of tabs) {
          // Assign default sheetId to tabs from old exports
          const fixed = tab.sheetId ? tab : { ...tab, sheetId: defaultSheetId! };
          await saveTab(fixed);
        }

        resolve(data.song);
      } catch {
        reject(new Error('Invalid song file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}