// src/lib/excel-storage.ts
// Excel-based local storage using File System Access API

import * as XLSX from "xlsx";
import type { PlantProfile, WateringEntry, ClimateEntry } from "@/lib/types";

// Types
export type ExcelData = {
  plants: PlantProfile[];
  wateringLogs: WateringLogRow[];
  climateLogs: ClimateLogRow[];
  settings: Record<string, string>;
};

export type WateringLogRow = {
  id: string;
  plantId: string;
  timestamp: string;
  amountMl: number;
  ph: number;
  ec: number;
  runoffPh?: number;
  runoffEc?: number;
};

export type ClimateLogRow = {
  id: string;
  plantId: string;
  timestamp: string;
  tempC: number;
  humidity: number;
};

export type SettingsRow = {
  key: string;
  value: string;
};

// File handle storage
let fileHandle: FileSystemFileHandle | null = null;

// Check if File System Access API is supported
export function isFileSystemAccessSupported(): boolean {
  return typeof window !== "undefined" && "showOpenFilePicker" in window;
}

// Request file access from user
export async function requestFileAccess(): Promise<FileSystemFileHandle | null> {
  if (!isFileSystemAccessSupported()) {
    console.warn("File System Access API not supported");
    return null;
  }

  try {
    const [handle] = await (window as any).showOpenFilePicker({
      types: [
        {
          description: "Excel Files",
          accept: {
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
          },
        },
      ],
      multiple: false,
    });
    fileHandle = handle;
    return handle;
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      console.log("User cancelled file picker");
    } else {
      console.error("Error accessing file:", err);
    }
    return null;
  }
}

// Create new Excel file
export async function createNewFile(): Promise<FileSystemFileHandle | null> {
  if (!isFileSystemAccessSupported()) {
    console.warn("File System Access API not supported");
    return null;
  }

  try {
    const handle = await (window as any).showSaveFilePicker({
      suggestedName: "g-buddy-data.xlsx",
      types: [
        {
          description: "Excel Files",
          accept: {
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
          },
        },
      ],
    });
    fileHandle = handle;

    // Create initial workbook
    const wb = XLSX.utils.book_new();

    // Plants sheet
    const plantsData = createPlantsSheet([]);
    XLSX.utils.book_append_sheet(wb, plantsData, "Plants");

    // Watering Log sheet
    const wateringData = createWateringSheet([]);
    XLSX.utils.book_append_sheet(wb, wateringData, "Watering_Log");

    // Climate Log sheet
    const climateData = createClimateSheet([]);
    XLSX.utils.book_append_sheet(wb, climateData, "Climate_Log");

    // Settings sheet
    const settingsData = createSettingsSheet([
      { key: "activePlantId", value: "" },
      { key: "locale", value: "en" },
    ]);
    XLSX.utils.book_append_sheet(wb, settingsData, "Settings");

    // Write file
    await writeWorkbook(wb);

    return handle;
  } catch (err) {
    console.error("Error creating file:", err);
    return null;
  }
}

// Read Excel file
export async function readExcelFile(): Promise<ExcelData | null> {
  if (!fileHandle) {
    console.warn("No file handle available");
    return null;
  }

  try {
    const file = await fileHandle.getFile();
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });

    // Parse Plants sheet
    const plantsSheet = wb.Sheets["Plants"];
    const plantsRaw = plantsSheet ? XLSX.utils.sheet_to_json(plantsSheet) : [];
    const plants = plantsRaw.map(parsePlantRow).filter(Boolean) as PlantProfile[];

    // Parse Watering Log sheet
    const wateringSheet = wb.Sheets["Watering_Log"];
    const wateringLogs = wateringSheet
      ? (XLSX.utils.sheet_to_json(wateringSheet) as WateringLogRow[])
      : [];

    // Parse Climate Log sheet
    const climateSheet = wb.Sheets["Climate_Log"];
    const climateLogs = climateSheet
      ? (XLSX.utils.sheet_to_json(climateSheet) as ClimateLogRow[])
      : [];

    // Parse Settings sheet
    const settingsSheet = wb.Sheets["Settings"];
    const settingsRaw = settingsSheet
      ? (XLSX.utils.sheet_to_json(settingsSheet) as SettingsRow[])
      : [];
    const settings: Record<string, string> = {};
    for (const row of settingsRaw) {
      if (row.key) settings[row.key] = row.value ?? "";
    }

    return {
      plants,
      wateringLogs,
      climateLogs,
      settings: settings as any,
    };
  } catch (err) {
    console.error("Error reading Excel file:", err);
    return null;
  }
}

// Write plants data
export async function writePlants(plants: PlantProfile[]): Promise<boolean> {
  try {
    const wb = await getWorkbook();
    const sheet = createPlantsSheet(plants);
    wb.Sheets["Plants"] = sheet;
    await writeWorkbook(wb);
    return true;
  } catch (err) {
    console.error("Error writing plants:", err);
    return false;
  }
}

// Write watering logs
export async function writeWateringLogs(logs: WateringLogRow[]): Promise<boolean> {
  try {
    const wb = await getWorkbook();
    const sheet = createWateringSheet(logs);
    wb.Sheets["Watering_Log"] = sheet;
    await writeWorkbook(wb);
    return true;
  } catch (err) {
    console.error("Error writing watering logs:", err);
    return false;
  }
}

// Write climate logs
export async function writeClimateLogs(logs: ClimateLogRow[]): Promise<boolean> {
  try {
    const wb = await getWorkbook();
    const sheet = createClimateSheet(logs);
    wb.Sheets["Climate_Log"] = sheet;
    await writeWorkbook(wb);
    return true;
  } catch (err) {
    console.error("Error writing climate logs:", err);
    return false;
  }
}

// Write settings
export async function writeSettings(settings: Record<string, string>): Promise<boolean> {
  try {
    const wb = await getWorkbook();
    const rows: SettingsRow[] = Object.entries(settings).map(([key, value]) => ({
      key,
      value: String(value),
    }));
    const sheet = createSettingsSheet(rows);
    wb.Sheets["Settings"] = sheet;
    await writeWorkbook(wb);
    return true;
  } catch (err) {
    console.error("Error writing settings:", err);
    return false;
  }
}

// Save all data at once
export async function saveAllData(data: ExcelData): Promise<boolean> {
  try {
    const wb = XLSX.utils.book_new();

    const plantsSheet = createPlantsSheet(data.plants);
    XLSX.utils.book_append_sheet(wb, plantsSheet, "Plants");

    const wateringSheet = createWateringSheet(data.wateringLogs);
    XLSX.utils.book_append_sheet(wb, wateringSheet, "Watering_Log");

    const climateSheet = createClimateSheet(data.climateLogs);
    XLSX.utils.book_append_sheet(wb, climateSheet, "Climate_Log");

    const settingsRows: SettingsRow[] = Object.entries(data.settings as any).map(
      ([key, value]) => ({ key, value: String(value) })
    );
    const settingsSheet = createSettingsSheet(settingsRows);
    XLSX.utils.book_append_sheet(wb, settingsSheet, "Settings");

    await writeWorkbook(wb);
    return true;
  } catch (err) {
    console.error("Error saving all data:", err);
    return false;
  }
}

// Helper: Get current workbook
async function getWorkbook(): Promise<XLSX.WorkBook> {
  if (!fileHandle) {
    return XLSX.utils.book_new();
  }

  try {
    const file = await fileHandle.getFile();
    const buffer = await file.arrayBuffer();
    return XLSX.read(buffer, { type: "array" });
  } catch {
    return XLSX.utils.book_new();
  }
}

// Helper: Write workbook to file
async function writeWorkbook(wb: XLSX.WorkBook): Promise<void> {
  if (!fileHandle) {
    throw new Error("No file handle available");
  }

  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const writable = await fileHandle.createWritable();
  await writable.write(buffer);
  await writable.close();
}

// Helper: Create styled Plants sheet
function createPlantsSheet(plants: PlantProfile[]): XLSX.WorkSheet {
  const headers = [
    "ID",
    "Strain Name",
    "Stage",
    "Started At",
    "Bloom Started At",
    "Light Schedule",
    "Lights On",
    "Lights Off",
    "Light Type",
    "Light Dimmer %",
    "Container Volume (L)",
    "Media Volume (L)",
    "Media Type",
    "Grow Temp (°C)",
    "Grow Humidity (%)",
    "Water Input (ml)",
    "Water pH",
    "Water EC",
    "Last Watered At",
    "Watering Interval (days)",
    "Outside Temp (°C)",
    "Outside Humidity (%)",
  ];

  const rows = plants.map((p) => [
    p.id,
    p.strainName,
    p.stage,
    p.startedAt,
    p.bloomStartedAt || "",
    p.lightSchedule,
    p.lightsOn,
    p.lightsOff,
    p.lightType || "panel_100w",
    p.lightDimmerPercent || 75,
    p.containerVolumeL,
    p.mediaVolumeL,
    p.mediaType,
    p.growTempC,
    p.growHumidity,
    p.waterInputMl,
    p.waterPh,
    p.waterEc,
    p.lastWateredAt,
    p.wateringIntervalDays,
    p.outsideTempC,
    p.outsideHumidity,
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Set column widths
  ws["!cols"] = [
    { wch: 36 }, // ID
    { wch: 20 }, // Strain Name
    { wch: 10 }, // Stage
    { wch: 24 }, // Started At
    { wch: 24 }, // Bloom Started At
    { wch: 14 }, // Light Schedule
    { wch: 10 }, // Lights On
    { wch: 10 }, // Lights Off
    { wch: 14 }, // Light Type
    { wch: 14 }, // Light Dimmer %
    { wch: 18 }, // Container Volume
    { wch: 16 }, // Media Volume
    { wch: 12 }, // Media Type
    { wch: 14 }, // Grow Temp
    { wch: 16 }, // Grow Humidity
    { wch: 14 }, // Water Input
    { wch: 10 }, // Water pH
    { wch: 10 }, // Water EC
    { wch: 24 }, // Last Watered At
    { wch: 20 }, // Watering Interval
  ];

  return ws;
}

// Helper: Create Watering Log sheet
function createWateringSheet(logs: WateringLogRow[]): XLSX.WorkSheet {
  const headers = ["ID", "Plant ID", "Timestamp", "Amount (ml)", "pH", "EC", "Runoff pH", "Runoff EC"];

  const rows = logs.map((l) => [
    l.id,
    l.plantId,
    l.timestamp,
    l.amountMl,
    l.ph,
    l.ec,
    l.runoffPh || "",
    l.runoffEc || "",
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  ws["!cols"] = [
    { wch: 36 }, // ID
    { wch: 36 }, // Plant ID
    { wch: 24 }, // Timestamp
    { wch: 12 }, // Amount
    { wch: 8 }, // pH
    { wch: 8 }, // EC
    { wch: 12 }, // Runoff pH
    { wch: 12 }, // Runoff EC
  ];

  return ws;
}

// Helper: Create Climate Log sheet
function createClimateSheet(logs: ClimateLogRow[]): XLSX.WorkSheet {
  const headers = ["ID", "Plant ID", "Timestamp", "Temp (°C)", "Humidity (%)"];

  const rows = logs.map((l) => [l.id, l.plantId, l.timestamp, l.tempC, l.humidity]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  ws["!cols"] = [
    { wch: 36 }, // ID
    { wch: 36 }, // Plant ID
    { wch: 24 }, // Timestamp
    { wch: 12 }, // Temp
    { wch: 14 }, // Humidity
  ];

  return ws;
}

// Helper: Create Settings sheet
function createSettingsSheet(rows: SettingsRow[]): XLSX.WorkSheet {
  const headers = ["Key", "Value"];
  const data = rows.map((r) => [r.key, r.value]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

  ws["!cols"] = [
    { wch: 20 }, // Key
    { wch: 40 }, // Value
  ];

  return ws;
}

// Helper: Parse plant row from Excel
function parsePlantRow(row: any): PlantProfile | null {
  try {
    return {
      id: String(row["ID"] || ""),
      strainName: String(row["Strain Name"] || "Unknown"),
      stage: String(row["Stage"] || "Seedling") as any,
      startedAt: String(row["Started At"] || new Date().toISOString()),
      bloomStartedAt: String(row["Bloom Started At"] || ""),
      lightSchedule: String(row["Light Schedule"] || "18 / 6"),
      lightsOn: String(row["Lights On"] || "06:00"),
      lightsOff: String(row["Lights Off"] || "00:00"),
      lightType: (row["Light Type"] || "panel_100w") as any,
      lightDimmerPercent: Number(row["Light Dimmer %"] || 75),
      containerVolumeL: Number(row["Container Volume (L)"] || 15),
      mediaVolumeL: Number(row["Media Volume (L)"] || 13),
      mediaType: String(row["Media Type"] || "Soil"),
      growTempC: Number(row["Grow Temp (°C)"] || 24),
      growHumidity: Number(row["Grow Humidity (%)"] || 60),
      waterInputMl: Number(row["Water Input (ml)"] || 500),
      waterPh: Number(row["Water pH"] || 6.0),
      waterEc: Number(row["Water EC"] || 1.0),
      lastWateredAt: String(row["Last Watered At"] || new Date().toISOString()),
      wateringIntervalDays: Number(row["Watering Interval (days)"] || 2),
      outsideTempC: Number(row["Outside Temp (°C)"] || 20),
      outsideHumidity: Number(row["Outside Humidity (%)"] || 50),
      stageDays: { seedling: 1, veg: 0, bloom: 0 },
      wateringData: [],
      climateData: [],
      notes: [],
      feedRecipe: {
        title: "Default Mix",
        baseAMl: 24,
        baseBMl: 21,
        calMagMl: 6,
        targetEc: 1.45,
        targetPhLow: 5.8,
        targetPhHigh: 6.1,
        additives: [],
      },
    };
  } catch {
    return null;
  }
}

// Check if file is currently open
export function hasFileAccess(): boolean {
  return fileHandle !== null;
}

// Get current file name
export async function getFileName(): Promise<string | null> {
  if (!fileHandle) return null;
  try {
    const file = await fileHandle.getFile();
    return file.name;
  } catch {
    return null;
  }
}