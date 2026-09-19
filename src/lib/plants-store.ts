// src/lib/plants-store.ts
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PlantProfile, SpaceConfig } from "@/lib/types";
import { generateUUID } from "@/lib/uuid";

export type PlantsState = {
  plants: PlantProfile[];
  activePlantId: string;
  spaces: SpaceConfig[];
  activeSpaceId: string;
  savedAt: string;
};

const dataDir = path.join(process.cwd(), "g-data");
const stateFile = path.join(dataDir, "plants-state.json");
let stateWriteQueue = Promise.resolve();

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
    const plantId = isValidUUID(plant.id) ? plant.id : generateUUID();
    if (!isValidUUID(plant.id) && plant.id) {
      console.log(`[Plants] Regenerated invalid plant ID: ${plant.id} -> ${plantId}`);
    }

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

function sanitizeSpaceData(space: any): SpaceConfig | null {
  if (!space || typeof space !== "object") return null;
  const weatherData = Array.isArray(space.weatherData)
    ? space.weatherData.filter((entry: any) => validateTimestamp(entry?.timestamp)).map((entry: any) => ({
        ...entry,
        timestamp: validateTimestamp(entry.timestamp) || new Date().toISOString()
      }))
    : [];
  const lightHistory = Array.isArray(space.lightHistory)
    ? space.lightHistory.filter((entry: any) => validateTimestamp(entry?.timestamp)).map((entry: any) => ({
        ...entry,
        timestamp: validateTimestamp(entry.timestamp) || new Date().toISOString()
      }))
    : [];

  return {
    ...space,
    id: typeof space.id === "string" && space.id ? space.id : generateUUID(),
    name: typeof space.name === "string" && space.name ? space.name : "Space",
    createdAt: validateTimestamp(space.createdAt) || new Date().toISOString(),
    plants: Array.isArray(space.plants)
      ? space.plants.filter((reference: any) => typeof reference?.id === "string")
      : [],
    weatherData,
    lightData: Array.isArray(space.lightData) ? space.lightData : [],
    activeLightId: typeof space.activeLightId === "string" ? space.activeLightId : undefined,
    lightHistory,
    electricityPricePerKwh: typeof space.electricityPricePerKwh === "number"
      ? space.electricityPricePerKwh
      : 0
  } as SpaceConfig;
}

export async function readPlantsState(): Promise<PlantsState> {
  await mkdir(dataDir, { recursive: true });

  try {
    const raw = await readFile(stateFile, "utf-8");
    const parsed = JSON.parse(raw) as Partial<PlantsState>;

    const plants = Array.isArray(parsed.plants) && parsed.plants.length > 0
      ? parsed.plants
          .map((p) => sanitizePlantData(p))
          .filter((p) => p !== null) as PlantProfile[]
      : [];

    const spaces = Array.isArray(parsed.spaces)
      ? parsed.spaces.map((space) => sanitizeSpaceData(space)).filter((space) => space !== null) as SpaceConfig[]
      : [];
    const activePlantId = typeof parsed.activePlantId === "string" && parsed.activePlantId
      ? parsed.activePlantId
      : plants[0]?.id ?? "";
    const activeSpaceId = typeof parsed.activeSpaceId === "string" && parsed.activeSpaceId
      ? parsed.activeSpaceId
      : spaces[0]?.id ?? "";

    if (plants.length > 0) {
      console.log("[Plants] Loaded from local storage:", plants.length, "plants");
    }

    return {
      plants,
      activePlantId,
      spaces,
      activeSpaceId,
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : ""
    };
  } catch (error) {
    if ((error as any)?.code !== "ENOENT") {
      console.error("Error reading plants state:", error);
    }
    return { plants: [], activePlantId: "", spaces: [], activeSpaceId: "", savedAt: "" };
  }
}

async function writePlantsStateFile(state: Partial<PlantsState>): Promise<boolean> {
  await mkdir(dataDir, { recursive: true });
  
  const safeState: PlantsState = {
    plants: state.plants || [],
    activePlantId: state.activePlantId || state.plants?.[0]?.id || "",
    spaces: state.spaces || [],
    activeSpaceId: state.activeSpaceId || state.spaces?.[0]?.id || "",
    savedAt: new Date().toISOString()
  };

  try {
    const temporaryStateFile = path.join(
      dataDir,
      `plants-state.json.${process.pid}.${Date.now()}.${generateUUID()}.tmp`
    );
    await writeFile(temporaryStateFile, JSON.stringify(safeState, null, 2), "utf-8");
    await rename(temporaryStateFile, stateFile);
    console.log("[Plants] Saved to local storage JSON");
    return true;
  } catch (err) {
    console.error("[Plants] Failed to save local:", err);
    return false;
  }
}

function serializeStateWrite<T>(operation: () => Promise<T>): Promise<T> {
  const result = stateWriteQueue.then(operation);
  stateWriteQueue = result.then(() => undefined, () => undefined);
  return result;
}

export function writePlantsState(state: Partial<PlantsState>): Promise<boolean> {
  return serializeStateWrite(() => writePlantsStateFile(state));
}

export function updatePlantsState(
  update: (state: PlantsState) => Partial<PlantsState> | Promise<Partial<PlantsState>>
): Promise<boolean> {
  return serializeStateWrite(async () => {
    const current = await readPlantsState();
    return writePlantsStateFile(await update(current));
  });
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
    return await updatePlantsState((state) => {
      const plant = state.plants.find((p) => p.id === plantId) ?? findPlantContainingWateringLog(state.plants, wateringId);
      if (!plant) return state;
      plant.wateringData = plant.wateringData.filter((w) => w.id !== wateringId);
      return state;
    }).then((ok) => ({ ok }));
  } catch (err) {
    console.error("Error deleting watering log:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Internal error" };
  }
}

export async function deleteClimateLogById(climateId: string, plantId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    return await updatePlantsState((state) => {
      const plant = state.plants.find((p) => p.id === plantId) ?? findPlantContainingClimateLog(state.plants, climateId);
      if (!plant) return state;
      plant.climateData = plant.climateData.filter((c) => c.id !== climateId);
      return state;
    }).then((ok) => ({ ok }));
  } catch (err) {
    console.error("Error deleting climate log:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Internal error" };
  }
}

export async function deletePlantById(plantId: string): Promise<boolean> {
  try {
    const success = await updatePlantsState((current) => {
      const updated = current.plants.filter((p) => p.id !== plantId);
      return {
        ...current,
        plants: updated,
        activePlantId: current.activePlantId === plantId ? updated[0]?.id || "" : current.activePlantId
      };
    });
    if (success) console.log(`[Plants] Updated local storage: ${plantId}`);
    return success;
  } catch (error) {
    console.error("Error deleting plant:", error);
    return false;
  }
}