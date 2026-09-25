// Characterization tests for the active-setlist item operations.
// Written before the DRY refactor (mutateActiveSetlist) to guarantee the
// refactor keeps behavior identical.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { useSetlistStore } from './useSetlistStore';
import type { SetlistItem } from '../types';

const store = () => useSetlistStore.getState();

function pauseId(items: SetlistItem[]): string {
  const pause = items.find((i) => i.type === 'pause');
  if (!pause || pause.type !== 'pause') throw new Error('no pause');
  return pause.id;
}

describe('useSetlistStore item operations', () => {
  beforeEach(async () => {
    useSetlistStore.setState({ setlists: [], activeSetlistId: null });
    await store().createSetlist('Test');
    await store().addSongToActiveSetlist('a');
    await store().addSongToActiveSetlist('b');
  });

  it('does not add the same song twice', async () => {
    await store().addSongToActiveSetlist('a');
    const songs = store().getActiveItems().filter((i) => i.type === 'song');
    expect(songs).toHaveLength(2);
  });

  it('inserts a pause after the given index', async () => {
    await store().addPause(0, 10);
    const items = store().getActiveItems();
    expect(items.map((i) => i.type)).toEqual(['song', 'pause', 'song']);
    const pause = items[1];
    expect(pause.type === 'pause' && pause.duration).toBe(10);
  });

  it('reorders items', async () => {
    await store().reorderItem(0, 1); // [a, b] -> [b, a]
    const songIds = store()
      .getActiveItems()
      .flatMap((i) => (i.type === 'song' ? [i.songId] : []));
    expect(songIds).toEqual(['b', 'a']);
  });

  it('is a no-op for an out-of-range reorder', async () => {
    const before = store().getActiveItems();
    await store().reorderItem(0, 5);
    expect(store().getActiveItems()).toEqual(before);
  });

  it('removes a pause by id', async () => {
    await store().addPause(0, 10);
    await store().removePause(pauseId(store().getActiveItems()));
    expect(store().getActiveItems().some((i) => i.type === 'pause')).toBe(false);
  });

  it('updates a pause duration', async () => {
    await store().addPause(0, 10);
    const id = pauseId(store().getActiveItems());
    await store().updatePause(id, 30);
    const pause = store().getActiveItems().find((i) => i.type === 'pause');
    expect(pause && pause.type === 'pause' && pause.duration).toBe(30);
  });

  it('renames the setlist', async () => {
    const id = store().activeSetlistId!;
    await store().renameSetlist(id, 'Renamed');
    expect(store().getActiveSetlist()?.name).toBe('Renamed');
  });

  it('replaces all items via setActiveItems', async () => {
    const items: SetlistItem[] = [{ type: 'song', songId: 'z' }];
    await store().setActiveItems(items);
    expect(store().getActiveItems()).toEqual(items);
  });

  it('creates a setlist when none exists (Band Sync viewer, fresh profile)', async () => {
    useSetlistStore.setState({ setlists: [], activeSetlistId: null });
    const items: SetlistItem[] = [{ type: 'song', songId: 's1' }];
    await store().setActiveItems(items, 'Gig A');
    expect(store().getActiveItems()).toEqual(items);
    expect(store().getActiveSetlist()?.name).toBe('Gig A');
  });
});

describe('useSetlistStore import helpers', () => {
  beforeEach(async () => {
    useSetlistStore.setState({ setlists: [], activeSetlistId: null });
    await store().createSetlist('Gig');
  });

  it('finds a setlist by name, ignoring case and surrounding whitespace', () => {
    expect(store().findSetlistByName('  gig ')?.name).toBe('Gig');
    expect(store().findSetlistByName('Other')).toBeNull();
  });

  it('returns the name unchanged when it is free', () => {
    expect(store().getUniqueSetlistName('Other')).toBe('Other');
  });

  it('appends the next free counter when the name is taken', async () => {
    expect(store().getUniqueSetlistName('Gig')).toBe('Gig (2)');
    await store().createSetlist('Gig (2)');
    expect(store().getUniqueSetlistName('Gig')).toBe('Gig (3)');
    expect(store().getUniqueSetlistName('Gig (2)')).toBe('Gig (3)');
  });

  it('replaces the items of a setlist and keeps its id and name', async () => {
    const { id } = store().setlists[0];
    await store().replaceSetlistItems(id, [{ type: 'song', songId: 'x' }]);
    const updated = store().setlists.find((s) => s.id === id);
    expect(updated?.name).toBe('Gig');
    expect(updated?.items).toEqual([{ type: 'song', songId: 'x' }]);
  });
});