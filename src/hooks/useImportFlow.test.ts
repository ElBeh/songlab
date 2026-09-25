// Integration tests for the import conflict flow (setlist name clashes).
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useImportFlow } from './useImportFlow';
import { useSetlistStore } from '../stores/useSetlistStore';
import { useSongStore } from '../stores/useSongStore';
import { getSong } from '../services/db';
import type { ParsedImport, SongBundle } from '../services/exportService';
import type { SongData } from '../types';

let counter = 0;

function bundle(id: string): SongBundle {
  const song: SongData = {
    id, title: id, fileName: '', fileSize: 0, duration: 60, createdAt: 0,
    volume: 1, normalizationGain: 1, normalizationEnabled: false, isDummy: true,
    gpFileName: null, syncPoints: null, syncOffset: null, bpmAdjust: null, bpm: null,
    timeSignature: null,
  };
  return { song, markers: [], tabs: [], sheets: [] };
}

/** Gig import with one song per setlist; song ids are unique per test run */
function gig(...names: string[]): ParsedImport {
  const ids = names.map(() => `flow-${++counter}`);
  return {
    type: 'gig',
    bundles: ids.map(bundle),
    setlists: names.map((name, i) => ({
      name,
      items: [{ type: 'song' as const, songId: ids[i] }],
    })),
  };
}

const setlists = () => useSetlistStore.getState().setlists;
const byName = (name: string) => setlists().find((s) => s.name === name);

describe('useImportFlow', () => {
  beforeEach(async () => {
    useSetlistStore.setState({ setlists: [], activeSetlistId: null });
    useSongStore.setState({ songs: [], activeSongId: null, markersBySong: {} });
    await useSetlistStore.getState().createSetlist('Gig');
  });

  it('imports directly when no name clashes', async () => {
    const { result } = renderHook(() => useImportFlow());
    await act(() => result.current.importParsed(gig('New')));

    expect(result.current.conflictDialog).toBeNull();
    expect(setlists().map((s) => s.name)).toEqual(['Gig', 'New']);
  });

  it('shows the dialog and persists nothing before a decision', async () => {
    const parsed = gig('Gig');
    const { result } = renderHook(() => useImportFlow());
    await act(() => result.current.importParsed(parsed));

    expect(result.current.conflictDialog).toMatchObject({
      setlistName: 'Gig', keepBothName: 'Gig (2)', conflictIndex: 1, conflictCount: 1,
    });
    if (parsed.type !== 'gig') throw new Error('expected gig');
    expect(await getSong(parsed.bundles[0].song.id)).toBeUndefined();
  });

  it('replaces the existing setlist and keeps its id', async () => {
    const existingId = setlists()[0].id;
    const parsed = gig('Gig');
    const { result } = renderHook(() => useImportFlow());
    await act(() => result.current.importParsed(parsed));
    await act(() => result.current.conflictDialog!.onResolve('replace', false));

    expect(setlists()).toHaveLength(1);
    expect(setlists()[0].id).toBe(existingId);
    expect(setlists()[0].items).toEqual(
      parsed.type === 'gig' ? parsed.setlists[0].items : [],
    );
  });

  it('keeps both by importing under a unique name', async () => {
    const { result } = renderHook(() => useImportFlow());
    await act(() => result.current.importParsed(gig('Gig')));
    await act(() => result.current.conflictDialog!.onResolve('keepBoth', false));

    expect(setlists().map((s) => s.name)).toEqual(['Gig', 'Gig (2)']);
  });

  it('skips the clashing setlist and does not persist its songs', async () => {
    const parsed = gig('Gig');
    const { result } = renderHook(() => useImportFlow());
    await act(() => result.current.importParsed(parsed));
    await act(() => result.current.conflictDialog!.onResolve('skip', false));

    expect(result.current.conflictDialog).toBeNull();
    expect(setlists()).toHaveLength(1);
    expect(setlists()[0].items).toEqual([]);
    if (parsed.type !== 'gig') throw new Error('expected gig');
    expect(await getSong(parsed.bundles[0].song.id)).toBeUndefined();
  });

  it('walks through multiple conflicts one by one', async () => {
    await useSetlistStore.getState().createSetlist('Encore');
    const { result } = renderHook(() => useImportFlow());
    await act(() => result.current.importParsed(gig('Gig', 'Encore', 'New')));

    expect(result.current.conflictDialog).toMatchObject({ conflictIndex: 1, conflictCount: 2 });
    await act(() => result.current.conflictDialog!.onResolve('skip', false));
    expect(result.current.conflictDialog).toMatchObject({
      setlistName: 'Encore', conflictIndex: 2,
    });
    await act(() => result.current.conflictDialog!.onResolve('keepBoth', false));

    expect(result.current.conflictDialog).toBeNull();
    expect(setlists().map((s) => s.name)).toEqual(['Gig', 'Encore', 'Encore (2)', 'New']);
  });

  it('applies one decision to all remaining conflicts', async () => {
    await useSetlistStore.getState().createSetlist('Encore');
    const { result } = renderHook(() => useImportFlow());
    await act(() => result.current.importParsed(gig('Gig', 'Encore')));
    await act(() => result.current.conflictDialog!.onResolve('keepBoth', true));

    expect(result.current.conflictDialog).toBeNull();
    expect(byName('Gig (2)')).toBeDefined();
    expect(byName('Encore (2)')).toBeDefined();
  });
});