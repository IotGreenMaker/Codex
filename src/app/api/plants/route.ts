import { NextRequest, NextResponse } from "next/server";
import { readExcelFile, saveAllData, hasFileAccess } from "@/lib/excel-storage";
import type { PlantProfile } from "@/lib/types";
import { generateUUID } from "@/lib/uuid";

type Body = {
  plants?: PlantProfile[];
  activePlantId?: string;
  plantId?: string;
  wateringId?: string;
  climateId?: string;
  action?: "delete-plant" | "delete-watering" | "delete-climate";
};

export async function GET() {
  try {
    const data = await readExcelFile();
    if (!data) {
      return NextResponse.json({ ok: false, error: "No data file loaded" }, { status: 404 });
    }

    const activePlantId = data.settings?.activePlantId || data.plants[0]?.id || "";
    return NextResponse.json({ ok: true, plants: data.plants, activePlantId });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to read plants." },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as Body;
    if (!Array.isArray(body.plants) || typeof body.activePlantId !== "string") {
      return NextResponse.json({ ok: false, error: "Invalid plants payload." }, { status: 400 });
    }

    const data = await readExcelFile();
    if (!data) {
      return NextResponse.json({ ok: false, error: "No data file loaded" }, { status: 404 });
    }

    // Convert plants to watering and climate logs
    const wateringLogs: any[] = [];
    const climateLogs: any[] = [];

    for (const plant of body.plants) {
      // Add watering data
      if (plant.wateringData) {
        for (const w of plant.wateringData) {
          wateringLogs.push({
            id: w.id,
            plantId: plant.id,
            timestamp: w.timestamp,
            amountMl: w.amountMl,
            ph: w.ph,
            ec: w.ec,
            runoffPh: w.runoffPh,
            runoffEc: w.runoffEc,
          });
        }
      }

      // Add climate data
      if (plant.climateData) {
        for (const c of plant.climateData) {
          climateLogs.push({
            id: c.id,
            plantId: plant.id,
            timestamp: c.timestamp,
            tempC: c.tempC,
            humidity: c.humidity,
          });
        }
      }
    }

    // Save all data
    const success = await saveAllData({
      plants: body.plants,
      wateringLogs,
      climateLogs,
      settings: {
        ...data.settings,
        activePlantId: body.activePlantId,
      },
    });

    if (!success) {
      return NextResponse.json({ ok: false, error: "Failed to save data" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to persist plants." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json()) as Body;
    const action = body.action || "delete-plant";

    const data = await readExcelFile();
    if (!data) {
      return NextResponse.json({ ok: false, error: "No data file loaded" }, { status: 404 });
    }

    if (action === "delete-plant") {
      if (!body.plantId || typeof body.plantId !== "string") {
        return NextResponse.json({ ok: false, error: "Missing or invalid plantId." }, { status: 400 });
      }

      const updatedPlants = data.plants.filter((p) => p.id !== body.plantId);
      const updatedWateringLogs = data.wateringLogs.filter((l) => l.plantId !== body.plantId);
      const updatedClimateLogs = data.climateLogs.filter((l) => l.plantId !== body.plantId);

      let newActivePlantId = data.settings?.activePlantId || "";
      if (newActivePlantId === body.plantId) {
        newActivePlantId = updatedPlants[0]?.id || "";
      }

      const success = await saveAllData({
        plants: updatedPlants,
        wateringLogs: updatedWateringLogs,
        climateLogs: updatedClimateLogs,
        settings: {
          ...data.settings,
          activePlantId: newActivePlantId,
        },
      });

      return NextResponse.json({ ok: success });
    } else if (action === "delete-watering") {
      if (!body.wateringId || typeof body.wateringId !== "string") {
        return NextResponse.json({ ok: false, error: "Missing or invalid wateringId." }, { status: 400 });
      }
      if (!body.plantId || typeof body.plantId !== "string") {
        return NextResponse.json({ ok: false, error: "Missing or invalid plantId." }, { status: 400 });
      }

      const updatedWateringLogs = data.wateringLogs.filter((l) => l.id !== body.wateringId);
      const success = await saveAllData({
        ...data,
        wateringLogs: updatedWateringLogs,
      });

      return NextResponse.json({ ok: success });
    } else if (action === "delete-climate") {
      if (!body.climateId || typeof body.climateId !== "string") {
        return NextResponse.json({ ok: false, error: "Missing or invalid climateId." }, { status: 400 });
      }
      if (!body.plantId || typeof body.plantId !== "string") {
        return NextResponse.json({ ok: false, error: "Missing or invalid plantId." }, { status: 400 });
      }

      const updatedClimateLogs = data.climateLogs.filter((l) => l.id !== body.climateId);
      const success = await saveAllData({
        ...data,
        climateLogs: updatedClimateLogs,
      });

      return NextResponse.json({ ok: success });
    } else {
      return NextResponse.json({ ok: false, error: "Invalid action." }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to delete record." },
      { status: 500 }
    );
  }
}