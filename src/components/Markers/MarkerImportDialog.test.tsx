// Tests for the generic section marker import dialog.
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MarkerImportDialog } from './MarkerImportDialog';
import type { ImportedMark } from '../../utils/sectionImport';

const MARKS: ImportedMark[] = [
  { name: 'Verse 1', type: 'verse', color: '#22c55e', timeSeconds: 0 },
  { name: 'Chorus 1', type: 'chorus', color: '#ef4444', timeSeconds: 42 },
];

function renderDialog(hasExistingSections: boolean, note?: string) {
  const handlers = { onMerge: vi.fn(), onReplace: vi.fn(), onCancel: vi.fn() };
  render(
    <MarkerImportDialog
      title='Import Songbook Sections'
      description='Found 2 sections:'
      note={note}
      marks={MARKS}
      hasExistingSections={hasExistingSections}
      {...handlers}
    />,
  );
  return handlers;
}

describe('MarkerImportDialog', () => {
  it('shows title, description, note and the preview', () => {
    renderDialog(false, 'Start times are estimated.');
    expect(screen.getByText('Import Songbook Sections')).toBeInTheDocument();
    expect(screen.getByText('Found 2 sections:')).toBeInTheDocument();
    expect(screen.getByText('Start times are estimated.')).toBeInTheDocument();
    expect(screen.getByText('Chorus 1')).toBeInTheDocument();
  });

  it('offers a plain import without existing sections', () => {
    const { onMerge } = renderDialog(false);
    expect(screen.queryByText('Replace')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Import'));
    expect(onMerge).toHaveBeenCalled();
  });

  it('offers merge and replace with existing sections', () => {
    const { onReplace } = renderDialog(true);
    expect(screen.getByText('Merge')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Replace'));
    expect(onReplace).toHaveBeenCalled();
  });
});