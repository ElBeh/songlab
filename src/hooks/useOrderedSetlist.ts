import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useSetlistStore } from '../stores/useSetlistStore';
import { useSongStore } from '../stores/useSongStore';
import type { SongData } from '../types';

/**
 * Joins the active setlist's items with the song library.
 *
 * Lives in a hook (not the setlist store) so that it subscribes to both
 * stores reactively: changes to the song library re-render consumers, which
 * a store getter reading useSongStore.getState() at call time would miss.
 */
export function useOrderedSetlist(): { orderedSongs: SongData[]; totalDuration: number } {
  const items = useSetlistStore(useShallow((state) => state.getActiveItems()));
  const songs = useSongStore(useShallow((state) => state.songs));

  const orderedSongs = useMemo(() => {
    const songMap = new Map(songs.map((s) => [s.id, s]));
    const ordered: SongData[] = [];
    for (const item of items) {
      if (item.type === 'song') {
        const song = songMap.get(item.songId);
        if (song) {
          ordered.push(song);
          songMap.delete(item.songId);
        }
      }
    }
    return ordered;
  }, [items, songs]);

  const totalDuration = useMemo(() => {
    const songMap = new Map(songs.map((s) => [s.id, s]));
    let total = 0;
    for (const item of items) {
      if (item.type === 'song') {
        total += songMap.get(item.songId)?.duration ?? 0;
      } else if (item.type === 'pause') {
        total += item.duration;
      }
    }
    return total;
  }, [items, songs]);

  return { orderedSongs, totalDuration };
}
