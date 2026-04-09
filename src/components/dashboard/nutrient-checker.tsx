"use client";

import { PlantProfile } from "@/lib/types";
import { mapToNutrientStage, analyzeFeeding, NUTRIENT_TARGETS, FeedingAnalysis, NutrientStage } from "@/lib/nutrient-logic";
import { CheckCircle, AlertTriangle, AlertCircle, ArrowDownCircle, ArrowUpCircle, Droplets, Info } from "lucide-react";

interface NutrientCheckerProps {
  plant: PlantProfile;
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'Optimal':
      return <CheckCircle className="h-4 w-4 text-green-400" />;
    case 'Underfeeding':
      return <ArrowDownCircle className="h-4 w-4 text-amber-400" />;
    case 'Overfeeding':
      return <ArrowUpCircle className="h-4 w-4 text-red-400" />;
    case 'Salt Buildup':
      return <AlertTriangle className="h-4 w-4 text-orange-400" />;
    case 'Hungry':
      return <Droplets className="h-4 w-4 text-blue-400" />;
    case 'Flush Ready':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case 'Too Low':
      return <ArrowDownCircle className="h-4 w-4 text-amber-400" />;
    case 'Too High':
      return <ArrowUpCircle className="h-4 w-4 text-amber-400" />;
    default:
      return <Info className="h-4 w-4 text-slate-400" />;
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'Optimal':
      return 'bg-green-400/20 text-green-300 border-green-400/30';
    case 'Underfeeding':
      return 'bg-amber-400/20 text-amber-300 border-amber-400/30';
    case 'Overfeeding':
      return 'bg-red-400/20 text-red-300 border-red-400/30';
    case 'Salt Buildup':
      return 'bg-orange-400/20 text-orange-300 border-orange-400/30';
    case 'Hungry':
      return 'bg-blue-400/20 text-blue-300 border-blue-400/30';
    case 'Flush Ready':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'Too Low':
    case 'Too High':
      return 'bg-amber-400/20 text-amber-300 border-amber-400/30';
    default:
      return 'bg-slate-400/10 text-slate-400 border-slate-400/20';
  }
}

function getProgressPercent(
  value: number | null,
  currentMin: number,
  currentMax: number,
  absoluteMin: number,
  absoluteMax: number
): number {
  if (value === null) return 0;
  const range = absoluteMax - absoluteMin;
  if (range === 0) return 0;
  return Math.max(0, Math.min(100, ((value - absoluteMin) / range) * 100));
}

function getRangeColor(
  value: number | null,
  min: number,
  max: number
): string {
  if (value === null) return 'bg-slate-600';
  if (value < min) return 'bg-amber-500';
  if (value > max) return 'bg-red-500';
  return 'bg-green-500';
}

export function NutrientChecker({ plant }: NutrientCheckerProps) {
  // Get latest watering data (runoff EC/pH are optional)
  const wateringData = plant?.wateringData ?? [];
  const sortedWatering = [...wateringData].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  const latest = sortedWatering[0] || null;

  // Determine nutrient stage from plant stage
  const nutrientStage = plant ? mapToNutrientStage(plant.stage) : 'Seedling';
  const targets = NUTRIENT_TARGETS[nutrientStage];

  // Run analysis (runoff values may be undefined/null)
  const analysis = analyzeFeeding(
    latest?.ec,
    latest?.ph,
    latest?.runoffEc,
    latest?.runoffPh,
    nutrientStage
  );

  const lastWateringDate = latest
    ? new Date(latest.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  // Absolute ranges for progress bar display
  const ecAbsMin = 0;
  const ecAbsMax = 3.0;
  const phAbsMin = 5.0;
  const phAbsMax = 7.5;

  // Guard against missing plant or watering data
  if (!plant || wateringData.length === 0) {
    return (
      <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-lime-200">Nutrient Checker</p>
          </div>
        </div>
        <div className="rounded-xl border border-white/8 bg-black/20 p-6 text-center">
          <p className="text-sm text-slate-400 italic">No watering data recorded yet.</p>
          <p className="mt-1 text-xs text-slate-500">Log your first watering session to see analysis.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-lime-200">Nutrient Checker</p>
          <p className="mt-1 text-sm text-lime-100/70">
            Stage: <span className="font-semibold text-lime-100">{nutrientStage}</span>
            {lastWateringDate && ` · Last feeding: ${lastWateringDate}`}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* EC Section */}
        <div className="rounded-xl border border-white/8 bg-black/20 p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-300">EC Analysis</p>
            <div className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${getStatusColor(analysis.ecStatus)}`}>
              {getStatusIcon(analysis.ecStatus)}
              <span>{analysis.ecStatus}</span>
            </div>
          </div>

          {/* Input EC */}
          <div className="mb-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Input EC</span>
              <span className="font-semibold text-lime-100">
                {analysis.inputEc !== null ? analysis.inputEc.toFixed(2) : '—'}
              </span>
            </div>
            <div className="relative mt-1 h-2 rounded-full bg-slate-700/50">
              {/* Target range overlay */}
              <div
                className="absolute h-2 rounded-full bg-green-500/20"
                style={{
                  left: `${getProgressPercent(targets.ecMin, ecAbsMin, ecAbsMax, ecAbsMin, ecAbsMax)}%`,
                  width: `${getProgressPercent(targets.ecMax, ecAbsMin, ecAbsMax, ecAbsMin, ecAbsMax) - getProgressPercent(targets.ecMin, ecAbsMin, ecAbsMax, ecAbsMin, ecAbsMax)}%`
                }}
              />
              {/* Value marker */}
              {analysis.inputEc !== null && (
                <div
                  className={`absolute top-0 h-2 w-1 rounded-full ${getRangeColor(analysis.inputEc, targets.ecMin, targets.ecMax)}`}
                  style={{ left: `${getProgressPercent(analysis.inputEc, ecAbsMin, ecAbsMax, ecAbsMin, ecAbsMax)}%` }}
                />
              )}
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
              <span>{ecAbsMin}</span>
              <span>Target: {targets.ecMin}–{targets.ecMax}</span>
              <span>{ecAbsMax}</span>
            </div>
          </div>

          {/* Runoff EC + Delta */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Runoff EC</span>
            <span className="font-semibold text-lime-100">
              {analysis.runoffEc !== null ? analysis.runoffEc.toFixed(2) : '—'}
            </span>
            {analysis.ecDelta !== null && (
              <span className={`ml-2 font-mono text-xs ${
                analysis.ecDelta > 0.5 ? 'text-red-400' :
                analysis.ecDelta > 0.3 ? 'text-amber-400' :
                analysis.ecDelta < -0.3 ? 'text-blue-400' :
                'text-green-400'
              }`}>
                Δ {analysis.ecDelta > 0 ? '+' : ''}{analysis.ecDelta.toFixed(2)}
              </span>
            )}
          </div>
        </div>

        {/* pH Section */}
        <div className="rounded-xl border border-white/8 bg-black/20 p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-300">pH Analysis</p>
            <div className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${getStatusColor(analysis.phStatus)}`}>
              {getStatusIcon(analysis.phStatus)}
              <span>{analysis.phStatus}</span>
            </div>
          </div>

          {/* Input pH */}
          <div className="mb-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Input pH</span>
              <span className="font-semibold text-lime-100">
                {analysis.inputPh !== null ? analysis.inputPh.toFixed(2) : '—'}
              </span>
            </div>
            <div className="relative mt-1 h-2 rounded-full bg-slate-700/50">
              {/* Target range overlay */}
              <div
                className="absolute h-2 rounded-full bg-green-500/20"
                style={{
                  left: `${getProgressPercent(targets.phMin, phAbsMin, phAbsMax, phAbsMin, phAbsMax)}%`,
                  width: `${getProgressPercent(targets.phMax, phAbsMin, phAbsMax, phAbsMin, phAbsMax) - getProgressPercent(targets.phMin, phAbsMin, phAbsMax, phAbsMin, phAbsMax)}%`
                }}
              />
              {/* Value marker */}
              {analysis.inputPh !== null && (
                <div
                  className={`absolute top-0 h-2 w-1 rounded-full ${getRangeColor(analysis.inputPh, targets.phMin, targets.phMax)}`}
                  style={{ left: `${getProgressPercent(analysis.inputPh, phAbsMin, phAbsMax, phAbsMin, phAbsMax)}%` }}
                />
              )}
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
              <span>{phAbsMin}</span>
              <span>Target: {targets.phMin}–{targets.phMax}</span>
              <span>{phAbsMax}</span>
            </div>
          </div>

          {/* Runoff pH + Delta */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Runoff pH</span>
            <span className="font-semibold text-lime-100">
              {analysis.runoffPh !== null ? analysis.runoffPh.toFixed(2) : '—'}
            </span>
            {analysis.phDelta !== null && (
              <span className={`ml-2 font-mono text-xs ${
                Math.abs(analysis.phDelta) > 0.5 ? 'text-amber-400' : 'text-green-400'
              }`}>
                Δ {analysis.phDelta > 0 ? '+' : ''}{analysis.phDelta.toFixed(2)}
              </span>
            )}
          </div>
        </div>

        {/* Recommendation */}
        <div className="rounded-xl border border-lime-300/20 bg-lime-300/5 p-3">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-lime-300 mt-0.5 flex-shrink-0" />
            <p className="text-sm leading-relaxed text-lime-100/90">
              {analysis.recommendation}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
