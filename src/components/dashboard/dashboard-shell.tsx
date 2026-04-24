"use client";

import { useEffect, useMemo, useState, useRef, useCallback, memo } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Download, Droplets, Flower, Info, Leaf, Lightbulb, Minus, Plus, RotateCcw, Settings, Sprout, Thermometer, Waves, X, Wheat, Cannabis } from "lucide-react";
import { GrowChart } from "@/components/charts/grow-chart";
import { AiAssistantPanel } from "@/components/dashboard/ai-assistant-panel";
import { VPDChart } from "@/components/dashboard/vpd-chart";
import { PlantTimelineCalendar } from "@/components/dashboard/plant-timeline-calendar";
import { CalendarConfigModal } from "@/components/dashboard/calendar-config-modal";
import { STAGE_TARGETS as DEFAULT_STAGE_TARGETS } from "@/lib/config";
import { AiAssistantTutorialModal } from "@/components/dashboard/ai-assistant-tutorial-modal";
import { LightConfigModal } from "@/components/dashboard/light-config-modal";
import { ConfirmationModal, ConfirmationOptions } from "@/components/dashboard/confirmation-modal";
import { NutrientChecker } from "@/components/dashboard/nutrient-checker";
import { LiveClock } from "@/components/dashboard/live-clock";
import {
  calculateVpd,
  getVpdBand,
  getDetailedCycleSummary,
  CANNA_AQUA_PERIODS,
  getNutrientPeriodKey,
  getRecipeSnapshotData,
  formatNutrientValue,
  getWateringCountdown,
  getDrybackPercent,
  parseTimeToMinutes,
  isLightsOnNow,
  toDatetimeLocal,
  formatAvgPh,
  formatAvgPpm
} from "@/lib/grow-math";
import { STAGE_TARGETS } from "@/lib/config";
import { Locale, translations } from "@/lib/i18n";
import { generateUUID } from "@/lib/uuid";
import { exportToExcel } from "@/lib/excel-export";
import type { GrowStage, PlantProfile, LightProfile, CalendarConfig } from "@/lib/types";
import { AiChatModal } from "@/components/dashboard/ai-chat-modal";
import { MessageCircle } from "lucide-react";
import { useCurrentTime } from "@/lib/time-context";

// Hooks
import { usePlants } from "@/hooks/use-plants";
import { useWeather } from "@/hooks/use-weather";
import { useSettings } from "@/hooks/use-settings";

// Memoized Sub-components for performance
const MemoizedGrowChart = memo(GrowChart);
const MemoizedAiAssistantPanel = memo(AiAssistantPanel);
const MemoizedPlantTimelineCalendar = memo(PlantTimelineCalendar);
const MemoizedNutrientChecker = memo(NutrientChecker);

type DashboardShellProps = {
  heading: string;
  subheading: string;
  showHero?: boolean;
};

export function DashboardShell({ heading: _heading, subheading: _subheading, showHero: _showHero = false }: DashboardShellProps) {
  const locale: Locale = "en";
  const t = translations[locale];
  const router = useRouter();

  // Hooks
  const { 
    plants, 
    activePlant, 
    activePlantId, 
    setActivePlantId, 
    loadedFromServer, 
    addPlant: _addPlant, 
    removePlant: _removePlant, 
    updatePlant, 
    patchActivePlant 
  } = usePlants();
  
  const weather = useWeather();
  const { notificationsEnabled, toggleNotifications, calendarConfig, setCalendarConfig } = useSettings();
  const { nowMs } = useCurrentTime();

  // Local UI State
  const [nutrientLiters, setNutrientLiters] = useState(10);
  const [nutrientTargetEc, setNutrientTargetEc] = useState(1.6);
  const [nutrientPeriodKey, setNutrientPeriodKey] = useState("veg_phase_2");
  const [isVpdChartOpen, setIsVpdChartOpen] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [isLightModalOpen, setIsLightModalOpen] = useState(false);
  const [isCalendarConfigOpen, setIsCalendarConfigOpen] = useState(false);
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [nutrientView, setNutrientView] = useState<"classic" | "checker">("classic");
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    options: ConfirmationOptions | null;
    resolve: ((value: boolean) => void) | null;
  }>({ isOpen: false, options: null, resolve: null });

  // Confirmation dialog helper
  const showConfirmation = (options: ConfirmationOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({ isOpen: true, options, resolve });
    });
  };

  const handleConfirm = () => {
    confirmState.resolve?.(true);
    setConfirmState({ isOpen: false, options: null, resolve: null });
  };

  const handleCancel = () => {
    confirmState.resolve?.(false);
    setConfirmState({ isOpen: false, options: null, resolve: null });
  };

  // ─── Shared Actions ───────────────────────────────────────────────────────

  const addPlant = () => _addPlant();

  const removePlant = async (plantId: string) => {
    const confirmed = await showConfirmation({
      title: "Delete Plant",
      message: "Are you sure you want to delete this plant? This action cannot be undone.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      variant: "danger"
    });
    if (confirmed) {
      await _removePlant(plantId);
    }
  };

  const handleToggleNotification = (enabled: boolean) => toggleNotifications(enabled);

  // ─── Plant Events ─────────────────────────────────────────────────────────

  const handleAddAiNote = (text: string, timestamp?: string) => {
    const time = (timestamp && !isNaN(new Date(timestamp).getTime())) ? timestamp : new Date().toISOString();
    const newNote = {
      id: time,
      timestamp: time,
      text
    };
    patchActivePlant({
      notes: [newNote, ...(activePlant?.notes || [])]
    });
  };

  const handleDeleteNote = (noteId: string) => {
    if (!activePlant?.notes) return;
    patchActivePlant({
      notes: activePlant.notes.filter((n) => n.id !== noteId)
    });
  };

  const patchWateringData = (nextWateringData: PlantProfile["wateringData"]) => {
    if (!activePlant) return;
    const validData = nextWateringData.filter((w) => w.timestamp && !isNaN(new Date(w.timestamp).getTime()));
    
    const processedData = validData.map(entry => {
      // Always determine period key based on plant state
      const cycleDetailed = getDetailedCycleSummary(activePlant);
      const periodToSet = getNutrientPeriodKey({
        stage: activePlant.stage,
        seedlingDays: cycleDetailed.daysInSeedling,
        vegDays: cycleDetailed.daysInVeg,
        bloomDays: cycleDetailed.daysInBloom,
        seedlingTarget: calendarConfig?.seedlingDuration ?? STAGE_TARGETS.seedling,
        vegTarget: calendarConfig?.vegDuration ?? STAGE_TARGETS.veg,
        bloomTarget: calendarConfig?.bloomDuration ?? STAGE_TARGETS.bloom
      });

      const litersValue = entry.amountMl / 1000 || activePlant.waterInputMl / 1000;
      
      // If isFeed is true, ensure we have a snapshot. If false, ensure we don't.
      const shouldHaveSnapshot = entry.isFeed !== false;
      const recipeSnapshot = shouldHaveSnapshot 
        ? getRecipeSnapshotData({
            periodKey: periodToSet,
            liters: litersValue,
            targetEc: entry.ec || activePlant.waterEc
          })
        : undefined;

      return {
        ...entry,
        isFeed: shouldHaveSnapshot,
        recipeSnapshot
      };
    });

    const sorted = [...processedData].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const latest = sorted[sorted.length - 1];

    patchActivePlant({
      wateringData: sorted,
      ...(latest ? {
        lastWateredAt: latest.timestamp,
        waterInputMl: latest.amountMl,
        waterPh: latest.ph,
        waterEc: latest.ec
      } : {})
    });
  };

  const patchClimateData = (data: any[]) => {
    const validData = data.filter((c) => c.timestamp && !isNaN(new Date(c.timestamp).getTime()));
    const sorted = [...validData].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const latest = sorted[sorted.length - 1];

    patchActivePlant({
      climateData: validData,
      ...(latest ? {
        growTempC: latest.tempC,
        growHumidity: latest.humidity
      } : {})
    });
  };

  // ─── Light Management ─────────────────────────────────────────────────────

  const allPoolLights = useMemo(() => {
    const lightsMap = new Map<string, LightProfile>();
    plants.forEach(p => (p.lights ?? []).forEach(l => lightsMap.set(l.id, l)));
    return Array.from(lightsMap.values());
  }, [plants]);

  const activeLights = activePlant?.lights ?? [];
  const activeLightId = activePlant?.activeLightId ?? activeLights[0]?.id;
  const activeLight = activeLights.find((l) => l.id === activeLightId) ?? activeLights[0];

  const syncLightUpdate = (lightId: string, patch: Partial<LightProfile>) => {
    updatePlant({ 
      ...activePlant!, 
      lights: activeLights.map(l => l.id === lightId ? { ...l, ...patch } : l),
      ...(activeLightId === lightId ? {
        lightsOn: patch.lightsOn ?? activePlant?.lightsOn ?? "06:00",
        lightsOff: patch.lightsOff ?? activePlant?.lightsOff ?? "22:00",
        lightDimmerPercent: patch.dimmerPercent !== undefined ? patch.dimmerPercent : activePlant?.lightDimmerPercent,
        lightLampWatts: patch.watts ?? activePlant?.lightLampWatts
      } : {})
    });
  };

  const handleSaveLight = (light: LightProfile) => {
    patchActivePlant({
      lights: [...activeLights, light],
      activeLightId: light.id,
      lightsOn: light.lightsOn,
      lightsOff: light.lightsOff,
      lightDimmerPercent: light.dimmerPercent,
      lightLampWatts: light.watts
    });
  };

  const handleDeleteLight = (id: string) => {
    const updated = activeLights.filter(l => l.id !== id);
    patchActivePlant({
      lights: updated,
      activeLightId: activeLightId === id ? updated[0]?.id : activeLightId
    });
  };

  const handleSelectLight = (id: string) => {
    const light = allPoolLights.find(l => l.id === id);
    if (light) {
      patchActivePlant({
        activeLightId: id,
        lights: activeLights.some(l => l.id === id) ? activeLights : [...activeLights, light],
        lightsOn: light.lightsOn,
        lightsOff: light.lightsOff,
        lightDimmerPercent: light.dimmerPercent,
        lightLampWatts: light.watts
      });
    }
  };

  const handleLightsOnChange = (value: string, isLightProfile: boolean) => {
    const hours = activePlant!.stage === "Bloom" ? 12 : 18;
    const match = value.match(/^(\d{1,2}):(\d{2})$/);
    let autoOff = "22:00";
    if (match) {
      const onH = Number(match[1]);
      const onM = Number(match[2]);
      const offTotal = (onH + hours) * 60 + onM;
      autoOff = `${String(Math.floor(offTotal / 60) % 24).padStart(2, "0")}:${String(offTotal % 60).padStart(2, "0")}`;
    }
    
    if (isLightProfile && activeLight) {
      syncLightUpdate(activeLight.id, { lightsOn: value, lightsOff: autoOff });
    } else {
      patchActivePlant({ lightsOn: value, lightsOff: autoOff });
    }
  };

  // ─── Loading / Empty States ───────────────────────────────────────────────

  // ─── Redirect to Home if no plants (Onboarding Hub) ───────────────────────
  useEffect(() => {
    if (loadedFromServer && plants.length === 0) {
      router.push("/");
    }
  }, [loadedFromServer, plants.length, router]);

  if (!loadedFromServer || plants.length === 0) {
    return (
      <main className="min-h-screen bg-hero-grid relative" aria-busy="true" aria-label="Loading your grow data...">
        <div className="bg-orb bg-orb--green" aria-hidden="true" />
        <div className="bg-orb bg-orb--purple" aria-hidden="true" />
        <div className="bg-orb bg-orb--orange" aria-hidden="true" />
        <div className="relative z-10 mx-auto max-w-screen-xl px-4 py-6 animate-pulse">
          <div className="mb-6 flex items-center justify-between"><div className="h-8 w-40 rounded-xl bg-white/10" /><div className="flex gap-2"><div className="h-8 w-8 rounded-lg bg-white/10" /><div className="h-8 w-8 rounded-lg bg-white/10" /></div></div>
          <div className="mb-6 flex gap-2"><div className="h-9 w-32 rounded-full bg-lime-300/15" /><div className="h-9 w-28 rounded-full bg-white/8" /></div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[280px_1fr]"><div className="flex flex-col gap-4"><div className="glass-panel rounded-3xl p-4 h-64" /><div className="glass-panel rounded-3xl p-4 h-48" /></div><div className="flex flex-col gap-4"><div className="glass-panel rounded-3xl p-4 h-40" /><div className="grid grid-cols-2 gap-4"><div className="glass-panel rounded-3xl p-4 h-32" /><div className="glass-panel rounded-3xl p-4 h-32" /><div className="glass-panel rounded-3xl p-4 h-32" /><div className="glass-panel rounded-3xl p-4 h-32" /></div></div></div>
        </div>
      </main>
    );
  }

  // ─── Derived UI Values ────────────────────────────────────────────────────

  if (!activePlant) return null;

  const cycleDetailed = getDetailedCycleSummary(activePlant);
  const liveVpd = calculateVpd(activePlant.growTempC, activePlant.growHumidity);
  const vpdBand = getVpdBand(activePlant.stage, liveVpd);
  const wateringProgress = getDrybackPercent(activePlant.lastWateredAt, activePlant.wateringIntervalDays);
  
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

  const dli = (getCurrentPpfd() || 0) * getLightHours() * 3600 / 1_000_000;
  
  const getDLIStatus = () => {
    if (dli === 0) return { label: "No data", color: "bg-slate-600", tone: "text-lime-100/60" };
    const targets: any = { Seedling: [12, 18], Veg: [25, 40], Bloom: [32, 45] };
    const [min, max] = targets[activePlant.stage] || [0, 0];
    if (dli < min) return { label: `DLI: ${dli.toFixed(1)} - Low`, color: "bg-amber-500", tone: "text-amber-400" };
    if (dli > max) return { label: `DLI: ${dli.toFixed(1)} - High`, color: "bg-red-500", tone: "text-red-400" };
    return { label: `DLI: ${dli.toFixed(1)} - Good`, color: "bg-green-500", tone: "text-green-400" };
  };

  const dliStatus = getDLIStatus();

  const getScheduleDisplay = () => {
    const onMin = parseTimeToMinutes(activeLight?.lightsOn ?? activePlant.lightsOn);
    const offMin = parseTimeToMinutes(activeLight?.lightsOff ?? activePlant.lightsOff);
    if (onMin === null || offMin === null) return { text: "--/--", color: "text-lime-100/60" };
    const onH = Math.round(getLightHours());
    return { 
      text: `${onH}/${24 - onH}`, 
      color: Math.abs(onH - (activePlant.stage === "Bloom" ? 12 : 18)) < 0.5 ? (activePlant.stage === "Bloom" ? "text-indigo-500" : "text-green-500") : "text-amber-500"
    };
  };

  const scheduleDisplay = getScheduleDisplay();

  return (
      <main className="min-h-screen bg-hero-grid relative">
        <div className="bg-orb bg-orb--green" aria-hidden="true" /><div className="bg-orb bg-orb--purple" aria-hidden="true" /><div className="bg-orb bg-orb--orange" aria-hidden="true" />
        <section className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 lg:px-6">
        <div className="glass-panel rounded-3xl p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <LiveClock locale={locale} />
            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end">
              <button type="button" onClick={() => setIsTutorialOpen(true)} className="rounded-full border border-lime-300/25 bg-lime-300/12 p-2 sm:p-2.5 text-lime-200 hover:bg-lime-300/22 transition min-h-[44px] min-w-[44px] flex items-center justify-center"><BookOpen className="h-4 w-4 sm:h-4.5 sm:w-4.5" /></button>
              <div className="rounded-2xl border border-lime-300/15 bg-lime-300/8 px-3 sm:px-4 py-2 sm:py-3 flex-1 sm:flex-initial">
                <p className="font-mono text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-lime-200">Outside Weather</p>
                <p className="mt-1 text-base sm:text-lg font-semibold text-lime-100">{weather?.temperatureC ?? "--"} C</p>
                <p className="text-xs text-lime-100/80">Humidity: {weather?.humidity ?? "--"}%</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-1 xl:grid-cols-[2fr_0.95fr]">
          <div className="glass-panel rounded-[2rem] p-5 lg:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-mono text-[11px] uppercase tracking-[0.34em] text-lime-200">G-Buddy</p></div></div>
            <div className=" items-start justify-between gap-4 mt-4">
              <div className="rounded-2xl border border-lime-300/20 bg-lime-300/10 px-4 py-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.24em]  text-slate-100">{t.activePlant}</p>
                <div className="mt-2 flex items-center gap-3">
                  <EditableText value={activePlant.strainName} className="text-xl font-semibold text-slate-100" onSave={(v) => patchActivePlant({ strainName: v })} />
                  {getStageIcon(activePlant.stage)}
                  <span className="text-xs text-lime-100/80">Started <EditableDate dateIso={activePlant.startedAt} locale={locale} onSave={(v) => patchActivePlant({ startedAt: `${v}T09:00:00.000Z` })} /></span>
                  <span className="text-xs font-semibold text-lime-100/80">{cycleDetailed.totalDays} days</span>
                </div>
                <div className="mt-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-lime-200">Progress</p>
                  <StageProgressBar seedlingDays={cycleDetailed.daysInSeedling} vegDays={cycleDetailed.daysInVeg} bloomDays={cycleDetailed.daysInBloom} seedlingTarget={calendarConfig?.seedlingDuration ?? STAGE_TARGETS.seedling} vegTarget={calendarConfig?.vegDuration ?? STAGE_TARGETS.veg} bloomTarget={calendarConfig?.bloomDuration ?? STAGE_TARGETS.bloom} />
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-white/8 bg-white/5 p-3">
              <div className="flex items-center justify-between"><p className="font-mono text-[10px] uppercase tracking-[0.22em] text-lime-200">Plant list</p><div className="flex items-center gap-2">
                <button type="button" onClick={() => exportToExcel({ plants, activePlantId })} className="rounded-full border border-lime-300/20 bg-lime-300/12 p-1 text-lime-100"><Download className="h-4 w-4" /></button>
                <button type="button" onClick={addPlant} className="rounded-full border border-lime-300/20 bg-lime-300/12 p-1 text-lime-100"><Plus className="h-4 w-4" /></button>
              </div></div>
              <div className="mt-3 flex flex-wrap gap-2">
                {plants.sort((a,b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()).map((entry) => (
                  <div key={entry.id} className="relative group">
                    <button type="button" onClick={() => setActivePlantId(entry.id)} className={`rounded-full border px-3 py-1.5 text-xs transition ${entry.id === activePlantId ? "border-lime-300/28 bg-lime-300/16 text-lime-100" : "border-white/10 bg-black/25 text-slate-300 hover:bg-white/10"}`}><span className="inline-flex items-center gap-2">{getStageIcon(entry.stage)}{entry.strainName}</span></button>
                    <button type="button" onClick={() => removePlant(entry.id)} className="absolute -top-2 -right-2 rounded-full bg-red-500/90 hover:bg-red-600 p-0.5 text-white opacity-0 group-hover:opacity-100 transition"><X className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <CompactMetric label={t.climate} icon={<Thermometer className="h-4 w-4" />} value={<span className="text-xl font-semibold text-lime-100">{activePlant.growTempC}°C / {activePlant.growHumidity}%</span>} helper={<span className="text-xs leading-5 text-lime-100/70">Outside: {weather?.temperatureC ?? "--"}°C / {weather?.humidity ?? "--"}%</span>} statusColor={null} />
              <CompactMetric label="VPD" icon={<Waves className="h-4 w-4" />} value={<span className="text-xl font-semibold text-lime-100">{liveVpd} kPa</span>} helper={<span className={`${vpdBand.tone} text-xs`}>{vpdBand.label} | {vpdBand.range}</span>} statusColor={null} />
              <CompactMetric label={t.water} icon={<Droplets className="h-4 w-4" />} value={<span className="text-xl font-semibold text-lime-100">{activePlant.waterInputMl} ml</span>} helper={<span className="text-xs leading-5 text-lime-100/70">pH {activePlant.waterPh} | {calendarConfig?.measurementUnit === 'PPM' ? 'PPM ' + formatNutrientValue(activePlant.waterEc, 'PPM', calendarConfig?.hannaScale || 700) : 'EC ' + activePlant.waterEc}</span>} statusColor={<div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10"><div className="h-1.5 rounded-full bg-gradient-to-r from-white/90 via-sky-300/70 to-sky-500/90 transition-all duration-700" style={{ width: `${wateringProgress}%` }} /></div>} />
            </div>
            <div className="mt-4 grid gap-3">
              <MiniInfo label={t.lightHours} value={
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3 text-xs text-lime-100/80">
                    <span className={`text-sm font-semibold ${scheduleDisplay.color}`}>{scheduleDisplay.text}</span>
                    <span>On <input type="time" value={activeLight?.lightsOn ?? activePlant.lightsOn} onChange={(e) => handleLightsOnChange(e.target.value, !!activeLight)} className="rounded-lg border border-lime-300/20 bg-black/30 px-2 py-1 text-sm text-lime-100 outline-none" /></span>
                    <span>Off <input type="time" value={activeLight?.lightsOff ?? activePlant.lightsOff} onChange={(e) => { const v = e.target.value; if (activeLight) syncLightUpdate(activeLight.id, { lightsOff: v }); else patchActivePlant({ lightsOff: v }); }} className="rounded-lg border border-lime-300/20 bg-black/30 px-2 py-1 text-sm text-lime-100 outline-none" /></span>
                    <span className=" flex items-center gap-3">
                      {getCurrentPpfd() !== null && <span className="group relative flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${dliStatus.color} shadow-[0_0_8px_currentColor]`} /><span className={`text-xs font-medium ${dliStatus.tone}`}>{dliStatus.label}</span><Info className="h-3.5 w-3.5 text-lime-100/50 cursor-help" /></span>}
                      <span className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${isLightsOnNow(activeLight?.lightsOn ?? activePlant.lightsOn, activeLight?.lightsOff ?? activePlant.lightsOff, nowMs) ? "bg-green-500 shadow-[0_0_10px_rgba(158,255,102,0.9)]" : "bg-slate-600"}`} />{isLightsOnNow(activeLight?.lightsOn ?? activePlant.lightsOn, activeLight?.lightsOff ?? activePlant.lightsOff, nowMs) ? "Lights ON" : "Lights OFF"}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2"><div className="flex-1"><p className="text-[11px] text-lime-100/65 mb-1">Active Light</p>{activeLights.length > 0 ? <select value={activeLightId ?? ""} onChange={(e) => handleSelectLight(e.target.value)} className="w-full rounded-lg border border-lime-300/20 bg-black/30 px-3 py-2 text-sm text-lime-100 outline-none">{allPoolLights.map(l => <option key={l.id} value={l.id}>{l.type}{l.hasDimmer ? ` (${l.dimmerPercent}%)` : ""}</option>)}</select> : <p className="text-sm text-lime-100/40 italic">No lights configured</p>}</div>
                  <div className="pt-5"><button type="button" onClick={() => setIsLightModalOpen(true)} className="rounded-full border border-lime-300/20 bg-lime-300/12 p-2 text-lime-100 hover:bg-lime-300/22 transition"><Plus className="h-4 w-4" /></button></div></div>
                  {activeLight && <div className="mt-2 grid gap-2 sm:grid-cols-3"><div><p className="text-[11px] text-lime-100/65">Type</p><p className="text-sm font-semibold text-lime-100">{activeLight.type}</p></div><div><p className="text-[11px] text-lime-100/65">Watts</p><p className="text-sm font-semibold text-lime-100">{activeLight.watts} W</p></div><div><p className="text-[11px] text-lime-100/65">PPFD</p><p className="text-sm font-semibold text-lime-100">{getCurrentPpfd() ?? "--"} μmol/m²/s</p></div>
                  {activeLight.hasDimmer && <div className="sm:col-span-3 pb-4"><div className="flex items-center justify-between mb-3"><p className="text-[11px] text-lime-100/65">Dimmer</p><span className="text-lg font-bold text-lime-100">{activeLight.dimmerPercent ?? 100}%</span></div><div className="relative"><div className="h-2 rounded-full bg-gradient-to-r from-green-500/30 to-indigo-500/30" /><div className="absolute top-0 left-0 h-2 rounded-full bg-gradient-to-r from-green-400/60 to-indigo-400/60 transition-all" style={{ width: `${activeLight.dimmerPercent ?? 100}%` }} /><div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-lg shadow-green-500/30 pointer-events-none transition-all z-20" style={{ left: `calc(${activeLight.dimmerPercent ?? 100}% - 6px)` }} /><input type="range" min={1} max={100} value={activeLight.dimmerPercent ?? 100} onChange={(e) => syncLightUpdate(activeLight.id, { dimmerPercent: Number(e.target.value) })} className="absolute top-0 left-0 w-full h-2 opacity-0 cursor-pointer z-10" /></div></div>}</div>}
                </div>
              } />
            </div>
          </div>
          <div className="hidden md:block">
            <MemoizedAiAssistantPanel locale={locale} plant={activePlant} plants={plants} weather={weather} onPlantUpdate={updatePlant} onPatchPlant={patchActivePlant} onSelectPlant={setActivePlantId} onUpdateWateringData={patchWateringData} onUpdateClimateData={patchClimateData} onToggleNotification={handleToggleNotification} notificationsEnabled={notificationsEnabled} onAddNote={handleAddAiNote} onCreatePlant={(v: { strainName: string; stage: GrowStage }) => _addPlant(v)} calendarConfig={calendarConfig} />
          </div>
        </div>

        <div className="grid gap-4">
          <VPDChart currentVpd={liveVpd} currentTemp={activePlant.growTempC} currentHumidity={activePlant.growHumidity} currentStage={activePlant.stage} isOpen={isVpdChartOpen} onClose={() => setIsVpdChartOpen(false)} onStageChange={(s) => patchActivePlant({ stage: s })} />
          <AiAssistantTutorialModal isOpen={isTutorialOpen} onClose={() => setIsTutorialOpen(false)} />
          <ConfirmationModal isOpen={confirmState.isOpen} options={confirmState.options} onConfirm={handleConfirm} onCancel={handleCancel} />
          <LightConfigModal isOpen={isLightModalOpen} onClose={() => setIsLightModalOpen(false)} onSave={handleSaveLight} existingLights={allPoolLights} onDeleteLight={handleDeleteLight} onSelectLight={handleSelectLight} activeLightId={activeLightId} currentStage={activePlant.stage} />
          <CalendarConfigModal isOpen={isCalendarConfigOpen} onClose={() => setIsCalendarConfigOpen(false)} onSave={() => {}} />
          <MemoizedGrowChart onOpenVpdChart={() => setIsVpdChartOpen(true)} plantId={activePlant.id} logs={[]} wateringData={activePlant.wateringData} climateData={activePlant.climateData} stage={activePlant.stage} locale={locale} wateringIntervalDays={activePlant.wateringIntervalDays} onWateringDataChange={patchWateringData} onClimateDataChange={patchClimateData} onUpdateInterval={(d) => patchActivePlant({ wateringIntervalDays: d })} onWaterNow={() => {
            const liters = activePlant.waterInputMl / 1000;
            const period = getNutrientPeriodKey({ stage: activePlant.stage as GrowStage, seedlingDays: cycleDetailed.daysInSeedling, vegDays: cycleDetailed.daysInVeg, bloomDays: cycleDetailed.daysInBloom, seedlingTarget: calendarConfig?.seedlingDuration ?? STAGE_TARGETS.seedling, vegTarget: calendarConfig?.vegDuration ?? STAGE_TARGETS.veg, bloomTarget: calendarConfig?.bloomDuration ?? STAGE_TARGETS.bloom });
            patchWateringData([...activePlant.wateringData, { id: generateUUID(), timestamp: new Date(nowMs).toISOString(), amountMl: activePlant.waterInputMl, ph: activePlant.waterPh, ec: activePlant.waterEc, isFeed: true, recipeSnapshot: getRecipeSnapshotData({ periodKey: period, liters, targetEc: activePlant.waterEc }) }]);
          }} config={calendarConfig || undefined} labels={{ progression: t.progression, tempHumidityVpd: t.tempHumidityVpd }} />
             <div className=" glass-panel rounded-3xl p-4 ">
              <div className="flex items-center justify-between"><div><p className="font-mono text-[11px] uppercase tracking-[0.28em] text-lime-200">{t.timeline}</p><h3 className="mt-2 text-lg font-semibold text-lime-100">{activePlant.strainName}</h3></div><button onClick={() => setIsCalendarConfigOpen(true)} className="p-2 hover:bg-white/10 border border-lime-300/20 rounded-lg transition"><Settings className="h-5 w-5 text-lime-300" /></button></div>
              <div className="mt-4 gap-2 xl:flex md:grid md:grid-cols-2">
                <MiniInfo label={t.stage} value={<EditableStage value={activePlant.stage} onSave={(s) => patchActivePlant({ stage: s })} />} />
                <MiniInfo label={t.totalDays} value={<span className="text-sm font-semibold text-lime-100">{cycleDetailed.totalDays} days</span>} />
                <MiniInfo
                  label="Seedling Start"
                  icon={<Sprout className="h-6 w-6 text-green-400" />}
                  accentClass="border-l-4 border-green-400"
                  value={<EditableDate dateIso={activePlant.startedAt} locale={locale} onSave={(v) => patchActivePlant({ startedAt: `${v}T09:00:00.000Z` })} disabled={!!activePlant.vegStartedAt} />}
                  footer={`${cycleDetailed.daysInSeedling} days`}
                />
                <MiniInfo
                  label="Vegging Start"
                  icon={<Cannabis className="h-6 w-6 text-green-500" />}
                  accentClass="border-l-4 border-green-500"
                  value={<EditableDate dateIso={activePlant.vegStartedAt || ""} locale={locale} onSave={(v) => patchActivePlant({ vegStartedAt: v ? `${v}T09:00:00.000Z` : undefined, stage: v ? "Veg" : "Seedling" })} disabled={!!activePlant.bloomStartedAt} />}
                  footer={activePlant.vegStartedAt ? `${cycleDetailed.daysInVeg} days` : "Not started"}
                />
                <MiniInfo
                  label="Bloom Start"
                  icon={<Wheat className="h-6 w-6 text-indigo-500" />}
                  accentClass="border-l-4 border-indigo-500"
                  value={<EditableDate dateIso={activePlant.bloomStartedAt || ""} locale={locale} onSave={(v) => patchActivePlant({ bloomStartedAt: v ? `${v}T09:00:00.000Z` : undefined, stage: v ? "Bloom" : (activePlant.vegStartedAt ? "Veg" : "Seedling") })} />}
                  footer={activePlant.bloomStartedAt ? `${cycleDetailed.daysInBloom} days` : "Not started"}
                />
              </div>
              <div className="lg:col-span-1 shadow-2xl shadow-emerald-950/20">
                <MemoizedPlantTimelineCalendar plant={activePlant} onUpdate={updatePlant} onDeleteNote={handleDeleteNote} />
              </div>
            </div>
            </div>
            <div className="glass-panel rounded-3xl p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-lime-200">Setup</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <MiniInfo label="Container" value={<EditableText value={`${activePlant.containerVolumeL} L`} onSave={(v) => patchActivePlant({ containerVolumeL: Number(v.replace(/[^\d.]/g, "")) || activePlant.containerVolumeL })} />} />
                <MiniInfo label="Media" value={<EditableText value={`${activePlant.mediaVolumeL} L`} onSave={(v) => patchActivePlant({ mediaVolumeL: Number(v.replace(/[^\d.]/g, "")) || activePlant.mediaVolumeL })} />} />
                <MiniInfo label="Type" value={<EditableText value={activePlant.mediaType} onSave={(v) => patchActivePlant({ mediaType: v })} />} />
              </div>
              <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.28em] text-lime-200">{t.feedRecipe}</p>
              <EditableText value={activePlant.feedRecipe.title} className="mt-2 text-lg font-semibold text-lime-100" onSave={(v) => patchActivePlant({ feedRecipe: { ...activePlant.feedRecipe, title: v } })} />
              <div className="mt-3 grid grid-cols-2 gap-2">
                <MiniInfo label="Average pH" value={<span className="text-sm font-semibold text-lime-100">{formatAvgPh(activePlant.wateringData)}</span>} />
                <MiniInfo label={calendarConfig?.measurementUnit === "PPM" ? "Average PPM" : "Average EC"} value={<span className="text-sm font-semibold text-lime-100">{formatAvgPpm(activePlant.wateringData, calendarConfig?.measurementUnit || "EC", calendarConfig?.hannaScale || 700)}</span>} />
              </div>
              <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 p-3">
                <div className="flex items-center justify-between mb-3"><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-lime-200">Nutrient calculator</p>
                  <div className="flex rounded-full border border-lime-300/20 bg-black/30 p-0.5">
                    <button type="button" onClick={() => setNutrientView("classic")} className={`rounded-full px-3 py-1 text-[10px] font-mono uppercase tracking-wider transition ${nutrientView === "classic" ? "bg-lime-300/20 text-lime-200" : "text-slate-400 hover:text-slate-300"}`}>Classic</button>
                    <button type="button" onClick={() => setNutrientView("checker")} className={`rounded-full px-3 py-1 text-[10px] font-mono uppercase tracking-wider transition ${nutrientView === "checker" ? "bg-lime-300/20 text-lime-200" : "text-slate-400 hover:text-slate-300"}`}>Checker</button>
                  </div>
                </div>
                {nutrientView === "classic" ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <div className="sm:col-span-2"><p className="text-[11px] text-lime-100/65">Period</p><select value={nutrientPeriodKey} onChange={(e) => setNutrientPeriodKey(e.target.value)} className="mt-1 w-full rounded-lg border border-lime-300/20 bg-black/30 px-2 py-1 text-sm text-lime-100 outline-none">{CANNA_AQUA_PERIODS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}</select></div>
                    <div><p className="text-[11px] text-lime-100/65">Water (L)</p><input type="number" min={0.5} step={0.5} value={nutrientLiters} onChange={(e) => setNutrientLiters(Math.max(0.5, Number(e.target.value) || 0.5))} className="mt-1 w-full rounded-lg border border-lime-300/20 bg-black/30 px-2 py-1 text-sm text-lime-100 outline-none" /></div>
                    <div><p className="text-[11px] text-lime-100/65">Target {calendarConfig?.measurementUnit === 'PPM' ? 'PPM' : 'EC'}</p><input type="number" step={calendarConfig?.measurementUnit === 'PPM' ? 10 : 0.05} value={calendarConfig?.measurementUnit === 'PPM' ? Math.round(nutrientTargetEc * (calendarConfig.hannaScale || 700)) : nutrientTargetEc} onChange={(e) => { const v = Math.max(0, Number(e.target.value) || 0); setNutrientTargetEc(calendarConfig?.measurementUnit === 'PPM' ? v / (calendarConfig.hannaScale || 700) : v); }} className="mt-1 w-full rounded-lg border border-lime-300/20 bg-black/30 px-2 py-1 text-sm text-lime-100 outline-none" /></div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 sm:col-span-3">{renderCannaMix({ periodKey: nutrientPeriodKey, liters: nutrientLiters, targetEc: nutrientTargetEc, config: calendarConfig || undefined })}</div>
                  </div>
                ) : <MemoizedNutrientChecker plant={activePlant} config={calendarConfig || undefined} />}
              </div>
            </div>
      </section>
      <button type="button" onClick={() => setIsAiChatOpen(true)} className="md:hidden fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-lime-300/40 bg-gradient-to-br from-lime-300/25 via-emerald-400/20 to-teal-300/25 text-lime-100 shadow-[0_0_30px_8px_rgba(178,255,102,0.18),0_0_50px_16px_rgba(16,185,129,0.12)] transition-all hover:scale-105 active:scale-95"><MessageCircle className="h-6 w-6" /></button>
      <AiChatModal isOpen={isAiChatOpen} onClose={() => setIsAiChatOpen(false)} locale={locale} plant={activePlant} plants={plants} weather={weather} onPlantUpdate={updatePlant} onPatchPlant={patchActivePlant} onSelectPlant={setActivePlantId} onUpdateWateringData={patchWateringData} onUpdateClimateData={patchClimateData} onToggleNotification={handleToggleNotification} notificationsEnabled={notificationsEnabled} onAddNote={handleAddAiNote} />
    </main>
  );
}

// ─── UI Helper Components ─────────────────────────────────────────────────────

const CompactMetric = memo(({
  label,
  value,
  helper,
  icon,
  statusColor
}: {
  label: string;
  value: React.ReactNode;
  helper: React.ReactNode;
  icon: React.ReactNode;
  statusColor: React.ReactNode;
}) => (
  <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
    <div className="flex items-center justify-between gap-3">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-lime-200">{label}</p>
      <div className="rounded-xl border border-lime-300/20 bg-lime-300/12 p-2 text-lime-200">{icon}</div>
    </div>
    <div className="mt-3">{value}</div>
    <div className="mt-1">{helper}</div>
    <div className="mt-1">{statusColor}</div>
  </div>
));

const MiniInfo = memo(({ label, value, icon, accentClass, footer }: { label: React.ReactNode; value: React.ReactNode; icon?: React.ReactNode; accentClass?: string; footer?: React.ReactNode }) => (
  <div className={`rounded-2xl border bg-white/5 p-3 ${accentClass ??  ""} border-white/8`}>
    <div className=" items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        {icon && <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-lime-300/20 bg-lime-300/12 text-lime-200">{icon}</span>}
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-lime-200">{label}</p>
      </div>
       <div className="flex items-center gap-2">
       <div className="mt-2 text-sm font-semibold text-lime-100">{value}</div>
    {footer && <div className="mt-2 text-sm font-semibold text-lime-100">{footer}</div>}
    </div>
    </div>
   
  </div>
));

const EditableText = memo(({ value, onSave, className }: { value: string; onSave: (value: string) => void; className?: string }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => { if (!editing) setDraft(value); }, [editing, value]);
  if (!editing) return <button type="button" onDoubleClick={() => setEditing(true)} className={`text-left ${className ?? ""}`} title="Double click to edit">{value}</button>;
  return <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => { setEditing(false); if (draft.trim()) onSave(draft.trim()); }} onKeyDown={(e) => { if (e.key === "Enter") { setEditing(false); if (draft.trim()) onSave(draft.trim()); } }} className="w-full rounded-lg border border-lime-300/30 bg-black/20 px-2 py-1 text-sm text-lime-100 outline-none" />;
});

const EditableDate = memo(({ dateIso, locale, onSave, placeholder, minDate, maxDate, disabled }: { dateIso: string; locale: Locale; onSave: (value: string) => void; placeholder?: string; minDate?: string; maxDate?: string; disabled?: boolean }) => {
  const [editing, setEditing] = useState(false);
  const hasDate = dateIso && dateIso.length > 0;
  const formatted = hasDate ? new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" }).format(new Date(dateIso)) : placeholder || "Not set";
  if (disabled) return <div className="text-left text-sm font-semibold text-lime-100/40 cursor-not-allowed">{formatted}</div>;
  if (!editing) return <button type="button" onDoubleClick={() => setEditing(true)} className={`text-left text-sm font-semibold ${hasDate ? "text-lime-100" : "text-lime-100/50 italic"}`}>{formatted}</button>;
  return <input type="date" autoFocus defaultValue={hasDate ? dateIso.slice(0, 10) : ""} min={minDate || ""} max={maxDate || ""} onBlur={(e) => { setEditing(false); onSave(e.target.value || ""); }} onKeyDown={(e) => { if (e.key === "Enter") { setEditing(false); onSave((e.currentTarget as HTMLInputElement).value || ""); } else if (e.key === "Escape") setEditing(false); }} className="w-full rounded-lg border border-lime-300/30 bg-black/20 px-2 py-1 text-sm text-lime-100 outline-none" />;
});

const EditableStage = memo(({ value, onSave }: { value: GrowStage; onSave: (value: GrowStage) => void }) => {
  const [editing, setEditing] = useState(false);
  if (!editing) return <button type="button" onDoubleClick={() => setEditing(true)} className="text-left text-sm font-semibold text-lime-100">{value}</button>;
  return <select autoFocus defaultValue={value} onBlur={(e) => { setEditing(false); onSave(e.target.value as GrowStage); }} className="w-full rounded-lg border border-lime-300/30 bg-black/20 px-2 py-1 text-sm text-lime-100 outline-none"><option value="Seedling">Seedling</option><option value="Veg">Vegging</option><option value="Bloom">Bloom</option></select>;
});

const EditableNumber = memo(({ value, onSave, suffix }: { value: number; onSave: (value: number) => void; suffix?: string }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { if (!editing) setDraft(String(value)); }, [editing, value]);
  if (!editing) return <button type="button" onDoubleClick={() => setEditing(true)} className="text-left text-sm font-semibold text-lime-100">{value}{suffix ?? ""}</button>;
  return <input autoFocus type="number" step="0.01" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => { setEditing(false); const n = Number(draft); if (Number.isFinite(n)) onSave(n); }} onKeyDown={(e) => { if (e.key === "Enter") { setEditing(false); const n = Number(draft); if (Number.isFinite(n)) onSave(n); } }} className="w-20 rounded-lg border border-lime-300/30 bg-black/20 px-2 py-1 text-sm text-lime-100 outline-none" />;
});

const EditableDateTime = memo(({ dateIso, onSave, displayValue }: { dateIso: string; onSave: (value: string) => void; displayValue: string }) => {
  const [editing, setEditing] = useState(false);
  if (!editing) return <button type="button" onDoubleClick={() => setEditing(true)} className="text-left text-xs text-lime-100">{displayValue}</button>;
  return <input type="datetime-local" autoFocus defaultValue={toDatetimeLocal(dateIso)} onBlur={(e) => { setEditing(false); if (e.target.value) onSave(new Date(e.target.value).toISOString()); }} onKeyDown={(e) => { if (e.key === "Enter") { setEditing(false); const v = (e.currentTarget as HTMLInputElement).value; if (v) onSave(new Date(v).toISOString()); } }} className="w-40 rounded-lg border border-lime-300/30 bg-black/20 px-2 py-1 text-xs text-lime-100 outline-none" />;
});

function getStageIcon(stage: GrowStage) {
  if (stage === "Seedling") return <Sprout className="h-5 w-5 text-green-200" />;
  if (stage === "Veg") return <Cannabis className="h-5 w-5 text-green-500" />;
  if (stage === "Bloom") return <Wheat className="h-5 w-5 text-indigo-500" />;
  return <Leaf className="h-5 w-5 text-lime-300" />;
}

const StageProgressBar = memo(({ seedlingDays, vegDays, bloomDays, seedlingTarget, vegTarget, bloomTarget }: { seedlingDays: number; vegDays: number; bloomDays: number; seedlingTarget: number; vegTarget: number; bloomTarget: number; }) => {
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const sPct = clamp01(seedlingDays / seedlingTarget);
  const vPct = clamp01(vegDays / vegTarget);
  const bPct = clamp01(bloomDays / bloomTarget);
  return (
    <div className="mt-2 grid grid-cols-3 gap-2">
      <div className="overflow-hidden rounded-full bg-white/10"><div className="h-2 rounded-full bg-green-500/80" style={{ width: `${Math.round(sPct * 100)}%` }} /></div>
      <div className="overflow-hidden rounded-full bg-white/10"><div className="h-2 rounded-full bg-green-300/80" style={{ width: `${Math.round(vPct * 100)}%` }} /></div>
      <div className="overflow-hidden rounded-full bg-white/10"><div className="h-2 rounded-full bg-indigo-500/100" style={{ width: `${Math.round(bPct * 100)}%` }} /></div>
    </div>
  );
});

function renderCannaMix({ periodKey, liters, targetEc, config }: { periodKey: string; liters: number; targetEc: number, config?: CalendarConfig }) {
  const period = CANNA_AQUA_PERIODS.find((p) => p.key === periodKey) ?? CANNA_AQUA_PERIODS[0];
  const scale = period.ecTotal > 0 ? targetEc / period.ecTotal : 1;
  const items = getRecipeSnapshotData({ periodKey, liters, targetEc });
  return (
    <>
      <div className="rounded-2xl border border-white/8 bg-white/5 p-4 sm:col-span-2">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-lime-200">Mix result</p>
        <div className="mt-3 grid grid-cols-[1.2fr_1fr_1fr] gap-2 text-xs text-lime-100/75"><span>Product</span><span className="text-right">ml/L (scaled)</span><span className="text-right">Total ml</span></div>
        <div className="mt-1.5 border-t border-lime-300/15" />
        <div className="mt-3 space-y-2">
          {items.map((item) => {
            const numericMatch = item.value.match(/^([0-9.]+)(?:–([0-9.]+))?\s*ml$/i);
            const totalMl = numericMatch ? numericMatch[2] ? `${numericMatch[1]}-${numericMatch[2]}` : numericMatch[1] : item.value;
            const perLiter = numericMatch ? numericMatch[2] ? `${(Number(numericMatch[1]) / liters).toFixed(2)}-${(Number(numericMatch[2]) / liters).toFixed(2)}` : (Number(numericMatch[1]) / liters).toFixed(2) : "-";
            return <div key={item.label + item.value} className="grid grid-cols-[1.2fr_1fr_1fr] gap-2 text-sm sm:text-base"><span className="text-lime-100/80">{item.label}</span><span className="text-right text-lime-100/80">{perLiter}</span><span className="text-right font-semibold text-lime-100">{totalMl}</span></div>;
          })}
        </div>
        <p className="mt-4 text-xs text-lime-100/65">
          Scaled from chart EC total {period.ecTotal} to target EC {targetEc.toFixed(2)} (x{Number(scale.toFixed(2))}).
        </p>
      </div>
      {config?.measurementUnit !== 'PPM' ? (
        <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-lime-200">PPM target</p>
          <p className="mt-2 text-lg font-semibold text-lime-100">{Math.round(targetEc * (config?.hannaScale || 700))} PPM</p>
          <p className="mt-1 text-xs text-lime-100/65">Uses {config?.hannaScale || 700} ppm/EC conversion.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-lime-200">EC target</p>
          <p className="mt-2 text-lg font-semibold text-lime-100">{targetEc.toFixed(2)} EC</p>
          <p className="mt-1 text-xs text-lime-100/65">Reverse scaled from PPM.</p>
        </div>
      )}
    </>
  );
}
