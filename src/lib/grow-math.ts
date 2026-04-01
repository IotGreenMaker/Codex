import type { GrowStage, NutrientMix, PlantProfile } from "@/lib/types";

export function calculateVpd(tempC: number, humidity: number) {
  const saturationVaporPressure = 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3));
  const vaporPressure = saturationVaporPressure * (humidity / 100);
  return Number((saturationVaporPressure - vaporPressure).toFixed(2));
}

export function getVpdBand(stage: GrowStage, vpd: number) {
  const targets: Record<GrowStage, [number, number]> = {
    Seedling: [0.4, 0.8],
    Veg: [0.8, 1.2],
    Bloom: [1.2, 1.5],
    Dry: [0.9, 1.2],
    Cure: [0.6, 1]
  };

  const [min, max] = targets[stage];

  if (vpd < min) {
    return { label: "Low", tone: "text-amber-500", range: `${min}-${max} kPa` };
  }

  if (vpd > max) {
    return { label: "High", tone: "text-red-500", range: `${min}-${max} kPa` };
  }

  return { label: "OK", tone: "text-green-500", range: `${min}-${max} kPa` };
}

export function getDaysSinceStart(startedAt: string) {
  const start = new Date(startedAt);
  const today = new Date();
  const diffMs = today.getTime() - start.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export function getCycleSummary(plant: PlantProfile) {
  if (plant.stageDays) {
    const totalDays = Math.max(0, plant.stageDays.seedling) + Math.max(0, plant.stageDays.veg) + Math.max(0, plant.stageDays.bloom);
    const stageMap = {
      Seedling: Math.max(0, plant.stageDays.seedling),
      Veg: Math.max(0, plant.stageDays.veg),
      Bloom: Math.max(0, plant.stageDays.bloom),
      Dry: 0,
      Cure: 0
    } as const;
    return {
      totalDays,
      daysInStage: stageMap[plant.stage]
    };
  }

  const totalDays = typeof plant.totalDaysOverride === "number" ? Math.max(0, Math.floor(plant.totalDaysOverride)) : getDaysSinceStart(plant.startedAt);
  const stageThresholds: Record<GrowStage, number> = {
    Seedling: 14,
    Veg: 42,
    Bloom: 63,
    Dry: 14,
    Cure: 21
  };

  const daysInStage = Math.min(totalDays, stageThresholds[plant.stage]);

  return {
    totalDays,
    daysInStage
  };
}

export function getDetailedCycleSummary(plant: PlantProfile) {
  if (plant.stageDays) {
    const daysInSeedling = Math.max(0, plant.stageDays.seedling);
    const daysInVeg = Math.max(0, plant.stageDays.veg);
    const daysInBloom = Math.max(0, plant.stageDays.bloom);

    return {
      totalDays: daysInSeedling + daysInVeg + daysInBloom,
      daysInVeg,
      daysInBloom,
      daysInSeedling,
      stage: plant.stage
    };
  }

  const totalDays = typeof plant.totalDaysOverride === "number" ? Math.max(0, Math.floor(plant.totalDaysOverride)) : getDaysSinceStart(plant.startedAt);
  const bloomStart = plant.bloomStartedAt ? new Date(plant.bloomStartedAt) : null;
  const start = new Date(plant.startedAt);
  const now = new Date();

  let daysInBloom = 0;
  let daysInVeg = 0;

  if (bloomStart && !Number.isNaN(bloomStart.getTime())) {
    daysInBloom = Math.max(0, Math.floor((now.getTime() - bloomStart.getTime()) / (1000 * 60 * 60 * 24)));
    daysInVeg = Math.max(0, Math.floor((bloomStart.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  } else if (plant.stage === "Bloom") {
    daysInBloom = totalDays;
  } else {
    daysInVeg = totalDays;
  }

  return {
    totalDays,
    daysInVeg,
    daysInBloom,
    stage: plant.stage
  };
}

export function calculateNutrientPlan(stage: Extract<GrowStage, "Veg" | "Bloom">, liters: number): NutrientMix {
  const profiles = {
    Veg: { baseA: 2.4, baseB: 2.1, calMag: 0.6, additive: 0.5, targetEc: 1.45, targetPh: [5.8, 6.1] as [number, number] },
    Bloom: { baseA: 1.6, baseB: 2.8, calMag: 0.4, additive: 1.1, targetEc: 1.85, targetPh: [5.9, 6.2] as [number, number] }
  };

  const selected = profiles[stage];

  return {
    stage,
    liters,
    baseAMl: Number((selected.baseA * liters).toFixed(1)),
    baseBMl: Number((selected.baseB * liters).toFixed(1)),
    calMagMl: Number((selected.calMag * liters).toFixed(1)),
    additiveMl: Number((selected.additive * liters).toFixed(1)),
    targetEc: selected.targetEc,
    targetPh: selected.targetPh
  };
}
