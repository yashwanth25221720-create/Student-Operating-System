// Offline Audio Service
// Functions to store/retrieve audio blobs in IndexedDB with no size restriction

export interface OfflineAudio {
  id: string;
  name: string;
  blob: Blob;
  mimeType: string;
  size: number;
  createdAt: number;
  category?: string;
}

const DB_NAME = "HaloOSOfflineAudio";
const DB_VERSION = 1;
const STORE_NAME = "offlineAudio";

let db: IDBDatabase | null = null;

async function getDB(): Promise<IDBDatabase> {
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
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("category", "category", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
  });
}

export async function saveOfflineAudio(audio: OfflineAudio): Promise<void> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(audio);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getOfflineAudio(id: string): Promise<OfflineAudio | undefined> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function getAllOfflineAudio(): Promise<OfflineAudio[]> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function getOfflineAudioByCategory(category: string): Promise<OfflineAudio[]> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index("category");
    const request = index.getAll(category);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function deleteOfflineAudio(id: string): Promise<void> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function clearAllOfflineAudio(): Promise<void> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Helper function to convert a file to OfflineAudio
export async function fileToOfflineAudio(file: File, category?: string): Promise<OfflineAudio> {
  return {
    id: crypto.randomUUID(),
    name: file.name,
    blob: file,
    mimeType: file.type,
    size: file.size,
    createdAt: Date.now(),
    category
  };
}

// Helper function to create a blob URL from offline audio
export function getBlobUrl(audio: OfflineAudio): string {
  return URL.createObjectURL(audio.blob);
}

// Helper function to revoke a blob URL (call this when done with the audio)
export function revokeBlobUrl(url: string): void {
  URL.revokeObjectURL(url);
}

// Get total storage used by offline audio
export async function getTotalStorageUsed(): Promise<number> {
  const audios = await getAllOfflineAudio();
  return audios.reduce((total, audio) => total + audio.size, 0);
}

// Format bytes to human-readable string
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}
