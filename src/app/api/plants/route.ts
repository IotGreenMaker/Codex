import { NextRequest, NextResponse } from "next/server";
import {
  deleteClimateLogById,
  deletePlantById,
  deleteWateringLogById,
  readPlantsState,
  writePlantsState
} from "@/lib/plants-store";
import type { PlantProfile } from "@/lib/types";

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
    const state = await readPlantsState();
    const { plants, activePlantId } = state;
    
    return NextResponse.json({ ok: true, plants, activePlantId });
  } catch (error) {
    console.error("API GET /plants failed:", error);
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

    await writePlantsState({ plants: body.plants, activePlantId: body.activePlantId });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("API PUT /plants failed:", error);
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

    if (action === "delete-plant") {
      if (!body.plantId || typeof body.plantId !== "string") {
        return NextResponse.json({ ok: false, error: "Missing or invalid plantId." }, { status: 400 });
      }

      const success = await deletePlantById(body.plantId);
      return NextResponse.json({ ok: success });
      
    } else if (action === "delete-watering") {
      if (!body.wateringId || typeof body.wateringId !== "string") {
        return NextResponse.json({ ok: false, error: "Missing or invalid wateringId." }, { status: 400 });
      }
      if (!body.plantId || typeof body.plantId !== "string") {
        return NextResponse.json({ ok: false, error: "Missing or invalid plantId." }, { status: 400 });
      }

      const result = await deleteWateringLogById(body.wateringId, body.plantId);
      return NextResponse.json(result);

    } else if (action === "delete-climate") {
      if (!body.climateId || typeof body.climateId !== "string") {
        return NextResponse.json({ ok: false, error: "Missing or invalid climateId." }, { status: 400 });
      }
      if (!body.plantId || typeof body.plantId !== "string") {
        return NextResponse.json({ ok: false, error: "Missing or invalid plantId." }, { status: 400 });
      }

      const result = await deleteClimateLogById(body.climateId, body.plantId);
      return NextResponse.json(result);

    } else {
      return NextResponse.json({ ok: false, error: "Invalid action." }, { status: 400 });
    }
  } catch (error) {
    console.error("API DELETE /plants failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to delete record." },
      { status: 500 }
    );
  }
}
