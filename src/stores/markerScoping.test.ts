// Regression tests: markers must be scoped to the active song - locally
// and when applying Band Sync events (incl. races and late events).
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { useSongStore } from './useSongStore';
import { navigateToSong } from '../utils/songNavigation';
import type { SongData, SectionMarker } from '../types';

const song = (id: string): SongData => ({
  id, title: id, fileName: '', fileSize: 0, duration: 100, createdAt: 1,
  volume: 1, normalizationGain: 1, normalizationEnabled: false,
  isDummy: true, gpFileName: null, syncOffset: null, bpmAdjust: null,
  syncPoints: null, bpm: null, timeSignature: null,
});
const marker = (id: string, songId: string, t: number): SectionMarker => ({
  id, songId, startTime: t, type: 'verse', label: id, color: '#fff',
});

describe('marker scoping across song switches', () => {
  it('shows only the active song markers after switching', async () => {
    const s = () => useSongStore.getState();
    await s().addSong(song('A'));
    await s().addSong(song('B'));
    await s().setActiveSongId('A');
    await s().addMarker(marker('m1', 'A', 10));
    await s().addMarker(marker('m2', 'A', 20));
    expect(s().getActiveMarkers().map((m) => m.id)).toEqual(['m1', 'm2']);

    await s().setActiveSongId('B');
    console.log('B markers:', JSON.stringify(s().getActiveMarkers()));
    expect(s().getActiveMarkers()).toEqual([]);

    await s().setActiveSongId('A');
    expect(s().getActiveMarkers().map((m) => m.id)).toEqual(['m1', 'm2']);
  });
});

describe('viewer marker scoping (socket handler simulation)', () => {
  beforeEach(() => {
    useSongStore.setState({ songs: [], activeSongId: null, markersBySong: {} });
  });

  it('song:select then song:data', async () => {
    const s = () => useSongStore.getState();
    await s().applyRemoteSongData(song('A'), [marker('a1', 'A', 5)], null);
    await s().applyRemoteMarker(marker('a2', 'A', 10)); // host adds markers
    expect(s().getActiveMarkers().map((m) => m.id)).toEqual(['a1', 'a2']);

    // Host switches to B: select first, data second
    await navigateToSong('B');
    console.log('after song:select ->', JSON.stringify(s().getActiveMarkers().map((m) => m.id)));
    await s().applyRemoteSongData(song('B'), [], null);
    console.log('after song:data   ->', JSON.stringify(s().getActiveMarkers().map((m) => m.id)));
    expect(s().getActiveMarkers()).toEqual([]);
  });

  it('song:select and song:data racing (concurrent)', async () => {
    const s = () => useSongStore.getState();
    await s().applyRemoteSongData(song('A'), [marker('a1', 'A', 5)], null);
    await s().applyRemoteMarker(marker('a2', 'A', 10));

    await Promise.all([
      navigateToSong('B'),
      s().applyRemoteSongData(song('B'), [], null),
    ]);
    console.log('after race        ->', JSON.stringify(s().getActiveMarkers().map((m) => m.id)));
    expect(s().getActiveMarkers()).toEqual([]);
  });

  it('marker:save arriving after the switch (late event)', async () => {
    const s = () => useSongStore.getState();
    await s().applyRemoteSongData(song('A'), [marker('a1', 'A', 5)], null);
    await navigateToSong('B');
    await s().applyRemoteSongData(song('B'), [], null);
    // Late marker:save for song A arrives after viewer switched to B
    await s().applyRemoteMarker(marker('a2', 'A', 10));
    console.log('late marker A     ->', JSON.stringify(s().getActiveMarkers().map((m) => m.id)));
    expect(s().getActiveMarkers()).toEqual([]);
  });
});
