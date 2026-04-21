// src/lib/plants-store.ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PlantProfile } from "@/lib/types";
import { generateUUID } from "@/lib/uuid";

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

    if (plants.length > 0) {
      console.log("[Plants] Loaded from local storage:", plants.length, "plants");
    }

    return { plants, activePlantId };
  } catch (error) {
    // Missing file is normal on first run.
    if ((error as any)?.code !== "ENOENT") {
      console.error("Error reading plants state:", error);
    }
    return defaultState;
  }
}

export async function writePlantsState(state: PlantsState) {
  await mkdir(dataDir, { recursive: true });
  
  const safeState: PlantsState = {
    plants: state.plants || [],
    activePlantId: state.activePlantId || state.plants?.[0]?.id || ""
  };

  // Save to local JSON
  try {
    await writeFile(stateFile, JSON.stringify(safeState, null, 2), "utf-8");
    console.log("[Plants] Saved to local storage JSON");
  } catch (err) {
    console.error("[Plants] Failed to save local:", err);
  }
}

function findPlantContainingWateringLog(plants: PlantProfile[], wateringId: string): PlantProfile | undefined {
  return plants.find((plant) => plant.wateringData?.some((row) => row.id === wateringId));
}

function findPlantContainingClimateLog(plants: PlantProfile[], climateId: string): PlantProfile | undefined {
  return plants.find((plant) => plant.climateData?.some((row) => row.id === climateId));
}

export async function deleteWateringLogById(
  wateringId: string,
  plantId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const state = await readPlantsState();
    const plant =
      state.plants.find((p) => p.id === plantId) ?? findPlantContainingWateringLog(state.plants, wateringId);

    // If the plant (or entry) is missing on the server, treat as already deleted
    if (!plant) return { ok: true };

    const initialCount = plant.wateringData.length;
    plant.wateringData = plant.wateringData.filter(w => w.id !== wateringId);
    
    if (plant.wateringData.length === initialCount) {
      // Treat as already deleted to avoid UI regressions when server is out-of-sync
      return { ok: true };
    }

    await writePlantsState(state);
    return { ok: true };
  } catch (err) {
    console.error("Error deleting watering log:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Internal error" };
  }
}

export async function deleteClimateLogById(climateId: string, plantId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const state = await readPlantsState();
    const plant =
      state.plants.find((p) => p.id === plantId) ?? findPlantContainingClimateLog(state.plants, climateId);

    // If the plant (or entry) is missing on the server, treat as already deleted
    if (!plant) return { ok: true };

    const initialCount = plant.climateData.length;
    plant.climateData = plant.climateData.filter((c) => c.id !== climateId);
    if (plant.climateData.length === initialCount) {
      // Treat as already deleted to avoid UI regressions when server is out-of-sync
      return { ok: true };
    }
    await writePlantsState(state);
    return { ok: true };
  } catch (err) {
    console.error("Error deleting climate log:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Internal error" };
  }
}

export async function deletePlantById(plantId: string): Promise<boolean> {
  try {
    const current = await readPlantsState();
    
    // Note: In a real server environment, you'd also delete associated 
    // chat files here if they were stored on disk.
    
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
