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

export type CannaPeriod = {
  key: string;
  label: string;
  ecTotal: number;
  baseA?: number;
  baseB?: number;
  vega?: boolean;
  flores?: boolean;
  rhizotonic?: number | [number, number];
  cannazym?: number | [number, number];
  pk1314?: number;
  cannaboost?: number | [number, number];
};

export const CANNA_AQUA_PERIODS: CannaPeriod[] = [
  { key: "rooting", label: "Start / rooting (3-5 days)", ecTotal: 1.1, baseA: 1.8, baseB: 1.8, vega: true, rhizotonic: 4 },
  { key: "veg_phase_1", label: "Vegetative phase I (0-3 weeks)", ecTotal: 1.3, baseA: 2.2, baseB: 2.2, vega: true, rhizotonic: 2, cannazym: 2.5 },
  { key: "veg_phase_2", label: "Vegetative phase II (2-4 weeks)", ecTotal: 1.6, baseA: 2.8, baseB: 2.8, vega: true, rhizotonic: 2, cannazym: 2.5, cannaboost: [2, 4] },
  { key: "gen_1", label: "Generative period I (2-3 weeks)", ecTotal: 1.8, baseA: 3.4, baseB: 3.4, flores: true, rhizotonic: 0.5, cannazym: 2.5, cannaboost: [2, 4] },
  { key: "gen_2", label: "Generative period II (1 week)", ecTotal: 2.0, baseA: 3.5, baseB: 3.5, flores: true, rhizotonic: 0.5, cannazym: 2.5, pk1314: 1.5, cannaboost: [2, 4] },
  { key: "gen_3", label: "Generative period III (2-3 weeks)", ecTotal: 1.4, baseA: 2.5, baseB: 2.5, flores: true, rhizotonic: 0.5, cannazym: 2.5, cannaboost: [2, 4] },
  { key: "gen_4", label: "Generative period IV (1-2 weeks)", ecTotal: 0.2, flores: true, cannazym: [2.5, 5], cannaboost: [2, 4] }
];

export function getNutrientPeriodKey({
  stage,
  seedlingDays,
  vegDays,
  bloomDays,
  seedlingTarget,
  vegTarget,
  bloomTarget
}: {
  stage: GrowStage;
  seedlingDays: number;
  vegDays: number;
  bloomDays: number;
  seedlingTarget: number;
  vegTarget: number;
  bloomTarget: number;
}) {
  if (stage === "Seedling") {
    const pct = seedlingDays / (seedlingTarget || 1);
    return pct < 0.1 ? "rooting" : "veg_phase_1";
  }
  if (stage === "Veg") {
    const pct = vegDays / (vegTarget || 1);
    return pct < 0.5 ? "veg_phase_1" : "veg_phase_2";
  }
  if (stage === "Bloom") {
    const pct = bloomDays / (bloomTarget || 1);
    if (pct < 0.3) return "gen_1";
    if (pct < 0.5) return "gen_2";
    if (pct < 0.8) return "gen_3";
    return "gen_4";
  }
  return "veg_phase_2";
}

export function getRecipeSnapshotData({
  periodKey,
  liters,
  targetEc
}: {
  periodKey: string;
  liters: number;
  targetEc: number;
}) {
  const period = CANNA_AQUA_PERIODS.find((p) => p.key === periodKey) ?? CANNA_AQUA_PERIODS[0];
  const scale = period.ecTotal > 0 ? targetEc / period.ecTotal : 1;

  const calcMl = (mlPerL?: number) => (typeof mlPerL === "number" ? Math.max(0, mlPerL * liters * scale) : null);
  const calcRange = (range?: [number, number]) =>
    range ? ([range[0] * liters * scale, range[1] * liters * scale] as [number, number]) : null;

  const items: Array<{ label: string; value: string }> = [];
  
  const baseA = calcMl(period.baseA);
  const baseB = calcMl(period.baseB);
  if (baseA !== null && baseB !== null) {
    items.push({ label: "Aqua Base A", value: `${baseA.toFixed(1)} ml` });
    items.push({ label: "Aqua Base B", value: `${baseB.toFixed(1)} ml` });
  }

  const rhizo = Array.isArray(period.rhizotonic) ? calcRange(period.rhizotonic) : null;
  const rhizoSingle = !Array.isArray(period.rhizotonic) ? calcMl(period.rhizotonic) : null;
  if (rhizoSingle !== null) items.push({ label: "Rhizotonic", value: `${rhizoSingle.toFixed(1)} ml` });
  if (rhizo) items.push({ label: "Rhizotonic", value: `${rhizo[0].toFixed(1)}–${rhizo[1].toFixed(1)} ml` });

  const zym = Array.isArray(period.cannazym) ? calcRange(period.cannazym) : null;
  const zymSingle = !Array.isArray(period.cannazym) ? calcMl(period.cannazym) : null;
  if (zymSingle !== null) items.push({ label: "Cannazym", value: `${zymSingle.toFixed(1)} ml` });
  if (zym) items.push({ label: "Cannazym", value: `${zym[0].toFixed(1)}–${zym[1].toFixed(1)} ml` });

  const pk = calcMl(period.pk1314);
  if (pk !== null) items.push({ label: "PK 13/14", value: `${pk.toFixed(1)} ml` });

  const boost = Array.isArray(period.cannaboost) ? calcRange(period.cannaboost) : null;
  const boostSingle = !Array.isArray(period.cannaboost) ? calcMl(period.cannaboost) : null;
  if (boostSingle !== null) items.push({ label: "Cannaboost", value: `${boostSingle.toFixed(1)} ml` });
  if (boost) items.push({ label: "Cannaboost", value: `${boost[0].toFixed(1)}–${boost[1].toFixed(1)} ml` });

  return items;
}

export function formatNutrientValue(value: number, unit: "EC" | "PPM", hannaScale: number = 700) {
  if (unit === "EC") {
    return value.toFixed(3);
  }
  return Math.round(value * hannaScale).toString();
}
