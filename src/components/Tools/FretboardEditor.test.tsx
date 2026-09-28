// Tests for chord lookup, identification and insertion in the fretboard editor.
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FretboardEditor } from './FretboardEditor';
import { loadGuitarChordDb } from '../../utils/chordLookup';

// svguitar needs SVG layout (getBBox), which jsdom lacks; the diagrams are not under test
vi.mock('svguitar', () => ({
  SVGuitarChord: class {
    configure() { return this; }
    chord() { return this; }
    draw() { return this; }
    remove() {}
  },
}));

function renderEditor(definitions = {}) {
  const onInsert = vi.fn();
  const onClose = vi.fn();
  render(<FretboardEditor onClose={onClose} onInsert={onInsert} definitions={definitions} />);
  return { onInsert, onClose };
}

async function search(chord: string) {
  // The chord database is loaded asynchronously; wait until it is there
  await loadGuitarChordDb();
  fireEvent.change(screen.getByLabelText('Chord'), { target: { value: chord } });
  await waitFor(() => expect(screen.getAllByTitle('Show this voicing on the fretboard').length)
    .toBeGreaterThan(1));
}

function pressed(name: string): boolean {
  return screen.getByRole('button', { name }).getAttribute('aria-pressed') === 'true';
}

describe('FretboardEditor', () => {
  it('shows the first voicing of a searched chord and inserts it without {define}', async () => {
    const { onInsert, onClose } = renderEditor();
    await search('Am');

    expect(pressed('String A: open')).toBe(true);
    expect(pressed('String D, fret 2')).toBe(true);
    expect(pressed('String B, fret 1')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Insert Am' }));
    expect(onInsert).toHaveBeenCalledWith('Am', null);
    expect(onClose).toHaveBeenCalled();
  });

  it('inserts another voicing with {define} and says so', async () => {
    const { onInsert } = renderEditor();
    await search('Am');

    fireEvent.click(screen.getAllByTitle('Show this voicing on the fretboard')[1]);
    expect(screen.getByText(/Adds \{define\} for Am/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Insert Am' }));
    const [name, definition] = onInsert.mock.calls[0];
    expect(name).toBe('Am');
    expect(definition).not.toBeNull();
  });

  it('identifies a clicked shape and inserts the chosen name', async () => {
    const { onInsert } = renderEditor();
    await loadGuitarChordDb();
    // x32010: C major
    fireEvent.click(screen.getByRole('button', { name: 'String A, fret 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'String D, fret 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'String G: muted' }));
    fireEvent.click(screen.getByRole('button', { name: 'String B, fret 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'String e: muted' }));

    expect(screen.getByText('C3 E3 G3 C4 E4')).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Insert C' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Insert C' }));
    expect(onInsert).toHaveBeenCalledWith('C', null);
  });

  it('announces the removal of an existing {define} for the default voicing', async () => {
    renderEditor({ Am: { name: 'Am', baseFret: 5, frets: [1, 3, 3, 1, 1, 1], fingers: [] } });
    await search('Am');
    expect(screen.getByText(/Removes the custom \{define\} for Am/)).toBeTruthy();
  });

  it('works as a lookup tool without an insert target', () => {
    render(<FretboardEditor onClose={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /^Insert/ })).toBeNull();
  });
});