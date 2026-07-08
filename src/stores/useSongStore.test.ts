// Pins the remote-apply semantics that motivated moving this logic into the
// store: incoming marker saves must upsert (never duplicate) and stay sorted.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { useSongStore } from './useSongStore';
import type { SectionMarker } from '../types';

function marker(id: string, startTime: number): SectionMarker {
  return { id, songId: 'song-1', type: 'verse', label: id, startTime, color: '#ffffff' };
}

describe('useSongStore remote apply', () => {
  beforeEach(() => {
    useSongStore.setState({ songs: [], activeSongId: null, markersBySong: {} });
  });

  it('upserts an incoming marker instead of duplicating it', async () => {
    await useSongStore.getState().applyRemoteMarker(marker('m1', 10));
    await useSongStore.getState().applyRemoteMarker(marker('m1', 5));
    const markers = useSongStore.getState().markersBySong['song-1'];
    expect(markers).toHaveLength(1);
    expect(markers[0].startTime).toBe(5);
  });

  it('keeps markers sorted by start time', async () => {
    await useSongStore.getState().applyRemoteMarker(marker('m2', 20));
    await useSongStore.getState().applyRemoteMarker(marker('m1', 5));
    const times = useSongStore.getState().markersBySong['song-1'].map((m) => m.startTime);
    expect(times).toEqual([5, 20]);
  });

  it('removes a marker on remote delete', async () => {
    await useSongStore.getState().applyRemoteMarker(marker('m1', 5));
    await useSongStore.getState().applyRemoteMarkerDelete('m1', 'song-1');
    expect(useSongStore.getState().markersBySong['song-1']).toHaveLength(0);
  });
});
