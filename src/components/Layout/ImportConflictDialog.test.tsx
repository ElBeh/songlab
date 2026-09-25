// Tests for the setlist import conflict dialog.
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ImportConflictDialog } from './ImportConflictDialog';

function renderDialog(conflictIndex: number, conflictCount: number) {
  const onResolve = vi.fn();
  render(
    <ImportConflictDialog
      setlistName='Gig'
      keepBothName='Gig (2)'
      conflictIndex={conflictIndex}
      conflictCount={conflictCount}
      onResolve={onResolve}
    />,
  );
  return onResolve;
}

describe('ImportConflictDialog', () => {
  it('shows the keep-both target name and hides apply-to-all for a single conflict', () => {
    renderDialog(1, 1);
    expect(screen.getByText('Import as "Gig (2)"')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('reports the chosen resolution', () => {
    const onResolve = renderDialog(1, 1);
    fireEvent.click(screen.getByText('Keep both'));
    expect(onResolve).toHaveBeenCalledWith('keepBoth', false);
  });

  it('passes apply-to-all when checked and more conflicts follow', () => {
    const onResolve = renderDialog(1, 3);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByText('Replace'));
    expect(onResolve).toHaveBeenCalledWith('replace', true);
  });

  it('skips on Escape', () => {
    const onResolve = renderDialog(1, 1);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onResolve).toHaveBeenCalledWith('skip', false);
  });
});