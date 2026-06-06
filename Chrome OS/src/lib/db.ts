// IndexedDB Schema for Halo OS
// Handles offline audio storage and white noise tracks

export interface WhiteNoiseTrack {
  id: string;
  name: string;
  url: string;
  category: string;
  duration?: number;
  thumbnail?: string;
}

const DB_NAME = "HaloOS";
const DB_VERSION = 1;
const STORE_OFFLINE_AUDIO = "offlineAudio";
const STORE_WHITE_NOISE = "whiteNoiseTracks";

let db: IDBDatabase | null = null;

export async function getDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Offline audio store (for user-uploaded audio files)
      if (!database.objectStoreNames.contains(STORE_OFFLINE_AUDIO)) {
        const audioStore = database.createObjectStore(STORE_OFFLINE_AUDIO, { keyPath: "id" });
        audioStore.createIndex("category", "category", { unique: false });
        audioStore.createIndex("createdAt", "createdAt", { unique: false });
      }

      // White noise tracks store (for CDN URLs)
      if (!database.objectStoreNames.contains(STORE_WHITE_NOISE)) {
        const noiseStore = database.createObjectStore(STORE_WHITE_NOISE, { keyPath: "id" });
        noiseStore.createIndex("category", "category", { unique: false });
      }
    };
  });
}

// White Noise Tracks Operations
export async function saveWhiteNoiseTrack(track: WhiteNoiseTrack): Promise<void> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_WHITE_NOISE], "readwrite");
    const store = transaction.objectStore(STORE_WHITE_NOISE);
    const request = store.put(track);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getAllWhiteNoiseTracks(): Promise<WhiteNoiseTrack[]> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_WHITE_NOISE], "readonly");
    const store = transaction.objectStore(STORE_WHITE_NOISE);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function getWhiteNoiseTracksByCategory(category: string): Promise<WhiteNoiseTrack[]> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_WHITE_NOISE], "readonly");
    const store = transaction.objectStore(STORE_WHITE_NOISE);
    const index = store.index("category");
    const request = index.getAll(category);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function deleteWhiteNoiseTrack(id: string): Promise<void> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_WHITE_NOISE], "readwrite");
    const store = transaction.objectStore(STORE_WHITE_NOISE);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Initialize white noise tracks from JSON file
export async function initializeWhiteNoiseTracks(tracks: WhiteNoiseTrack[]): Promise<void> {
  const existing = await getAllWhiteNoiseTracks();
  if (existing.length > 0) return; // Already initialized

  for (const track of tracks) {
    await saveWhiteNoiseTrack(track);
  }
}
