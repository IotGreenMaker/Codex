"use client";

import { useState, useEffect } from "react";
import { X, Calendar, Eye, Droplets, Sprout, Cannabis, Wheat } from "lucide-react";
import { STAGE_TARGETS } from "@/lib/config";
import { getSetting, setSetting } from "@/lib/indexeddb-storage";
import type { CalendarConfig } from "@/lib/types";

type CalendarConfigModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: CalendarConfig) => void;
};

const DEFAULT_CONFIG: CalendarConfig = {
  seedlingDuration: STAGE_TARGETS.seedling,
  vegDuration: STAGE_TARGETS.veg,
  bloomDuration: STAGE_TARGETS.bloom,
  showWatering: true,
  showSeedling: true,
  showVeg: true,
  showBloom: true,
  nutrientDelta: 5,
  hannaScale: 500,        // TODO #8: default to 500-scale (most common Hanna meter)
  measurementUnit: "PPM"  // TODO #8: PPM is the most common grower preference
};


const SETTINGS_KEY = "calendarConfig";

export async function loadCalendarConfig(): Promise<CalendarConfig> {
  try {
    const stored = await getSetting(SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
    }
  } catch {
    // ignore
  }
  return DEFAULT_CONFIG;
}

export async function saveCalendarConfig(config: CalendarConfig): Promise<void> {
  await setSetting(SETTINGS_KEY, JSON.stringify(config));
}

export function CalendarConfigModal({ isOpen, onClose, onSave }: CalendarConfigModalProps) {
  const [config, setConfig] = useState<CalendarConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    if (isOpen) {
      loadCalendarConfig().then(setConfig);
    }
  }, [isOpen]);

  const handleSave = () => {
    saveCalendarConfig(config);
    onSave(config);
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md max-h-[90vh] rounded-2xl glass-panel flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-lime-500/10 bg-white/[0.03]">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-lime-300/20 p-2.5">
              <Calendar className="h-5 w-5 text-lime-400" />
            </div>
            <div>
              <p className="font-semibold text-lg text-lime-100">Timeline Settings</p>
              <p className="text-xs text-lime-100/60">Configure calendar and feed</p>
            </div>
          </div>
          <button
            onClick={handleCancel}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition text-slate-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Stage Duration Settings */}
          <div>
            <h3 className="font-mono text-[11px] uppercase tracking-[0.22em] text-lime-200 mb-3">
              Stage Duration (days)
            </h3>
            <div className="space-y-3">
              {/* Seedling */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Sprout className="h-4 w-4 text-green-200" />
                  <label className="text-sm text-lime-100/80">Seedling</label>
                </div>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={config.seedlingDuration}
                  onChange={(e) => setConfig({ ...config, seedlingDuration: Math.max(1, Number(e.target.value) || 1) })}
                  className="w-20 rounded-lg border border-lime-300/15 bg-black/15 px-3 py-2 text-sm text-lime-100 outline-none text-center"
                />
              </div>

              {/* Veg */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Cannabis className="h-4 w-4 text-green-400" />
                  <label className="text-sm text-lime-100/80">Veg</label>
                </div>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={config.vegDuration}
                  onChange={(e) => setConfig({ ...config, vegDuration: Math.max(1, Number(e.target.value) || 1) })}
                  className="w-20 rounded-lg border border-lime-300/15 bg-black/15 px-3 py-2 text-sm text-lime-100 outline-none text-center"
                />
              </div>

              {/* Bloom */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Wheat className="h-4 w-4 text-indigo-400" />
                  <label className="text-sm text-lime-100/80">Bloom</label>
                </div>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={config.bloomDuration}
                  onChange={(e) => setConfig({ ...config, bloomDuration: Math.max(1, Number(e.target.value) || 1) })}
                  className="w-20 rounded-lg border border-lime-300/15 bg-black/15 px-3 py-2 text-sm text-lime-100 outline-none text-center"
                />
              </div>
            </div>
          </div>

          {/* Feed & Nutrient Settings */}
          <div className="pt-2">
            <h3 className="font-mono text-[11px] uppercase tracking-[0.22em] text-lime-200 mb-3 flex items-center gap-2">
              <Droplets className="h-3.5 w-3.5" />
              Nutrient Settings
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <label className="text-sm text-lime-100/80">Nutrient Delta (Next Feed %)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={config.nutrientDelta}
                    onChange={(e) => setConfig({ ...config, nutrientDelta: Math.max(0, Number(e.target.value) || 0) })}
                    className="w-16 rounded-lg border border-lime-300/15 bg-black/15 px-2 py-1.5 text-sm text-lime-100 outline-none text-center"
                  />
                  <span className="text-xs text-lime-100/40">%</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <label className="text-sm text-lime-100/80">Measurement Unit</label>
                <div className="flex rounded-lg border border-lime-300/20 bg-black/30 p-0.5">
                  {["EC", "PPM"].map((unit) => (
                    <button
                      key={unit}
                      type="button"
                      onClick={() => setConfig({ ...config, measurementUnit: unit as "EC" | "PPM" })}
                      className={`rounded-md px-3 py-1 text-[10px] font-mono transition ${
                        config.measurementUnit === unit
                          ? "bg-lime-300/20 text-lime-200"
                          : "text-slate-400 hover:text-slate-300"
                      }`}
                    >
                      {unit}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <label className="text-sm text-lime-100/80">Hanna Scale (PPM)</label>
                <div className="flex rounded-lg border border-lime-300/20 bg-black/30 p-0.5">
                  {[500, 700].map((scale) => (
                    <button
                      key={scale}
                      type="button"
                      onClick={() => setConfig({ ...config, hannaScale: scale as 500 | 700 })}
                      className={`rounded-md px-3 py-1 text-[10px] font-mono transition ${
                        config.hannaScale === scale
                          ? "bg-lime-300/20 text-lime-200"
                          : "text-slate-400 hover:text-slate-300"
                      }`}
                    >
                      {scale}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Feed Visibility */}
          <div>
            <h3 className="font-mono text-[11px] uppercase tracking-[0.22em] text-lime-200 mb-3 flex items-center gap-2">
              <Eye className="h-3.5 w-3.5" />
              Feed Visibility
            </h3>
            <div className="space-y-3">
              {/* Watering */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-sky-400" />
                  <label className="text-sm text-lime-100/80">Watering Events</label>
                </div>
                <button
                  onClick={() => setConfig({ ...config, showWatering: !config.showWatering })}
                  className={`relative h-6 w-11 rounded-full transition ${
                    config.showWatering ? "bg-lime-400/60" : "bg-white/10"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                      config.showWatering ? "left-5" : "left-0.5"
                    }`}
                  />
                </button>
              </div>

              {/* Seedling */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sprout className="h-4 w-4 text-green-200" />
                  <label className="text-sm text-lime-100/80">Seedling Changes</label>
                </div>
                <button
                  onClick={() => setConfig({ ...config, showSeedling: !config.showSeedling })}
                  className={`relative h-6 w-11 rounded-full transition ${
                    config.showSeedling ? "bg-lime-400/60" : "bg-white/10"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                      config.showSeedling ? "left-5" : "left-0.5"
                    }`}
                  />
                </button>
              </div>

              {/* Veg */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cannabis className="h-4 w-4 text-green-400" />
                  <label className="text-sm text-lime-100/80">Veg Changes</label>
                </div>
                <button
                  onClick={() => setConfig({ ...config, showVeg: !config.showVeg })}
                  className={`relative h-6 w-11 rounded-full transition ${
                    config.showVeg ? "bg-lime-400/60" : "bg-white/10"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                      config.showVeg ? "left-5" : "left-0.5"
                    }`}
                  />
                </button>
              </div>

              {/* Bloom */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wheat className="h-4 w-4 text-indigo-400" />
                  <label className="text-sm text-lime-100/80">Bloom Changes</label>
                </div>
                <button
                  onClick={() => setConfig({ ...config, showBloom: !config.showBloom })}
                  className={`relative h-6 w-11 rounded-full transition ${
                    config.showBloom ? "bg-lime-400/60" : "bg-white/10"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                      config.showBloom ? "left-5" : "left-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex gap-3 px-6 py-4 border-t border-lime-500/10 bg-white/[0.03]">
          <button
            onClick={handleCancel}
            className="flex-1 rounded-lg border border-lime-500/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-lime-100/70 hover:bg-white/[0.06] transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 rounded-lg bg-lime-400/20 border border-lime-300/30 hover:bg-lime-400/30 px-4 py-2 text-sm font-semibold text-lime-100 transition"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}