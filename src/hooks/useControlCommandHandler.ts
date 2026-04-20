import { useCallback } from 'react';
import type { ControlCommand } from '../../shared/syncProtocol';
import { useTempoStore } from '../stores/useTempoStore';
import { navigateSong, navigateToSong } from '../utils/songNavigation';

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