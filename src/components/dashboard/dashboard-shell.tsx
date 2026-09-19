"use client";

import { useEffect, useMemo, useState, useRef, useCallback, memo, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Download, Droplets, Flower, Info, Leaf, Lightbulb, Minus, Plus, RotateCcw, Settings, Sprout, Thermometer, Upload, Waves, X, Wheat, Cannabis, Layers } from "lucide-react";
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
import { buildSpaceExport, buildThemedPlantExport, buildThemedPlantExportHtml, getExportFileName, getSpaceExportFileName, parseImportedPlantJson, parseImportedSpace } from "@/lib/plant-transfer";
import { saveBackupSnapshot, savePlant, saveSpace, setSetting } from "@/lib/indexeddb-storage";
import type { GrowStage, PlantProfile, LightProfile, CalendarConfig, ClimateEntry } from "@/lib/types";
import { AiChatModal } from "@/components/dashboard/ai-chat-modal";
import { MessageCircle } from "lucide-react";
import { useCurrentTime } from "@/lib/time-context";

import { SpaceSelector } from "@/components/spaces/space-selector";
import { PlantDetailModal } from "@/components/dashboard/plant-detail-modal";
import { LightConfigPanel } from "@/components/dashboard/light-config-panel";

// Hooks
import { usePlants } from "@/hooks/use-plants";
import { useSpaces } from "@/hooks/use-spaces";
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
  const {
    spaces,
    activeSpaceId,
    activeSpace,
    setActiveSpaceId,
    addSpace,
    removeSpace,
    patchActiveSpace,
    movePlantToSpace,
    removePlantFromAllSpaces,
    pruneDanglingPlantRefs,
    getCurrentSpacePlantsSync,
    loadedFromServer: spacesLoaded
  } = useSpaces(plants, loadedFromServer);
  const spacePlants = getCurrentSpacePlantsSync();
  const spaceClimateData = activeSpace?.weatherData ?? [];

  const handleSelectSpace = useCallback((spaceId: string) => {
    setActiveSpaceId(spaceId);
    const firstPlant = getCurrentSpacePlantsSync(spaceId)[0];
    if (firstPlant) setActivePlantId(firstPlant.id);
  }, [getCurrentSpacePlantsSync, setActivePlantId, setActiveSpaceId]);

// Keep the selected plant in the active space when data loads or a plant is
  // moved. The explicit switch handler above always selects the first plant.
  useEffect(() => {
    if (spacePlants.length > 0 && !spacePlants.some((plant) => plant.id === activePlantId)) {
      setActivePlantId(spacePlants[0].id);
    }
  }, [activePlantId, activeSpaceId, setActivePlantId, spacePlants]);

  // Once plants are known, prune any stale plant id references in spaces.
  useEffect(() => {
    if (!loadedFromServer) return;
    if (plants.length === 0) return;
    pruneDanglingPlantRefs(plants);
  }, [loadedFromServer, plants, pruneDanglingPlantRefs]);

  // Preserve existing history from the former plant-scoped model. Once copied,
  // all reads and writes use the space record exclusively.
  useEffect(() => {
    if (!activeSpace || activeSpace.weatherData.length > 0) return;
    const legacyEntries = spacePlants.flatMap((plant) => plant.climateData ?? []);
    if (legacyEntries.length === 0) return;

    const entriesById = new Map(legacyEntries.map((entry) => [entry.id, entry]));
    const migrated = Array.from(entriesById.values()).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    patchActiveSpace({ weatherData: migrated });
  }, [activeSpace, patchActiveSpace, spacePlants]);

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
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement | null>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const flushQueueRef = useRef(Promise.resolve());
  const [plantDetailId, setPlantDetailId] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    options: ConfirmationOptions | null;
    resolve: ((value: boolean) => void) | null;
  }>({ isOpen: false, options: null, resolve: null });
  const importFileInputRef = useRef<HTMLInputElement | null>(null);

  // Close add dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
        setIsAddMenuOpen(false);
      }
    };
    if (isAddMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isAddMenuOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    if (isExportMenuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isExportMenuOpen]);

  useEffect(() => {
    if (!loadedFromServer || !spacesLoaded || plants.length === 0 || spaces.length === 0) return;

    let timeout: ReturnType<typeof setTimeout> | null = null;
    const flushState = async () => {
      const writesSucceeded = (await Promise.all([
        ...plants.map((plant) => savePlant(plant)),
        ...spaces.map((space) => saveSpace(space)),
        setSetting("activePlantId", activePlantId),
        setSetting("activeSpaceId", activeSpaceId)
      ])).every(Boolean);

      if (!writesSucceeded) {
        console.error("[Backup] IndexedDB persistence failed; server fallback was not updated.");
        return;
      }

      await saveBackupSnapshot({
        id: "latest",
        savedAt: new Date().toISOString(),
        plants,
        spaces,
        activePlantId,
        activeSpaceId
      });

      const response = await fetch("/api/plants", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plants, activePlantId, spaces, activeSpaceId })
      });
      if (!response.ok) {
        throw new Error(`Server fallback save failed (${response.status})`);
      }
    };

    const queueFlush = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        flushQueueRef.current = flushQueueRef.current
          .then(flushState)
          .catch((error) => console.error("[Backup] Flush failed:", error));
      }, 1500);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "hidden") return;
      if (timeout) clearTimeout(timeout);
      flushQueueRef.current = flushQueueRef.current
        .then(flushState)
        .catch((error) => console.error("[Backup] Visibility flush failed:", error));
    };

    queueFlush();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      if (timeout) clearTimeout(timeout);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activePlantId, activeSpaceId, loadedFromServer, plants, spaces, spacesLoaded]);

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

  const addPlant = async () => {
    const newPlant = await _addPlant({});
    if (newPlant && activeSpace) {
      movePlantToSpace(newPlant.id, activeSpace.id);
    }
  };

  const handleExportActivePlant = async () => {
    if (!activePlant) return;
    const payload = buildThemedPlantExport(activePlant);
    let logoSrc = "/g-icon.png";
    try {
      const logoResponse = await fetch("/g-icon.png");
      const logoBlob = await logoResponse.blob();
      logoSrc = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : "/g-icon.png");
        reader.onerror = () => reject(new Error("Logo read failed"));
        reader.readAsDataURL(logoBlob);
      });
    } catch (error) {
      console.error("Failed to embed logo in export:", error);
    }
    const content = buildThemedPlantExportHtml(payload, logoSrc);
    const fileName = getExportFileName(activePlant);

    try {
      await fetch("/api/plants/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName, content })
      });
    } catch (error) {
      console.error("Failed to archive export:", error);
    }

    const blob = new Blob([content], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const handleExportActiveSpace = () => {
    if (!activeSpace) return;
    const payload = buildSpaceExport(activeSpace, plants);
    const content = JSON.stringify(payload, null, 2);
    const blob = new Blob([content], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = getSpaceExportFileName(activeSpace, new Date(payload.exportedAt));
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const handleImportPlantClick = () => {
    importFileInputRef.current?.click();
  };

  const handleImportPlantFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

try {
      const text = await file.text();
      let importedSpace: ReturnType<typeof parseImportedSpace> | null = null;
      try {
        importedSpace = parseImportedSpace(text);
      } catch {
        importedSpace = null;
      }

      if (importedSpace) {
        const importedPlantIds: Array<{ id: string }> = [];
        for (const plant of importedSpace.plants) {
          const added = await _addPlant(plant);
          if (added) importedPlantIds.push({ id: added.id });
        }
        await addSpace({ ...importedSpace.space, plants: importedPlantIds });
        return;
      }

      const importedPlant = parseImportedPlantJson(text);
      const currentNames = new Set(plants.map((plant) => plant.strainName.trim().toLowerCase()));
      if (currentNames.has(importedPlant.strainName.trim().toLowerCase())) {
        importedPlant.strainName = `${importedPlant.strainName} (Imported ${new Date().toISOString().slice(0, 10)})`;
      }
      const added = await _addPlant(importedPlant);
      if (added && activeSpace) {
        movePlantToSpace(added.id, activeSpace.id);
      }
    } catch (error) {
      console.error("Failed to import plant:", error);
      window.alert("Invalid Gbuddy export file. Please import an HTML or JSON file exported from this app.");
    }
  };

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
      removePlantFromAllSpaces(plantId);
    }
  };

  const handleRemoveSpace = async (spaceId: string) => {
    const spaceToDelete = spaces.find(s => s.id === spaceId);
    const confirmed = await showConfirmation({
      title: "Delete Space",
      message: `Are you sure you want to delete "${spaceToDelete?.name || "this space"}"?`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      variant: "danger"
    });
    if (confirmed) {
      await removeSpace(spaceId);
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

  const patchClimateData = (data: ClimateEntry[]) => {
    const validData = data.filter((c) => c.timestamp && !isNaN(new Date(c.timestamp).getTime()));
    const sorted = [...validData].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    patchActiveSpace({ weatherData: sorted });
  };

  // ─── Light Management (Associated with Space) ──────────────────────────────

  const allPoolLights = useMemo(() => {
    const lightsMap = new Map<string, LightProfile>();
    // Primary: active space lights
    (activeSpace?.lightData ?? []).forEach((l) => lightsMap.set(l.id, l));
    // Fallback/Legacy: active plant lights
    (activePlant?.lights ?? []).forEach((l) => lightsMap.set(l.id, l));
    return Array.from(lightsMap.values());
  }, [activeSpace?.lightData, activePlant?.lights]);

  const activeLightId = activeSpace?.activeLightId ?? activePlant?.activeLightId ?? allPoolLights[0]?.id;
  const activeLight = allPoolLights.find((l) => l.id === activeLightId) ?? allPoolLights[0];

  const syncLightUpdate = (lightId: string, patch: Partial<LightProfile>) => {
    const updatedLights = allPoolLights.map((l) => (l.id === lightId ? { ...l, ...patch } : l));
    
    // Persist to Space
    if (activeSpace) {
      patchActiveSpace({
        lightData: updatedLights,
        ...(activeLightId === lightId ? { activeLightId: lightId } : {})
      });
    }

    // Sync to Active Plant for instant calculations and state
    if (activePlant) {
      patchActivePlant({
        lights: updatedLights,
        ...(activeLightId === lightId ? {
          activeLightId: lightId,
          lightsOn: patch.lightsOn ?? activePlant.lightsOn ?? "06:00",
          lightsOff: patch.lightsOff ?? activePlant.lightsOff ?? "22:00",
          lightDimmerPercent: patch.dimmerPercent !== undefined ? patch.dimmerPercent : activePlant.lightDimmerPercent,
          lightLampWatts: patch.watts ?? activePlant.lightLampWatts
        } : {})
      });
    }
  };

  const handleSaveLight = (light: LightProfile) => {
    const updatedLights = [...allPoolLights.filter((l) => l.id !== light.id), light];
    
    if (activeSpace) {
      patchActiveSpace({
        lightData: updatedLights,
        activeLightId: light.id
      });
    }

    if (activePlant) {
      patchActivePlant({
        lights: updatedLights,
        activeLightId: light.id,
        lightsOn: light.lightsOn,
        lightsOff: light.lightsOff,
        lightDimmerPercent: light.dimmerPercent,
        lightLampWatts: light.watts
      });
    }
  };

  const handleDeleteLight = (id: string) => {
    const updated = allPoolLights.filter((l) => l.id !== id);
    const nextActiveId = activeLightId === id ? updated[0]?.id : activeLightId;
    
    if (activeSpace) {
      patchActiveSpace({
        lightData: updated,
        activeLightId: nextActiveId
      });
    }

    if (activePlant) {
      patchActivePlant({
        lights: updated,
        activeLightId: nextActiveId
      });
    }
  };

  const handleSelectLight = (id: string) => {
    const light = allPoolLights.find((l) => l.id === id);
    if (light) {
      if (activeSpace) {
        patchActiveSpace({
          activeLightId: id
        });
      }

      if (activePlant) {
        patchActivePlant({
          activeLightId: id,
          lightsOn: light.lightsOn,
          lightsOff: light.lightsOff,
          lightDimmerPercent: light.dimmerPercent,
          lightLampWatts: light.watts
        });
      }
    }
  };

  // ─── Loading / Empty States ───────────────────────────────────────────────

  // ─── Redirect to Home if no plants (Onboarding Hub) ───────────────────────
  useEffect(() => {
    if (loadedFromServer && plants.length === 0) {
      console.log('Dashboard loaded with no plants. Redirecting to home page for onboarding...');
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
  const latestSpaceClimate = spaceClimateData[spaceClimateData.length - 1];
  const spaceTempC = latestSpaceClimate?.tempC ?? activePlant.growTempC;
  const spaceHumidity = latestSpaceClimate?.humidity ?? activePlant.growHumidity;
  const liveVpd = calculateVpd(spaceTempC, spaceHumidity);
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
              <SpaceSelector spaces={spaces} activeSpaceId={activeSpaceId} onSelectSpace={handleSelectSpace} />
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
            {/* ─── Space Level Container & Plant Selector Cards ─────────────────── */}
            <div className="mt-4 rounded-3xl border border-white/8 bg-white/[0.03] p-4 sm:p-5 backdrop-blur-md">
              {/* Space Header & Switcher Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 pb-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-lime-300/30 bg-lime-300/15 text-lime-300 shadow-[0_0_12px_rgba(163,230,53,0.2)]">
                    <Layers className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-lime-300/70">Space</p>
                    <EditableText
                      value={activeSpace?.name || "Space"}
                      className="text-base sm:text-lg font-bold text-lime-100 hover:text-white transition"
                      onSave={(v) => patchActiveSpace({ name: v })}
                    />
                  </div>
                </div>

                {/* Space Switcher Tabs (if multiple spaces) */}
                {spaces.length > 1 && (
                  <div className="flex items-center gap-1 overflow-x-auto rounded-full border border-white/10 bg-black/40 p-1">
                    {spaces.map((s) => (
                      <div key={s.id} className="relative group/tab flex items-center">
                        <button
                          type="button"
                          onClick={() => handleSelectSpace(s.id)}
                          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                            s.id === activeSpaceId
                              ? "border border-lime-300/30 bg-lime-300/20 text-lime-200 font-semibold shadow-[0_0_10px_rgba(163,230,53,0.15)]"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          {s.name}
                        </button>
                        {spaces.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveSpace(s.id);
                            }}
                            className="ml-0.5 rounded-full p-0.5 text-slate-500 hover:text-red-400 opacity-0 group-hover/tab:opacity-100 transition"
                            title="Delete space"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <input ref={importFileInputRef} type="file" accept="text/html,application/json,.html,.json" onChange={handleImportPlantFile} className="hidden" />
                  <div className="relative" ref={exportMenuRef}>
                    <button type="button" onClick={() => setIsExportMenuOpen((previous) => !previous)} className="rounded-full border border-lime-300/20 bg-lime-300/12 p-2 text-lime-100 hover:bg-lime-300/22 transition" title="Export plant or space">
                      <Download className="h-4 w-4" />
                    </button>
                    {isExportMenuOpen && (
                      <div className="absolute right-0 top-full z-50 mt-2 w-44 rounded-2xl border border-lime-300/20 bg-slate-900/95 p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur-xl">
                        <button type="button" onClick={() => { setIsExportMenuOpen(false); void handleExportActivePlant(); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium text-lime-100 hover:bg-lime-300/15 hover:text-white transition">
                          <Sprout className="h-3.5 w-3.5 text-lime-300" /> Export plant
                        </button>
                        <button type="button" onClick={() => { setIsExportMenuOpen(false); handleExportActiveSpace(); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium text-lime-100 hover:bg-lime-300/15 hover:text-white transition">
                          <Layers className="h-3.5 w-3.5 text-lime-300" /> Export space
                        </button>
                      </div>
                    )}
                  </div>
                  <button type="button" onClick={handleImportPlantClick} className="rounded-full border border-lime-300/20 bg-lime-300/12 p-2 text-lime-100 hover:bg-lime-300/22 transition" title="Import plant HTML or JSON"><Upload className="h-4 w-4" /></button>

                  {/* Combined Add Button with Dropdown Tooltip */}
                  <div className="relative" ref={addMenuRef}>
                    <button
                      type="button"
                      onClick={() => setIsAddMenuOpen((prev) => !prev)}
                      className={`rounded-full border p-2 transition shadow-[0_0_10px_rgba(163,230,53,0.15)] ${
                        isAddMenuOpen
                          ? "border-lime-400 bg-lime-300/25 text-white scale-105"
                          : "border-lime-300/25 bg-lime-300/12 text-lime-100 hover:bg-lime-300/22"
                      }`}
                      title="Add new plant or space"
                    >
                      <Plus className={`h-4 w-4 transition-transform duration-200 ${isAddMenuOpen ? "rotate-45" : ""}`} />
                    </button>

                    {/* Tooltip Dropdown Menu */}
                    {isAddMenuOpen && (
                      <div className="absolute right-0 top-full mt-2 w-48 rounded-2xl border border-lime-300/20 bg-slate-900/95 p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur-xl z-50">
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddMenuOpen(false);
                            addPlant();
                          }}
                          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-lime-100 hover:bg-lime-300/15 hover:text-white transition"
                        >
                          <div className="flex h-6 w-6 items-center justify-center rounded-lg border border-lime-300/30 bg-lime-300/15 text-lime-300">
                            <Sprout className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <p className="font-semibold text-lime-100">New Plant</p>
                            <p className="text-[10px] text-lime-100/60">Add to {activeSpace?.name || "Space"}</p>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setIsAddMenuOpen(false);
                            addSpace();
                          }}
                          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-lime-100 hover:bg-lime-300/15 hover:text-white transition"
                        >
                          <div className="flex h-6 w-6 items-center justify-center rounded-lg border border-lime-300/30 bg-lime-300/15 text-lime-300">
                            <Layers className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <p className="font-semibold text-lime-100">New Space</p>
                            <p className="text-[10px] text-lime-100/60">Create a new grow space</p>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Space Aggregated Weather & Light Index */}
              <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/6 bg-black/30 px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs text-lime-100/80">
                  <div className="flex items-center gap-1.5">
                    <Thermometer className="h-3.5 w-3.5 text-lime-300" />
                    <span className="text-lime-200/60 font-mono uppercase text-[10px]">Climate:</span>
                    <span className="font-semibold text-lime-100">{`${spaceTempC}°C / ${spaceHumidity}%`}</span>
                    <span className="text-[10px] text-lime-100/50 hidden sm:inline">(Out: {weather?.temperatureC ?? "--"}°C)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Waves className="h-3.5 w-3.5 text-lime-300" />
                    <span className="text-lime-200/60 font-mono uppercase text-[10px]">VPD:</span>
                    <span className="font-semibold text-lime-100">{liveVpd} kPa</span>
                    <span className={`text-[10px] ${vpdBand.tone}`}>({vpdBand.label})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Lightbulb className="h-3.5 w-3.5 text-lime-300" />
                    <span className="text-lime-200/60 font-mono uppercase text-[10px]">Light:</span>
                    <span className={`font-semibold ${scheduleDisplay.color}`}>{scheduleDisplay.text}</span>
                    <span className={`inline-block h-2 w-2 rounded-full ${isLightsOnNow(activeLight?.lightsOn ?? activePlant?.lightsOn ?? "06:00", activeLight?.lightsOff ?? activePlant?.lightsOff ?? "00:00", nowMs) ? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]" : "bg-slate-600"}`} />
                  </div>
                </div>
                <div className="text-[11px] font-mono uppercase tracking-wider text-lime-300/70">
                  {spacePlants.length} {spacePlants.length === 1 ? "Plant" : "Plants"} in Space
                </div>
              </div>

              {/* Plant Cards (shrunk, borderless card style with inline watering info) */}
              <div className="mt-3.5 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {spacePlants.map((plant) => {
                  const isActive = plant.id === activePlantId;
                  const daysSinceStart = Math.floor((Date.now() - new Date(plant.startedAt).getTime()) / (1000 * 60 * 60 * 24));
                  const countdown = getWateringCountdown(plant.lastWateredAt, plant.wateringIntervalDays);
                  const dryback = getDrybackPercent(plant.lastWateredAt, plant.wateringIntervalDays);
                  const ppmVal = Math.round(plant.waterEc * (calendarConfig?.hannaScale || 700));
                  const nutrientDisplay = calendarConfig?.measurementUnit === 'PPM' ? `${ppmVal} PPM` : `${plant.waterEc} EC`;

                  return (
                    <div
                      key={plant.id}
                      onClick={() => setActivePlantId(plant.id)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setActivePlantId(plant.id);
                        setPlantDetailId(plant.id);
                      }}
                      className={`group relative flex flex-col justify-between rounded-2xl p-3.5 cursor-pointer transition-all duration-200 ${
                        isActive
                          ? "border border-lime-300/35 bg-lime-300/12 shadow-[0_0_20px_rgba(163,230,53,0.12)] scale-[1.01]"
                          : "border border-white/5 bg-black/25 hover:border-white/15 hover:bg-white/[0.04]"
                      }`}
                    >
                      {/* Top Row: Strain Name & Stage */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="shrink-0">{getStageIcon(plant.stage)}</div>
                          <div className="min-w-0">
                            <p className={`truncate text-sm font-bold ${isActive ? "text-lime-100" : "text-slate-200"}`}>
                              {plant.strainName}
                            </p>
                            <p className="text-[10px] text-lime-100/60 font-mono">
                              {plant.stage} • Day {daysSinceStart}
                            </p>
                          </div>
                        </div>
                        {/* Delete button on hover */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removePlant(plant.id);
                          }}
                          className="rounded-full bg-red-500/80 p-1 text-white opacity-0 group-hover:opacity-100 hover:bg-red-600 transition"
                          title="Delete plant"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>

                      {/* Bottom Row: Watering Info (shrunk & borderless) */}
                      <div className="mt-3 pt-2.5 border-t border-white/6 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 text-lime-100/90 font-semibold">
                            <Droplets className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                            <span>{plant.waterInputMl} ml</span>
                          </div>
                          <div className="text-[11px] text-lime-100/70 font-mono">
                            pH {plant.waterPh} • {nutrientDisplay}
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-lime-100/60">
                          <span>{countdown === "0d 0h" ? "Due today" : `Due in ${countdown}`}</span>
                          <span className="font-mono">{Math.round(dryback)}%</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-1.5 rounded-full bg-gradient-to-r from-white/90 via-sky-300/70 to-sky-500/90 transition-all duration-700"
                            style={{ width: `${Math.min(100, Math.max(0, dryback))}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>


<div className="mt-4 grid gap-3 w-full ">
              {/* Light configuration moved to its own container below the Calendar */}
            </div>


          </div>
          <div className="hidden md:block">
            <MemoizedAiAssistantPanel locale={locale} plant={activePlant} plants={plants} weather={weather} onPlantUpdate={updatePlant} onPatchPlant={patchActivePlant} onSelectPlant={setActivePlantId} onUpdateWateringData={patchWateringData} onUpdateClimateData={patchClimateData} climateData={spaceClimateData} onToggleNotification={handleToggleNotification} notificationsEnabled={notificationsEnabled} onAddNote={handleAddAiNote} onCreatePlant={(v: { strainName: string; stage: GrowStage }) => _addPlant(v)} calendarConfig={calendarConfig} />
          </div>
        </div>

        <div className="grid gap-4">
          <VPDChart currentVpd={liveVpd} currentTemp={spaceTempC} currentHumidity={spaceHumidity} currentStage={activePlant.stage} isOpen={isVpdChartOpen} onClose={() => setIsVpdChartOpen(false)} onStageChange={(s) => patchActivePlant({ stage: s })} />
          <AiAssistantTutorialModal isOpen={isTutorialOpen} onClose={() => setIsTutorialOpen(false)} />
          <ConfirmationModal isOpen={confirmState.isOpen} options={confirmState.options} onConfirm={handleConfirm} onCancel={handleCancel} />
          <PlantDetailModal
            isOpen={plantDetailId !== null}
            plant={plantDetailId ? plants.find((p) => p.id === plantDetailId) ?? null : null}
            spaces={spaces}
            currentSpaceId={activeSpaceId}
            onClose={() => setPlantDetailId(null)}
            onPatch={(patch) => {
              const id = plantDetailId;
              if (!id) return;
              const target = plants.find((p) => p.id === id);
              if (!target) return;
              updatePlant({ ...target, ...patch });
            }}
            onMoveToSpace={(plantId, spaceId) => movePlantToSpace(plantId, spaceId)}
          />
          <LightConfigModal isOpen={isLightModalOpen} onClose={() => setIsLightModalOpen(false)} onSave={handleSaveLight} existingLights={allPoolLights} onDeleteLight={handleDeleteLight} onSelectLight={handleSelectLight} activeLightId={activeLightId} currentStage={activePlant.stage} />
            <CalendarConfigModal
              isOpen={isCalendarConfigOpen}
              onClose={() => setIsCalendarConfigOpen(false)}
              onSave={() => {}}
              notificationsEnabled={notificationsEnabled}
              onToggleNotification={handleToggleNotification}
            />
<MemoizedGrowChart onOpenVpdChart={() => setIsVpdChartOpen(true)} plantId={activePlant.id} logs={[]} wateringData={activePlant.wateringData} climateData={spaceClimateData} stage={activePlant.stage} locale={locale} wateringIntervalDays={activePlant.wateringIntervalDays} onWateringDataChange={patchWateringData} onClimateDataChange={patchClimateData} onUpdateInterval={(d) => patchActivePlant({ wateringIntervalDays: d })} onWaterNow={() => {
            const liters = activePlant.waterInputMl / 1000;
            const period = getNutrientPeriodKey({ stage: activePlant.stage as GrowStage, seedlingDays: cycleDetailed.daysInSeedling, vegDays: cycleDetailed.daysInVeg, bloomDays: cycleDetailed.daysInBloom, seedlingTarget: calendarConfig?.seedlingDuration ?? STAGE_TARGETS.seedling, vegTarget: calendarConfig?.vegDuration ?? STAGE_TARGETS.veg, bloomTarget: calendarConfig?.bloomDuration ?? STAGE_TARGETS.bloom });
            patchWateringData([...activePlant.wateringData, { id: generateUUID(), timestamp: new Date(nowMs).toISOString(), amountMl: activePlant.waterInputMl, ph: activePlant.waterPh, ec: activePlant.waterEc, isFeed: true, recipeSnapshot: getRecipeSnapshotData({ periodKey: period, liters, targetEc: activePlant.waterEc }) }]);
          }} currentVpd={liveVpd} currentTemp={spaceTempC} currentHumidity={spaceHumidity} config={calendarConfig || undefined} labels={{ progression: t.progression, tempHumidityVpd: t.tempHumidityVpd }} />
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
            <LightConfigPanel
              activePlant={activePlant}
              allPoolLights={allPoolLights}
              activeLight={activeLight}
              activeLightId={activeLightId}
              currentStage={activePlant.stage}
              nowMs={nowMs}
              activeSpace={activeSpace}
              notificationsEnabled={notificationsEnabled}
              onToggleNotification={handleToggleNotification}
              onSelectLight={handleSelectLight}
              onSyncLightUpdate={syncLightUpdate}
              onOpenAddLight={() => setIsLightModalOpen(true)}
              onPatchActivePlant={patchActivePlant}
              onAddLightSnapshot={(entry) => {
                if (activeSpace) {
                  patchActiveSpace({
                    ...activeSpace,
                    lightHistory: [...(activeSpace.lightHistory || []), entry]
                  });
                }
              }}
              onUpdateLightHistory={(history) => {
                if (activeSpace) {
                  patchActiveSpace({ ...activeSpace, lightHistory: history });
                }
              }}
            />
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
      <AiChatModal isOpen={isAiChatOpen} onClose={() => setIsAiChatOpen(false)} locale={locale} plant={activePlant} plants={plants} weather={weather} onPlantUpdate={updatePlant} onPatchPlant={patchActivePlant} onSelectPlant={setActivePlantId} onUpdateWateringData={patchWateringData} onUpdateClimateData={patchClimateData} climateData={spaceClimateData} onToggleNotification={handleToggleNotification} notificationsEnabled={notificationsEnabled} onAddNote={handleAddAiNote} />
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
  <div className={`rounded-2xl border  p-3 ${accentClass ??  ""} border-white/8  w-full`}>
    <div className=" items-center justify-between w-full gap-3">
      <div className="flex   items-center  gap-2">
        {icon && <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-lime-300/20 bg-lime-300/12 text-lime-200">{icon}</span>}
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-lime-200">{label}</p>
      </div>
       <div className="flex items-center w-full gap-2">
       <div className="mt-2 w-full text-sm font-semibold text-lime-100">{value}</div>
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
