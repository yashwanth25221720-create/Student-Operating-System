// Chrome Notifications Service for Todo Timers
// Handles scheduling timers (seconds to years) and persisting them in IndexedDB

export interface TodoTimer {
  id: string;
  taskId: string;
  taskTitle: string;
  scheduledTime: number; // Unix timestamp in milliseconds
  duration: number; // Duration in milliseconds
  completed: boolean;
  createdAt: number;
}

const DB_NAME = "HaloOSTimers";
const DB_VERSION = 1;
const STORE_NAME = "timers";

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
        store.createIndex("taskId", "taskId", { unique: false });
        store.createIndex("scheduledTime", "scheduledTime", { unique: false });
      }
    };
  });
}

export async function saveTimer(timer: TodoTimer): Promise<void> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(timer);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getTimer(id: string): Promise<TodoTimer | undefined> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function getAllTimers(): Promise<TodoTimer[]> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function deleteTimer(id: string): Promise<void> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function markTimerCompleted(id: string): Promise<void> {
  const timer = await getTimer(id);
  if (timer) {
    timer.completed = true;
    await saveTimer(timer);
  }
}

// Schedule a Chrome notification for a timer
export async function scheduleNotification(timer: TodoTimer): Promise<void> {
  if (!chrome.notifications) {
    console.warn("Chrome notifications API not available");
    return;
  }

  const delay = timer.scheduledTime - Date.now();
  if (delay <= 0) {
    // Timer is already due, show notification immediately
    showNotification(timer);
    return;
  }

  // Store the timer
  await saveTimer(timer);

  // Schedule the notification using setTimeout (in a real extension, you'd use chrome.alarms)
  setTimeout(() => {
    showNotification(timer);
  }, delay);
}

function showNotification(timer: TodoTimer): void {
  if (!chrome.notifications) return;

  chrome.notifications.create(timer.id, {
    type: "basic",
    iconUrl: "/icon-128.png",
    title: "Task Timer Complete",
    message: timer.taskTitle,
    priority: 2,
    buttons: [
      { title: "Complete Task" },
      { title: "Delay 5 min" }
    ],
    requireInteraction: true
  });
}

// Handle notification button clicks
export function setupNotificationHandlers(): void {
  if (!chrome.notifications) return;

  chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
    if (buttonIndex === 0) {
      // Complete task
      markTimerCompleted(notificationId);
      chrome.notifications.clear(notificationId);
      // Dispatch event to UI
      window.dispatchEvent(new CustomEvent("todoTimerComplete", { detail: { timerId: notificationId } }));
    } else if (buttonIndex === 1) {
      // Delay 5 minutes
      delayTimer(notificationId, 5 * 60 * 1000);
    }
  });

  chrome.notifications.onClicked.addListener((notificationId) => {
    // Open the todo modal
    window.dispatchEvent(new CustomEvent("todoTimerClick", { detail: { timerId: notificationId } }));
  });
}

async function delayTimer(timerId: string, delayMs: number): Promise<void> {
  const timer = await getTimer(timerId);
  if (timer) {
    timer.scheduledTime = Date.now() + delayMs;
    await saveTimer(timer);
    await scheduleNotification(timer);
  }
}

// Parse duration string (e.g., "5m", "1h", "30s") to milliseconds
export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/i);
  if (!match) return 0;

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case "s":
      return value * 1000;
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "d":
      return value * 24 * 60 * 60 * 1000;
    default:
      return 0;
  }
}

// Format milliseconds to human-readable string
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}
