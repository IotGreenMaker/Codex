// IndexedDB storage for GBuddy
import type { PlantProfile, WateringEntry, ClimateEntry } from "@/lib/types";
import { createNewPlant } from "@/lib/newplant-data";
import { generateUUID } from "@/lib/uuid";

// Extended types for IndexedDB storage (includes plantId reference)
export type StoredWateringEntry = WateringEntry & { plantId: string };
export type StoredClimateEntry = ClimateEntry & { plantId: string };

// Chat message type for IndexedDB storage
export type ChatMessageEntry = {
  id: string;
  plantId: string;
  role: "user" | "assistant";
  content: string;
  source: "text" | "voice";
  createdAt: string;
  model?: string;
};

// Maximum number of messages to keep per plant (10 prompts + 10 responses = 20)
const MAX_CHAT_MESSAGES = 20;

const DB_NAME = "gbuddy-db";
const DB_VERSION = 2; // Incremented to add chat_messages store
let dbCache: IDBDatabase | null = null;

export async function openDB(): Promise<IDBDatabase> {
  if (dbCache) {
    try {
      // Test if db is still usable
      dbCache.transaction("settings", "readonly");
      return dbCache;
    } catch {
      dbCache = null;
    }
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbCache = request.result;
      resolve(request.result);
    };
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("plants")) {
        db.createObjectStore("plants", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("watering_logs")) {
        db.createObjectStore("watering_logs", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("climate_logs")) {
        db.createObjectStore("climate_logs", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("chat_messages")) {
        const chatStore = db.createObjectStore("chat_messages", { keyPath: "id" });
        chatStore.createIndex("plantId", "plantId", { unique: false });
        chatStore.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
  });
}

// Generic CRUD operations
async function addRecord<T>(storeName: string, record: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.add(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function putRecord<T>(storeName: string, record: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getRecord<T>(storeName: string, key: string): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllRecords<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function deleteRecord(storeName: string, key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

// Plants operations
export async function getAllPlants(): Promise<PlantProfile[]> {
  return getAllRecords<PlantProfile>("plants");
}

export async function getPlant(id: string): Promise<PlantProfile | undefined> {
  return getRecord<PlantProfile>("plants", id);
}

export async function savePlant(plant: PlantProfile): Promise<void> {
  return putRecord("plants", plant);
}

export async function deletePlant(id: string): Promise<void> {
  const db = await openDB();
  
  // Delete associated watering logs
  const wateringLogs = await getWateringLogs(id);
  for (const log of wateringLogs) {
    await deleteRecord("watering_logs", log.id);
  }
  
  // Delete associated climate logs
  const climateLogs = await getClimateLogs(id);
  for (const log of climateLogs) {
    await deleteRecord("climate_logs", log.id);
  }
  
  // Delete the plant itself
  return deleteRecord("plants", id);
}

// Watering logs operations
export async function getWateringLogs(plantId?: string): Promise<StoredWateringEntry[]> {
  const logs = await getAllRecords<StoredWateringEntry>("watering_logs");
  if (plantId) {
    return logs.filter((log) => log.plantId === plantId);
  }
  return logs;
}

export async function saveWateringLog(log: StoredWateringEntry): Promise<void> {
  return putRecord("watering_logs", log);
}

export async function deleteWateringLog(id: string): Promise<void> {
  return deleteRecord("watering_logs", id);
}

// Climate logs operations
export async function getClimateLogs(plantId?: string): Promise<StoredClimateEntry[]> {
  const logs = await getAllRecords<StoredClimateEntry>("climate_logs");
  if (plantId) {
    return logs.filter((log) => log.plantId === plantId);
  }
  return logs;
}

export async function saveClimateLog(log: StoredClimateEntry): Promise<void> {
  return putRecord("climate_logs", log);
}

export async function deleteClimateLog(id: string): Promise<void> {
  return deleteRecord("climate_logs", id);
}

// Settings operations
export async function getSetting(key: string): Promise<string | undefined> {
  const record = await getRecord<{ key: string; value: string }>("settings", key);
  return record?.value;
}

export async function setSetting(key: string, value: string): Promise<void> {
  return putRecord("settings", { key, value });
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const records = await getAllRecords<{ key: string; value: string }>("settings");
  const settings: Record<string, string> = {};
  for (const record of records) {
    settings[record.key] = record.value;
  }
  return settings;
}

// Test plant definitions for first-time users
export async function seedTestPlants(): Promise<void> {
  const existingPlants = await getAllPlants();
  if (existingPlants.length > 0) return; // Only seed if DB is empty

  const now = new Date();

  // Helper to create watering entries
  const createWateringEntry = (daysAgo: number, amountMl: number, ph: number, ec: number, runoffPh?: number, runoffEc?: number): WateringEntry => ({
    id: generateUUID(),
    timestamp: new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
    amountMl,
    ph,
    ec,
    ...(runoffPh !== undefined && { runoffPh }),
    ...(runoffEc !== undefined && { runoffEc })
  });

  // Helper to create climate entries
  const createClimateEntry = (daysAgo: number, tempC: number, humidity: number): ClimateEntry => ({
    id: generateUUID(),
    timestamp: new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
    tempC,
    humidity
  });

  // Plant 1: "Baby Green" - Seedling (Day 1, no history)
  const seedlingPlant = createNewPlant({
    id: `test-seedling-${Date.now()}`,
    strainName: "Baby Green",
    startedAt: now.toISOString(),
    stage: "Seedling",
    vegStartedAt: undefined,
    bloomStartedAt: undefined,
    growTempC: 24,
    growHumidity: 65,
    waterInputMl: 200,
    waterPh: 6.0,
    waterEc: 0.8,
    lastWateredAt: now.toISOString(),
    wateringIntervalDays: 2,
    lightSchedule: "18 / 6",
    lightsOn: "08:00",
    lightsOff: "02:00",
    wateringData: [],
    climateData: [
      createClimateEntry(0, 24, 65)
    ]
  });

  // Plant 2: "Green Machine" - Veg (25 days old, 15 days in veg, 5 watering logs)
  const startDateVeg = new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000);
  const vegStartDate = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
  const vegPlant = createNewPlant({
    id: `test-veg-${Date.now()}`,
    strainName: "Green Machine",
    startedAt: startDateVeg.toISOString(),
    stage: "Veg",
    vegStartedAt: vegStartDate.toISOString(),
    bloomStartedAt: undefined,
    growTempC: 26,
    growHumidity: 55,
    waterInputMl: 800,
    waterPh: 6.2,
    waterEc: 1.4,
    lastWateredAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    wateringIntervalDays: 3,
    lightSchedule: "18 / 6",
    lightsOn: "06:00",
    lightsOff: "00:00",
    wateringData: [
      createWateringEntry(19, 500, 5.8, 1.2, 6.0, 1.3),
      createWateringEntry(16, 600, 6.0, 1.3, 6.2, 1.4),
      createWateringEntry(13, 650, 6.1, 1.35, 6.3, 1.45),
      createWateringEntry(10, 700, 6.0, 1.4, 6.2, 1.5),
      createWateringEntry(7, 750, 6.2, 1.4, 6.4, 1.55),
      createWateringEntry(4, 780, 6.1, 1.45, 6.3, 1.5),
      createWateringEntry(1, 800, 6.2, 1.4, 6.4, 1.45)
    ],
    climateData: [
      createClimateEntry(25, 24, 65),
      createClimateEntry(20, 25, 60),
      createClimateEntry(15, 25, 58),
      createClimateEntry(10, 26, 56),
      createClimateEntry(5, 26, 55),
      createClimateEntry(0, 26, 55)
    ]
  });

  // Plant 3: "Purple Haze" - Bloom (60 days old, 10 days in bloom, full history)
  const startDateBloom = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const vegStartDateBloom = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000);
  const bloomStartDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
  const bloomPlant = createNewPlant({
    id: `test-bloom-${Date.now()}`,
    strainName: "Purple Haze",
    startedAt: startDateBloom.toISOString(),
    stage: "Bloom",
    vegStartedAt: vegStartDateBloom.toISOString(),
    bloomStartedAt: bloomStartDate.toISOString(),
    growTempC: 24,
    growHumidity: 45,
    waterInputMl: 1200,
    waterPh: 6.0,
    waterEc: 1.8,
    lastWateredAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    wateringIntervalDays: 2,
    lightSchedule: "12 / 12",
    lightsOn: "20:00",
    lightsOff: "08:00",
    wateringData: [
      createWateringEntry(50, 500, 5.8, 1.2, 6.0, 1.3),
      createWateringEntry(47, 600, 6.0, 1.3, 6.2, 1.4),
      createWateringEntry(44, 650, 6.1, 1.35, 6.3, 1.45),
      createWateringEntry(41, 700, 6.0, 1.4, 6.2, 1.5),
      createWateringEntry(38, 800, 6.2, 1.5, 6.4, 1.6),
      createWateringEntry(35, 850, 6.1, 1.5, 6.3, 1.65),
      createWateringEntry(32, 900, 6.0, 1.6, 6.2, 1.7),
      createWateringEntry(29, 950, 6.0, 1.65, 6.2, 1.75),
      createWateringEntry(26, 1000, 5.9, 1.7, 6.1, 1.8),
      createWateringEntry(23, 1050, 5.9, 1.75, 6.1, 1.85),
      createWateringEntry(20, 1100, 5.8, 1.8, 6.0, 1.9),
      createWateringEntry(17, 1100, 5.8, 1.8, 6.0, 1.9),
      createWateringEntry(14, 1150, 5.9, 1.8, 6.1, 1.85),
      createWateringEntry(11, 1150, 6.0, 1.75, 6.2, 1.8),
      createWateringEntry(8, 1200, 6.0, 1.7, 6.2, 1.75),
      createWateringEntry(5, 1200, 6.0, 1.75, 6.2, 1.8),
      createWateringEntry(2, 1200, 6.0, 1.8, 6.2, 1.85),
      createWateringEntry(1, 1200, 6.0, 1.8, 6.2, 1.85)
    ],
    climateData: [
      createClimateEntry(60, 23, 70),
      createClimateEntry(50, 24, 65),
      createClimateEntry(40, 25, 60),
      createClimateEntry(35, 25, 58),
      createClimateEntry(30, 25, 55),
      createClimateEntry(25, 24, 52),
      createClimateEntry(20, 24, 50),
      createClimateEntry(15, 24, 48),
      createClimateEntry(10, 24, 46),
      createClimateEntry(5, 24, 45),
      createClimateEntry(0, 24, 45)
    ]
  });

  // Save all plants to IndexedDB
  await savePlant(seedlingPlant);
  await savePlant(vegPlant);
  await savePlant(bloomPlant);

  // Set the first plant as active
  await setSetting("activePlantId", seedlingPlant.id);
}

// Chat messages operations
export async function getChatMessages(plantId: string, limit: number = MAX_CHAT_MESSAGES): Promise<ChatMessageEntry[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("chat_messages", "readonly");
    const store = transaction.objectStore("chat_messages");
    const index = store.index("plantId");
    const request = index.getAll(plantId);
    request.onsuccess = () => {
      let messages = request.result as ChatMessageEntry[];
      // Sort by createdAt descending and take the last N messages
      messages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      messages = messages.slice(0, limit);
      // Reverse to get chronological order
      messages.reverse();
      resolve(messages);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveChatMessage(message: ChatMessageEntry): Promise<void> {
  return putRecord("chat_messages", message);
  // After saving, truncate to MAX_CHAT_MESSAGES
}

export async function saveAndTruncateChatMessage(message: ChatMessageEntry, maxMessages: number = MAX_CHAT_MESSAGES): Promise<ChatMessageEntry[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("chat_messages", "readwrite");
    const store = transaction.objectStore("chat_messages");
    const index = store.index("plantId");

    // Save the new message
    store.put(message);

    // Get all messages for this plant, sorted by createdAt
    const request = index.getAll(message.plantId);
    request.onsuccess = () => {
      let messages = request.result as ChatMessageEntry[];
      messages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      // Delete oldest messages if we exceed maxMessages
      if (messages.length > maxMessages) {
        const toDelete = messages.slice(maxMessages);
        for (const msg of toDelete) {
          store.delete(msg.id);
        }
      }
      
      // Return the remaining messages in chronological order
      const remaining = messages.slice(0, maxMessages);
      remaining.reverse();
      resolve(remaining);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteChatMessagesForPlant(plantId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("chat_messages", "readwrite");
    const store = transaction.objectStore("chat_messages");
    const index = store.index("plantId");
    const request = index.getAllKeys(plantId);
    request.onsuccess = () => {
      const keys = request.result as string[];
      for (const key of keys) {
        store.delete(key);
      }
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getAllChatMessages(plantId?: string): Promise<ChatMessageEntry[]> {
  const messages = await getAllRecords<ChatMessageEntry>("chat_messages");
  if (plantId) {
    return messages.filter((msg) => msg.plantId === plantId);
  }
  return messages;
}

// Initialize with default settings
export async function initializeDB(): Promise<void> {
  const activePlantId = await getSetting("activePlantId");
  if (activePlantId === undefined) {
    await setSetting("activePlantId", "");
    await setSetting("locale", "en");
    // Seed test plants on first run (only if DB is empty)
    await seedTestPlants();
  }
}
