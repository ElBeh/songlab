// Tests for paste conversion and saving in the songbook editor.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SongbookEditor } from './SongbookEditor';
import { useSongStore } from '../../stores/useSongStore';
import type { SongData } from '../../types';

function song(chordSheet: string | null = null): SongData {
  return {
    id: 'sb-1', title: 'Test', fileName: '', fileSize: 0, duration: 60, createdAt: 0,
    volume: 1, normalizationGain: 1, normalizationEnabled: false, isDummy: true,
    gpFileName: null, syncPoints: null, syncOffset: null, bpmAdjust: null, bpm: null,
    timeSignature: null, chordSheet,
  };
}

function textarea(): HTMLTextAreaElement {
  return screen.getByRole('textbox') as HTMLTextAreaElement;
}

function paste(text: string) {
  fireEvent.paste(textarea(), { clipboardData: { getData: () => text } });
}

describe('SongbookEditor', () => {
  beforeEach(() => {
    useSongStore.setState({ songs: [song()], activeSongId: 'sb-1', markersBySong: {} });
  });

  it('converts a pasted chords-over-words sheet to ChordPro', () => {
    render(<SongbookEditor song={song()} />);
    paste('Am    F\nHello world');
    expect(textarea().value).toBe('[Am]Hello [F]world');
  });

  it('keeps pasted ChordPro unchanged (default paste)', () => {
    render(<SongbookEditor song={song()} />);
    paste('[Am]Hello');
    expect(textarea().value).toBe('');
  });

  it('saves the text on the song', async () => {
    render(<SongbookEditor song={song()} />);
    fireEvent.change(textarea(), { target: { value: '[G]Hi' } });
    fireEvent.click(screen.getByText('● save'));
    await waitFor(() => expect(useSongStore.getState().songs[0].chordSheet).toBe('[G]Hi'));
  });

  it('clears the songbook with null when saved empty', async () => {
    useSongStore.setState({ songs: [song('[G]Hi')] });
    render(<SongbookEditor song={song('[G]Hi')} />);
    fireEvent.change(textarea(), { target: { value: '  ' } });
    fireEvent.click(screen.getByText('● save'));
    await waitFor(() => expect(useSongStore.getState().songs[0].chordSheet).toBeNull());
  });

  it('offers manual conversion for chords-over-words text', () => {
    render(<SongbookEditor song={song()} />);
    fireEvent.change(textarea(), { target: { value: 'C\nHi' } });
    fireEvent.click(screen.getByText('convert to ChordPro'));
    expect(textarea().value).toBe('[C]Hi');
  });
});