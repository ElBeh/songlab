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
});
