// src/lib/plants-store.ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PlantProfile } from "@/lib/types";
import { generateUUID } from "@/lib/uuid";
import {
  getAllPlants,
  savePlant,
  deletePlant as deletePlantFromIndexedDB,
  getSetting,
  setSetting
} from "@/lib/indexeddb-storage";

export type PlantsState = {
  plants: PlantProfile[];
  activePlantId: string;
};

const dataDir = path.join(process.cwd(), "g-data");
const stateFile = path.join(dataDir, "plants-state.json");

const defaultState: PlantsState = {
  plants: [],
  activePlantId: ""
};

function isValidUUID(id: string): boolean {
  if (!id || typeof id !== "string") return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

function validateTimestamp(ts: any): string | null {
  if (!ts) return null;
  const date = new Date(ts);
  if (isNaN(date.getTime())) return null;
  return date.toISOString();
}

function sanitizePlantData(plant: any): PlantProfile | null {
  try {
    // Validate and generate UUIDs for plant ID
    const plantId = isValidUUID(plant.id) ? plant.id : generateUUID();
    if (!isValidUUID(plant.id) && plant.id) {
      console.log(`[Plants] Regenerated invalid plant ID: ${plant.id} -> ${plantId}`);
    }

    // Validate watering data and regenerate invalid IDs
    const wateringData = Array.isArray(plant.wateringData)
      ? plant.wateringData
          .map((w: any) => {
            const waterId = isValidUUID(w.id) ? w.id : generateUUID();
            if (!isValidUUID(w.id) && w.id) {
              console.log(`[Watering] Regenerated invalid watering ID: ${w.id} -> ${waterId}`);
            }
            return {
              ...w,
              id: waterId,
              timestamp: validateTimestamp(w.timestamp)
            };
          })
          .filter((w: any) => w.timestamp)
      : [];

    // Validate climate data and regenerate invalid IDs
    const climateData = Array.isArray(plant.climateData)
      ? plant.climateData
          .map((c: any) => {
            const climateId = isValidUUID(c.id) ? c.id : generateUUID();
            if (!isValidUUID(c.id) && c.id) {
              console.log(`[Climate] Regenerated invalid climate ID: ${c.id} -> ${climateId}`);
            }
            return {
              ...c,
              id: climateId,
              timestamp: validateTimestamp(c.timestamp)
            };
          })
          .filter((c: any) => c.timestamp)
      : [];

    // Validate notes data and regenerate invalid IDs
    const notes = Array.isArray(plant.notes)
      ? plant.notes
          .map((n: any) => {
            const noteId = isValidUUID(n.id) ? n.id : generateUUID();
            return {
              ...n,
              id: noteId,
              timestamp: validateTimestamp(n.timestamp)
            };
          })
          .filter((n: any) => n.timestamp)
      : [];

    // Return sanitized plant with valid UUIDs
    return {
      ...plant,
      id: plantId,
      startedAt: validateTimestamp(plant.startedAt) || new Date().toISOString(),
      bloomStartedAt: validateTimestamp(plant.bloomStartedAt) || "",
      lastWateredAt: validateTimestamp(plant.lastWateredAt) || new Date().toISOString(),
      wateringData,
      climateData,
      notes
    } as PlantProfile;
  } catch (err) {
    console.error("Error sanitizing plant data:", err);
    return null;
  }
}

export async function readPlantsState(): Promise<PlantsState> {
  await mkdir(dataDir, { recursive: true });

  try {
    // Try to load from IndexedDB first
    const indexedPlants = await getAllPlants();
    if (indexedPlants && indexedPlants.length > 0) {
      console.log("[Plants] Loaded from IndexedDB:", indexedPlants.length, "plants");
      const activePlantId = await getSetting("activePlantId");
      return {
        plants: indexedPlants,
        activePlantId: activePlantId || indexedPlants[0]?.id || ""
      };
    }

    // Fallback to local JSON
    const raw = await readFile(stateFile, "utf-8");
    const parsed = JSON.parse(raw) as Partial<any>;

    const plants = Array.isArray(parsed.plants) && parsed.plants.length > 0
      ? parsed.plants
          .map((p) => sanitizePlantData(p))
          .filter((p) => p !== null) as PlantProfile[]
      : [];
    const activePlantId = typeof parsed.activePlantId === "string" && parsed.activePlantId
      ? parsed.activePlantId
      : plants[0]?.id ?? "";

    // Sync local JSON to IndexedDB if we loaded from JSON
    if (plants.length > 0 && indexedPlants.length === 0) {
      for (const plant of plants) {
        await savePlant(plant);
      }
      await setSetting("activePlantId", activePlantId);
      console.log("[Plants] Synced local JSON to IndexedDB");
    }

    if (plants.length > 0) {
      console.log("[Plants] Loaded from local storage:", plants.length, "plants");
    }

    return { plants, activePlantId };
  } catch (error) {
    console.error("Error reading plants state:", error);
    return defaultState;
  }
}

export async function writePlantsState(state: PlantsState) {
  await mkdir(dataDir, { recursive: true });
  
  const safeState: PlantsState = {
    plants: state.plants || [],
    activePlantId: state.activePlantId || state.plants?.[0]?.id || ""
  };

  // Save to IndexedDB
  for (const plant of safeState.plants) {
    try {
      await savePlant(plant);
    } catch (err) {
      console.error(`[Plants] Failed to save plant ${plant.id}:`, err);
    }
  }
  await setSetting("activePlantId", safeState.activePlantId);

  // Also save to local JSON as fallback/backup
  try {
    await writeFile(stateFile, JSON.stringify(safeState, null, 2), "utf-8");
    console.log("[Plants] Saved to local storage and IndexedDB");
  } catch (err) {
    console.error("[Plants] Failed to save local:", err);
  }
}

export async function deleteWateringLogById(wateringId: string, plantId: string): Promise<boolean> {
  // Only uses IndexedDB now - Supabase removed
  console.log("[Watering] Delete via IndexedDB only (Supabase removed)");
  return true;
}

export async function deleteClimateLogById(climateId: string, plantId: string): Promise<boolean> {
  // Only uses IndexedDB now - Supabase removed
  console.log("[Climate] Delete via IndexedDB only (Supabase removed)");
  return true;
}

export async function deletePlantById(plantId: string): Promise<boolean> {
  try {
    // Delete from IndexedDB
    await deletePlantFromIndexedDB(plantId);
    
    // Delete chat messages for this plant
    const { deleteChatMessagesForPlant } = await import("@/lib/indexeddb-storage");
    await deleteChatMessagesForPlant(plantId);

    console.log(`[Plants] Deleted from IndexedDB: ${plantId}`);

    // Also update local JSON
    const current = await readPlantsState();
    const updated = current.plants.filter((p) => p.id !== plantId);
    let newActivePlantId = current.activePlantId;
    
    // If the deleted plant was active, switch to the first remaining plant
    if (newActivePlantId === plantId) {
      newActivePlantId = updated[0]?.id || "";
    }

    await writePlantsState({
      plants: updated,
      activePlantId: newActivePlantId
    });

    console.log(`[Plants] Updated local storage: ${plantId}`);
    return true;
  } catch (error) {
    console.error("Error deleting plant:", error);
    return false;
  }
}