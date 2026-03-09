import type { SongData, SectionMarker, SectionTab } from '../types';
import { saveSong, saveMarker, saveTab, getMarkersForSong, getTabsForSong } from './db';

interface SongExport {
  version: 1;
  song: SongData;
  markers: SectionMarker[];
  tabs: SectionTab[];
}

export async function exportSong(song: SongData): Promise<void> {
  const markers = await getMarkersForSong(song.id);
  const tabs = await getTabsForSong(song.id);

  const data: SongExport = {
    version: 1,
    song,
    markers,
    tabs,
  };

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

        if (data.version !== 1) {
          throw new Error(`Unsupported export version: ${data.version}`);
        }

        await saveSong(data.song);
        for (const marker of data.markers) {
          await saveMarker(marker);
        }
        for (const tab of data.tabs) {
          await saveTab(tab);
        }

        resolve(data.song);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}