import { NextRequest, NextResponse } from "next/server";
import {
  deleteClimateLogById,
  deletePlantById,
  deleteWateringLogById,
  readPlantsState,
  updatePlantsState
} from "@/lib/plants-store";
import type { PlantProfile, SpaceConfig, GrowStage, WateringEntry, ClimateEntry, NoteEntry, FeedRecipe } from "@/lib/types";

type Body = {
  plants?: PlantProfile[];
  activePlantId?: string;
  spaces?: SpaceConfig[];
  activeSpaceId?: string;
  plantId: string;
  wateringId?: string;
  climateId?: string;
  action?: "delete-plant" | "delete-watering" | "delete-climate";
  id?: string;
  lightsOn?: string;
  lightsOff?: string;
  strainName?: string;
  startedAt?: string;
  stage?: GrowStage;
  seedlingStartedAt?: string;
  vegStartedAt?: string;
  bloomStartedAt?: string;
  lightSchedule?: string;
  lightType?: string;
  lightDimmerPercent?: number;
  lightLampName?: string;
  lightLampWatts?: number;
  lights?: any[];
  activeLightId?: string;
  totalDaysOverride?: number;
  containerVolumeL?: number;
  mediaVolumeL?: number;
  mediaType?: string;
  outsideTempC?: number;
  outsideHumidity?: number;
  growTempC?: number;
  growHumidity?: number;
  waterInputMl?: number;
  waterPh?: number;
  waterEc?: number;
  lastWateredAt?: string;
  wateringIntervalDays?: number;
  stageDays?: { seedling: number; veg: number; bloom: number };
  wateringData?: WateringEntry[];
  climateData?: ClimateEntry[];
  notes?: NoteEntry[];
  feedRecipe?: FeedRecipe;
};

export async function GET() {
  try {
    const state = await readPlantsState();
    const { plants, activePlantId } = state;
    
    return NextResponse.json({ 
      ok: true, 
      plants, 
      activePlantId,
      spaces: state.spaces,
      activeSpaceId: state.activeSpaceId,
      savedAt: state.savedAt
    });
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
    
    if (!body.plants && !body.plantId) {
      return NextResponse.json(
        { ok: false, error: "Missing plants array or plantId." },
        { status: 400 }
      );
    }

    let plants: PlantProfile[] = [];
    let activePlantId: string = body.activePlantId || '';

    if (Array.isArray(body.plants)) {
      if (!body.plants.length) {
        return NextResponse.json(
          { ok: false, error: "Empty plants array." },
          { status: 400 }
        );
      }

      for (const plant of body.plants) {
        if (!plant.id || !plant.strainName) {
          return NextResponse.json(
            { ok: false, error: "Each plant must have id and strainName." },
            { status: 400 }
          );
        }
      }
      
      plants = body.plants;
      
      if (!activePlantId) {
        activePlantId = body.activePlantId || plants[0]?.id || '';
      }
    } else if (body.plantId && typeof body.plantId === "string") {
      const newPlant: PlantProfile & Partial<PlantProfile> = {
        id: body.plantId as string,
        strainName: body.strainName || "",
        startedAt: body.startedAt || "",
        stage: (body.stage as GrowStage) || "Veg",
        lightSchedule: body.lightSchedule || "12/12",
        lightsOn: body.lightsOn || "08:00",
        lightsOff: body.lightsOff || "20:00",
        containerVolumeL: body.containerVolumeL || 5,
        mediaVolumeL: body.mediaVolumeL || 5,
        mediaType: body.mediaType || "soil",
        outsideTempC: body.outsideTempC || 25,
        outsideHumidity: body.outsideHumidity || 60,
        growTempC: body.growTempC || 25,
        growHumidity: body.growHumidity || 60,
        waterInputMl: body.waterInputMl || 0,
        waterPh: body.waterPh || 6.0,
        waterEc: body.waterEc || 1.2,
        lastWateredAt: body.lastWateredAt || new Date().toISOString(),
        wateringIntervalDays: body.wateringIntervalDays || 7,
        stageDays: body.stageDays || { seedling: 7, veg: 30, bloom: 60 },
        wateringData: body.wateringData || [],
        climateData: body.climateData || [],
        notes: body.notes || [],
        feedRecipe: (body.feedRecipe as any) || { title: "Default", baseAMl: 0, baseBMl: 0, calMagMl: 0, targetEc: 0, targetPhLow: 0, targetPhHigh: 0, additives: [] },
        lightType: body.lightType,
        lightDimmerPercent: body.lightDimmerPercent,
        lightLampName: body.lightLampName,
        lightLampWatts: body.lightLampWatts,
        activeLightId: body.activeLightId,
        totalDaysOverride: body.totalDaysOverride,
        seedlingStartedAt: body.seedlingStartedAt,
        vegStartedAt: body.vegStartedAt,
        bloomStartedAt: body.bloomStartedAt,
        lights: body.lights
      };
      
      plants = [newPlant] as PlantProfile[];
    } else if (body.action === "delete-plant") {
      if (!body.plantId || typeof body.plantId !== "string") {
        return NextResponse.json(
          { ok: false, error: "Missing or invalid plantId for delete." },
          { status: 400 }
        );
      }

      if (body.plants && Array.isArray(body.plants)) {
        plants = (body.plants as PlantProfile[]).filter(p => p.id !== body.plantId);
      } else {
        return NextResponse.json(
          { ok: false, error: "Cannot delete plant without providing plants array." },
          { status: 400 }
        );
      }

      if (body.plantId === activePlantId) {
        activePlantId = '';
      }
    } else {
      return NextResponse.json(
        { ok: false, error: "Invalid request format. Use plants array or plantId." },
        { status: 400 }
      );
    }

    const result = await updatePlantsState((currentState) => ({
      ...currentState,
      plants,
      activePlantId,
      spaces: Array.isArray(body.spaces) ? body.spaces : currentState.spaces,
      activeSpaceId: body.activeSpaceId || currentState.activeSpaceId
    }));

    return NextResponse.json({ 
      ok: result,
      message: "Plants persisted successfully" 
    }, { status: result ? 200 : 500 });
  } catch (error) {
    console.error("API PUT /plants failed:", error);
    return NextResponse.json(
      { 
        ok: false, 
        error: error instanceof Error ? error.message : "Failed to persist plants." 
      },
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
      { 
        ok: false, 
        error: error instanceof Error ? error.message : "Failed to delete record." 
      },
      { status: 500 }
    );
  }
}