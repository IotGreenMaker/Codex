// src/lib/plants-store.ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PlantProfile } from "@/lib/types";
import { createClient } from "@supabase/supabase-js";
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

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

function getSupabaseClient() {
  if (!supabaseUrl || !supabaseKey) {
    console.warn("Supabase not configured - using local storage only");
    return null;
  }
  return createClient(supabaseUrl, supabaseKey);
}

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

    // Return sanitized plant with valid UUIDs
    return {
      ...plant,
      id: plantId,
      startedAt: validateTimestamp(plant.startedAt) || new Date().toISOString(),
      bloomStartedAt: validateTimestamp(plant.bloomStartedAt) || "",
      lastWateredAt: validateTimestamp(plant.lastWateredAt) || new Date().toISOString(),
      wateringData,
      climateData
    } as PlantProfile;
  } catch (err) {
    console.error("Error sanitizing plant data:", err);
    return null;
  }
}

export async function readPlantsState(): Promise<PlantsState> {
  await mkdir(dataDir, { recursive: true });

  try {
    // Try to fetch from Supabase first
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("plants")
          .select("*")
          .order("created_at", { ascending: true });

        if (!error && data && data.length > 0) {
          console.log("[Plants] Loaded from Supabase:", data.length, "plants");
          const validPlants = data
            .map((p) => {
              // If plant has nested data object, extract it
              const plantData = p.data && typeof p.data === "object" ? p.data : p;
              return sanitizePlantData(plantData);
            })
            .filter((p) => p !== null) as PlantProfile[];
          
          if (validPlants.length > 0) {
            return {
              plants: validPlants,
              activePlantId: validPlants[0]?.id || ""
            };
          }
        }
      } catch (err) {
        console.warn("[Plants] Supabase read failed, falling back to local:", err);
      }
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

    if (plants.length > 0) {
      console.log("[Plants] Loaded from local storage:", plants.length, "plants with valid timestamps");
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

  // Always save to local JSON as fallback
  try {
    await writeFile(stateFile, JSON.stringify(safeState, null, 2), "utf-8");
    console.log("[Plants] Saved to local storage");
  } catch (err) {
    console.error("[Plants] Failed to save local:", err);
  }

  // Try to sync to Supabase
  const supabase = getSupabaseClient();
  if (supabase && safeState.plants.length > 0) {
    try {
      for (const plant of safeState.plants) {
        // Upsert plants (using id as primary key)
        const { error: plantError } = await supabase
          .from("plants")
          .upsert(
            {
              id: plant.id,
              user_id: "default-user",
              strain_name: plant.strainName,
              started_at: plant.startedAt,
              stage: plant.stage,
              data: plant // Store full plant data as JSONB
            },
            { onConflict: "id" }
          );

        if (plantError) {
          console.error(`[Plants] Failed to sync plant ${plant.id}:`, plantError);
        } else {
          console.log(`[Plants] Synced to Supabase: ${plant.id}`);
        }

        // Sync watering logs
        if (plant.wateringData && plant.wateringData.length > 0) {
          let wateringSynced = 0;
          for (const watering of plant.wateringData) {
            const { error: wateringError } = await supabase
              .from("watering_log")
              .upsert(
                {
                  id: watering.id,
                  plant_id: plant.id,
                  amount_ml: watering.amountMl,
                  ph: watering.ph ?? null,
                  ec: watering.ec ?? null,
                  runoff_ph: watering.runoffPh ?? null,
                  runoff_ec: watering.runoffEc ?? null,
                  created_at: watering.timestamp
                },
                { onConflict: "id" }
              );
            
            if (wateringError) {
              console.error(`[Watering] Failed to sync ${watering.id}:`, wateringError);
            } else {
              wateringSynced++;
            }
          }
          console.log(`[Watering] Synced ${wateringSynced}/${plant.wateringData.length} records for plant ${plant.id}`);
        }

        // Sync climate logs
        if (plant.climateData && plant.climateData.length > 0) {
          let climateSynced = 0;
          for (const climate of plant.climateData) {
            const { error: climateError } = await supabase
              .from("climate_log")
              .upsert(
                {
                  id: climate.id,
                  plant_id: plant.id,
                  temp_c: climate.tempC,
                  humidity: climate.humidity,
                  created_at: climate.timestamp
                },
                { onConflict: "id" }
              );
            
            if (climateError) {
              console.error(`[Climate] Failed to sync ${climate.id}:`, climateError);
            } else {
              climateSynced++;
            }
          }
          console.log(`[Climate] Synced ${climateSynced}/${plant.climateData.length} records for plant ${plant.id}`);
        }
      }
      console.log("[Plants] All data synced to Supabase");
    } catch (err) {
      console.error("[Plants] Supabase sync failed:", err);
    }
  }
}