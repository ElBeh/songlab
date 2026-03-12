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
        for (const tab of data.tabs ?? []) await saveTab(tab);
        for (const sheet of data.sheets ?? []) await saveTabSheet(sheet);
        resolve(data.song);
      } catch {
        reject(new Error('Invalid song file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}