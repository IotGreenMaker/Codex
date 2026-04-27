/**
 * Application configuration constants
 */

// Stage duration targets in days (for progress bar visualization)
export const STAGE_TARGETS = {
  seedling: 21,
  veg: 50,
  bloom: 65,
} as const;

// VPD target ranges per stage (in kPa)
export const VPD_TARGETS: Record<string, [number, number]> = {
  Seedling: [0.4, 0.8],
  Veg: [0.8, 1.2],
  Bloom: [1.2, 1.5],
} as const;

// DLI (Daily Light Integral) targets per stage
export const DLI_TARGETS: Record<string, { low: number; high: number }> = {
  Seedling: { low: 12, high: 18 },
  Veg: { low: 25, high: 40 },
  Bloom: { low: 32, high: 45 },
} as const;

// Input validation ranges
export const VALIDATION_RANGES = {
  temperature: { min: -5, max: 50 },
  humidity: { min: 0, max: 100 },
  ph: { min: 0, max: 14 },
  ec: { min: 0, max: 5 },
  waterAmount: { min: 10, max: 50000 },
} as const;

// Water standards (for nutrinet solution concentration)
export const WATER_STANDARDS = {
  wStandardpH: 7.8,
  wStandardUnit: 238,
} as const;

// Weather refresh interval (5 minutes)
export const WEATHER_REFRESH_INTERVAL = 300_000;

// Debounce delay for saving to IndexedDB (ms)
export const SAVE_DEBOUNCE_DELAY = 1500;