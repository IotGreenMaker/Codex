import { NextRequest, NextResponse } from "next/server";
import { readPlantsState, writePlantsState } from "@/lib/plants-store";
import type { PlantProfile } from "@/lib/types";

type Body = {
  plants?: PlantProfile[];
  activePlantId?: string;
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
