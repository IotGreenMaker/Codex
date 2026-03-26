import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { plantProfiles } from "@/lib/mock-data";
import type { PlantProfile } from "@/lib/types";

export type PlantsState = {
  plants: PlantProfile[];
  activePlantId: string;
};

const dataDir = path.join(process.cwd(), "g-data");
const stateFile = path.join(dataDir, "plants-state.json");

const defaultState: PlantsState = {
  plants: plantProfiles,
  activePlantId: plantProfiles[0]?.id ?? ""
};

export async function readPlantsState(): Promise<PlantsState> {
  await mkdir(dataDir, { recursive: true });

  try {
    const raw = await readFile(stateFile, "utf-8");
    const parsed = JSON.parse(raw) as Partial<PlantsState>;
    const plants =
      Array.isArray(parsed.plants) && parsed.plants.length
        ? parsed.plants.map((entry) => normalizePlant(entry))
        : defaultState.plants;
    const activePlantId = typeof parsed.activePlantId === "string" && parsed.activePlantId ? parsed.activePlantId : plants[0]?.id ?? "";
    return {
      plants,
      activePlantId
    };
  } catch {
    await writePlantsState(defaultState);
    return defaultState;
  }
}

export async function writePlantsState(state: PlantsState) {
  await mkdir(dataDir, { recursive: true });
  const safeState: PlantsState = {
    plants: state.plants.map((entry) => normalizePlant(entry)),
    activePlantId: state.activePlantId || state.plants[0]?.id || ""
  };
  await writeFile(stateFile, JSON.stringify(safeState, null, 2), "utf-8");
}

function normalizePlant(plant: PlantProfile): PlantProfile {
  const fallback = plantProfiles.find((entry) => entry.id === plant.id) ?? plantProfiles[0];
  if (!fallback) {
    return plant;
  }

  return {
    ...fallback,
    ...plant,
    bloomStartedAt: plant.bloomStartedAt ?? fallback.bloomStartedAt ?? "",
    lightType: plant.lightType ?? fallback.lightType ?? "panel_100w",
    lightDimmerPercent: plant.lightDimmerPercent ?? fallback.lightDimmerPercent ?? 75,
    lightLampName: plant.lightLampName ?? fallback.lightLampName ?? "",
    lightLampWatts: plant.lightLampWatts ?? fallback.lightLampWatts ?? undefined,
    stageDays: {
      ...fallback.stageDays,
      ...(plant.stageDays ?? {})
    },
    wateringData: Array.isArray(plant.wateringData) && plant.wateringData.length ? plant.wateringData : fallback.wateringData,
    climateData: Array.isArray(plant.climateData) && plant.climateData.length ? plant.climateData : fallback.climateData,
    feedRecipe: {
      ...fallback.feedRecipe,
      ...(plant.feedRecipe ?? {}),
      additives:
        Array.isArray(plant.feedRecipe?.additives) && plant.feedRecipe.additives.length
          ? plant.feedRecipe.additives
          : fallback.feedRecipe.additives
    }
  };
}
