import { SavedPhoto } from '../types';

const DB_NAME = "GrandTreeDB_React_v1";
const PHOTOS_STORE = "photos";
const MUSIC_STORE = "music";

let dbPromise: Promise<IDBDatabase> | null = null;

const initDB = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(PHOTOS_STORE)) {
        db.createObjectStore(PHOTOS_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(MUSIC_STORE)) {
        db.createObjectStore(MUSIC_STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = (e: any) => resolve(e.target.result);
    request.onerror = (e) => reject(e);
  });

  return dbPromise;
};

export const savePhotoToDB = async (base64: string): Promise<string> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PHOTOS_STORE, "readwrite");
    const id = Date.now().toString() + Math.random().toString().slice(2, 6);
    const request = transaction.objectStore(PHOTOS_STORE).add({ id, data: base64 });
    
    request.onsuccess = () => resolve(id);
    request.onerror = (e) => reject(e);
  });
};

export const loadPhotosFromDB = async (): Promise<SavedPhoto[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PHOTOS_STORE, "readonly");
    const request = transaction.objectStore(PHOTOS_STORE).getAll();
    request.onsuccess = (e: any) => resolve(e.target.result);
    request.onerror = (e) => reject(e);
  });
};

export const deletePhotoFromDB = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PHOTOS_STORE, "readwrite");
    const request = transaction.objectStore(PHOTOS_STORE).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e);
  });
};

export const clearPhotosDB = async (): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PHOTOS_STORE, "readwrite");
    const request = transaction.objectStore(PHOTOS_STORE).clear();
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e);
  });
};

export const saveMusicToDB = async (blob: Blob): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(MUSIC_STORE, "readwrite");
    const request = transaction.objectStore(MUSIC_STORE).put({ id: 'bgm', data: blob });
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e);
  });
};

export const loadMusicFromDB = async (): Promise<Blob | null> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(MUSIC_STORE, "readonly");
    const request = transaction.objectStore(MUSIC_STORE).get('bgm');
    request.onsuccess = (e: any) => resolve(e.target.result ? e.target.result.data : null);
    request.onerror = (e) => reject(e);
  });
};