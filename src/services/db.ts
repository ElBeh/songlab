import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { SongData, SectionMarker, SectionTab } from '../types';

// IndexedDB schema – idb uses this for type safety
interface SongLabDB extends DBSchema {
  songs: {
    key: string;
    value: SongData;
  };
  markers: {
    key: string;
    value: SectionMarker;
    indexes: { 'by-song': string };
  };
  tabs: {
    key: string;
    value: SectionTab;
    indexes: { 'by-song': string };
  };
}

const DB_NAME = 'songlab';
const DB_VERSION = 2;

let dbInstance: IDBPDatabase<SongLabDB> | null = null;

async function getDB(): Promise<IDBPDatabase<SongLabDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<SongLabDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('songs', { keyPath: 'id' });
        const markerStore = db.createObjectStore('markers', { keyPath: 'id' });
        markerStore.createIndex('by-song', 'songId');
      }
      if (oldVersion < 2) {
        const tabStore = db.createObjectStore('tabs', { keyPath: 'id' });
        tabStore.createIndex('by-song', 'songId');
      }
    },
  });

  return dbInstance;
}

// --- Songs ---

export async function saveSong(song: SongData): Promise<void> {
  const db = await getDB();
  await db.put('songs', song);
}

export async function getSong(id: string): Promise<SongData | undefined> {
  const db = await getDB();
  return db.get('songs', id);
}

export async function getAllSongs(): Promise<SongData[]> {
  const db = await getDB();
  return db.getAll('songs');
}

export async function deleteSong(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('songs', id);
}

// --- Markers ---

export async function saveMarker(marker: SectionMarker): Promise<void> {
  const db = await getDB();
  await db.put('markers', marker);
}

export async function getMarkersForSong(songId: string): Promise<SectionMarker[]> {
  const db = await getDB();
  return db.getAllFromIndex('markers', 'by-song', songId);
}

export async function deleteMarker(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('markers', id);
}

// --- Tabs ---

export async function saveTab(tab: SectionTab): Promise<void> {
  const db = await getDB();
  await db.put('tabs', tab);
}

export async function getTabsForSong(songId: string): Promise<SectionTab[]> {
  const db = await getDB();
  return db.getAllFromIndex('tabs', 'by-song', songId);
}

export async function deleteTab(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('tabs', id);
}