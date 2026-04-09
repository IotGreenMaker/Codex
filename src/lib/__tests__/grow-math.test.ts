/**
 * Unit tests for grow-math.ts
 * Run with: npx jest or npm test (after installing jest)
 * 
 * Note: This project doesn't have a test runner installed yet.
 * To run these tests, first install jest:
 *   npm install --save-dev jest @types/jest ts-jest
 * Then add jest.config.js and run: npm test
 */

import { calculateVpd, getVpdBand, getDaysSinceStart, getCycleSummary, getDetailedCycleSummary, calculateNutrientPlan } from "../grow-math";
import type { PlantProfile } from "../types";

// Helper to create a mock plant
function createMockPlant(overrides: Partial<PlantProfile> = {}): PlantProfile {
  const now = new Date().toISOString();
  return {
    id: "test-plant-1",
    strainName: "Test Plant",
    startedAt: now,
    stage: "Seedling",
    vegStartedAt: undefined,
    bloomStartedAt: undefined,
    lightSchedule: "18/6",
    lightsOn: "06:00",
    lightsOff: "00:00",
    containerVolumeL: 15,
    mediaVolumeL: 13,
    mediaType: "Soil",
    outsideTempC: 20,
    outsideHumidity: 50,
    growTempC: 25,
    growHumidity: 60,
    waterInputMl: 500,
    waterPh: 6.0,
    waterEc: 1.0,
    lastWateredAt: now,
    wateringIntervalDays: 2,
    stageDays: { seedling: 1, veg: 0, bloom: 0 },
    wateringData: [],
    climateData: [],
    feedRecipe: {
      title: "Test Recipe",
      baseAMl: 24,
      baseBMl: 21,
      calMagMl: 6,
      targetEc: 1.45,
      targetPhLow: 5.8,
      targetPhHigh: 6.1,
      additives: []
    },
    ...overrides
  };
}

describe("calculateVpd", () => {
  test("calculates VPD correctly for standard conditions", () => {
    // At 25C and 60% humidity, VPD should be around 1.27 kPa
    const vpd = calculateVpd(25, 60);
    expect(vpd).toBeCloseTo(1.27, 1);
  });

  test("returns 0 when humidity is 100%", () => {
    const vpd = calculateVpd(25, 100);
    expect(vpd).toBe(0);
  });

  test("returns higher VPD for lower humidity", () => {
    const vpdLow = calculateVpd(25, 30);
    const vpdHigh = calculateVpd(25, 80);
    expect(vpdLow).toBeGreaterThan(vpdHigh);
  });

  test("returns higher VPD for higher temperature", () => {
    const vpdCold = calculateVpd(15, 50);
    const vpdHot = calculateVpd(30, 50);
    expect(vpdHot).toBeGreaterThan(vpdCold);
  });
});

describe("getVpdBand", () => {
  test("returns OK for VPD in seedling range", () => {
    const result = getVpdBand("Seedling", 0.6);
    expect(result.label).toBe("OK");
    expect(result.tone).toBe("text-green-500");
  });

  test("returns Low for VPD below seedling range", () => {
    const result = getVpdBand("Seedling", 0.2);
    expect(result.label).toBe("Low");
    expect(result.tone).toBe("text-amber-500");
  });

  test("returns High for VPD above seedling range", () => {
    const result = getVpdBand("Seedling", 1.0);
    expect(result.label).toBe("High");
    expect(result.tone).toBe("text-red-500");
  });

  test("returns OK for VPD in veg range", () => {
    const result = getVpdBand("Veg", 1.0);
    expect(result.label).toBe("OK");
  });

  test("returns OK for VPD in bloom range", () => {
    const result = getVpdBand("Bloom", 1.3);
    expect(result.label).toBe("OK");
  });
});

describe("getDaysSinceStart", () => {
  test("returns 0 for today", () => {
    const today = new Date().toISOString();
    const days = getDaysSinceStart(today);
    expect(days).toBe(0);
  });

  test("returns correct days for past date", () => {
    const pastDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const days = getDaysSinceStart(pastDate);
    expect(days).toBe(10);
  });

  test("returns 0 for future date", () => {
    const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const days = getDaysSinceStart(futureDate);
    expect(days).toBe(0);
  });
});

describe("getCycleSummary", () => {
  test("returns correct summary for seedling", () => {
    const plant = createMockPlant({ stage: "Seedling" });
    const summary = getCycleSummary(plant);
    expect(summary.totalDays).toBe(0);
    expect(summary.daysInStage).toBe(0);
  });

  test("returns correct daysInStage for veg", () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const plant = createMockPlant({
      stage: "Veg",
      vegStartedAt: tenDaysAgo
    });
    const summary = getCycleSummary(plant);
    expect(summary.daysInStage).toBe(10);
  });

  test("returns correct daysInStage for bloom", () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const plant = createMockPlant({
      stage: "Bloom",
      vegStartedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      bloomStartedAt: fiveDaysAgo
    });
    const summary = getCycleSummary(plant);
    expect(summary.daysInStage).toBe(5);
  });
});

describe("getDetailedCycleSummary", () => {
  test("returns all zeros for new seedling", () => {
    const plant = createMockPlant({ stage: "Seedling" });
    const summary = getDetailedCycleSummary(plant);
    expect(summary.daysInSeedling).toBe(0);
    expect(summary.daysInVeg).toBe(0);
    expect(summary.daysInBloom).toBe(0);
    expect(summary.stage).toBe("Seedling");
  });

  test("returns correct days for multi-stage plant", () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    
    const plant = createMockPlant({
      stage: "Bloom",
      startedAt: thirtyDaysAgo,
      vegStartedAt: twentyDaysAgo,
      bloomStartedAt: fiveDaysAgo
    });
    const summary = getDetailedCycleSummary(plant);
    
    expect(summary.daysInSeedling).toBe(10); // 30 - 20
    expect(summary.daysInVeg).toBe(15); // 20 - 5
    expect(summary.daysInBloom).toBe(5);
    expect(summary.totalDays).toBe(30);
  });
});

describe("calculateNutrientPlan", () => {
  test("calculates veg nutrient plan correctly", () => {
    const plan = calculateNutrientPlan("Veg", 10);
    expect(plan.stage).toBe("Veg");
    expect(plan.liters).toBe(10);
    expect(plan.baseAMl).toBe(24); // 2.4 * 10
    expect(plan.baseBMl).toBe(21); // 2.1 * 10
    expect(plan.calMagMl).toBe(6); // 0.6 * 10
    expect(plan.targetEc).toBe(1.45);
    expect(plan.targetPh).toEqual([5.8, 6.1]);
  });

  test("calculates bloom nutrient plan correctly", () => {
    const plan = calculateNutrientPlan("Bloom", 10);
    expect(plan.stage).toBe("Bloom");
    expect(plan.liters).toBe(10);
    expect(plan.baseAMl).toBe(16); // 1.6 * 10
    expect(plan.baseBMl).toBe(28); // 2.8 * 10
    expect(plan.calMagMl).toBe(4); // 0.4 * 10
    expect(plan.targetEc).toBe(1.85);
    expect(plan.targetPh).toEqual([5.9, 6.2]);
  });

  test("scales correctly with different volumes", () => {
    const plan5L = calculateNutrientPlan("Veg", 5);
    const plan20L = calculateNutrientPlan("Veg", 20);
    
    expect(plan20L.baseAMl).toBe(plan5L.baseAMl * 4);
    expect(plan20L.baseBMl).toBe(plan5L.baseBMl * 4);
  });
});

// Export for test runner
export { createMockPlant };