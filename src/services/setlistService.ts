import type { Setlist, SongData } from '../types';

export async function exportSetlist(
  name: string,
  songs: SongData[],
): Promise<void> {
  const setlist: Setlist = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    entries: songs.map((s) => ({ songId: s.id, title: s.title })),
    createdAt: Date.now(),
  };

  const blob = new Blob([JSON.stringify(setlist, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.setlist.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importSetlist(file: File): Promise<Setlist> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const setlist: Setlist = JSON.parse(reader.result as string);
        resolve(setlist);
      } catch {
        reject(new Error('Invalid setlist file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}