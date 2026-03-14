import type { SongData, SectionMarker, SectionTab, TabSheet } from '../types';
import {
  getMarkersForSong,
  getTabsForSong,
  getTabSheetsForSong,
  saveSong,
  saveMarker,
  saveTab,
  saveTabSheet,
} from './db';

interface SongExport {
  version: number;
  song: SongData;
  markers: SectionMarker[];
  tabs: SectionTab[];
  sheets: TabSheet[];
}

export async function exportSong(song: SongData): Promise<void> {
  const markers = await getMarkersForSong(song.id);
  const tabs = await getTabsForSong(song.id);
  const sheets = await getTabSheetsForSong(song.id);

  const data: SongExport = { version: 2, song, markers, tabs, sheets };

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