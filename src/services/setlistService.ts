import type { Setlist, SongData, SectionMarker, SectionTab, TabSheet } from '../types';
import {
  getMarkersForSong,
  getTabsForSong,
  getTabSheetsForSong,
  saveSong,
  saveMarker,
  saveTab,
  saveTabSheet,
} from './db';

interface SetlistEntry {
  songId: string;
  title: string;
  song: SongData;
  markers: SectionMarker[];
  tabs: SectionTab[];
  sheets: TabSheet[];
}

interface SetlistExport extends Omit<Setlist, 'entries'> {
  entries: SetlistEntry[];
}

export async function exportSetlist(name: string, songs: SongData[]): Promise<void> {
  const entries: SetlistEntry[] = await Promise.all(
    songs.map(async (song) => ({
      songId: song.id,
      title: song.title,
      song,
      markers: await getMarkersForSong(song.id),
      tabs: await getTabsForSong(song.id),
      sheets: await getTabSheetsForSong(song.id),
    }))
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
          for (const tab of entry.tabs ?? []) await saveTab(tab);
          for (const sheet of entry.sheets ?? []) await saveTabSheet(sheet);
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