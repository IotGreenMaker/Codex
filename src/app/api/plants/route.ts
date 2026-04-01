import { NextRequest, NextResponse } from "next/server";
import { readPlantsState, writePlantsState, deletePlantById, deleteWateringLogById, deleteClimateLogById } from "@/lib/plants-store";
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
  const state = await readPlantsState();
  return NextResponse.json({ ok: true, ...state });
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as Body;
    if (!Array.isArray(body.plants) || typeof body.activePlantId !== "string") {
      return NextResponse.json({ ok: false, error: "Invalid plants payload." }, { status: 400 });
    }

    await writePlantsState({
      plants: body.plants,
      activePlantId: body.activePlantId
    });
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
      const success = await deleteWateringLogById(body.wateringId, body.plantId);
      return NextResponse.json({ ok: success });
    } else if (action === "delete-climate") {
      if (!body.climateId || typeof body.climateId !== "string") {
        return NextResponse.json({ ok: false, error: "Missing or invalid climateId." }, { status: 400 });
      }
      if (!body.plantId || typeof body.plantId !== "string") {
        return NextResponse.json({ ok: false, error: "Missing or invalid plantId." }, { status: 400 });
      }
      const success = await deleteClimateLogById(body.climateId, body.plantId);
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
