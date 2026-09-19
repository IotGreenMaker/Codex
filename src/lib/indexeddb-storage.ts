// lib/indexeddb-storage.ts
// Real IndexedDB implementation â€” all data stored locally in the browser.
// No server, no accounts, no cloud. Works completely offline.

import type { AiConfig } from "@/components/dashboard/ai-config-modal";
import type { PlantProfile, SpaceConfig } from "@/lib/types";

// â”€â”€â”€ Schema â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const DB_NAME = "g-buddy";
const DB_VERSION = 4; // Consolidated spaces schema and recovery snapshots

const STORE_PLANTS = "plants";
const STORE_SETTINGS = "settings";
const STORE_CHAT = "chat_messages";
const STORE_SPACES = "spaces";
const STORE_BACKUP = "backup_snapshots";

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export type ChatMessageEntry = {
  id: string;
  plantId: string;
  /** ISO timestamp â€” prefer this field */
  timestamp?: string;
  /** Legacy alias kept for backward compatibility */
  createdAt?: string;
  role: "user" | "assistant";
  content: string;
  source?: string;
  model?: string;
};

export type BackupSnapshot = {
  id: "latest";
  savedAt: string;
  plants: PlantProfile[];
  spaces: SpaceConfig[];
  activePlantId: string;
  activeSpaceId: string;
};

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Open (or create) the G-Buddy IndexedDB database.
 * Uses a singleton promise to ensure the database is only opened once per session.
 */
export function openDB(): Promise<IDBDatabase> {
  // Guard: IndexedDB only exists in browser contexts
  if (typeof window === "undefined" || typeof indexedDB === "undefined") {
    return Promise.reject(new Error("[IndexedDB] Not available in this environment"));
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Plants â€” keyed by id
      if (!db.objectStoreNames.contains(STORE_PLANTS)) {
        db.createObjectStore(STORE_PLANTS, { keyPath: "id" });
      }

      // Settings â€” simple key-value store
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS);
      }

      // Chat messages â€” keyed by id, indexed by plantId for fast lookup
      if (!db.objectStoreNames.contains(STORE_CHAT)) {
        const chatStore = db.createObjectStore(STORE_CHAT, { keyPath: "id" });
        chatStore.createIndex("plantId", "plantId", { unique: false });
      }

      // Spaces â€” keyed by id, stores space configurations with isolated VPD data
      if (!db.objectStoreNames.contains(STORE_SPACES)) {
        const spacesStore = db.createObjectStore(STORE_SPACES, { keyPath: "id" });
        spacesStore.createIndex("name", "name", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_BACKUP)) {
        db.createObjectStore(STORE_BACKUP, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null; // Reset promise on error so we can retry
      reject(request.error);
    };
  });

  return dbPromise;
}


// â”€â”€â”€ Low-level helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function storeGetAll<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

function storeGet<T>(
  db: IDBDatabase,
  storeName: string,
  key: IDBValidKey
): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

function storePut<T>(
  db: IDBDatabase,
  storeName: string,
  value: T,
  key?: IDBValidKey
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const req =
      key !== undefined
        ? tx.objectStore(storeName).put(value, key)
        : tx.objectStore(storeName).put(value);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function storeDelete(
  db: IDBDatabase,
  storeName: string,
  key: IDBValidKey
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const req = tx.objectStore(storeName).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function storeGetByIndex<T>(
  db: IDBDatabase,
  storeName: string,
  indexName: string,
  key: IDBValidKey
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).index(indexName).getAll(key);
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

// â”€â”€â”€ Database initialisation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Call once on app startup to ensure the DB schema exists. */
export async function initializeDB(): Promise<boolean> {
  try {
    await openDB();
    console.log("[IndexedDB] Ready");
    return true;
  } catch (err) {
    console.error("[IndexedDB] initializeDB failed:", err);
    return false;
  }
}

// â”€â”€â”€ Plants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Retrieve all plant profiles stored in IndexedDB. */
export async function getAllPlants(): Promise<PlantProfile[]> {
  try {
    const db = await openDB();
    return await storeGetAll<PlantProfile>(db, STORE_PLANTS);
  } catch (err) {
    console.error("[IndexedDB] getAllPlants failed:", err);
    return [];
  }
}

/** Save (insert or update) a plant profile. */
export async function savePlant(plant: PlantProfile): Promise<boolean> {
  try {
    const db = await openDB();
    await storePut(db, STORE_PLANTS, plant);
    return true;
  } catch (err) {
    console.error("[IndexedDB] savePlant failed:", err);
    return false;
  }
}

/** Permanently delete a plant by ID. */
export async function deletePlant(id: string): Promise<boolean> {
  try {
    const db = await openDB();
    await storeDelete(db, STORE_PLANTS, id);
    return true;
  } catch (err) {
    console.error("[IndexedDB] deletePlant failed:", err);
    return false;
  }
}

// â”€â”€â”€ Settings (key-value) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Retrieve a setting by key. Returns null if not found. */
export async function getSetting(key: string): Promise<string | null> {
  try {
    const db = await openDB();
    const value = await storeGet<string>(db, STORE_SETTINGS, key);
    return value ?? null;
  } catch (err) {
    console.error("[IndexedDB] getSetting failed:", err);
    return null;
  }
}

/** Save a setting value. Value is serialised as a string. */
export async function setSetting(
  key: string,
  value: string
): Promise<boolean> {
  try {
    const db = await openDB();
    await storePut(db, STORE_SETTINGS, String(value), key);
    return true;
  } catch (err) {
    console.error("[IndexedDB] setSetting failed:", err);
    return false;
  }
}

// â”€â”€â”€ AI Configuration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const AI_CONFIG_KEY = "aiConfig";

const DEFAULT_AI_CONFIG: AiConfig = {
  aiProvider: "groq",
  aiApiKey: "",
  voiceProvider: "browser",
  voiceApiKey: "",
};

/** Load the user's AI/voice configuration from settings. */
export async function getAiConfig(): Promise<AiConfig> {
  try {
    const db = await openDB();
    const raw = await storeGet<string>(db, STORE_SETTINGS, AI_CONFIG_KEY);
    if (!raw) return DEFAULT_AI_CONFIG;
    return { ...DEFAULT_AI_CONFIG, ...(JSON.parse(raw) as Partial<AiConfig>) };
  } catch (err) {
    console.error("[IndexedDB] getAiConfig failed:", err);
    return DEFAULT_AI_CONFIG;
  }
}

/** Persist the AI/voice configuration. */
export async function saveAiConfig(config: AiConfig): Promise<boolean> {
  try {
    const db = await openDB();
    await storePut(db, STORE_SETTINGS, JSON.stringify(config), AI_CONFIG_KEY);
    return true;
  } catch (err) {
    console.error("[IndexedDB] saveAiConfig failed:", err);
    return false;
  }
}

// â”€â”€â”€ Chat messages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Retrieve the last `limit` chat messages for a given plant, oldest first. */
export async function getChatMessages(
  plantId: string,
  limit = 20
): Promise<ChatMessageEntry[]> {
  try {
    const db = await openDB();
    const all = await storeGetByIndex<ChatMessageEntry>(
      db,
      STORE_CHAT,
      "plantId",
      plantId
    );

    // Sort ascending by timestamp so history is in conversation order
    const sorted = all.sort((a, b) => {
      const aTime = a.timestamp ?? a.createdAt ?? "";
      const bTime = b.timestamp ?? b.createdAt ?? "";
      return aTime.localeCompare(bTime);
    });

    // Return only the most recent `limit` entries
    return sorted.slice(-limit);
  } catch (err) {
    console.error("[IndexedDB] getChatMessages failed:", err);
    return [];
  }
}

/**
 * Save a new chat message then prune oldest entries so the store never
 * exceeds `limit` messages per plant. Keeps memory usage tiny.
 */
export async function saveAndTruncateChatMessage(
  message: ChatMessageEntry,
  limit = 20
): Promise<boolean> {
  try {
    const db = await openDB();

    // Ensure timestamp is set
    const entry: ChatMessageEntry = {
      ...message,
      timestamp: message.timestamp ?? message.createdAt ?? new Date().toISOString(),
    };

    await storePut(db, STORE_CHAT, entry);

    // Prune oldest messages if over limit
    const all = await storeGetByIndex<ChatMessageEntry>(
      db,
      STORE_CHAT,
      "plantId",
      message.plantId
    );

    if (all.length > limit) {
      const sorted = all.sort((a, b) => {
        const aTime = a.timestamp ?? a.createdAt ?? "";
        const bTime = b.timestamp ?? b.createdAt ?? "";
        return aTime.localeCompare(bTime);
      });
      const toDelete = sorted.slice(0, all.length - limit);
      for (const msg of toDelete) {
        await storeDelete(db, STORE_CHAT, msg.id);
      }
    }

    return true;
  } catch (err) {
    console.error("[IndexedDB] saveAndTruncateChatMessage failed:", err);
    return false;
  }
}

/** Delete all chat messages associated with a plant (e.g. when deleting the plant). */
export async function deleteChatMessagesForPlant(
  plantId: string
): Promise<boolean> {
  try {
    const db = await openDB();
    const all = await storeGetByIndex<ChatMessageEntry>(
      db,
      STORE_CHAT,
      "plantId",
      plantId
    );
    for (const msg of all) {
      await storeDelete(db, STORE_CHAT, msg.id);
    }
    console.log(
      `[IndexedDB] Deleted ${all.length} chat messages for plant ${plantId}`
    );
    return true;
  } catch (err) {
    console.error("[IndexedDB] deleteChatMessagesForPlant failed:", err);
    return false;
  }
}

// â”€â”€â”€ Spaces â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Retrieve all spaces stored in IndexedDB. */
export async function getAllSpaces(): Promise<SpaceConfig[]> {
  try {
    const db = await openDB();
    return await storeGetAll<SpaceConfig>(db, STORE_SPACES);
  } catch (err) {
    console.error("[IndexedDB] getAllSpaces failed:", err);
    return [];
  }
}

/** Get a single space by ID. */
export async function getSpace(id: string): Promise<SpaceConfig | null> {
  try {
    const db = await openDB();
    const space = await storeGet<SpaceConfig>(db, STORE_SPACES, id);
    return space || null;
  } catch (err) {
    console.error("[IndexedDB] getSpace failed:", err);
    return null;
  }
}

/** Save (insert or update) a space. */
export async function saveSpace(space: SpaceConfig): Promise<boolean> {
  try {
    const db = await openDB();
    await storePut(db, STORE_SPACES, space);
    return true;
  } catch (err) {
    console.error("[IndexedDB] saveSpace failed:", err);
    return false;
  }
}

/** Permanently delete a space by ID. */
export async function deleteSpace(id: string): Promise<boolean> {
  try {
    const db = await openDB();
    await storeDelete(db, STORE_SPACES, id);
    console.log(`[IndexedDB] Deleted space ${id}`);
    return true;
  } catch (err) {
    console.error("[IndexedDB] deleteSpace failed:", err);
    return false;
  }
}

/** Save the latest local recovery snapshot without creating a browser download. */
export async function saveBackupSnapshot(snapshot: BackupSnapshot): Promise<boolean> {
  try {
    const db = await openDB();
    await storePut(db, STORE_BACKUP, snapshot);
    return true;
  } catch (err) {
    console.error("[IndexedDB] saveBackupSnapshot failed:", err);
    return false;
  }
}

/** Retrieve the latest recovery snapshot, if one exists. */
export async function getBackupSnapshot(): Promise<BackupSnapshot | null> {
  try {
    const db = await openDB();
    return (await storeGet<BackupSnapshot>(db, STORE_BACKUP, "latest")) ?? null;
  } catch (err) {
    console.error("[IndexedDB] getBackupSnapshot failed:", err);
    return null;
  }
}

