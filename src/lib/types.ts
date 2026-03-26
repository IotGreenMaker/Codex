export type GrowStage = "Seedling" | "Veg" | "Bloom" | "Dry" | "Cure";

export type WateringEntry = {
  id: string;
  timestamp: string;
  amountMl: number;
  ph: number;
  ec: number;
  runoffPh?: number;
  runoffEc?: number;
};

export type ClimateEntry = {
  id: string;
  timestamp: string;
  tempC: number;
  humidity: number;
};

export type FeedAdditive = {
  id: string;
  label: string;
  amountMl: number;
};

export type FeedRecipe = {
  title: string;
  baseAMl: number;
  baseBMl: number;
  calMagMl: number;
  targetEc: number;
  targetPhLow: number;
  targetPhHigh: number;
  additives: FeedAdditive[];
};

export type PlantProfile = {
  id: string;
  strainName: string;
  startedAt: string;
  stage: GrowStage;
  bloomStartedAt?: string;
  lightSchedule: string;
  lightsOn: string;
  lightsOff: string;
  lightType?: "blurple_40w" | "panel_100w";
  lightDimmerPercent?: number;
  lightLampName?: string;
  lightLampWatts?: number;
  totalDaysOverride?: number;
  containerVolumeL: number;
  mediaVolumeL: number;
  mediaType: string;
  outsideTempC: number;
  outsideHumidity: number;
  growTempC: number;
  growHumidity: number;
  waterInputMl: number;
  waterPh: number;
  waterEc: number;
  lastWateredAt: string;
  wateringIntervalDays: number;
  stageDays: {
    seedling: number;
    veg: number;
    bloom: number;
  };
  wateringData: WateringEntry[];
  climateData: ClimateEntry[];
  feedRecipe: FeedRecipe;
};

export type GrowLogEntry = {
  id: string;
  timestamp: string;
  outsideTempC: number;
  outsideHumidity: number;
  growTempC: number;
  growHumidity: number;
  vpdKpa: number;
  waterInputMl: number;
  waterPh: number;
  waterEc: number;
  runoffPh?: number;
  runoffEc?: number;
  note: string;
};

export type VoiceInteraction = {
  id: string;
  createdAt: string;
  transcript: string;
  response: string;
  citations: Array<{
    label: string;
    href: string;
  }>;
};

export type NutrientMix = {
  stage: Extract<GrowStage, "Veg" | "Bloom">;
  liters: number;
  baseAMl: number;
  baseBMl: number;
  calMagMl: number;
  additiveMl: number;
  targetEc: number;
  targetPh: [number, number];
};

export type LocalLlmSettings = {
  provider: "xai" | "lmstudio" | "ollama" | "openai-compatible";
  baseUrl: string;
  model: string;
  apiKey?: string;
};

export type GrowCommand =
  | {
      action: "update_active_plant";
      field:
        | "strainName"
        | "stage"
        | "startedAt"
        | "bloomStartedAt"
        | "totalDaysOverride"
        | "lightSchedule"
        | "lightsOn"
        | "lightsOff"
        | "containerVolumeL"
        | "mediaVolumeL"
        | "mediaType"
        | "outsideTempC"
        | "outsideHumidity"
        | "growTempC"
        | "growHumidity"
        | "waterInputMl"
        | "waterPh"
        | "waterEc"
        | "lastWateredAt"
        | "wateringIntervalDays";
      value: string | number;
    }
  | {
      action: "add_watering_event";
      value: {
        timestamp?: string;
        amountMl: number;
        ph: number;
        ec: number;
        runoffPh?: number;
        runoffEc?: number;
      };
    }
  | {
      action: "add_climate_event";
      value: {
        timestamp?: string;
        tempC: number;
        humidity: number;
      };
    }
  | {
      action: "none";
    };
