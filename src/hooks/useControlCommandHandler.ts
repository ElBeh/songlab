import { useCallback } from 'react';
import type { ControlCommand } from '../../shared/syncProtocol';
import { useSongStore } from '../stores/useSongStore';
import { useTabStore } from '../stores/useTabStore';
import { useTempoStore } from '../stores/useTempoStore';

interface UseControlCommandHandlerOptions {
  handlePlayPause: () => void;
  handleSeekTo: (time: number) => void;
  isPlaying: boolean;
}

/**
 * Processes incoming control commands from a remote Controller.
 * Only active on the Host side – the server forwards commands here.
 */
export function useControlCommandHandler({
  handlePlayPause,
  handleSeekTo,
  isPlaying,
}: UseControlCommandHandlerOptions) {

  const handleControlCommand = useCallback((command: ControlCommand) => {
    switch (command.type) {
      case 'play':
        if (!isPlaying) handlePlayPause();
        break;

      case 'pause':
        if (isPlaying) handlePlayPause();
        break;

      case 'seek':
        if (command.value !== undefined) handleSeekTo(command.value);
        break;

      case 'nextSong':
        navigateSong('next');
        break;

      case 'prevSong':
        navigateSong('prev');
        break;

      case 'tempoChange':
        if (command.value !== undefined) {
          useTempoStore.getState().setPlaybackRate(command.value);
        }
        break;
      
      case 'songSelect':
        if (command.songId) {
          navigateToSong(command.songId);
        }
        break;
    }
  }, [isPlaying, handlePlayPause, handleSeekTo]);

  return handleControlCommand;
}

/**
 * Navigate to the next or previous song in the setlist.
 */
async function navigateSong(direction: 'next' | 'prev'): Promise<void> {
  const { songOrder, activeSongId, setActiveSongId } = useSongStore.getState();
  if (!activeSongId) return;

  // Collect song-type items only
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

async function navigateToSong(songId: string): Promise<void> {
  const { setActiveSongId } = useSongStore.getState();
  await setActiveSongId(songId);
  await useTabStore.getState().loadTabsForSong(songId);
  await useTabStore.getState().loadSheetsForSong(songId);
}