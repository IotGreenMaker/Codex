import { calculateNutrientPlan, calculateVpd } from "@/lib/grow-math";
import type { GrowLogEntry, PlantProfile, VoiceInteraction } from "@/lib/types";

const defaultWateringData = [
  { id: "w-1", timestamp: "2026-03-16T08:30:00.000Z", amountMl: 800, ph: 5.9, ec: 1.2, runoffPh: 6.1, runoffEc: 1.4 },
  { id: "w-2", timestamp: "2026-03-18T08:30:00.000Z", amountMl: 900, ph: 5.8, ec: 1.35, runoffPh: 6.1, runoffEc: 1.45 },
  { id: "w-3", timestamp: "2026-03-20T08:30:00.000Z", amountMl: 950, ph: 5.9, ec: 1.4, runoffPh: 6.2, runoffEc: 1.48 },
  { id: "w-4", timestamp: "2026-03-22T08:30:00.000Z", amountMl: 1000, ph: 5.9, ec: 1.45, runoffPh: 6.1, runoffEc: 1.46 }
];

const defaultClimateData = [
  { id: "c-1", timestamp: "2026-03-16T08:30:00.000Z", tempC: 24.4, humidity: 64 },
  { id: "c-2", timestamp: "2026-03-17T08:30:00.000Z", tempC: 24.9, humidity: 63 },
  { id: "c-3", timestamp: "2026-03-18T08:30:00.000Z", tempC: 25.4, humidity: 61 },
  { id: "c-4", timestamp: "2026-03-19T08:30:00.000Z", tempC: 24.7, humidity: 60 },
  { id: "c-5", timestamp: "2026-03-20T08:30:00.000Z", tempC: 25.1, humidity: 59 },
  { id: "c-6", timestamp: "2026-03-21T08:30:00.000Z", tempC: 25.6, humidity: 58 },
  { id: "c-7", timestamp: "2026-03-22T08:30:00.000Z", tempC: 25.3, humidity: 60 }
];

const defaultFeedRecipe = {
  title: "10 L veg mix",
  baseAMl: 24,
  baseBMl: 21,
  calMagMl: 6,
  targetEc: 1.45,
  targetPhLow: 5.8,
  targetPhHigh: 6.1,
  additives: [{ id: "add-1", label: "Silica", amountMl: 5 }]
};

function createFeedRecipe(overrides?: Partial<typeof defaultFeedRecipe>) {
  return {
    ...defaultFeedRecipe,
    ...overrides,
    additives: overrides?.additives ? overrides.additives : defaultFeedRecipe.additives.map((entry) => ({ ...entry }))
  };
}

export const activePlant: PlantProfile = {
  id: "plant-1",
  strainName: "Lemon Haze Auto",
  startedAt: "2026-01-28T09:00:00.000Z",
  stage: "Veg",
  bloomStartedAt: "",
  lightSchedule: "18 / 6",
  lightsOn: "06:00",
  lightsOff: "00:00",
  lightType: "panel_100w",
  lightDimmerPercent: 75,
  lightLampName: "Phlizon PL1000",
  lightLampWatts: 100,
  containerVolumeL: 15,
  mediaVolumeL: 13,
  mediaType: "Soil",
  outsideTempC: 16.7,
  outsideHumidity: 60,
  growTempC: 25.3,
  growHumidity: 60,
  waterInputMl: 1000,
  waterPh: 5.9,
  waterEc: 1.45,
  lastWateredAt: "2026-03-22T08:30:00.000Z",
  wateringIntervalDays: 2,
  stageDays: { seedling: 14, veg: 41, bloom: 0 },
  wateringData: defaultWateringData,
  climateData: defaultClimateData,
  feedRecipe: createFeedRecipe()
};

export const plantProfiles: PlantProfile[] = [
  activePlant,
  {
    id: "plant-2",
    strainName: "Blueberry Muffin",
    startedAt: "2026-02-14T09:00:00.000Z",
    stage: "Seedling",
    bloomStartedAt: "",
    lightSchedule: "18 / 6",
    lightsOn: "07:00",
    lightsOff: "01:00",
    lightType: "blurple_40w",
    lightDimmerPercent: undefined,
    lightLampName: "Veg blurple",
    lightLampWatts: 40,
    containerVolumeL: 8,
    mediaVolumeL: 7,
    mediaType: "Coco",
    outsideTempC: 15.1,
    outsideHumidity: 66,
    growTempC: 24.1,
    growHumidity: 68,
    waterInputMl: 350,
    waterPh: 6.0,
    waterEc: 0.9,
    lastWateredAt: "2026-03-22T09:10:00.000Z",
    wateringIntervalDays: 1,
    stageDays: { seedling: 38, veg: 0, bloom: 0 },
    wateringData: [
      { id: "w-b-1", timestamp: "2026-03-20T09:10:00.000Z", amountMl: 300, ph: 6.0, ec: 0.8 },
      { id: "w-b-2", timestamp: "2026-03-21T09:10:00.000Z", amountMl: 330, ph: 6.0, ec: 0.9 },
      { id: "w-b-3", timestamp: "2026-03-22T09:10:00.000Z", amountMl: 350, ph: 6.0, ec: 0.9 }
    ],
    climateData: [
      { id: "c-b-1", timestamp: "2026-03-20T09:10:00.000Z", tempC: 23.8, humidity: 70 },
      { id: "c-b-2", timestamp: "2026-03-21T09:10:00.000Z", tempC: 24.1, humidity: 68 },
      { id: "c-b-3", timestamp: "2026-03-22T09:10:00.000Z", tempC: 24.1, humidity: 68 }
    ],
    feedRecipe: createFeedRecipe({
      baseAMl: 12,
      baseBMl: 10,
      calMagMl: 3,
      targetEc: 0.9
    })
  },
  {
    id: "plant-3",
    strainName: "Critical Orange Punch",
    startedAt: "2025-12-20T09:00:00.000Z",
    stage: "Bloom",
    bloomStartedAt: "2026-02-10T09:00:00.000Z",
    lightSchedule: "12 / 12",
    lightsOn: "08:00",
    lightsOff: "20:00",
    lightType: "panel_100w",
    lightDimmerPercent: 80,
    lightLampName: "Main panel",
    lightLampWatts: 100,
    containerVolumeL: 20,
    mediaVolumeL: 17,
    mediaType: "Soil",
    outsideTempC: 14.2,
    outsideHumidity: 58,
    growTempC: 24.8,
    growHumidity: 52,
    waterInputMl: 1200,
    waterPh: 6.1,
    waterEc: 1.9,
    lastWateredAt: "2026-03-21T12:00:00.000Z",
    wateringIntervalDays: 3,
    stageDays: { seedling: 14, veg: 52, bloom: 30 },
    wateringData: [
      { id: "w-c-1", timestamp: "2026-03-15T12:00:00.000Z", amountMl: 1000, ph: 6.0, ec: 1.8, runoffPh: 6.2, runoffEc: 2.0 },
      { id: "w-c-2", timestamp: "2026-03-18T12:00:00.000Z", amountMl: 1100, ph: 6.1, ec: 1.85, runoffPh: 6.2, runoffEc: 2.05 },
      { id: "w-c-3", timestamp: "2026-03-21T12:00:00.000Z", amountMl: 1200, ph: 6.1, ec: 1.9, runoffPh: 6.3, runoffEc: 2.1 }
    ],
    climateData: [
      { id: "c-c-1", timestamp: "2026-03-15T12:00:00.000Z", tempC: 24.5, humidity: 54 },
      { id: "c-c-2", timestamp: "2026-03-18T12:00:00.000Z", tempC: 24.8, humidity: 52 },
      { id: "c-c-3", timestamp: "2026-03-21T12:00:00.000Z", tempC: 25.0, humidity: 51 }
    ],
    feedRecipe: createFeedRecipe({
      baseAMl: 16,
      baseBMl: 28,
      calMagMl: 4,
      targetEc: 1.85,
      targetPhLow: 5.9,
      targetPhHigh: 6.2
    })
  }
];

const dailyLogsSeed = [
  { day: "Mar 16", growTempC: 24.4, growHumidity: 64, outsideTempC: 15.3, outsideHumidity: 72, waterInputMl: 800, waterPh: 5.9, waterEc: 1.2, runoffPh: 6.1, runoffEc: 1.4 },
  { day: "Mar 17", growTempC: 24.9, growHumidity: 63, outsideTempC: 16.2, outsideHumidity: 74, waterInputMl: 860, waterPh: 5.8, waterEc: 1.3, runoffPh: 6.0, runoffEc: 1.4 },
  { day: "Mar 18", growTempC: 25.4, growHumidity: 61, outsideTempC: 17.1, outsideHumidity: 71, waterInputMl: 900, waterPh: 5.8, waterEc: 1.35, runoffPh: 6.1, runoffEc: 1.45 },
  { day: "Mar 19", growTempC: 24.7, growHumidity: 60, outsideTempC: 14.8, outsideHumidity: 67, waterInputMl: 900, waterPh: 5.9, waterEc: 1.4, runoffPh: 6.2, runoffEc: 1.42 },
  { day: "Mar 20", growTempC: 25.1, growHumidity: 59, outsideTempC: 15.6, outsideHumidity: 64, waterInputMl: 950, waterPh: 5.9, waterEc: 1.4, runoffPh: 6.2, runoffEc: 1.48 },
  { day: "Mar 21", growTempC: 25.6, growHumidity: 58, outsideTempC: 16.1, outsideHumidity: 61, waterInputMl: 980, waterPh: 6.0, waterEc: 1.45, runoffPh: 6.2, runoffEc: 1.5 },
  { day: "Mar 22", growTempC: 25.3, growHumidity: 60, outsideTempC: 16.7, outsideHumidity: 60, waterInputMl: 1000, waterPh: 5.9, waterEc: 1.45, runoffPh: 6.1, runoffEc: 1.46 }
];

export const dailyLogs: GrowLogEntry[] = dailyLogsSeed.map((log, index) => ({
  id: `log-${index + 1}`,
  timestamp: `2026-03-${String(index + 16).padStart(2, "0")}T08:30:00.000Z`,
  outsideTempC: log.outsideTempC,
  outsideHumidity: log.outsideHumidity,
  growTempC: log.growTempC,
  growHumidity: log.growHumidity,
  vpdKpa: calculateVpd(log.growTempC, log.growHumidity),
  waterInputMl: log.waterInputMl,
  waterPh: log.waterPh,
  waterEc: log.waterEc,
  runoffPh: log.runoffPh,
  runoffEc: log.runoffEc,
  note: `${log.day}: canopy stable, leaves praying, no deficiency flags.`
}));

export const voiceInteractions: VoiceInteraction[] = [
  {
    id: "voice-1",
    createdAt: "2026-03-22T08:32:00.000Z",
    transcript: "What should my VPD be during veg with canopy temperature around twenty five degrees?",
    response: "For veg, a comfortable target is roughly 0.8 to 1.2 kPa. At 25 C, you usually reach that by staying around the low 60s in relative humidity.",
    citations: [
      {
        label: "VPD target note",
        href: "https://example.com/vpd-reference"
      }
    ]
  },
  {
    id: "voice-2",
    createdAt: "2026-03-22T08:36:00.000Z",
    transcript: "Log one liter feed at pH five point nine and EC one point four five.",
    response: "Logged. I also marked runoff collection as pending because no runoff values were provided.",
    citations: []
  }
];

export const vegMix = calculateNutrientPlan("Veg", 10);
