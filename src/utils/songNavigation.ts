// Shared setlist navigation helper.
// Used by useControlCommandHandler (Band Sync) and useMidiInput (MIDI footswitch).

import { useSongStore } from '../stores/useSongStore';
import { useTabStore } from '../stores/useTabStore';

export async function navigateSong(
  direction: 'next' | 'prev',
): Promise<void> {
  const { songOrder, activeSongId, setActiveSongId } = useSongStore.getState();
  if (!activeSongId) return;

  const songItems = songOrder.filter((item) => item.type === 'song');
  const currentIdx = songItems.findIndex(
    (item) => item.type === 'song' && item.songId === activeSongId,
  );
  if (currentIdx === -1) return;

  const targetIdx = direction === 'next' ? currentIdx + 1 : currentIdx - 1;
  if (targetIdx < 0 || targetIdx >= songItems.length) return;

  const target = songItems[targetIdx];
  if (target.type !== 'song') return;

  await setActiveSongId(target.songId);
  await useTabStore.getState().loadTabsForSong(target.songId);
  await useTabStore.getState().loadSheetsForSong(target.songId);
}

export async function navigateToSong(songId: string): Promise<void> {
  const { setActiveSongId } = useSongStore.getState();
  await setActiveSongId(songId);
  await useTabStore.getState().loadTabsForSong(songId);
  await useTabStore.getState().loadSheetsForSong(songId);
}