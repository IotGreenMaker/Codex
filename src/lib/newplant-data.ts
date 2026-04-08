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

export { defaultFeedRecipe };

export function createFeedRecipe(overrides?: Partial<typeof defaultFeedRecipe>) {
  return {
    ...defaultFeedRecipe,
    ...overrides,
    additives: overrides?.additives ? overrides.additives : defaultFeedRecipe.additives.map((entry) => ({ ...entry }))
  };
}

// Template for creating new plants
export function createNewPlant(overrides?: Partial<PlantProfile>): PlantProfile {
  const now = new Date();
  const today = now.toISOString();
  
  return {
    id: generateUUID(),
    strainName: "New Plant",
    startedAt: today,
    stage: "Seedling",
    vegStartedAt: undefined,
    bloomStartedAt: undefined,
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
    growTempC: 25,
    growHumidity: 45,
    waterInputMl: 500,
    waterPh: 6.0,
    waterEc: 1.0,
    lastWateredAt: today,
    wateringIntervalDays: 2,
    stageDays: { seedling: 1, veg: 0, bloom: 0 },
    wateringData: [],
    climateData: [],
    feedRecipe: createFeedRecipe(),
    ...overrides
  };
}

// Sample daily log entry
export const dailyLogs: GrowLogEntry[] = [
  {
    id: generateUUID(),
    timestamp: new Date().toISOString(),
    outsideTempC: 22,
    outsideHumidity: 55,
    growTempC: 25,
    growHumidity: 60,
    vpdKpa: calculateVpd(25, 60),
    waterInputMl: 500,
    waterPh: 6.0,
    waterEc: 1.2,
    note: "Sample log entry"
  }
];

// Sample voice interactions (empty for now)
export const voiceInteractions: VoiceInteraction[] = [];

// Sample nutrient mix
export const vegMix = calculateNutrientPlan("Veg", 10);