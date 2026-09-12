import * as XLSX from "xlsx";
import type { PlantProfile, SpaceConfig, ClimateEntry, LightProfile, LightSnapshotEntry } from "@/lib/types";

export type ExportData = {
  plants: PlantProfile[];
  activePlantId: string;
  lightHistory: LightSnapshotEntry[];
};

export async function exportToExcel(data: ExportData): Promise<void> {
  const wb = XLSX.utils.book_new();

  const plantsHeaders = [
    "ID", "Strain Name", "Stage", "Started At", "Bloom Started At",
    "Light Schedule", "Lights On", "Lights Off", "Light Type", "Light Dimmer %",
    "Container Volume (L)", "Media Volume (L)", "Media Type", "Grow Temp (C)",
    "Grow Humidity (%)", "Water Input (ml)", "Water pH", "Water EC",
    "Last Watered At", "Watering Interval (days)", "Outside Temp (C)", "Outside Humidity (%)",
    "Light History"
  ];

  const plantsRows = data.plants.map(p => [
    p.id, p.strainName, p.stage, p.startedAt, p.bloomStartedAt || "",
    p.lightSchedule, p.lightsOn, p.lightsOff, p.lightType || "panel_100w", p.lightDimmerPercent || 75,
    p.containerVolumeL, p.mediaVolumeL, p.mediaType, p.growTempC,
    p.growHumidity, p.waterInputMl, p.waterPh, p.waterEc,
    p.lastWateredAt, p.wateringIntervalDays, p.outsideTempC, p.outsideHumidity,
    // Light History column - for now showing count and latest entry
    data.lightHistory.filter(h => {
      // This is approximate since we don't have space ID in plant
      // We'll need to associate light history differently
      return true; // Placeholder
    }).length > 0 ? 
      `${data.lightHistory.filter(h => true).length} entries, latest: ${data.lightHistory.slice(-1)[0]?.timestamp?.slice(0,10) || 'N/A'}` : 
      "No history"
  ]);

  const plantsWs = XLSX.utils.aoa_to_sheet([plantsHeaders, ...plantsRows]);
  plantsWs["!cols"] = [
    { wch: 36 }, { wch: 20 }, { wch: 10 }, { wch: 24 }, { wch: 24 },
    { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 },
    { wch: 18 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 16 },
    { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 24 }, { wch: 20 },
    { wch: 16 }, { wch: 16 }
  ];
  XLSX.utils.book_append_sheet(wb, plantsWs, "Plants");

  const wateringHeaders = ["ID", "Plant ID", "Timestamp", "Amount (ml)", "pH", "EC", "Runoff pH", "Runoff EC"];
  const wateringRows: any[] = [];
  
  for (const plant of data.plants) {
    for (const w of plant.wateringData) {
      wateringRows.push([
        w.id, plant.id, w.timestamp, w.amountMl, w.ph, w.ec, w.runoffPh || "", w.runoffEc || ""
      ]);
    }
  }

  const wateringWs = XLSX.utils.aoa_to_sheet([wateringHeaders, ...wateringRows]);
  wateringWs["!cols"] = [
    { wch: 36 }, { wch: 36 }, { wch: 24 }, { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 12 }
  ];
  XLSX.utils.book_append_sheet(wb, wateringWs, "Watering_Log");

  const climateHeaders = ["ID", "Plant ID", "Timestamp", "Temp (C)", "Humidity (%)"];
  const climateRows: any[] = [];
  
  for (const plant of data.plants) {
    for (const c of plant.climateData) {
      climateRows.push([c.id, plant.id, c.timestamp, c.tempC, c.humidity]);
    }
  }

  const climateWs = XLSX.utils.aoa_to_sheet([climateHeaders, ...climateRows]);
  climateWs["!cols"] = [
    { wch: 36 }, { wch: 36 }, { wch: 24 }, { wch: 12 }, { wch: 14 }
  ];
  XLSX.utils.book_append_sheet(wb, climateWs, "Climate_Log");

  const settingsHeaders = ["Key", "Value"];
  const settingsRows = [
    ["activePlantId", data.activePlantId],
    ["locale", "en"],
    ["exportedAt", new Date().toISOString()]
  ];

  const settingsWs = XLSX.utils.aoa_to_sheet([settingsHeaders, ...settingsRows]);
  settingsWs["!cols"] = [{ wch: 20 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, settingsWs, "Settings");

  const wbOut = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbOut], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `gbuddy-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── Spaces Export ─────────────────────────────────────────────────────────

export type SpaceExportData = {
  spaces: SpaceConfig[];
};

export async function exportSpaces(data: SpaceExportData): Promise<void> {
  const wb = XLSX.utils.book_new();

  const spacesHeaders = [
    "ID", "Name", "Color", "Created At", "Plant Count", "Active Light ID"
  ];

  const spacesRows = data.spaces.map(s => [
    s.id, 
    s.name, 
    s.color || "", 
    s.createdAt, 
    s.plants.length,
    s.activeLightId || ""
  ]);

  const spacesWs = XLSX.utils.aoa_to_sheet([spacesHeaders, ...spacesRows]);
  spacesWs["!cols"] = [
    { wch: 36 }, { wch: 20 }, { wch: 18 }, { wch: 24 }, { wch: 12 }, { wch: 36 }
  ];
  XLSX.utils.book_append_sheet(wb, spacesWs, "Spaces");

  const plantRefsHeaders = ["Space ID", "Plant ID"];
  const plantRefsRows: any[] = [];
  
  for (const space of data.spaces) {
    for (const plant of space.plants) {
      plantRefsRows.push([space.id, typeof plant === 'string' ? plant : plant.id]);
    }
  }

  const plantRefsWs = XLSX.utils.aoa_to_sheet([plantRefsHeaders, ...plantRefsRows]);
  plantRefsWs["!cols"] = [{ wch: 36 }, { wch: 36 }];
  XLSX.utils.book_append_sheet(wb, plantRefsWs, "Space_Plants");

  const spaceClimateHeaders = ["Space ID", "ID", "Timestamp", "Temp (C)", "Humidity (%)"];
  const spaceClimateRows: any[] = [];
  
  for (const space of data.spaces) {
    for (const c of space.weatherData) {
      spaceClimateRows.push([space.id, c.id, c.timestamp, c.tempC, c.humidity]);
    }
  }

  const spaceClimateWs = XLSX.utils.aoa_to_sheet([spaceClimateHeaders, ...spaceClimateRows]);
  spaceClimateWs["!cols"] = [
    { wch: 36 }, { wch: 36 }, { wch: 24 }, { wch: 12 }, { wch: 14 }
  ];
  XLSX.utils.book_append_sheet(wb, spaceClimateWs, "Space_Climate");

  const lightHeaders = ["Space ID", "Light ID", "Type", "Watts", "Has Dimmer", "Dimmer %", "PPFD Estimated", "PPFD Min", "PPFD Max", "Lights On", "Lights Off"];
  const lightRows: any[] = [];
  
  for (const space of data.spaces) {
    for (const l of space.lightData) {
      lightRows.push([
        space.id, l.id, l.type, l.watts, l.hasDimmer, l.dimmerPercent || "",
        l.ppfdEstimated || "", l.ppfdMin || "", l.ppfdMax || "",
        l.lightsOn, l.lightsOff
      ]);
    }
  }

  const lightWs = XLSX.utils.aoa_to_sheet([lightHeaders, ...lightRows]);
  lightWs["!cols"] = [
    { wch: 36 }, { wch: 36 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 12 },
    { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }
  ];
  XLSX.utils.book_append_sheet(wb, lightWs, "Space_Lights");

  const wbOut = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbOut], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `gbuddy-spaces-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportAllData(data: { plants: PlantProfile[]; spaces: SpaceConfig[]; activePlantId: string }): Promise<void> {
  const wb = XLSX.utils.book_new();

  const plantsHeaders = [
    "ID", "Strain Name", "Stage", "Started At", "Bloom Started At",
    "Light Schedule", "Lights On", "Lights Off", "Light Type", "Light Dimmer %",
    "Container Volume (L)", "Media Volume (L)", "Media Type", "Grow Temp (C)",
    "Grow Humidity (%)", "Water Input (ml)", "Water pH", "Water EC",
    "Last Watered At", "Watering Interval (days)", "Outside Temp (C)", "Outside Humidity (%)",
    "Light History"
  ];

  const plantsRows = data.plants.map(p => [
    p.id, p.strainName, p.stage, p.startedAt, p.bloomStartedAt || "",
    p.lightSchedule, p.lightsOn, p.lightsOff, p.lightType || "panel_100w", p.lightDimmerPercent || 75,
    p.containerVolumeL, p.mediaVolumeL, p.mediaType, p.growTempC,
    p.growHumidity, p.waterInputMl, p.waterPh, p.waterEc,
    p.lastWateredAt, p.wateringIntervalDays, p.outsideTempC, p.outsideHumidity
  ]);

  const plantsWs = XLSX.utils.aoa_to_sheet([plantsHeaders, ...plantsRows]);
  plantsWs["!cols"] = [
    { wch: 36 }, { wch: 20 }, { wch: 10 }, { wch: 24 }, { wch: 24 },
    { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 },
    { wch: 18 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 16 },
    { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 24 }, { wch: 20 },
    { wch: 16 }, { wch: 16 }
  ];
  XLSX.utils.book_append_sheet(wb, plantsWs, "Plants");

  const spacesHeaders = [
    "ID", "Name", "Color", "Created At", "Plant Count", "Active Light ID"
  ];

  const spacesRows = data.spaces.map(s => [
    s.id, 
    s.name, 
    s.color || "", 
    s.createdAt, 
    s.plants.length,
    s.activeLightId || ""
  ]);

  const spacesWs = XLSX.utils.aoa_to_sheet([spacesHeaders, ...spacesRows]);
  spacesWs["!cols"] = [
    { wch: 36 }, { wch: 20 }, { wch: 18 }, { wch: 24 }, { wch: 12 }, { wch: 36 }
  ];
  XLSX.utils.book_append_sheet(wb, spacesWs, "Spaces");

  const plantRefsHeaders = ["Space ID", "Plant ID"];
  const plantRefsRows: any[] = [];
  
  for (const space of data.spaces) {
    for (const plant of space.plants) {
      plantRefsRows.push([space.id, typeof plant === 'string' ? plant : plant.id]);
    }
  }

  const plantRefsWs = XLSX.utils.aoa_to_sheet([plantRefsHeaders, ...plantRefsRows]);
  plantRefsWs["!cols"] = [{ wch: 36 }, { wch: 36 }];
  XLSX.utils.book_append_sheet(wb, plantRefsWs, "Space_Plants");

  const spaceClimateHeaders = ["Space ID", "ID", "Timestamp", "Temp (C)", "Humidity (%)"];
  const spaceClimateRows: any[] = [];
  
  for (const space of data.spaces) {
    for (const c of space.weatherData) {
      spaceClimateRows.push([space.id, c.id, c.timestamp, c.tempC, c.humidity]);
    }
  }

  const spaceClimateWs = XLSX.utils.aoa_to_sheet([spaceClimateHeaders, ...spaceClimateRows]);
  spaceClimateWs["!cols"] = [
    { wch: 36 }, { wch: 36 }, { wch: 24 }, { wch: 12 }, { wch: 14 }
  ];
  XLSX.utils.book_append_sheet(wb, spaceClimateWs, "Space_Climate");

  const lightHeaders = ["Space ID", "Light ID", "Type", "Watts", "Has Dimmer", "Dimmer %", "PPFD Estimated", "PPFD Min", "PPFD Max", "Lights On", "Lights Off"];
  const lightRows: any[] = [];
  
  for (const space of data.spaces) {
    for (const l of space.lightData) {
      lightRows.push([
        space.id, l.id, l.type, l.watts, l.hasDimmer, l.dimmerPercent || "",
        l.ppfdEstimated || "", l.ppfdMin || "", l.ppfdMax || "",
        l.lightsOn, l.lightsOff
      ]);
    }
  }

  const lightWs = XLSX.utils.aoa_to_sheet([lightHeaders, ...lightRows]);
  lightWs["!cols"] = [
    { wch: 36 }, { wch: 36 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 12 },
    { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }
  ];
  XLSX.utils.book_append_sheet(wb, lightWs, "Space_Lights");

  const settingsHeaders = ["Key", "Value"];
  const settingsRows = [
    ["activePlantId", data.activePlantId],
    ["locale", "en"],
    ["exportedAt", new Date().toISOString()]
  ];

  const settingsWs = XLSX.utils.aoa_to_sheet([settingsHeaders, ...settingsRows]);
  settingsWs["!cols"] = [{ wch: 20 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, settingsWs, "Settings");

  const wbOut = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbOut], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `gbuddy-full-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}