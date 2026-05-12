// Hook that connects MIDI input to SongLab actions.
// Initializes MIDI access, listens for messages, matches mappings,
// and dispatches the corresponding store actions.

import { useEffect, useCallback, useRef } from 'react';
import {
  requestMidiAccess,
  listenToAllInputs,
  addMessageListener,
  removeMessageListener,
  getInputDevices,
  matchMapping,
  disconnect,
  isMidiSupported,
} from '../services/midiService';
import type { MidiMessage } from '../services/midiService';
import { useMidiStore } from '../stores/useMidiStore';
import { useSongStore } from '../stores/useSongStore';
import { useLoopStore } from '../stores/useLoopStore';
import { useTempoStore } from '../stores/useTempoStore';
import { navigateSong, navigateToSong } from '../utils/songNavigation';
import { useSetlistStore } from '../stores/useSetlistStore';

interface UseMidiInputOptions {
  handlePlayPause: () => void;
  handleSeekTo: (time: number) => void;
  currentTime: number;
}

const TEMPO_STEP = 0.05;
const SEEK_STEP = 5; // seconds

export function useMidiInput({
  handlePlayPause,
  handleSeekTo,
  currentTime,
}: UseMidiInputOptions) {
  const enabled = useMidiStore((s) => s.enabled);
  const mappings = useMidiStore((s) => s.mappings);
  const learnTarget = useMidiStore((s) => s.learnTarget);

  // Keep current values in refs so the MIDI callback always sees
  // the latest state without re-registering the listener.
  const currentTimeRef = useRef(currentTime);
  const handlePlayPauseRef = useRef(handlePlayPause);
  const handleSeekToRef = useRef(handleSeekTo);
  const mappingsRef = useRef(mappings);
  const learnTargetRef = useRef(learnTarget);

  useEffect(() => {
    currentTimeRef.current = currentTime;
    handlePlayPauseRef.current = handlePlayPause;
    handleSeekToRef.current = handleSeekTo;
    mappingsRef.current = mappings;
    learnTargetRef.current = learnTarget;
  }, [currentTime, handlePlayPause, handleSeekTo, mappings, learnTarget]);

  // --- Section navigation ---

  const seekToAdjacentSection = useCallback((
    direction: 'prev' | 'next',
  ) => {
    const markers = useSongStore.getState().getActiveMarkers();
    if (markers.length === 0) return;

    const time = currentTimeRef.current;
    // Find the index of the current section (last marker before currentTime)
    let currentIdx = -1;
    for (let i = markers.length - 1; i >= 0; i--) {
      if (markers[i].startTime <= time + 0.1) {
        currentIdx = i;
        break;
      }
    }

    if (direction === 'prev') {
      // If we're more than 1s into the current section, jump to its start.
      // Otherwise jump to the previous section.
      if (currentIdx >= 0 && time - markers[currentIdx].startTime > 1) {
        handleSeekToRef.current(markers[currentIdx].startTime);
      } else if (currentIdx > 0) {
        handleSeekToRef.current(markers[currentIdx - 1].startTime);
      } else {
        handleSeekToRef.current(0);
      }
    } else {
      const nextIdx = currentIdx + 1;
      if (nextIdx < markers.length) {
        handleSeekToRef.current(markers[nextIdx].startTime);
      }
    }
  }, []);

  // --- MIDI message handler ---

  const handleMidiMessage = useCallback((message: MidiMessage) => {
    // Learn mode: capture this message as the new mapping
    // (Program Change is not learnable — it maps directly to setlist)
    const learn = learnTargetRef.current;
    if (learn && message.type !== 'program_change') {
      useMidiStore.getState().updateMapping({
        command: learn,
        type: message.type,
        channel: message.channel,
        note: message.note,
      });
      return;
    }

    // Program Change: navigate to song by setlist index (0-based)
    if (message.type === 'program_change') {
       const songOrder = useSetlistStore.getState().getActiveItems();
      const songItems = songOrder.filter((item) => item.type === 'song');
      const target = songItems[message.note];
      if (target && target.type === 'song') {
        navigateToSong(target.songId);
      }
      return;
    }

    // Normal mode: match against mappings and dispatch
    const command = matchMapping(message, mappingsRef.current);
    if (!command) return;

    switch (command) {
      case 'TRANSPORT_TOGGLE':
        handlePlayPauseRef.current();
        break;

      case 'SECTION_PREV':
        seekToAdjacentSection('prev');
        break;

      case 'SECTION_NEXT':
        seekToAdjacentSection('next');
        break;

      case 'LOOP_TOGGLE':
        useLoopStore.getState().toggleLoop();
        break;

      case 'SONG_PREV':
        navigateSong('prev');
        break;

      case 'SONG_NEXT':
        navigateSong('next');
        break;

      case 'TEMPO_DOWN': {
        const { playbackRate, setPlaybackRate } = useTempoStore.getState();
        setPlaybackRate(playbackRate - TEMPO_STEP);
        break;
      }

      case 'TEMPO_UP': {
        const { playbackRate, setPlaybackRate } = useTempoStore.getState();
        setPlaybackRate(playbackRate + TEMPO_STEP);
        break;
      }

      case 'SEEK_BACK':
        handleSeekToRef.current(
          Math.max(0, currentTimeRef.current - SEEK_STEP),
        );
        break;

      case 'SEEK_FORWARD':
        handleSeekToRef.current(currentTimeRef.current + SEEK_STEP);
        break;

      case 'LOOP_SET_A': {
        const loopStore = useLoopStore.getState();
        if (!loopStore.abMode) loopStore.toggleAbMode();
        loopStore.setAbStart(currentTimeRef.current);
        break;
      }

      case 'LOOP_SET_B': {
        const loopStore = useLoopStore.getState();
        const aPoint = loopStore.abStart;
        if (aPoint !== null && currentTimeRef.current > aPoint) {
          loopStore.setLoop({
            start: aPoint,
            end: currentTimeRef.current,
            label: 'A/B Loop',
          });
        }
        break;
      }
    }
  }, [seekToAdjacentSection]);

  // --- Init/cleanup ---

  useEffect(() => {
    if (!enabled || !isMidiSupported()) return;

    let cancelled = false;

    async function init() {
      const granted = await requestMidiAccess();
      if (cancelled || !granted) return;

      listenToAllInputs();
      addMessageListener(handleMidiMessage);

      // Update device list in store
      useMidiStore.getState().setDevices(getInputDevices());
      await useMidiStore.getState().loadMappings();
    }

    init();

    return () => {
      cancelled = true;
      removeMessageListener(handleMidiMessage);
      disconnect();
      useMidiStore.getState().setDevices([]);
    };
  }, [enabled, handleMidiMessage]);

  return { isSupported: isMidiSupported() };
}