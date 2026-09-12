"use client";

import { useEffect, useState } from "react";
import { Info, Lightbulb, Plus, Bell, BellOff } from "lucide-react";
import type { GrowStage, LightProfile, PlantProfile, SpaceConfig, LightSnapshotEntry } from "@/lib/types";
import { parseTimeToMinutes, isLightsOnNow, calculateDLI } from "@/lib/grow-math";
import { useNotification } from "@/contexts/notification-context";
import { generateUUID } from "@/lib/uuid";
import { LightChart } from "@/components/charts/light-chart";

type LightConfigPanelProps = {
  activePlant: PlantProfile;
  allPoolLights: LightProfile[];
  activeLight: LightProfile | null | undefined;
  activeLightId: string | null | undefined;
  currentStage: GrowStage;
  nowMs: number;
  activeSpace?: SpaceConfig;
  notificationsEnabled: boolean;
  onToggleNotification: (enabled: boolean) => void;
  onSelectLight: (id: string) => void;
  onSyncLightUpdate: (lightId: string, patch: Partial<LightProfile>) => void;
  onOpenAddLight: () => void;
  onPatchActivePlant: (patch: Partial<PlantProfile>) => void;
  onAddLightSnapshot: (entry: LightSnapshotEntry) => void;
  onUpdateLightHistory: (history: LightSnapshotEntry[]) => void;
};

export function LightConfigPanel({
  activePlant,
  allPoolLights,
  activeLight,
  activeLightId,
  currentStage,
  nowMs,
  activeSpace,
  notificationsEnabled,
  onToggleNotification,
  onSelectLight,
  onSyncLightUpdate,
  onOpenAddLight,
  onPatchActivePlant,
  onAddLightSnapshot,
  onUpdateLightHistory
}: LightConfigPanelProps) {
  const { notify, ensurePermission } = useNotification();
  const spaceName = activeSpace?.name ?? "Space";
  const getLightHours = () => {
    const onMin = parseTimeToMinutes(activeLight?.lightsOn ?? activePlant.lightsOn);
    const offMin = parseTimeToMinutes(activeLight?.lightsOff ?? activePlant.lightsOff);
    if (onMin === null || offMin === null) return 0;
    return onMin < offMin ? (offMin - onMin) / 60 : (24 * 60 - onMin + offMin) / 60;
  };

  const getCurrentPpfd = () => {
    if (!activeLight) return null;
    if (activeLight.ppfdEstimated !== undefined) return activeLight.ppfdEstimated;
    if (activeLight.hasDimmer && activeLight.ppfdMin !== undefined && activeLight.ppfdMax !== undefined) {
      const t = Math.max(0, Math.min(1, ((activeLight.dimmerPercent ?? 100) - 10) / 90));
      return Math.round(activeLight.ppfdMin + (activeLight.ppfdMax - activeLight.ppfdMin) * t);
    }
    return null;
  };

  const hoursOn = getLightHours();
  const currentPpfd = getCurrentPpfd();
  const dli = calculateDLI(currentPpfd || 0, hoursOn);

  const targets: Record<string, [number, number]> = {
    Seedling: [12, 18],
    Veg: [25, 40],
    Bloom: [32, 45]
  };
  const [minDli, maxDli] = targets[currentStage] || [0, 0];

  let dliLabel = "No data";
  let dliColor = "bg-slate-600";
  let dliTone = "text-lime-100/60";
  if (dli > 0) {
    if (dli < minDli) {
      dliLabel = `DLI: ${dli.toFixed(1)} - Low`;
      dliColor = "bg-amber-500";
      dliTone = "text-amber-400";
    } else if (dli > maxDli) {
      dliLabel = `DLI: ${dli.toFixed(1)} - High`;
      dliColor = "bg-red-500";
      dliTone = "text-red-400";
    } else {
      dliLabel = `DLI: ${dli.toFixed(1)} - Good`;
      dliColor = "bg-green-500";
      dliTone = "text-green-400";
    }
  };

  const lightsOn = activeLight?.lightsOn ?? activePlant.lightsOn;
  const lightsOff = activeLight?.lightsOff ?? activePlant.lightsOff;

  const onH = Math.round(hoursOn);
  const expectedHours = currentStage === "Bloom" ? 12 : 18;
  const scheduleText = `${onH}/${24 - onH}`;
  const scheduleColor =
    Math.abs(onH - expectedHours) < 0.5
      ? currentStage === "Bloom"
        ? "text-indigo-500"
        : "text-green-500"
      : "text-amber-500";

  const lightsOnNow = isLightsOnNow(lightsOn, lightsOff, nowMs);

  const getEffectiveWatts = (): number => {
    if (!activeLight) return 0;
    const pct = activeLight.dimmerPercent ?? 100;
    return Math.round((activeLight.watts * pct) / 100);
  };

  const handleAutoOff = (value: string) => {
    const hours = currentStage === "Bloom" ? 12 : 18;
    const match = value.match(/^(\d{1,2}):(\d{2})$/);
    let autoOff = "22:00";
    if (match) {
      const onH = Number(match[1]);
      const onM = Number(match[2]);
      const offTotal = (onH + hours) * 60 + onM;
      autoOff = `${String(Math.floor(offTotal / 60) % 24).padStart(2, "0")}:${String(offTotal % 60).padStart(2, "0")}`;
    }
    if (activeLight) {
      onSyncLightUpdate(activeLight.id, { lightsOn: value, lightsOff: autoOff });
    } else {
      onPatchActivePlant({ lightsOn: value, lightsOff: autoOff });
    }
  };

  const handleToggleNotification = async (enabled: boolean) => {
    if (enabled) {
      const ok = await ensurePermission();
      if (!ok) {
        await notify({
          source: "light-config",
          variant: "error",
          title: "Permission Required",
          message: "Enable notifications in your browser settings to receive lighting alerts."
        });
        return;
      }
      await notify({
        source: "light-config",
        variant: "toggle-on",
        title: "Lighting Notifications Enabled",
        message: "You'll receive alerts when your grow lights turn on and off."
      });
    } else {
      await notify({
        source: "light-config",
        variant: "toggle-off",
        title: "Lighting Notifications Disabled",
        message: "Lighting alerts are now muted."
      });
    }
    onToggleNotification(enabled);
  };

  const captureLightSnapshot = (isOn: boolean) => {
    if (!activeLight) return;
    
    const ppfd = currentPpfd ?? 0;
    const actualWatts = getEffectiveWatts();
    const dimmerPercent = activeLight.dimmerPercent ?? 100;
    
    const entry: LightSnapshotEntry = {
      id: generateUUID(),
      timestamp: new Date().toISOString(),
      lightId: activeLight.id,
      ppfd,
      dli: calculateDLI(ppfd, hoursOn),
      actualWatts,
      dimmerPercent,
      isOn,
      onTime: isOn ? lightsOn : "",
      offTime: isOn ? "" : lightsOff
    };
    
    onAddLightSnapshot(entry);
    
    const allHistory = activeSpace?.lightHistory || [];
    onUpdateLightHistory([...allHistory, entry]);
  };

  const sendLightNotification = (type: "on" | "off") => {
    void notify({
      source: "light-config",
      variant: type === "on" ? "schedule-on" : "schedule-off",
      title: `Lights ${type === "on" ? "ON" : "OFF"}`,
      message: `Your grow lights turned ${type === "on" ? "on" : "off"} at ${type === "on" ? lightsOn : lightsOff}.`
    });
    
    captureLightSnapshot(type === "on");
  };

  useEffect(() => {
    if (!notificationsEnabled) return;

    const onMatch = lightsOn.match(/^(\d{1,2}):(\d{2})$/);
    const offMatch = lightsOff.match(/^(\d{1,2}):(\d{2})$/);
    if (!onMatch || !offMatch) {
      console.warn("[LightConfig] Invalid time format. Expected HH:MM format.", {
        lightsOn,
        lightsOff
      });
      return;
    }

    const now = new Date();
    const onH = parseInt(onMatch[1]);
    const onM = parseInt(onMatch[2]);
    const offH = parseInt(offMatch[1]);
    const offM = parseInt(offMatch[2]);

    const getNextOccurrence = (hour: number, minute: number): number => {
      const next = new Date(now);
      next.setHours(hour, minute, 0, 0);
      if (next.getTime() <= now.getTime()) {
        next.setDate(next.getDate() + 1);
      }
      return next.getTime();
    };

    const nextOnTime = getNextOccurrence(onH, onM);
    const nextOffTime = getNextOccurrence(offH, offM);

    console.log("[LightConfig] Scheduling notifications:", {
      lightsOn: `${String(onH).padStart(2, "0")}:${String(onM).padStart(2, "0")}`,
      lightsOff: `${String(offH).padStart(2, "0")}:${String(offM).padStart(2, "0")}`,
      nextOnTime: new Date(nextOnTime).toLocaleString(),
      nextOffTime: new Date(nextOffTime).toLocaleString(),
      now: new Date(now).toLocaleString()
    });

    const timers: ReturnType<typeof setTimeout>[] = [];

    if (nextOnTime - now.getTime() < 2147483647) {
      timers.push(
        setTimeout(() => {
          console.log("[LightConfig] Firing ON notification");
          sendLightNotification("on");
        }, nextOnTime - now.getTime())
      );
    }

    if (nextOffTime - now.getTime() < 2147483647) {
      timers.push(
        setTimeout(() => {
          console.log("[LightConfig] Firing OFF notification");
          sendLightNotification("off");
        }, nextOffTime - now.getTime())
      );
    }

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [notificationsEnabled, lightsOn, lightsOff]);

  return (
    <div className="glass-panel rounded-3xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-lime-200">Light Configuration</p>
          <h3 className="mt-2 text-lg font-semibold text-lime-100">{spaceName}</h3>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleToggleNotification(notificationsEnabled)}
            className={`rounded-full w-10 h-10 flex items-center justify-center transition-all ${
              notificationsEnabled
                ? "bg-lime-400/20 border border-lime-400/40 shadow-[0_0_12px_rgba(163,230,53,0.4)]"
                : "bg-black/30 border border-white/10 hover:border-white/20"
            }`}
            title={notificationsEnabled ? "Disable notifications" : "Enable notifications"}
          >
            {notificationsEnabled ? (
              <Bell className="h-5 w-5 text-lime-300" />
            ) : (
              <BellOff className="h-5 w-5 text-slate-400" />
            )}
          </button>
          <Lightbulb className="h-5 w-5 text-lime-300" />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-lime-100/80">
        <span className={`text-sm font-semibold ${scheduleColor}`}>{scheduleText}</span>
        <span>
          On{" "}
          <input
            type="time"
            value={lightsOn}
            onChange={(e) => handleAutoOff(e.target.value)}
            className="rounded-lg border border-lime-300/20 bg-black/30 px-2 py-1 text-sm text-lime-100 outline-none"
          />
        </span>
        <span>
          Off{" "}
          <input
            type="time"
            value={lightsOff}
            onChange={(e) => {
              const v = e.target.value;
              if (activeLight) onSyncLightUpdate(activeLight.id, { lightsOff: v });
              else onPatchActivePlant({ lightsOff: v });
            }}
            className="rounded-lg border border-lime-300/20 bg-black/30 px-2 py-1 text-sm text-lime-100 outline-none"
          />
        </span>
        <span className="flex items-center gap-3">
          {currentPpfd !== null && (
            <span className="group relative flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${dliColor} shadow-[0_0_8px_currentColor]`} />
              <span className={`text-xs font-medium ${dliTone}`}>{dliLabel}</span>
              <Info className="h-3.5 w-3.5 text-lime-100/50 cursor-help" />
            </span>
          )}
          <span className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                lightsOnNow
                  ? "bg-green-500 shadow-[0_0_10px_rgba(158,255,102,0.9)]"
                  : "bg-slate-600"
              }`}
            />
            {lightsOnNow ? "Lights ON" : "Lights OFF"}
          </span>
        </span>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <div className="flex-1">
          <p className="text-[11px] text-lime-100/65 mb-1">Active Light</p>
          {allPoolLights.length > 0 ? (
            <select
              value={activeLightId ?? ""}
              onChange={(e) => onSelectLight(e.target.value)}
              className="w-full rounded-lg border border-lime-300/20 bg-black/30 px-3 py-2 text-sm text-lime-100 outline-none"
            >
              {allPoolLights.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.type}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-lime-100/40 italic">No lights configured</p>
          )}
        </div>
        <button
          type="button"
          onClick={onOpenAddLight}
          className="rounded-full border border-lime-300/20 bg-lime-300/12 p-2 text-lime-100 hover:bg-lime-300/22 transition"
          title="Add new light"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {activeLight && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-2 sm:grid-cols-3">
            <div>
              <p className="text-[11px] text-lime-100/65">Type</p>
              <p className="text-sm font-semibold text-lime-100">{activeLight?.type}</p>
            </div>
            <div>
              <p className="text-[11px] text-lime-100/65">Watts</p>
              <p className="text-sm font-semibold text-lime-100">
                {activeLight?.hasDimmer
                  ? `${Math.round(activeLight.watts * (activeLight.dimmerPercent ?? 100) / 100)} W`
                  : `${activeLight?.watts} W`}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-lime-100/65">PPFD</p>
              <p className="text-sm font-semibold text-lime-100">{currentPpfd ?? "--"} μmol/m²/s</p>
            </div>
            {activeLight.hasDimmer && (
              <div className="sm:col-span-3 pb-2">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] text-lime-100/65">Dimmer</p>
                  <span className="text-lg font-bold text-lime-100">{activeLight.dimmerPercent ?? 100}%</span>
                </div>
                <div className="relative">
                  <div className="h-2 rounded-full bg-gradient-to-r from-green-500/30 to-indigo-500/30" />
                  <div
                    className="absolute top-0 left-0 h-2 rounded-full bg-gradient-to-r from-green-400/60 to-indigo-400/60 transition-all"
                    style={{ width: `${activeLight.dimmerPercent ?? 100}%` }}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-lg shadow-green-500/30 pointer-events-none transition-all z-20"
                    style={{ left: `calc(${activeLight.dimmerPercent ?? 100}% - 6px)` }}
                  />
                  <input
                    type="range"
                    min={1}
                    max={100}
                    value={activeLight.dimmerPercent ?? 100}
                    onChange={(e) => onSyncLightUpdate(activeLight.id, { dimmerPercent: Number(e.target.value) })}
                    className="absolute top-0 left-0 w-full h-2 opacity-0 cursor-pointer z-10"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeSpace && (
        <div className="mt-4">
          <LightChart
            lightHistory={activeSpace.lightHistory || []}
            electricityPricePerKwh={activeSpace.electricityPricePerKwh || 0}
            onLightHistoryChange={onUpdateLightHistory}
            locale="en"
          />
        </div>
      )}
    </div>
  );
}