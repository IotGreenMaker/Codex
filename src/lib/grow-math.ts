import type { GrowStage, NutrientMix, PlantProfile } from "@/lib/types";
import { VPD_TARGETS } from "@/lib/config";

/**
 * Calculate Vapor Pressure Deficit (VPD) using the Magnus formula
 * 
 * VPD is the difference between the amount of moisture in the air and how much
 * moisture the air can hold when saturated. It's a critical metric for plant growth.
 * 
 * Formula:
 * - SVP (Saturation Vapor Pressure) = 0.6108 * exp((17.27 * T) / (T + 237.3))
 * - VP (Actual Vapor Pressure) = SVP * (RH / 100)
 * - VPD = SVP - VP
 * 
 * Constants:
 * - 0.6108: Saturation vapor pressure at 0°C in kPa
 * - 17.27: Dimensionless coefficient for water vapor
 * - 237.3: Temperature offset in °C
 * 
 * @param tempC - Temperature in Celsius
 * @param humidity - Relative humidity as percentage (0-100)
 * @returns VPD in kPa (kilopascals)
 */
export function calculateVpd(tempC: number, humidity: number) {
  // Magnus formula for saturation vapor pressure
  const saturationVaporPressure = 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3));
  // Actual vapor pressure based on relative humidity
  const vaporPressure = saturationVaporPressure * (humidity / 100);
  // VPD = difference between saturated and actual
  return Number((saturationVaporPressure - vaporPressure).toFixed(2));
}

export function getVpdBand(stage: GrowStage, vpd: number) {
  const targets = VPD_TARGETS as Record<GrowStage, [number, number]>;
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
  // Always calculate from timestamps for consistency
  const now = new Date();
  const startedAt = new Date(plant.startedAt);
  const totalDays = Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / (1000 * 60 * 60 * 24)));

  // Calculate days in current stage from timestamps
  if (plant.stage === "Seedling" || !plant.vegStartedAt) {
    return { totalDays, daysInStage: totalDays };
  }

  if (plant.stage === "Veg") {
    const vegStarted = new Date(plant.vegStartedAt);
    const daysInVeg = Math.max(0, Math.floor((now.getTime() - vegStarted.getTime()) / (1000 * 60 * 60 * 24)));
    return { totalDays, daysInStage: daysInVeg };
  }

  if (plant.stage === "Bloom") {
    if (plant.bloomStartedAt) {
      const bloomStarted = new Date(plant.bloomStartedAt);
      const daysInBloom = Math.max(0, Math.floor((now.getTime() - bloomStarted.getTime()) / (1000 * 60 * 60 * 24)));
      return { totalDays, daysInStage: daysInBloom };
    }
  }

  return { totalDays, daysInStage: 0 };
}

export function getDetailedCycleSummary(plant: PlantProfile) {
  // Always calculate from timestamps for consistency
  const now = new Date();
  const startedAt = new Date(plant.startedAt);
  const totalDays = Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / (1000 * 60 * 60 * 24)));

  let seedlingDays = 0;
  let vegDays = 0;
  let bloomDays = 0;

  // Seedling: from startedAt to vegStartedAt (or now if veg never started)
  if (plant.vegStartedAt) {
    const vegStarted = new Date(plant.vegStartedAt);
    seedlingDays = Math.max(0, Math.floor((vegStarted.getTime() - startedAt.getTime()) / (1000 * 60 * 60 * 24)));
  } else {
    seedlingDays = totalDays;
  }

  // Veg: from vegStartedAt to bloomStartedAt (or now if bloom never started)
  if (plant.vegStartedAt) {
    const vegStarted = new Date(plant.vegStartedAt);
    if (plant.bloomStartedAt) {
      const bloomStarted = new Date(plant.bloomStartedAt);
      vegDays = Math.max(0, Math.floor((bloomStarted.getTime() - vegStarted.getTime()) / (1000 * 60 * 60 * 24)));
    } else {
      vegDays = Math.max(0, Math.floor((now.getTime() - vegStarted.getTime()) / (1000 * 60 * 60 * 24)));
    }
  }

  // Bloom: from bloomStartedAt to now
  if (plant.bloomStartedAt) {
    const bloomStarted = new Date(plant.bloomStartedAt);
    bloomDays = Math.max(0, Math.floor((now.getTime() - bloomStarted.getTime()) / (1000 * 60 * 60 * 24)));
  }

  return {
    totalDays: seedlingDays + vegDays + bloomDays,
    daysInVeg: vegDays,
    daysInBloom: bloomDays,
    daysInSeedling: seedlingDays,
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
