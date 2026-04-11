export type GrowStage = "Seedling" | "Veg" | "Bloom";

export type LightType = "blurple_40w" | "panel_100w" | "custom_led" | "custom_hps" | "other";

export type LightProfile = {
  id: string;
  type: string;
  watts: number;
  hasDimmer: boolean;
  dimmerPercent?: number;
  ppfdEstimated?: number;
  ppfdMin?: number;
  ppfdMax?: number;
  lightsOn: string;
  lightsOff: string;
};

export const LIGHT_TYPE_LABELS: Record<LightType, string> = {
  blurple_40w: "Blurple 40W (Veg)",
  panel_100w: "Panel 100W (Bloom)",
  custom_led: "Custom LED",
  custom_hps: "Custom HPS/MH",
  other: "Other Light"
};

export const LIGHT_TYPE_DEFAULT_WATTS: Record<LightType, number> = {
  blurple_40w: 40,
  panel_100w: 100,
  custom_led: 100,
  custom_hps: 600,
  other: 100
};

export type NoteEntry = {
  id: string;
  timestamp: string;
  text: string;
};

export type WateringEntry = {
  id: string;
  timestamp: string;
  amountMl: number;
  ph: number;
  ec: number;
  runoffPh?: number;
  runoffEc?: number;
  isFeed?: boolean;
  recipeSnapshot?: Array<{ label: string; value: string }>;
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
  seedlingStartedAt?: string;
  vegStartedAt?: string;
  bloomStartedAt?: string;
  lightSchedule: string;
  lightsOn: string;
  lightsOff: string;
  lightType?: "blurple_40w" | "panel_100w";
  lightDimmerPercent?: number;
  lightLampName?: string;
  lightLampWatts?: number;
  lights?: LightProfile[];
  activeLightId?: string;
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
  notes: NoteEntry[];
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
