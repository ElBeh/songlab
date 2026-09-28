// Tests for fret selection on the interactive fretboard.
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Fretboard } from './Fretboard';

const MUTED = [null, null, null, null, null, null];

function renderBoard(frets: (number | null)[]) {
  const onChange = vi.fn();
  render(<Fretboard frets={frets} onChange={onChange} />);
  return onChange;
}

describe('Fretboard', () => {
  it('labels strings like a tab, highest string on top', () => {
    renderBoard(MUTED);
    const nutButtons = screen.getAllByRole('button', { name: /muted$/ });
    expect(nutButtons.map((b) => b.getAttribute('aria-label'))).toEqual([
      'String e: muted', 'String B: muted', 'String G: muted',
      'String D: muted', 'String A: muted', 'String E: muted',
    ]);
  });

  it('sets a fret and mutes the string when clicked again', () => {
    const onChange = renderBoard(MUTED);
    fireEvent.click(screen.getByRole('button', { name: 'String A, fret 3' }));
    expect(onChange).toHaveBeenLastCalledWith([null, 3, null, null, null, null]);

    const second = renderBoard([null, 3, null, null, null, null]);
    fireEvent.click(screen.getAllByRole('button', { name: 'String A, fret 3' })[1]);
    expect(second).toHaveBeenLastCalledWith(MUTED);
  });

  it('toggles the nut between open and muted', () => {
    const onChange = renderBoard([null, 3, null, null, null, null]);
    fireEvent.click(screen.getByRole('button', { name: 'String A: muted' }));
    expect(onChange).toHaveBeenLastCalledWith([null, 0, null, null, null, null]);

    const second = renderBoard([0, 3, null, null, null, null]);
    fireEvent.click(screen.getByRole('button', { name: 'String E: open' }));
    expect(second).toHaveBeenLastCalledWith([null, 3, null, null, null, null]);
  });

  it('shows the note names of sounding positions', () => {
    renderBoard([null, 3, 2, 0, 1, 0]);
    expect(screen.getByRole('button', { name: 'String A, fret 3' }).textContent).toBe('C');
    expect(screen.getByRole('button', { name: 'String D, fret 2' }).textContent).toBe('E');
    expect(screen.getByRole('button', { name: 'String G: open' }).textContent).toBe('G');
  });
});