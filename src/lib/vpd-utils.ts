import type { GrowStage } from "@/lib/types";

export type VPDStatus = "optimal" | "low" | "high" | "out-of-range";

export interface VPDInfo {
  status: VPDStatus;
  color: string;
  bgColor: string;
  label: string;
  recommendation: string;
  optimal: [number, number];
}

const VPD_RANGES: Record<GrowStage, [number, number]> = {
  Seedling: [0.4, 0.8],
  Veg: [0.8, 1.2],
  Bloom: [1.2, 1.5],
  Dry: [0.9, 1.2],
  Cure: [0.6, 1.0]
};

export function getVPDStatus(vpd: number, stage: GrowStage): VPDInfo {
  const [min, max] = VPD_RANGES[stage];

  if (vpd < min) {
    return {
      status: "low",
      color: "text-blue-300",
      bgColor: "bg-blue-300/15",
      label: "VPD Low",
      recommendation: "Increase humidity or lower temperature to increase VPD",
      optimal: [min, max]
    };
  }

  if (vpd > max) {
    return {
      status: "high",
      color: "text-red-300",
      bgColor: "bg-red-300/15",
      label: "VPD High",
      recommendation: "Increase airflow or lower humidity to decrease VPD",
      optimal: [min, max]
    };
  }

  return {
    status: "optimal",
    color: "text-lime-300",
    bgColor: "bg-lime-300/15",
    label: "VPD Optimal",
    recommendation: "Conditions are optimal for plant growth",
    optimal: [min, max]
  };
}

export function getVPDRanges(): Record<GrowStage, [number, number]> {
  return VPD_RANGES;
}

export function getRecommendation(vpd: number, stage: GrowStage): string {
  const info = getVPDStatus(vpd, stage);
  return info.recommendation;
}

export function getStatusColor(status: VPDStatus): string {
  const colors: Record<VPDStatus, string> = {
    optimal: "bg-lime-300/20",
    low: "bg-blue-300/20",
    high: "bg-red-300/20",
    "out-of-range": "bg-purple-300/20"
  };
  return colors[status];
}

export function getStatusBorder(status: VPDStatus): string {
  const borders: Record<VPDStatus, string> = {
    optimal: "border-lime-300/50",
    low: "border-blue-300/50",
    high: "border-red-300/50",
    "out-of-range": "border-purple-300/50"
  };
  return borders[status];
}
