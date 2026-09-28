// Tests for paste conversion and saving in the songbook editor.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SongbookEditor } from './SongbookEditor';
import { loadGuitarChordDb } from '../../utils/chordLookup';
import { useSongStore } from '../../stores/useSongStore';
import type { SongData } from '../../types';

// svguitar needs SVG layout (getBBox), which jsdom lacks; diagrams are not under test
vi.mock('svguitar', () => ({
  SVGuitarChord: class {
    configure() { return this; }
    chord() { return this; }
    draw() { return this; }
    remove() {}
  },
}));

function song(chordSheet: string | null = null): SongData {
  return {
    id: 'sb-1', title: 'Test', fileName: '', fileSize: 0, duration: 60, createdAt: 0,
    volume: 1, normalizationGain: 1, normalizationEnabled: false, isDummy: true,
    gpFileName: null, syncPoints: null, syncOffset: null, bpmAdjust: null, bpm: null,
    timeSignature: null, chordSheet,
  };
}

// The fretboard editor adds a second textbox (chord input), so pick the textarea
function textarea(): HTMLTextAreaElement {
  return screen.getAllByRole('textbox').find((el) => el.tagName === 'TEXTAREA') as HTMLTextAreaElement;
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

  it('converts a pasted stacked chord sheet to ChordPro', () => {
    render(<SongbookEditor song={song()} />);
    paste(['D', 'I see ', 'A', 'bad ', 'G', 'moon ', 'D', 'rising', '', 'D', 'I see ', 'A', 'earth', 'G', 'quakes'].join('\n'));
    expect(textarea().value).toBe('[D]I see [A]bad [G]moon [D]rising\n\n[D]I see [A]earth[G]quakes');
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

  describe('insert toolbar', () => {
    function typeAndSelect(value: string, start: number, end = start) {
      fireEvent.change(textarea(), { target: { value } });
      textarea().setSelectionRange(start, end);
    }

    it('wraps the selected lines in a numbered section', () => {
      render(<SongbookEditor song={song()} />);
      const value = '{start_of_verse: Verse 1}\na\n{end_of_verse}\n[G]Line';
      typeAndSelect(value, value.indexOf('[G]'), value.length);
      fireEvent.change(screen.getByLabelText('Insert section'), { target: { value: 'verse' } });
      expect(textarea().value)
        .toBe('{start_of_verse: Verse 1}\na\n{end_of_verse}\n{start_of_verse: Verse 2}\n[G]Line\n{end_of_verse}');
    });

    it('inserts a chorus repeat below the cursor line', () => {
      render(<SongbookEditor song={song()} />);
      typeAndSelect('[G]Hi', 5);
      fireEvent.click(screen.getByText('repeat'));
      expect(textarea().value).toBe('[G]Hi\n{chorus: Chorus 1}');
    });

    it('sets song info from the info popover', () => {
      render(<SongbookEditor song={song()} />);
      typeAndSelect('{key: D}\n[G]Hi', 0);
      fireEvent.click(screen.getByLabelText('Edit song info (title, artist, key, capo)'));
      fireEvent.change(screen.getByPlaceholderText('Bad Moon Rising'), { target: { value: 'Bad Moon' } });
      fireEvent.change(screen.getByDisplayValue('D'), { target: { value: 'E' } });
      fireEvent.click(screen.getByText('apply'));
      expect(textarea().value).toBe('{title: Bad Moon}\n{key: E}\n[G]Hi');
    });

    async function searchChord(name: string) {
      await loadGuitarChordDb();
      fireEvent.click(screen.getByText('chord'));
      fireEvent.change(screen.getByLabelText('Chord'), { target: { value: name } });
      await waitFor(() => expect(screen.getAllByTitle('Show this voicing on the fretboard').length)
        .toBeGreaterThan(1));
    }

    it('inserts a chord from the fretboard editor at the cursor', async () => {
      render(<SongbookEditor song={song()} />);
      typeAndSelect('Let it be', 7);
      await searchChord('Am');
      fireEvent.click(screen.getByRole('button', { name: 'Insert Am' }));
      expect(textarea().value).toBe('Let it [Am]be');
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('adds a {define} for a non-default voicing below the song info', async () => {
      render(<SongbookEditor song={song()} />);
      typeAndSelect('{title: X}\nLet it be', 18);
      await searchChord('Am');
      fireEvent.click(screen.getAllByTitle('Show this voicing on the fretboard')[1]);
      fireEvent.click(screen.getByRole('button', { name: 'Insert Am' }));
      expect(textarea().value).toMatch(/^\{title: X\}\n\{define: Am base-fret \d+ frets [^}]+\}\nLet it \[Am\]be$/);
    });
  });
});