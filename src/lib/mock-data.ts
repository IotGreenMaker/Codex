import { calculateNutrientPlan, calculateVpd } from "@/lib/grow-math";
import type { GrowLogEntry, PlantProfile, VoiceInteraction } from "@/lib/types";
import { generateUUID } from "@/lib/uuid";

const defaultFeedRecipe = {
  title: "10 L veg mix",
  baseAMl: 24,
  baseBMl: 21,
  calMagMl: 6,
  targetEc: 1.45,
  targetPhLow: 5.8,
  targetPhHigh: 6.1,
  additives: [{ id: generateUUID(), label: "Silica", amountMl: 5 }]
};

function createFeedRecipe(overrides?: Partial<typeof defaultFeedRecipe>) {
  return {
    ...defaultFeedRecipe,
    ...overrides,
    additives: overrides?.additives ? overrides.additives : defaultFeedRecipe.additives.map((entry) => ({ ...entry }))
  };
}

// Template for creating new plants (NOT auto-created)
export function createNewPlant(overrides?: Partial<PlantProfile>): PlantProfile {
  return {
    id: generateUUID(),
    strainName: "New Plant",
    startedAt: new Date().toISOString(),
    stage: "Seedling",
    bloomStartedAt: "",
    lightSchedule: "18 / 6",
    lightsOn: "06:00",
    lightsOff: "00:00",
    lightType: "panel_100w",
    lightDimmerPercent: 75,
    lightLampName: "Growth Light",
    lightLampWatts: 100,
    containerVolumeL: 15,
    mediaVolumeL: 13,
    mediaType: "Soil",
    outsideTempC: 20,
    outsideHumidity: 50,
    growTempC: 24,
    growHumidity: 60,
    waterInputMl: 500,
    waterPh: 6.0,
    waterEc: 1.0,
    lastWateredAt: new Date().toISOString(),
    wateringIntervalDays: 2,
    stageDays: { seedling: 1, veg: 0, bloom: 0 },
    seedlingStartedAt: new Date().toISOString(),
    wateringData: [],
    climateData: [],
    feedRecipe: createFeedRecipe(),
    ...overrides
  };
}

// DO NOT auto-create plants - loading from Supabase/local storage only
export const plantProfiles: PlantProfile[] = [];

export const dailyLogs: GrowLogEntry[] = [];

export const voiceInteractions: VoiceInteraction[] = [];

export const vegMix = calculateNutrientPlan("Veg", 10);
