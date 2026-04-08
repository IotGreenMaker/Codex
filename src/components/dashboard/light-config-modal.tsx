"use client";

import { useState } from "react";
import { X, Lightbulb, Smartphone } from "lucide-react";
import type { LightProfile } from "@/lib/types";
import { generateUUID } from "@/lib/uuid";

type LightConfigModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (light: LightProfile) => void;
  existingLights: LightProfile[];
  onDeleteLight: (id: string) => void;
  onSelectLight: (id: string) => void;
  activeLightId?: string;
  currentStage?: string;
};

const PPFD_INSTRUCTIONS = {
  normal: {
    title: "How to measure PPFD with Photone",
    steps: [
      "Download the free Photone app (iOS/Android)",
      "Select your light type in the app",
      "Place your phone at canopy level under the light",
      "Take a reading and enter the PPFD value below"
    ]
  },
  dimmer: {
    title: "How to measure PPFD with Photone (Dimmer)",
    steps: [
      "Download the free Photone app (iOS/Android)",
      "Set light to MINIMUM (10%) - measure at canopy level",
      "Enter the reading as Min PPFD below",
      "Set light to MAXIMUM (100%) - same distance",
      "Enter the reading as Max PPFD below",
      "The app will auto-calculate PPFD at your current dimmer %"
    ]
  }
};

export function LightConfigModal({
  isOpen,
  onClose,
  onSave,
  existingLights,
  onDeleteLight,
  onSelectLight,
  activeLightId,
  currentStage
}: LightConfigModalProps) {
  const [lightType, setLightType] = useState("");
  const [watts, setWatts] = useState(100);
  const [hasDimmer, setHasDimmer] = useState(false);
  const [dimmerPercent, setDimmerPercent] = useState(100);
  const [ppfdEstimated, setPpfdEstimated] = useState("");
  const [ppfdMin, setPpfdMin] = useState("");
  const [ppfdMax, setPpfdMax] = useState("");
  const [lightsOn, setLightsOn] = useState("06:00");
  const [lightsOff, setLightsOff] = useState("00:00");

  const calculateLightsOff = (lightsOn: string, stage: string): string => {
    const match = lightsOn.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return "00:00";
    const onHours = Number(match[1]);
    const onMinutes = Number(match[2]);
    const hoursOn = stage === "Bloom" ? 12 : 18;
    const offTotalMinutes = (onHours + hoursOn) * 60 + onMinutes;
    const offHours = Math.floor(offTotalMinutes / 60) % 24;
    const offMinutes = offTotalMinutes % 60;
    return `${String(offHours).padStart(2, "0")}:${String(offMinutes).padStart(2, "0")}`;
  };

  const resetForm = () => {
    setLightType("");
    setWatts(100);
    setHasDimmer(false);
    setDimmerPercent(100);
    setPpfdEstimated("");
    setPpfdMin("");
    setPpfdMax("");
    setLightsOn("06:00");
    setLightsOff(calculateLightsOff("06:00", currentStage ?? "Veg"));
  };

  const handleSave = () => {
    if (!lightType.trim()) return;
    const light: LightProfile = {
      id: generateUUID(),
      type: lightType.trim(),
      watts,
      hasDimmer,
      dimmerPercent: hasDimmer ? dimmerPercent : undefined,
      ppfdEstimated: ppfdEstimated ? Number(ppfdEstimated) : undefined,
      ppfdMin: hasDimmer && ppfdMin ? Number(ppfdMin) : undefined,
      ppfdMax: hasDimmer && ppfdMax ? Number(ppfdMax) : undefined,
      lightsOn,
      lightsOff
    };
    onSave(light);
    resetForm();
  };

  const handleSelectLight = (id: string) => {
    onSelectLight(id);
  };

  const handleDeleteLight = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteLight(id);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] rounded-2xl glass-panel flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-lime-500/10 bg-white/[0.03]">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-lime-300/20 p-2.5">
              <Lightbulb className="h-5 w-5 text-lime-400" />
            </div>
            <div>
              <p className="font-semibold text-lg text-lime-100">Light Configuration</p>
              <p className="text-xs text-lime-100/60">Manage your grow lights</p>
            </div>
          </div>
          <button
            onClick={() => {
              resetForm();
              onClose();
            }}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition text-slate-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Existing Lights List */}
          {existingLights.length > 0 && (
            <div>
              <h3 className="font-mono text-[11px] uppercase tracking-[0.22em] text-lime-200 mb-3">
                Saved Lights ({existingLights.length})
              </h3>
              <div className="space-y-2">
                {existingLights.map((light) => (
                    <button
                      key={light.id}
                      onClick={() => handleSelectLight(light.id)}
                      className={`w-full flex items-center justify-between rounded-xl glass-panel p-3 transition ${
                        light.id === activeLightId
                          ? "border-lime-300/40 bg-lime-300/10"
                          : "hover:bg-white/[0.04]"
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <Lightbulb className={`h-4 w-4 ${light.id === activeLightId ? "text-lime-400" : "text-lime-300/60"}`} />
                      <div className="text-left">
                        <p className="text-sm font-semibold text-lime-100">
                          {light.type}
                        </p>
                        <p className="text-xs text-lime-100/60">
                          {light.watts}W | {light.ppfdEstimated ? `${light.ppfdEstimated} PPFD` : "No PPFD"} | {light.lightsOn} - {light.lightsOff}
                          {light.hasDimmer && ` | Dimmer: ${light.dimmerPercent}%`}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDeleteLight(light.id, e)}
                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition"
                      title="Delete light"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Add Light Form - Always Visible */}
          <div>
            <h3 className="font-mono text-[11px] uppercase tracking-[0.22em] text-lime-200 mb-3">
              Add New Light
            </h3>
            <div className="space-y-4 rounded-xl glass-panel p-4">
              {/* Light Type - Text Input */}
              <div>
                <label className="text-[11px] text-lime-100/65 mb-1 block">Light Type / Name</label>
                <input
                  type="text"
                  value={lightType}
                  onChange={(e) => setLightType(e.target.value)}
                  placeholder="e.g., Blurple 40W Veg, Panel 100W Bloom..."
                  className="w-full rounded-lg border border-lime-300/15 bg-black/15 px-3 py-2 text-sm text-lime-100 outline-none placeholder:text-lime-100/30"
                />
              </div>

              {/* Watts */}
              <div>
                <label className="text-[11px] text-lime-100/65 mb-1 block">Watts</label>
                <input
                  type="number"
                  min={1}
                  value={watts}
                  onChange={(e) => setWatts(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full rounded-lg border border-lime-300/15 bg-black/15 px-3 py-2 text-sm text-lime-100 outline-none"
                />
              </div>

              {/* Has Dimmer Toggle */}
              <div className="flex items-center justify-between">
                <label className="text-[11px] text-lime-100/65">Has Dimmer?</label>
                <button
                  onClick={() => setHasDimmer(!hasDimmer)}
                  className={`relative h-6 w-11 rounded-full transition ${
                    hasDimmer ? "bg-lime-400/60" : "bg-white/10"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                      hasDimmer ? "left-5" : "left-0.5"
                    }`}
                  />
                </button>
              </div>

              {/* Dimmer Percent - Stylish Slider */}
              {hasDimmer && (
                <div className="rounded-lg bg-black/10 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-[11px] text-lime-100/65">Current Dimmer</label>
                    <span className="text-lg font-bold text-lime-100">{dimmerPercent}%</span>
                  </div>
                  {/* Custom Slider */}
                  <div className="relative">
                    <div className="h-2 rounded-full bg-gradient-to-r from-green-500/30 to-indigo-500/30" />
                    <div 
                      className="absolute top-0 left-0 h-2 rounded-full bg-gradient-to-r from-green-400/60 to-indigo-400/60 transition-all"
                      style={{ width: `${dimmerPercent}%` }}
                    />
                    <div 
                      className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-lg shadow-green-500/30 pointer-events-none transition-all z-20"
                      style={{ left: `calc(${dimmerPercent}% - 6px)` }}
                    />
                    <input
                      type="range"
                      min={1}
                      max={100}
                      value={dimmerPercent}
                      onChange={(e) => setDimmerPercent(Number(e.target.value))}
                      className="absolute top-0 left-0 w-full h-2 opacity-0 cursor-pointer z-10"
                    />
                  </div>
                </div>
              )}

              {/* PPFD Inputs */}
              {hasDimmer ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-lime-100/65 mb-1 block">Min PPFD (at 10%)</label>
                    <input
                      type="number"
                      min={0}
                      value={ppfdMin}
                      onChange={(e) => setPpfdMin(e.target.value)}
                      placeholder="e.g., 200"
                      className="w-full rounded-lg border border-lime-300/15 bg-black/15 px-3 py-2 text-sm text-lime-100 outline-none placeholder:text-lime-100/30"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-lime-100/65 mb-1 block">Max PPFD (at 100%)</label>
                    <input
                      type="number"
                      min={0}
                      value={ppfdMax}
                      onChange={(e) => setPpfdMax(e.target.value)}
                      placeholder="e.g., 1200"
                    className="w-full rounded-lg border border-lime-300/15 bg-black/15 px-3 py-2 text-sm text-lime-100 outline-none placeholder:text-lime-100/30"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-[11px] text-lime-100/65 mb-1 block">Estimated PPFD</label>
                  <input
                    type="number"
                    min={0}
                    value={ppfdEstimated}
                    onChange={(e) => setPpfdEstimated(e.target.value)}
                    placeholder="e.g., 800"
                    className="w-full rounded-lg border border-lime-300/15 bg-black/15 px-3 py-2 text-sm text-lime-100 outline-none placeholder:text-lime-100/30"
                  />
                </div>
              )}

              {/* Lights On/Off */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-lime-100/65 mb-1 block">Lights On</label>
                  <input
                    type="time"
                    value={lightsOn}
                    onChange={(e) => {
                      setLightsOn(e.target.value);
                      setLightsOff(calculateLightsOff(e.target.value, currentStage ?? "Veg"));
                    }}
                    className="w-full rounded-lg border border-lime-300/15 bg-black/15 px-3 py-2 text-sm text-lime-100 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-lime-100/65 mb-1 block">Lights Off (auto)</label>
                  <input
                    type="time"
                    value={lightsOff}
                    onChange={(e) => setLightsOff(e.target.value)}
                    className="w-full rounded-lg border border-lime-300/15 bg-black/15 px-3 py-2 text-sm text-lime-100 outline-none"
                  />
                  <p className="text-[9px] text-lime-100/40 mt-1">Auto-calculated, editable</p>
                </div>
              </div>

              {/* PPFD Instructions Box */}
              <div className="rounded-xl glass-panel p-4">
                <div className="flex items-start gap-2 mb-2">
                  <Smartphone className="h-4 w-4 text-lime-400 mt-0.5 flex-shrink-0" />
                  <h4 className="text-sm font-semibold text-lime-100">
                    {hasDimmer ? PPFD_INSTRUCTIONS.dimmer.title : PPFD_INSTRUCTIONS.normal.title}
                  </h4>
                </div>
                <ol className="space-y-1.5">
                  {(hasDimmer ? PPFD_INSTRUCTIONS.dimmer.steps : PPFD_INSTRUCTIONS.normal.steps).map((step, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-lime-100/70">
                      <span className="h-4 w-4 rounded-full bg-lime-400/20 text-lime-300 text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => resetForm()}
                  className="flex-1 rounded-lg border border-lime-500/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-lime-100/70 hover:bg-white/[0.06] transition"
                >
                  Clear
                </button>
                <button
                  onClick={handleSave}
                  disabled={!lightType.trim()}
                  className="flex-1 rounded-lg bg-lime-400/20 border border-lime-300/30 hover:bg-lime-400/30 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 text-sm font-semibold text-lime-100 transition"
                >
                  Save Light
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}