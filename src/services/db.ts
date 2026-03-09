import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { SongData, SectionMarker } from '../types';

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
}

const DB_NAME = 'songlab';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<SongLabDB> | null = null;

async function getDB(): Promise<IDBPDatabase<SongLabDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<SongLabDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore('songs', { keyPath: 'id' });

      const markerStore = db.createObjectStore('markers', { keyPath: 'id' });
      // Index lets us query all markers for a given songId efficiently
      markerStore.createIndex('by-song', 'songId');
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