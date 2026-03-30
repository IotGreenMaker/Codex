"use client";

import { useState } from "react";
import { ChevronDown, Leaf, Flower2 } from "lucide-react";
import type { GrowStage } from "@/lib/types";
import { getVPDStatus, getVPDRanges } from "@/lib/vpd-utils";
import { calculateVpd } from "@/lib/grow-math";

type VPDChartProps = {
  currentVpd: number;
  currentTemp: number;
  currentHumidity: number;
  currentStage: GrowStage;
  onStageChange?: (stage: GrowStage) => void;
};

export function VPDChart({
  currentVpd,
  currentTemp,
  currentHumidity,
  currentStage,
  onStageChange
}: VPDChartProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [displayStage, setDisplayStage] = useState<"Veg" | "Bloom">(currentStage === "Bloom" ? "Bloom" : "Veg");

  const vpdRanges = getVPDRanges();
  const vegRange = vpdRanges["Veg"];
  const bloomRange = vpdRanges["Bloom"];
  const currentInfo = getVPDStatus(currentVpd, currentStage);

  const handleStageToggle = (stage: "Veg" | "Bloom") => {
    setDisplayStage(stage);
    onStageChange?.(stage === "Bloom" ? "Bloom" : "Veg");
  };

  // Temperature and humidity ranges for the chart
  const tempRange = { min: 10, max: 43 };
  const humidityRange = { min: 0, max: 100 };

  // Generate grid data
  const generateGridData = () => {
    const data: Array<{ temp: number; humidity: number; vpd: number }> = [];
    for (let temp = tempRange.min; temp <= tempRange.max; temp += 2) {
      for (let humidity = humidityRange.min; humidity <= humidityRange.max; humidity += 5) {
        const vpd = calculateVpd(temp, humidity);
        data.push({ temp, humidity, vpd });
      }
    }
    return data;
  };

  const gridData = generateGridData();

  const isInOptimalRange = (vpd: number, stage: "Veg" | "Bloom") => {
    const range = stage === "Veg" ? vegRange : bloomRange;
    return vpd >= range[0] && vpd <= range[1];
  };

  const getCellColor = (vpd: number, stage: "Veg" | "Bloom") => {
    if (isInOptimalRange(vpd, stage)) {
      return "bg-lime-400/40 border-white/80";
    }
    return "bg-purple-400/30 border-purple-300/40";
  };

  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 p-5">
      {/* Header with toggle */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-lime-300/70">VPD Chart</p>
          <p className="mt-1 text-[11px] text-lime-100/65">Temperature vs Humidity optimal ranges</p>
        </div>
        <div className={`transition-transform ${isVisible ? "rotate-180" : ""}`}>
          <ChevronDown className="h-5 w-5 text-lime-300/70" />
        </div>
      </button>

      {/* Chart Content */}
      {isVisible && (
        <div className="mt-6 space-y-6">
          {/* Stage Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => handleStageToggle("Veg")}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 transition ${
                displayStage === "Veg"
                  ? "bg-lime-300/25 text-lime-200"
                  : "bg-lime-300/10 text-lime-100/60 hover:bg-lime-300/15"
              }`}
            >
              <Leaf className="h-4 w-4" />
              <span className="text-sm font-semibold">Vegetative ({vegRange[0]}-{vegRange[1]} kPa)</span>
            </button>
            <button
              onClick={() => handleStageToggle("Bloom")}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 transition ${
                displayStage === "Bloom"
                  ? "bg-fuchsia-300/25 text-fuchsia-200"
                  : "bg-fuchsia-300/10 text-fuchsia-100/60 hover:bg-fuchsia-300/15"
              }`}
            >
              <Flower2 className="h-4 w-4" />
              <span className="text-sm font-semibold">Bloom ({bloomRange[0]}-{bloomRange[1]} kPa)</span>
            </button>
          </div>

          {/* Chart Grid */}
          <div className="overflow-x-auto">
            <div className="min-w-full border border-white/80 rounded-lg bg-slate-900/30 p-4">
              {/* Title */}
              <p className="mb-4 text-center text-xs font-semibold text-lime-200">
                Current: {currentTemp}°C, {currentHumidity}% RH = {currentVpd} kPa
              </p>

              {/* Legend */}
              <div className="mb-4 flex gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-lime-400/40" />
                  <span className="text-lime-300">Optimal Range</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-purple-400/30" />
                  <span className="text-purple-300">Out of Range</span>
                </div>
              </div>

              {/* Grid Layout - Temperature rows */}
              <div className="space-y-2">
                {/* Humidity Header */}
                <div className="flex gap-1">
                  <div className="w-12 flex-shrink-0" />
                  {Array.from({ length: 21 }, (_, i) => humidityRange.min + i * 5).map((humidity) => (
                    <div
                      key={`h-${humidity}`}
                      className="h-8 w-8 flex-shrink-0 flex items-center justify-center text-[9px] text-white font-semibold"
                    >
                      {humidity}
                    </div>
                  ))}
                </div>

                {/* Temperature rows */}
                {Array.from({ length: 17 }, (_, i) => tempRange.min + i * 2).map((temp) => (
                  <div key={`t-${temp}`} className="flex gap-1">
                    <div className="w-12 flex-shrink-0 flex items-center justify-center text-[9px] text-white font-semibold">
                      {temp}°C
                    </div>
                    {Array.from({ length: 21 }, (_, i) => humidityRange.min + i * 5).map((humidity) => {
                      const cellVpd = calculateVpd(temp, humidity);
                      const isCurrentPoint =
                        Math.abs(temp - currentTemp) < 2 && Math.abs(humidity - currentHumidity) < 5;
                      const stageToCheck = displayStage;
                      const inRange = isInOptimalRange(cellVpd, stageToCheck);

                      return (
                        <div
                          key={`${temp}-${humidity}`}
                          className={`h-8 w-8 flex-shrink-0 flex items-center justify-center text-[8px] rounded border transition ${
                            isCurrentPoint
                              ? "ring-2 ring-red-400 ring-offset-1 ring-offset-slate-900"
                              : ""
                          } ${getCellColor(cellVpd, stageToCheck)}`}
                          title={`${temp}°C, ${humidity}% RH: ${cellVpd.toFixed(2)} kPa`}
                        >
                          <span className={`font-semibold ${inRange ? "text-green-500" : "text-white"}`}>
                            {cellVpd.toFixed(1)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Current Status */}
          <div
            className={`rounded-lg border ${currentInfo.bgColor} border-l-4 p-4 ${
              currentInfo.status === "optimal"
                ? "border-green-300"
                : currentInfo.status === "low"
                  ? "border-blue-300"
                  : "border-red-300"
            }`}
          >
            <div className="flex items-center gap-2">
              <div
                className={`h-3 w-3 rounded-full ${
                  currentInfo.status === "optimal"
                    ? "bg-green-300"
                    : currentInfo.status === "low"
                      ? "bg-blue-300"
                      : "bg-red-300"
                }`}
              />
              <span className={`text-sm font-semibold ${currentInfo.color}`}>{currentInfo.label}</span>
            </div>
            <p className="mt-2 text-sm text-slate-300">{currentInfo.recommendation}</p>
          </div>
        </div>
      )}
    </div>
  );
}
