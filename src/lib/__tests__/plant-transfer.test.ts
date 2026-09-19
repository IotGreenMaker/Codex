import {
  buildSpaceExport,
  getSpaceExportFileName,
  parseImportedSpace
} from "../plant-transfer";
import type { PlantProfile, SpaceConfig } from "../types";

function plant(id: string, strainName: string): PlantProfile {
  return {
    id,
    strainName,
    startedAt: "2026-01-01T00:00:00.000Z",
    stage: "Veg",
    lightSchedule: "18/6",
    lightsOn: "06:00",
    lightsOff: "00:00",
    containerVolumeL: 10,
    mediaVolumeL: 8,
    mediaType: "Soil",
    outsideTempC: 20,
    outsideHumidity: 50,
    growTempC: 25,
    growHumidity: 60,
    waterInputMl: 500,
    waterPh: 6,
    waterEc: 1,
    lastWateredAt: "2026-01-01T00:00:00.000Z",
    wateringIntervalDays: 2,
    stageDays: { seedling: 1, veg: 10, bloom: 0 },
    wateringData: [],
    climateData: [],
    notes: [],
    feedRecipe: {
      title: "Recipe",
      baseAMl: 1,
      baseBMl: 1,
      calMagMl: 0,
      targetEc: 1,
      targetPhLow: 5.8,
      targetPhHigh: 6.2,
      additives: []
    }
  };
}

function space(): SpaceConfig {
  return {
    id: "space-1",
    name: "Main Grow Space",
    createdAt: "2026-01-01T00:00:00.000Z",
    plants: [{ id: "plant-1" }],
    weatherData: [],
    lightData: [],
    lightHistory: []
  };
}

describe("space transfer", () => {
  test("exports only plants assigned to the space", () => {
    const payload = buildSpaceExport(space(), [plant("plant-1", "A"), plant("plant-2", "B")]);

    expect(payload.space.id).toBe("space-1");
    expect(payload.plants.map((entry) => entry.id)).toEqual(["plant-1"]);
  });

  test("creates a sanitized dated filename", () => {
    const filename = getSpaceExportFileName(space(), new Date("2026-09-19T12:34:56.000Z"));

    expect(filename).toBe("Space_20260919T123456Z_Main-Grow-Space.json");
  });

  test("imports a space and remaps its plant references", () => {
    const payload = buildSpaceExport(space(), [plant("plant-1", "A")]);
    const imported = parseImportedSpace(JSON.stringify(payload));

    expect(imported.space.id).not.toBe("space-1");
    expect(imported.space.name).toBe("Main Grow Space (Imported)");
    expect(imported.plants).toHaveLength(1);
    expect(imported.space.plants).toEqual([{ id: imported.plants[0].id }]);
    expect(imported.plants[0].id).not.toBe("plant-1");
  });
});
