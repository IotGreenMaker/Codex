"use client";

import { useState, useMemo } from "react";
import { Leaf, Flower2, X } from "lucide-react";
import type { GrowStage } from "@/lib/types";
import { getVPDStatus, getVPDRanges } from "@/lib/vpd-utils";
import { calculateVpd } from "@/lib/grow-math";

type VPDChartProps = {
  currentVpd: number;
  currentTemp: number;
  currentHumidity: number;
  currentStage: GrowStage;
  isOpen: boolean;
  onClose: () => void;
  onStageChange?: (stage: GrowStage) => void;
};

export function VPDChart({
  currentVpd,
  currentTemp,
  currentHumidity,
  currentStage,
  isOpen,
  onClose,
  onStageChange
}: VPDChartProps) {
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
  const tempRange = { min: 10, max: 40 };
  const humidityRange = { min: 10, max: 90 };
  
  // Grid resolution
  const tempStep = 1;
  const humidityStep = 2;
  
  const tempCount = Math.floor((tempRange.max - tempRange.min) / tempStep) + 1;
  const humidityCount = Math.floor((humidityRange.max - humidityRange.min) / humidityStep) + 1;

  const getGradientColor = (vpd: number, stage: "Veg" | "Bloom"): string => {
    const range = stage === "Veg" ? vegRange : bloomRange;
    const min = range[0] - 0.4;
    const max = range[1] + 0.6;
    
    if (vpd < min) return "rgba(30, 64, 175, 0.7)"; // Blue - too low
    if (vpd < range[0]) return "rgba(59, 130, 246, 0.6)"; // Light blue
    if (vpd < (range[0] + range[1]) / 2) return "rgba(34, 197, 94, 0.7)"; // Green optimal
    if (vpd < range[1]) return "rgba(163, 230, 53, 0.7)"; // Lime optimal
    if (vpd < max) return "rgba(234, 179, 8, 0.7)"; // Yellow
    if (vpd < max + 0.4) return "rgba(239, 68, 68, 0.7)"; // Red
    return "rgba(153, 27, 27, 0.8)"; // Dark red - too high
  };

  // Calculate current position in grid
  const currentPos = useMemo(() => {
    const temp = Math.max(tempRange.min, Math.min(tempRange.max, Math.round(currentTemp)));
    const humidity = Math.max(humidityRange.min, Math.min(humidityRange.max, Math.round(currentHumidity / 2) * 2));
    
    const tempIndex = Math.floor((temp - tempRange.min) / tempStep);
    const humidityIndex = Math.floor((humidity - humidityRange.min) / humidityStep);
    
    return {
      temp,
      humidity,
      tempIndex: Math.max(0, Math.min(tempCount - 1, tempIndex)),
      humidityIndex: Math.max(0, Math.min(humidityCount - 1, humidityIndex)),
      tempPercent: ((temp - tempRange.min) / (tempRange.max - tempRange.min)) * 100,
      humidityPercent: 100 - ((humidity - humidityRange.min) / (humidityRange.max - humidityRange.min)) * 100
    };
  }, [currentTemp, currentHumidity, tempCount, humidityCount]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-green-300/70 bg-slate-900/45 p-6 shadow-2xl backdrop-blur">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-lime-300/70">VPD CHART</p>
            <p className="mt-1 text-sm text-lime-100/65">Vapour Pressure Deficit</p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Stage Toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => handleStageToggle("Veg")}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 transition text-xs ${
                  displayStage === "Veg"
                    ? "bg-lime-300/25 text-lime-200"
                    : "bg-lime-300/10 text-lime-100/60 hover:bg-lime-300/15"
                }`}
              >
                <Leaf className="h-3.5 w-3.5" />
                <span>Vegetative</span>
              </button>
              <button
                onClick={() => handleStageToggle("Bloom")}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 transition text-xs ${
                  displayStage === "Bloom"
                    ? "bg-fuchsia-300/25 text-fuchsia-200"
                    : "bg-fuchsia-300/10 text-fuchsia-100/60 hover:bg-fuchsia-300/15"
                }`}
              >
                <Flower2 className="h-3.5 w-3.5" />
                <span>Bloom</span>
              </button>
            </div>
            
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition text-slate-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Current Value Header */}
        <div className="mb-6 text-center">
          <p className="text-2xl font-bold text-white mb-1">
            {currentVpd.toFixed(2)} <span className="text-lg font-normal text-slate-400">kPa</span>
          </p>
          <p className="text-sm text-slate-400">
            {currentTemp}°C • {currentHumidity}% RH
          </p>
        </div>

        {/* Heatmap Chart */}
        <div className="relative rounded-xl overflow-hidden border border-white/10 bg-slate-800/50">
          {/* Grid Container */}
          <div 
            className="relative aspect-[4/3] w-full"
            style={{
              background: `linear-gradient(135deg, rgba(30, 64, 175, 0.3) 0%, rgba(34, 197, 94, 0.3) 50%, rgba(153, 27, 27, 0.3) 100%)`
            }}
          >
            {/* Heatmap cells */}
            <div className="absolute inset-0 grid" style={{
              gridTemplateRows: `repeat(${tempCount}, 1fr)`,
              gridTemplateColumns: `repeat(${humidityCount}, 1fr)`,
              gap: "1px"
            }}>
              {Array.from({ length: tempCount }).map((_, tempIdx) => (
                Array.from({ length: humidityCount }).map((_, humidityIdx) => {
                  const temp = tempRange.min + tempIdx * tempStep;
                  const humidity = humidityRange.min + humidityIdx * humidityStep;
                  const vpd = calculateVpd(temp, humidity);
                  
                  return (
                    <div
                      key={`${tempIdx}-${humidityIdx}`}
                      className="w-full h-full"
                      style={{ 
                        backgroundColor: getGradientColor(vpd, displayStage),
                        opacity: 0.85
                      }}
                    />
                  );
                })
              ))}
            </div>
            
            {/* Crosshair lines */}
            <div 
              className="absolute left-0 right-0 h-px bg-white/80 z-10"
              style={{ top: `${currentPos.tempPercent}%` }}
            />
            <div 
              className="absolute top-0 bottom-0 w-px bg-white/80 z-10"
              style={{ left: `${100 - currentPos.humidityPercent}%` }}
            />
            
            {/* Current point marker */}
            <div 
              className="absolute z-20 w-5 h-5 rounded-full border-2 border-white bg-white/20 shadow-lg transform -translate-x-1/2 -translate-y-1/2 animate-pulse"
              style={{ 
                left: `${100 - currentPos.humidityPercent}%`,
                top: `${currentPos.tempPercent}%`,
                boxShadow: "0 0 20px rgba(255,255,255,0.5)"
              }}
            />

            {/* Axes labels */}
            <div className="absolute -left-12 top-0 bottom-0 flex flex-col justify-between py-2">
              {[40, 35, 30, 25, 20, 15, 10].map((t) => (
                <span key={t} className="text-[10px] text-slate-400 font-mono w-10 text-right pr-2">
                  {t}°C
                </span>
              ))}
            </div>
            
            <div className="absolute -bottom-6 left-0 right-0 flex justify-between px-2">
              {[10, 30, 50, 70, 90].map((h) => (
                <span key={h} className="text-[10px] text-slate-400 font-mono">
                  {h}% RH
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-blue-700" />
            <span className="text-blue-400">Too Low</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-green-500" />
            <span className="text-green-400">Optimal</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-yellow-500" />
            <span className="text-yellow-400">Warning</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-red-600" />
            <span className="text-red-400">Too High</span>
          </div>
        </div>

        {/* Current Status */}
        <div className="mt-6">
          <div
            className={`rounded-xl border ${currentInfo.bgColor} border-l-4 p-4 ${
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
      </div>
    </div>
  );
}
