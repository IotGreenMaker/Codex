import type { GrowCommand, LocalLlmSettings, PlantProfile } from "@/lib/types";

export function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, "");
}

export function inferLocalLlmProvider(settings: Pick<LocalLlmSettings, "provider" | "baseUrl">): LocalLlmSettings["provider"] {
  const normalized = normalizeBaseUrl(settings.baseUrl).toLowerCase();

  if (settings.provider && settings.provider !== "openai-compatible") {
    return settings.provider;
  }

  if (normalized.includes("api.x.ai")) {
    return "xai";
  }

  if (normalized.includes(":11434") || normalized.endsWith("/api") || normalized.includes("ollama")) {
    return "ollama";
  }

  if (normalized.includes(":1234") || normalized.endsWith("/v1")) {
    return "lmstudio";
  }

  return settings.provider || "openai-compatible";
}

export function applyGrowCommand(plant: PlantProfile, command: GrowCommand) {
  if (command.action === "none") {
    return plant;
  }

  if (command.action === "add_watering_event") {
    const value = command.value;
    const timestamp = value.timestamp ? new Date(value.timestamp).toISOString() : new Date().toISOString();
    return {
      ...plant,
      lastWateredAt: timestamp,
      waterInputMl: Number(value.amountMl) || 0,
      waterPh: Number(value.ph) || 0,
      waterEc: Number(value.ec) || 0,
      wateringData: [
        ...plant.wateringData,
        {
          id: `water-${Date.now()}`,
          timestamp,
          amountMl: Number(value.amountMl) || 0,
          ph: Number(value.ph) || 0,
          ec: Number(value.ec) || 0,
          ...(typeof value.runoffPh === "number" ? { runoffPh: value.runoffPh } : {}),
          ...(typeof value.runoffEc === "number" ? { runoffEc: value.runoffEc } : {})
        }
      ]
    };
  }

  if (command.action === "add_climate_event") {
    const value = command.value;
    const timestamp = value.timestamp ? new Date(value.timestamp).toISOString() : new Date().toISOString();
    return {
      ...plant,
      growTempC: Number(value.tempC) || 0,
      growHumidity: Number(value.humidity) || 0,
      climateData: [
        ...plant.climateData,
        {
          id: `climate-${Date.now()}`,
          timestamp,
          tempC: Number(value.tempC) || 0,
          humidity: Number(value.humidity) || 0
        }
      ]
    };
  }

  if (
    command.field === "totalDaysOverride" ||
    command.field === "containerVolumeL" ||
    command.field === "mediaVolumeL" ||
    command.field === "outsideTempC" ||
    command.field === "outsideHumidity" ||
    command.field === "growTempC" ||
    command.field === "growHumidity" ||
    command.field === "waterInputMl" ||
    command.field === "waterPh" ||
    command.field === "waterEc" ||
    command.field === "wateringIntervalDays"
  ) {
    const numeric = typeof command.value === "number" ? command.value : Number(command.value);
    if (!Number.isFinite(numeric)) {
      return plant;
    }

    if (command.field === "wateringIntervalDays") {
      return {
        ...plant,
        wateringIntervalDays: Math.max(1, Math.floor(numeric))
      };
    }

    return {
      ...plant,
      [command.field]: command.field === "totalDaysOverride" ? Math.max(0, Math.floor(numeric)) : numeric
    };
  }

  if (command.field === "startedAt" || command.field === "bloomStartedAt" || command.field === "lastWateredAt") {
    const date = new Date(String(command.value));
    if (Number.isNaN(date.getTime())) {
      return plant;
    }

    return {
      ...plant,
      [command.field]: date.toISOString()
    };
  }

  if (command.field === "stage") {
    const next = String(command.value) as PlantProfile["stage"];
    const allowed = new Set(["Seedling", "Veg", "Bloom", "Dry", "Cure"]);
    if (!allowed.has(next)) {
      return plant;
    }

    return {
      ...plant,
      stage: next
    };
  }

  return {
    ...plant,
    [command.field]: String(command.value)
  };
}

export function fallbackCommandParser(message: string): GrowCommand {
  const normalized = message.trim().toLowerCase();

  const strainMatch =
    message.match(/change (?:the )?(?:active )?(?:plant )?(?:strain|strain name) to (.+)/i) ??
    message.match(/set (?:the )?(?:active )?(?:plant )?(?:strain|strain name) to (.+)/i) ??
    message.match(/rename (?:the )?(?:active )?(?:plant|strain) to (.+)/i);

  if (strainMatch?.[1]) {
    return {
      action: "update_active_plant",
      field: "strainName",
      value: strainMatch[1].trim()
    };
  }

  const vegMatch = normalized.includes("set stage to veg") || normalized.includes("change stage to veg");
  if (vegMatch) {
    return { action: "update_active_plant", field: "stage", value: "Veg" };
  }

  const bloomMatch = normalized.includes("set stage to bloom") || normalized.includes("change stage to bloom");
  if (bloomMatch) {
    return { action: "update_active_plant", field: "stage", value: "Bloom" };
  }

  const startDateMatch =
    message.match(/(?:set|change|update)\s+(?:the\s+)?(?:plant\s+)?(?:start|starting)\s+date\s+(?:to|as)\s+(\d{4}-\d{2}-\d{2})/i) ??
    message.match(/(?:set|change|update)\s+started(?:\s+at)?\s+(?:to|as)\s+(\d{4}-\d{2}-\d{2})/i);
  if (startDateMatch?.[1]) {
    return { action: "update_active_plant", field: "startedAt", value: `${startDateMatch[1]}T00:00:00.000Z` };
  }

  const totalDaysMatch =
    message.match(/(?:set|change|update)\s+(?:total\s+)?days\s+(?:to|as)\s+(\d{1,4})/i) ??
    message.match(/(?:set|change|update)\s+plant\s+age\s+(?:to|as)\s+(\d{1,4})/i);
  if (totalDaysMatch?.[1]) {
    return { action: "update_active_plant", field: "totalDaysOverride", value: Number(totalDaysMatch[1]) };
  }

  const lightScheduleMatch = message.match(/(?:set|change|update)\s+(?:light\s+schedule|photoperiod)\s+(?:to|as)\s+([0-9]{1,2}\s*\/\s*[0-9]{1,2})/i);
  if (lightScheduleMatch?.[1]) {
    return { action: "update_active_plant", field: "lightSchedule", value: lightScheduleMatch[1].replace(/\s+/g, " ").trim() };
  }

  const lightsOnMatch = message.match(/(?:set|change|update)\s+lights?\s+on\s+(?:to|as)\s+([0-2][0-9]:[0-5][0-9])/i);
  if (lightsOnMatch?.[1]) {
    return { action: "update_active_plant", field: "lightsOn", value: lightsOnMatch[1] };
  }

  const lightsOffMatch = message.match(/(?:set|change|update)\s+lights?\s+off\s+(?:to|as)\s+([0-2][0-9]:[0-5][0-9])/i);
  if (lightsOffMatch?.[1]) {
    return { action: "update_active_plant", field: "lightsOff", value: lightsOffMatch[1] };
  }

  const wateringMatch = message.match(
    /(?:log|add|register)\s+watering(?:\s+event)?(?:.*?)(\d+(?:\.\d+)?)\s*(?:ml|milliliters?).*?(?:ph\s*([0-9]+(?:\.[0-9]+)?))?.*?(?:ec\s*([0-9]+(?:\.[0-9]+)?))?/i
  );
  if (wateringMatch?.[1]) {
    return {
      action: "add_watering_event",
      value: {
        amountMl: Number(wateringMatch[1]),
        ph: Number(wateringMatch[2] ?? 6),
        ec: Number(wateringMatch[3] ?? 1)
      }
    };
  }

  const climateMatch = message.match(
    /(?:log|add|register)\s+climate(?:\s+event)?(?:.*?)(\d+(?:\.\d+)?)\s*(?:c|degrees?).*?(\d+(?:\.\d+)?)\s*%/i
  );
  if (climateMatch?.[1] && climateMatch?.[2]) {
    return {
      action: "add_climate_event",
      value: {
        tempC: Number(climateMatch[1]),
        humidity: Number(climateMatch[2])
      }
    };
  }

  return { action: "none" };
}

export function buildCommandPrompt(message: string, plant: PlantProfile) {
  return [
    "You are G-Buddy, a local grow assistant that extracts structured commands and replies briefly.",
    "Return valid JSON only. Do not wrap the JSON in markdown.",
    "Schema:",
    '{"assistantMessage":"string","command":{"action":"update_active_plant","field":"strainName|stage|startedAt|bloomStartedAt|totalDaysOverride|lightSchedule|lightsOn|lightsOff|containerVolumeL|mediaVolumeL|mediaType|outsideTempC|outsideHumidity|growTempC|growHumidity|waterInputMl|waterPh|waterEc|lastWateredAt|wateringIntervalDays","value":"string|number"} | {"action":"add_watering_event","value":{"timestamp":"optional ISO date","amountMl":"number","ph":"number","ec":"number","runoffPh":"optional number","runoffEc":"optional number"}} | {"action":"add_climate_event","value":{"timestamp":"optional ISO date","tempC":"number","humidity":"number"}} | {"action":"none"}}',
    `Current active plant: ${JSON.stringify(plant)}`,
    `User message: ${message}`
  ].join("\n");
}

export function hasLocalLlmSettings(settings: LocalLlmSettings) {
  return Boolean(normalizeBaseUrl(settings.baseUrl) && settings.model.trim());
}
