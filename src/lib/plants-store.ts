import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PlantProfile } from "@/lib/types";

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

export async function readPlantsState(): Promise<PlantsState> {
  await mkdir(dataDir, { recursive: true });

  try {
    const raw = await readFile(stateFile, "utf-8");
    const parsed = JSON.parse(raw) as Partial<any>;
    
    // plants-state.json has multiple real plants
    const plants = Array.isArray(parsed.plants) && parsed.plants.length > 0
      ? parsed.plants
      : [];
    const activePlantId = typeof parsed.activePlantId === "string" && parsed.activePlantId
      ? parsed.activePlantId
      : plants[0]?.id ?? "";
    
    return { plants, activePlantId };
  } catch (error) {
    console.error("Error reading plants-state.json:", error);
    return defaultState;
  }
}

export async function writePlantsState(state: PlantsState) {
  await mkdir(dataDir, { recursive: true });
  const safeState: PlantsState = {
    plants: state.plants || [],
    activePlantId: state.activePlantId || state.plants?.[0]?.id || ""
  };
  await writeFile(stateFile, JSON.stringify(safeState, null, 2), "utf-8");
}