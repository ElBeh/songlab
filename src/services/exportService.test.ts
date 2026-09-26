// Tests for the parse / commit split of the import pipeline.
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import {
  commitBundles,
  parseImportFile,
  selectBundlesToCommit,
  type ImportedSetlist,
  type SongBundle,
} from './exportService';
import { getSong } from './db';
import type { SongData } from '../types';

function song(id: string, isDummy = false): SongData {
  return {
    id, title: id, fileName: `${id}.mp3`, fileSize: 0, duration: 60, createdAt: 0,
    volume: 1, normalizationGain: 1, normalizationEnabled: false, isDummy,
    gpFileName: null, syncPoints: null, syncOffset: null, bpmAdjust: null, bpm: null,
    timeSignature: null,
  };
}

function bundle(id: string): SongBundle {
  return { song: song(id), markers: [], tabs: [], sheets: [] };
}

function setlist(name: string, songIds: string[]): ImportedSetlist {
  return { name, items: songIds.map((songId) => ({ type: 'song' as const, songId })) };
}

function jsonFile(data: unknown): File {
  return new File([JSON.stringify(data)], 'import.json', { type: 'application/json' });
}

describe('parseImportFile', () => {
  it('parses a gig export without writing to IndexedDB', async () => {
    const file = jsonFile({
      version: 2,
      setlists: [setlist('Gig', ['parse-a'])],
      songs: [bundle('parse-a')],
    });
    const parsed = await parseImportFile(file);

    expect(parsed.type).toBe('gig');
    expect(await getSong('parse-a')).toBeUndefined();
  });

  it('normalizes songs to dummy songs and adds a default sheet for orphan tabs', async () => {
    const tab = { id: 't1', songId: 'parse-b', markerId: 'm1', content: '' };
    const parsed = await parseImportFile(jsonFile({ version: 3, ...bundle('parse-b'), tabs: [tab] }));

    if (parsed.type !== 'song') throw new Error('expected song import');
    expect(parsed.bundle.song.isDummy).toBe(true);
    expect(parsed.bundle.sheets).toHaveLength(1);
    expect(parsed.bundle.tabs[0].sheetId).toBe(parsed.bundle.sheets[0].id);
  });

  it('falls back to a flat "Imported" setlist for v2 exports without setlists', async () => {
    const parsed = await parseImportFile(jsonFile({ version: 2, setlists: [], songs: [bundle('parse-c')] }));
    if (parsed.type !== 'gig') throw new Error('expected gig import');
    expect(parsed.setlists).toEqual([setlist('Imported', ['parse-c'])]);
  });
});

describe('commitBundles', () => {
  it('persists the bundles and returns their songs', async () => {
    const songs = await commitBundles([bundle('commit-a')]);
    expect(songs.map((s) => s.id)).toEqual(['commit-a']);
    expect(await getSong('commit-a')).toBeDefined();
  });
});

describe('selectBundlesToCommit', () => {
  const bundles = ['a', 'b', 'c', 'lib'].map(bundle);
  const first = setlist('First', ['a', 'b']);
  const second = setlist('Second', ['b', 'c']);
  const ids = (list: SongBundle[]) => list.map((b) => b.song.id);

  it('keeps everything when no setlist is skipped', () => {
    expect(ids(selectBundlesToCommit(bundles, [first, second], [first, second])))
      .toEqual(['a', 'b', 'c', 'lib']);
  });

  it('drops songs referenced only by skipped setlists', () => {
    expect(ids(selectBundlesToCommit(bundles, [first, second], [second])))
      .toEqual(['b', 'c', 'lib']);
  });

  it('keeps songs that are not referenced by any setlist', () => {
    expect(ids(selectBundlesToCommit(bundles, [first, second], []))).toEqual(['lib']);
  });
});

describe('songbook chordSheet', () => {
  it('survives a song export and re-import', async () => {
    const chordSheet = '{title: Test}\n{start_of_verse: Verse 1}\n[Am]Hello [F]world\n{end_of_verse}';
    const exported = { version: 3, ...bundle('cs-a'), song: { ...song('cs-a'), chordSheet } };

    const parsed = await parseImportFile(jsonFile(exported));
    if (parsed.type !== 'song') throw new Error('expected song import');
    await commitBundles([parsed.bundle]);

    expect((await getSong('cs-a'))?.chordSheet).toBe(chordSheet);
  });

  it('survives a gig export and re-import', async () => {
    const exported = {
      version: 2,
      setlists: [setlist('Gig', ['cs-b'])],
      songs: [{ ...bundle('cs-b'), song: { ...song('cs-b'), chordSheet: '[G]Hi' } }],
    };

    const parsed = await parseImportFile(jsonFile(exported));
    if (parsed.type !== 'gig') throw new Error('expected gig import');
    await commitBundles(parsed.bundles);

    expect((await getSong('cs-b'))?.chordSheet).toBe('[G]Hi');
  });

  it('imports older exports without a chordSheet field', async () => {
    const parsed = await parseImportFile(jsonFile({ version: 3, ...bundle('cs-c') }));
    if (parsed.type !== 'song') throw new Error('expected song import');
    await commitBundles([parsed.bundle]);

    expect((await getSong('cs-c'))?.chordSheet).toBeUndefined();
  });
});