/**
 * Input validation utilities
 */

import { VALIDATION_RANGES } from "@/lib/config";

/**
 * Validate a number is within a range
 */
export function validateRange(
  value: number,
  min: number,
  max: number,
  fieldName: string
): string | null {
  if (!Number.isFinite(value)) {
    return `${fieldName} must be a valid number`;
  }
  if (value < min || value > max) {
    return `${fieldName} must be between ${min} and ${max}`;
  }
  return null;
}

/**
 * Validate temperature
 */
export function validateTemperature(value: number): string | null {
  return validateRange(value, VALIDATION_RANGES.temperature.min, VALIDATION_RANGES.temperature.max, "Temperature");
}

/**
 * Validate humidity
 */
export function validateHumidity(value: number): string | null {
  return validateRange(value, VALIDATION_RANGES.humidity.min, VALIDATION_RANGES.humidity.max, "Humidity");
}

/**
 * Validate pH
 */
export function validatePh(value: number): string | null {
  return validateRange(value, VALIDATION_RANGES.ph.min, VALIDATION_RANGES.ph.max, "pH");
}

/**
 * Validate EC
 */
export function validateEc(value: number): string | null {
  return validateRange(value, VALIDATION_RANGES.ec.min, VALIDATION_RANGES.ec.max, "EC");
}

/**
 * Validate water amount
 */
export function validateWaterAmount(value: number): string | null {
  return validateRange(value, VALIDATION_RANGES.waterAmount.min, VALIDATION_RANGES.waterAmount.max, "Water amount");
}

/**
 * Clamp a number to a range
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Sanitize temperature (clamp to valid range)
 */
export function sanitizeTemperature(value: number): number {
  return clamp(value, VALIDATION_RANGES.temperature.min, VALIDATION_RANGES.temperature.max);
}

/**
 * Sanitize humidity (clamp to valid range)
 */
export function sanitizeHumidity(value: number): number {
  return clamp(value, VALIDATION_RANGES.humidity.min, VALIDATION_RANGES.humidity.max);
}

/**
 * Sanitize pH (clamp to valid range)
 */
export function sanitizePh(value: number): number {
  return clamp(value, VALIDATION_RANGES.ph.min, VALIDATION_RANGES.ph.max);
}

/**
 * Sanitize EC (clamp to valid range)
 */
export function sanitizeEc(value: number): number {
  return clamp(value, VALIDATION_RANGES.ec.min, VALIDATION_RANGES.ec.max);
}