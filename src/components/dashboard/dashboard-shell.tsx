"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { BookOpen, Download, Droplets, Flower, Info, Leaf, Lightbulb, Minus, Plus, RotateCcw, Settings, Sprout, Thermometer, Waves, X, Wheat, Cannabis } from "lucide-react";
import { GrowChart } from "@/components/charts/grow-chart";
import { AiAssistantPanel } from "@/components/dashboard/ai-assistant-panel-livekit";
import { VPDChart } from "@/components/dashboard/vpd-chart";
import { PlantTimelineCalendar } from "@/components/dashboard/plant-timeline-calendar";
import { CalendarConfigModal, CalendarConfig, loadCalendarConfig } from "@/components/dashboard/calendar-config-modal";
import { STAGE_TARGETS as DEFAULT_STAGE_TARGETS } from "@/lib/config";
import { FilePicker } from "@/components/dashboard/file-picker";
import { AiAssistantTutorialModal } from "@/components/dashboard/ai-assistant-tutorial-modal";
import { LightConfigModal } from "@/components/dashboard/light-config-modal";
import { ConfirmationModal, ConfirmationOptions } from "@/components/dashboard/confirmation-modal";
import { NutrientChecker } from "@/components/dashboard/nutrient-checker";
import { calculateVpd, getCycleSummary, getDetailedCycleSummary, getVpdBand } from "@/lib/grow-math";
import { STAGE_TARGETS, SAVE_DEBOUNCE_DELAY, WEATHER_REFRESH_INTERVAL, VALIDATION_RANGES } from "@/lib/config";
import { Locale, translations } from "@/lib/i18n";
import { dailyLogs, createNewPlant } from "@/lib/newplant-data";
import { EmptyStateOnboarding } from "@/components/onboarding/empty-state-onboarding";
import { generateUUID } from "@/lib/uuid";
import { 
  openDB, 
  getAllPlants, 
  savePlant, 
  deletePlant, 
  getSetting, 
  setSetting,
  initializeDB,
  seedTestPlants
} from "@/lib/indexeddb-storage";
import { exportToExcel } from "@/lib/excel-export";
import type { GrowStage, PlantProfile, LightProfile, LightType } from "@/lib/types";
import { LIGHT_TYPE_LABELS, LIGHT_TYPE_DEFAULT_WATTS } from "@/lib/types";
import { AiChatModal } from "@/components/dashboard/ai-chat-modal";
import { MessageCircle } from "lucide-react";

type DashboardShellProps = {
  heading: string;
  subheading: string;
  showHero?: boolean;
};

export function DashboardShell({ heading: _heading, subheading: _subheading, showHero: _showHero = false }: DashboardShellProps) {
  const locale: Locale = "en";
  const [plants, setPlants] = useState<PlantProfile[]>([]);
  const [activePlantId, setActivePlantId] = useState<string>("");
  const [loadedFromServer, setLoadedFromServer] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [weather, setWeather] = useState<{ temperatureC: number | null; humidity: number | null; location: string } | null>(null);
  const [nutrientLiters, setNutrientLiters] = useState(10);
  const [nutrientTargetEc, setNutrientTargetEc] = useState(1.6);
  const [nutrientPeriodKey, setNutrientPeriodKey] = useState("veg_phase_2");
  const [isVpdChartOpen, setIsVpdChartOpen] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [isLightModalOpen, setIsLightModalOpen] = useState(false);
  const [isCalendarConfigOpen, setIsCalendarConfigOpen] = useState(false);
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [calendarConfig, setCalendarConfig] = useState<CalendarConfig | null>(null);
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    options: ConfirmationOptions | null;
    resolve: ((value: boolean) => void) | null;
  }>({ isOpen: false, options: null, resolve: null });
  const [nutrientView, setNutrientView] = useState<"classic" | "checker">("classic");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const t = translations[locale];

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

  // Seed test plants
  const handleSeedTestData = async () => {
    const confirmed = await showConfirmation({
      title: "Seed Test Data",
      message: "This will add 3 test plants (Baby Green, Green Machine, Purple Haze) to your database. Existing plants won't be affected.",
      confirmLabel: "Add Test Plants",
      cancelLabel: "Cancel",
      variant: "info"
    });
    if (confirmed) {
      await seedTestPlants();
      // Reload plants list
      const loadedPlants = await getAllPlants();
      setPlants(loadedPlants);
      if (loadedPlants.length > 0) {
        setActivePlantId(loadedPlants[0].id);
      }
    }
  };

  // Refs for debounced save and latest plant state
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const plantsRef = useRef<PlantProfile[]>([]);
  const activePlantIdRef = useRef<string>("");

  // Keep refs in sync
  useEffect(() => {
    plantsRef.current = plants;
  }, [plants]);

  useEffect(() => {
    activePlantIdRef.current = activePlantId;
  }, [activePlantId]);

  // Stage duration targets imported from config

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  // Weather - increased refresh to 5 minutes (was 60s)
  useEffect(() => {
    let ignore = false;

    const loadWeather = async () => {
      try {
        const response = await fetch("/api/weather", { cache: "no-store" });
        const data = (await response.json()) as {
          ok: boolean;
          location?: string;
          temperatureC?: number | null;
          humidity?: number | null;
        };
        if (!ignore && data.ok) {
          setWeather({
            location: data.location ?? "Barreiro, Setubal, Portugal",
            temperatureC: data.temperatureC ?? null,
            humidity: data.humidity ?? null
          });
        }
      } catch {
        if (!ignore) {
          setWeather((current) => current ?? { location: "Barreiro, Setubal, Portugal", temperatureC: null, humidity: null });
        }
      }
    };

    void loadWeather();
    const weatherTimer = window.setInterval(() => void loadWeather(), WEATHER_REFRESH_INTERVAL);
    return () => {
      ignore = true;
      window.clearInterval(weatherTimer);
    };
  }, []);

  // Load calendar config for progress bar targets
  useEffect(() => {
    loadCalendarConfig().then((config) => setCalendarConfig(config));
  }, []);

  // Load notification preference
  useEffect(() => {
    getSetting("wateringNotification").then((val) => {
      setNotificationsEnabled(val === "true");
    });
  }, []);

  useEffect(() => {
    let ignore = false;

    const loadState = async () => {
      try {
        await initializeDB();
        const loadedPlants = await getAllPlants();
        const savedActivePlantId = await getSetting("activePlantId");

        if (!ignore && loadedPlants.length > 0) {
          setPlants(loadedPlants);
          if (!savedActivePlantId) {
            const sorted = [...loadedPlants].sort((a, b) => {
              const aDate = new Date(a.startedAt).getTime();
              const bDate = new Date(b.startedAt).getTime();
              return aDate - bDate;
            });
            setActivePlantId(sorted[0]?.id || loadedPlants[0].id);
          } else {
            setActivePlantId(savedActivePlantId);
          }
        }
      } catch (error) {
        console.error("Error loading from IndexedDB:", error);
      } finally {
        if (!ignore) {
          setLoadedFromServer(true);
        }
      }
    };

    void loadState();
    return () => {
      ignore = true;
    };
  }, []);

  // Debounced save to IndexedDB - prevents excessive writes on rapid edits
  useEffect(() => {
    if (!loadedFromServer) return;

    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce: wait configured delay after last change before saving
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        for (const plant of plants) {
          await savePlant(plant);
        }
        await setSetting("activePlantId", activePlantId);
      } catch (error) {
        console.error("Error saving to IndexedDB:", error);
      }
    }, SAVE_DEBOUNCE_DELAY);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [activePlantId, loadedFromServer, plants]);

  // Memoized: get first plant sorted by date
  const getFirstPlantByList = useCallback(() => {
    if (plants.length === 0) return undefined;
    const sorted = [...plants].sort((a, b) => {
      const aDate = new Date(a.startedAt).getTime();
      const bDate = new Date(b.startedAt).getTime();
      return aDate - bDate;
    });
    return sorted[0];
  }, [plants]);

  const activePlant = useMemo(
    () => plants.find((entry) => entry.id === activePlantId) ?? getFirstPlantByList(),
    [plants, activePlantId, getFirstPlantByList]
  );

  // Helper: calculate elapsed days from timestamps for the active plant
  const calculateElapsedDays = useCallback((plant: PlantProfile) => {
    const now = new Date();
    const startedAt = new Date(plant.startedAt);
    const totalDaysElapsed = Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / (1000 * 60 * 60 * 24)));

    let seedlingDays = 0;
    let vegDays = 0;
    let bloomDays = 0;

    // Seedling: from startedAt to vegStartedAt (or now if veg never started)
    if (plant.vegStartedAt) {
      const vegStarted = new Date(plant.vegStartedAt);
      seedlingDays = Math.max(0, Math.floor((vegStarted.getTime() - startedAt.getTime()) / (1000 * 60 * 60 * 24)));
    } else {
      seedlingDays = totalDaysElapsed;
    }

    // Veg: from vegStartedAt to bloomStartedAt (or now if bloom never started)
    if (plant.vegStartedAt) {
      const vegStarted = new Date(plant.vegStartedAt);
      if (plant.bloomStartedAt) {
        const bloomStarted = new Date(plant.bloomStartedAt);
        vegDays = Math.max(0, Math.floor((bloomStarted.getTime() - vegStarted.getTime()) / (1000 * 60 * 60 * 24)));
      } else {
        vegDays = Math.max(0, Math.floor((now.getTime() - vegStarted.getTime()) / (1000 * 60 * 60 * 24)));
      }
    }

    // Bloom: from bloomStartedAt to now
    if (plant.bloomStartedAt) {
      const bloomStarted = new Date(plant.bloomStartedAt);
      bloomDays = Math.max(0, Math.floor((now.getTime() - bloomStarted.getTime()) / (1000 * 60 * 60 * 24)));
    }

    return { seedlingDays, vegDays, bloomDays, totalDaysElapsed };
  }, []);

  // NOTE: Removed auto-update effect that was overwriting stageDays.
  // Day counts are now calculated directly from timestamps via calculateElapsedDays
  // and displayed as read-only values to avoid conflicts with manual edits.

  const addPlant = () => {
    const nextIndex = plants.length + 1;
    const next = createNewPlant({
      strainName: `New Plant ${nextIndex}`,
      // Copy settings from active plant if available
      ...(activePlant ? {
        lightSchedule: activePlant.lightSchedule,
        lightsOn: activePlant.lightsOn,
        lightsOff: activePlant.lightsOff,
        lightType: activePlant.lightType,
        lightDimmerPercent: activePlant.lightDimmerPercent,
        containerVolumeL: activePlant.containerVolumeL,
        mediaVolumeL: activePlant.mediaVolumeL,
        mediaType: activePlant.mediaType,
        wateringIntervalDays: activePlant.wateringIntervalDays,
        feedRecipe: {
          ...activePlant.feedRecipe,
          additives: activePlant.feedRecipe.additives.map((entry) => ({ ...entry, id: generateUUID() }))
        }
      } : {})
    });
    setPlants((current) => [...current, next]);
    setActivePlantId(next.id);
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
      try {
        await deletePlant(plantId);
        setPlants((current) => current.filter((p) => p.id !== plantId));
        if (activePlantId === plantId) {
          const remaining = plants.filter((p) => p.id !== plantId);
          setActivePlantId(remaining[0]?.id || "");
        }
      } catch (error) {
        console.error("Error deleting plant:", error);
        alert("Error deleting plant. Check console for details.");
      }
    }
  };

  if (!activePlant) {
    return (
      <main className="min-h-screen bg-hero-grid relative flex items-center justify-center">
        {/* Animated background orbs - behind all content */}
        <div className="bg-orb bg-orb--green" aria-hidden="true" />
        <div className="bg-orb bg-orb--purple" aria-hidden="true" />
        <div className="bg-orb bg-orb--orange" aria-hidden="true" />
        <div className="relative z-10">
          <EmptyStateOnboarding onCreatePlant={addPlant} />
        </div>
      </main>
    );
  }

  const cycle = getCycleSummary(activePlant);
  const cycleDetailed = getDetailedCycleSummary(activePlant);
  
  // Calculate elapsed days from timestamps for accurate progress
  const { seedlingDays: elapsedSeedling, vegDays: elapsedVeg, bloomDays: elapsedBloom, totalDaysElapsed } = calculateElapsedDays(activePlant);
  const liveVpd = calculateVpd(activePlant.growTempC, activePlant.growHumidity);
  const vpdBand = getVpdBand(activePlant.stage, liveVpd);
  const lastWateredLabel = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric"
  }).format(new Date(activePlant.lastWateredAt));
  const wateringCountdown = getWateringCountdown(activePlant.lastWateredAt, activePlant.wateringIntervalDays);
  const wateringProgress = getDrybackPercent(activePlant.lastWateredAt, activePlant.wateringIntervalDays);
  
  // Calculate next watering date based on latest watering entry (matches bottom table)
  const sortedWateringData = [...activePlant.wateringData].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  const latestWateringEntry = sortedWateringData[0];
  const nextWateringDate = latestWateringEntry
    ? new Date(new Date(latestWateringEntry.timestamp).getTime() + activePlant.wateringIntervalDays * 24 * 60 * 60 * 1000)
    : new Date(new Date(activePlant.lastWateredAt).getTime() + activePlant.wateringIntervalDays * 24 * 60 * 60 * 1000);
  const nextWateringLabel = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric"
  }).format(nextWateringDate);
  
  const lightsOnNow = isLightsOnNow(activePlant.lightsOn, activePlant.lightsOff, now);
  const ppfd =
    typeof activePlant.lightDimmerPercent === "number"
      ? estimatePpfd(activePlant.lightType ?? "panel_100w", activePlant.lightDimmerPercent)
      : null;

  const onPlantUpdate = (next: PlantProfile) => {
    setPlants((current) => current.map((entry) => (entry.id === next.id ? next : entry)));
  };

  const patchActivePlant = (patch: Partial<PlantProfile>) => {
    setPlants((current) => {
      // Use ref value to avoid stale closure race condition
      const currentActivePlantId = activePlantIdRef.current;
      const activePlant = current.find((entry) => entry.id === currentActivePlantId) ?? current[0];
      if (!activePlant) return current;
      return current.map((entry) => 
        entry.id === activePlant.id ? { ...entry, ...patch } : entry
      );
    });
  };

  const createPlant = (plantData: { strainName: string; stage: string }) => {
    const nextIndex = plants.length + 1;
    const newPlant = createNewPlant({
      strainName: plantData.strainName,
      stage: plantData.stage as GrowStage,
      // Copy settings from active plant if available
      ...(activePlant ? {
        lightSchedule: activePlant.lightSchedule,
        lightsOn: activePlant.lightsOn,
        lightsOff: activePlant.lightsOff,
        lightType: activePlant.lightType,
        lightDimmerPercent: activePlant.lightDimmerPercent,
        containerVolumeL: activePlant.containerVolumeL,
        mediaVolumeL: activePlant.mediaVolumeL,
        mediaType: activePlant.mediaType,
        wateringIntervalDays: activePlant.wateringIntervalDays,
        feedRecipe: {
          ...activePlant.feedRecipe,
          additives: activePlant.feedRecipe.additives.map((entry) => ({ ...entry, id: generateUUID() }))
        }
      } : {})
    });
    setPlants((current) => [...current, newPlant]);
    setActivePlantId(newPlant.id);
  };

  const handleStageChange = (newStage: GrowStage) => {
    const now = new Date().toISOString();
    const patch: Partial<PlantProfile> = { stage: newStage };

    // When moving TO Veg for the first time
    if (newStage === "Veg" && activePlant.stageDays.veg === 0 && !activePlant.vegStartedAt) {
      patch.vegStartedAt = now;
      patch.stageDays = { ...activePlant.stageDays, veg: 1 };
    }

    // When moving TO Bloom for the first time
    if (newStage === "Bloom" && activePlant.stageDays.bloom === 0 && !activePlant.bloomStartedAt) {
      patch.bloomStartedAt = now;
      patch.stageDays = { ...activePlant.stageDays, bloom: 1 };
    }

    patchActivePlant(patch);
  };

  const patchWateringData = (nextWateringData: PlantProfile["wateringData"]) => {
    const validData = nextWateringData.filter((w) => {
      if (!w.timestamp) return false;
      const ts = new Date(w.timestamp).getTime();
      return !isNaN(ts);
    });
    const sorted = [...validData].sort((a, b) => {
      const aTime = new Date(a.timestamp).getTime();
      const bTime = new Date(b.timestamp).getTime();
      return aTime - bTime;
    });
    const latest = sorted[sorted.length - 1];

    patchActivePlant({
      wateringData: sorted,
      ...(latest
        ? {
            lastWateredAt: latest.timestamp,
            waterInputMl: latest.amountMl,
            waterPh: latest.ph,
            waterEc: latest.ec
          }
        : {})
    });
  };

  const patchClimateData = (nextClimateData: PlantProfile["climateData"]) => {
    const validData = nextClimateData.filter((c) => {
      if (!c.timestamp) return false;
      const ts = new Date(c.timestamp).getTime();
      return !isNaN(ts);
    });
    const sorted = [...validData].sort((a, b) => {
      const aTime = new Date(a.timestamp).getTime();
      const bTime = new Date(b.timestamp).getTime();
      return aTime - bTime;
    });
    const latest = sorted[sorted.length - 1];

    patchActivePlant({
      climateData: sorted,
      ...(latest
        ? {
            growTempC: latest.tempC,
            growHumidity: latest.humidity
          }
        : {})
    });
  };

  // Notification toggle handler for AI assistant
  const handleToggleNotification = async (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    await setSetting("wateringNotification", String(enabled));
  };

  // Light management functions
  const activeLights = activePlant.lights ?? [];
  const activeLightId = activePlant.activeLightId ?? activeLights[0]?.id;
  const activeLight = activeLights.find((l) => l.id === activeLightId) ?? activeLights[0];

  const handleSaveLight = (light: LightProfile) => {
    const updatedLights = [...(activePlant.lights ?? []), light];
    patchActivePlant({
      lights: updatedLights,
      activeLightId: light.id,
      lightsOn: light.lightsOn,
      lightsOff: light.lightsOff,
      lightDimmerPercent: light.dimmerPercent,
      lightLampWatts: light.watts
    });
  };

  const handleDeleteLight = (id: string) => {
    const updatedLights = (activePlant.lights ?? []).filter((l) => l.id !== id);
    const newActiveLightId = activePlant.activeLightId === id ? updatedLights[0]?.id : activePlant.activeLightId;
    const newActiveLight = updatedLights.find((l) => l.id === newActiveLightId);
    patchActivePlant({
      lights: updatedLights,
      activeLightId: newActiveLightId,
      ...(newActiveLight ? {
        lightsOn: newActiveLight.lightsOn,
        lightsOff: newActiveLight.lightsOff,
        lightDimmerPercent: newActiveLight.dimmerPercent,
        lightLampWatts: newActiveLight.watts
      } : {})
    });
  };

  const handleSelectLight = (id: string) => {
    const light = activeLights.find((l) => l.id === id);
    if (light) {
      patchActivePlant({
        activeLightId: id,
        lightsOn: light.lightsOn,
        lightsOff: light.lightsOff,
        lightDimmerPercent: light.dimmerPercent,
        lightLampWatts: light.watts
      });
    }
  };

  // DLI calculation (regular functions, not hooks, to avoid conditional hook calls)
  const getLightHours = () => {
    const lightsOn = activeLight?.lightsOn ?? activePlant.lightsOn;
    const lightsOff = activeLight?.lightsOff ?? activePlant.lightsOff;
    const onMinutes = parseTimeToMinutes(lightsOn);
    const offMinutes = parseTimeToMinutes(lightsOff);
    if (onMinutes === null || offMinutes === null) return 0;
    if (onMinutes < offMinutes) {
      return (offMinutes - onMinutes) / 60;
    }
    return (24 * 60 - onMinutes + offMinutes) / 60;
  };

  const getCurrentPpfd = () => {
    if (!activeLight) return null;
    if (activeLight.ppfdEstimated !== undefined && activeLight.ppfdEstimated !== null) {
      return activeLight.ppfdEstimated;
    }
    if (activeLight.hasDimmer && activeLight.ppfdMin !== undefined && activeLight.ppfdMax !== undefined) {
      const dimmer = activeLight.dimmerPercent ?? 100;
      const t = Math.max(0, Math.min(1, (dimmer - 10) / 90));
      return Math.round(activeLight.ppfdMin + (activeLight.ppfdMax - activeLight.ppfdMin) * t);
    }
    return null;
  };

  const calculateDLI = () => {
    const ppfd = getCurrentPpfd();
    const hours = getLightHours();
    if (ppfd === null || hours === 0) return null;
    return (ppfd * hours * 3600) / 1_000_000;
  };

  const getDLIStatus = () => {
    const dli = calculateDLI();
    if (dli === null) return { label: "No data", color: "bg-slate-600", tone: "text-lime-100/60" };
    
    const stage = activePlant.stage;
    const targets: Record<string, { low: number; high: number }> = {
      Seedling: { low: 12, high: 18 },
      Veg: { low: 25, high: 40 },
      Bloom: { low: 32, high: 45 }
    };
    
    const target = targets[stage];
    if (!target) return { label: `DLI: ${dli.toFixed(1)}`, color: "bg-slate-600", tone: "text-lime-100/60" };
    
    if (dli < target.low) {
      return { label: `DLI: ${dli.toFixed(1)} - Low`, color: "bg-amber-500", tone: "text-amber-400" };
    }
    if (dli > target.high) {
      return { label: `DLI: ${dli.toFixed(1)} - High`, color: "bg-red-500", tone: "text-red-400" };
    }
    return { label: `DLI: ${dli.toFixed(1)} - Good`, color: "bg-green-500", tone: "text-green-400" };
  };

  const dliStatus = getDLIStatus();
  const currentPpfd = getCurrentPpfd();

  // DLI Tooltip content based on plant stage
  const getDLITooltip = () => {
    const stage = activePlant.stage;
    const targets: Record<string, { dli: string; ppfd: string; description: string }> = {
      Seedling: { dli: "12-18", ppfd: "300-600", description: "Gentle light for young plants" },
      Veg: { dli: "25-40", ppfd: "400-600", description: "Higher light for vegetative growth" },
      Bloom: { dli: "32-45", ppfd: "600-900", description: "Maximum light for flowering" }
    };
    const target = targets[stage];
    if (!target) return null;
    return {
      title: `${stage} Stage`,
      dli: `Recommended DLI: ${target.dli} mol/m²/day`,
      ppfd: `Recommended PPFD: ${target.ppfd} μmol/m²/s`,
      description: target.description
    };
  };

  const dliTooltip = getDLITooltip();

  // Light schedule helpers
  const getExpectedLightHours = (stage: GrowStage): number => {
    if (stage === "Bloom") return 12;
    return 18; // Veg, Seedling
  };

  const calculateLightsOff = (lightsOn: string, hoursOn: number): string => {
    const match = lightsOn.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return "22:00";
    const onHours = Number(match[1]);
    const onMinutes = Number(match[2]);
    const offTotalMinutes = (onHours + hoursOn) * 60 + onMinutes;
    const offHours = Math.floor(offTotalMinutes / 60) % 24;
    const offMinutes = offTotalMinutes % 60;
    return `${String(offHours).padStart(2, "0")}:${String(offMinutes).padStart(2, "0")}`;
  };

  const getScheduleDisplay = (lightsOn: string, lightsOff: string, stage: GrowStage) => {
    const onMin = parseTimeToMinutes(lightsOn);
    const offMin = parseTimeToMinutes(lightsOff);
    if (onMin === null || offMin === null) return { text: "--/--", color: "text-lime-100/60" };
    
    const hoursOn = onMin < offMin ? (offMin - onMin) / 60 : (24 * 60 - onMin + offMin) / 60;
    const hoursOff = 24 - hoursOn;
    const text = `${Math.round(hoursOn)}/${Math.round(hoursOff)}`;
    
    const expectedHours = getExpectedLightHours(stage);
    const isStandard = Math.abs(hoursOn - expectedHours) < 0.5;
    
    let color = "text-amber-500"; // custom/non-standard
    if (isStandard) {
      color = stage === "Bloom" ? "text-indigo-500" : "text-green-500";
    }
    
    return { text, color };
  };

  const handleLightsOnChange = (value: string, isLightProfile: boolean) => {
    const hours = getExpectedLightHours(activePlant.stage);
    const autoOff = calculateLightsOff(value, hours);
    if (isLightProfile && activeLight) {
      const updatedLights = activeLights.map((l) =>
        l.id === activeLightId ? { ...l, lightsOn: value, lightsOff: autoOff } : l
      );
      patchActivePlant({ lights: updatedLights, lightsOn: value, lightsOff: autoOff });
    } else {
      patchActivePlant({ lightsOn: value, lightsOff: autoOff });
    }
  };

  const handleStageChangeWithLightUpdate = (newStage: GrowStage) => {
    const now = new Date().toISOString();
    const patch: Partial<PlantProfile> = { stage: newStage };

    // Auto-adjust light schedule based on stage
    const currentOn = activeLight?.lightsOn ?? activePlant.lightsOn;
    const newOff = calculateLightsOff(currentOn, getExpectedLightHours(newStage));
    patch.lightsOff = newOff;
    if (activeLight) {
      const updatedLights = activeLights.map((l) =>
        l.id === activeLightId ? { ...l, lightsOff: newOff } : l
      );
      patch.lights = updatedLights;
    }

    // Stage timing logic
    if (newStage === "Veg" && activePlant.stageDays.veg === 0 && !activePlant.vegStartedAt) {
      patch.vegStartedAt = now;
      patch.stageDays = { ...activePlant.stageDays, veg: 1 };
    }
    if (newStage === "Bloom" && activePlant.stageDays.bloom === 0 && !activePlant.bloomStartedAt) {
      patch.bloomStartedAt = now;
      patch.stageDays = { ...activePlant.stageDays, bloom: 1 };
    }

    patchActivePlant(patch);
  };

  const scheduleDisplay = getScheduleDisplay(
    activeLight?.lightsOn ?? activePlant.lightsOn,
    activeLight?.lightsOff ?? activePlant.lightsOff,
    activePlant.stage
  );

  return (
    <main className="min-h-screen bg-hero-grid relative">
      {/* Animated background orbs - behind all content */}
      <div className="bg-orb bg-orb--green" aria-hidden="true" />
      <div className="bg-orb bg-orb--purple" aria-hidden="true" />
      <div className="bg-orb bg-orb--orange" aria-hidden="true" />

      <section className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 lg:px-6">
        {/* Header Panel - Responsive Layout */}
        <div className="glass-panel rounded-3xl p-4">
          {/* Mobile: stacked layout, Desktop: horizontal */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            {/* Clock Block */}
            <div className="flex-1 w-full sm:w-auto">
              <p className="font-mono text-xs sm:text-[11px] uppercase tracking-[0.22em] text-lime-200">Live Clock</p>
              <p className="mt-1 text-xl sm:text-2xl font-semibold text-lime-100">
                {new Intl.DateTimeFormat(locale, {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false
                }).format(new Date(now))}
              </p>
              <p className="text-xs text-lime-100/75 text-sm sm:text-xs">
                {new Intl.DateTimeFormat(locale, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric"
                }).format(new Date(now))}
              </p>
            </div>
            
            {/* Controls Block */}
            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => setIsTutorialOpen(true)}
                className="rounded-full border border-lime-300/25 bg-lime-300/12 p-2 sm:p-2.5 text-lime-200 hover:bg-lime-300/22 transition min-h-[44px] min-w-[44px] flex items-center justify-center"
                title="AI Assistant Guide"
                aria-label="Open AI Assistant Guide"
              >
                <BookOpen className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
              </button>
              <div className="rounded-2xl border border-lime-300/15 bg-lime-300/8 px-3 sm:px-4 py-2 sm:py-3 flex-1 sm:flex-initial">
                <p className="font-mono text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-lime-200">Outside Weather</p>
                <p className="mt-1 text-base sm:text-lg font-semibold text-lime-100">
                  {weather?.temperatureC !== null && weather?.temperatureC !== undefined ? `${weather.temperatureC} C` : "-- C"}
                </p>
                <p className="text-xs text-lime-100/80">
                  Humidity: {weather?.humidity !== null && weather?.humidity !== undefined ? `${weather.humidity}%` : "--%"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-1 xl:grid-cols-[2fr_0.95fr]">
          <div className="glass-panel rounded-[2rem] p-5 lg:p-6">
             <div className="flex flex-wrap items-start justify-between gap-4">
               <div className="">
                <p className="font-mono text-[11px] uppercase tracking-[0.34em] text-lime-200">G-Buddy</p>
              </div>
             </div>
            <div className=" items-start justify-between gap-4 mt-4">
              <div className="rounded-2xl border border-lime-300/20 bg-lime-300/10 px-4 py-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.24em]  text-slate-100">{t.activePlant}</p>
                <div className="mt-2 flex items-center gap-3">
                  <EditableText
                    value={activePlant.strainName}
                    className="text-xl font-semibold text-slate-100"
                    onSave={(value) => patchActivePlant({ strainName: value })}
                  />
                  {getStageIcon(activePlant.stage)}
                  <span className="text-xs text-lime-100/80">
                    Started{" "}
                    <EditableDate
                      dateIso={activePlant.startedAt}
                      locale={locale}
                      onSave={(value) => patchActivePlant({ startedAt: `${value}T09:00:00.000Z` })}
                    />
                  </span>
                  <span className="text-xs font-semibold text-lime-100/80">{cycleDetailed.totalDays} days</span>
                </div>
                <div className="mt-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-lime-200">Progress</p>
                  <StageProgressBar
                    seedlingDays={elapsedSeedling}
                    vegDays={elapsedVeg}
                    bloomDays={elapsedBloom}
                    seedlingTarget={calendarConfig?.seedlingDuration ?? DEFAULT_STAGE_TARGETS.seedling}
                    vegTarget={calendarConfig?.vegDuration ?? DEFAULT_STAGE_TARGETS.veg}
                    bloomTarget={calendarConfig?.bloomDuration ?? DEFAULT_STAGE_TARGETS.bloom}
                  />
                </div>
              </div>
             
            </div>

            <div className="mt-4 rounded-2xl border border-white/8 bg-white/5 p-3">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-lime-200">Plant list</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => exportToExcel({ plants, activePlantId })}
                    className="rounded-full border border-lime-300/20 bg-lime-300/12 p-1 text-lime-100"
                    title="Export to Excel"
                    aria-label="Export to Excel"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleSeedTestData}
                    className="rounded-full border border-lime-300/20 bg-lime-300/12 p-1 text-lime-100"
                    title="Seed Test Plants"
                    aria-label="Add test plants"
                  >
                    <Sprout className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={addPlant}
                    className="rounded-full border border-lime-300/20 bg-lime-300/12 p-1 text-lime-100"
                    title="Add plant"
                    aria-label="Add new plant"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {plants
                  .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())
                  .map((entry) => (
                  <div key={entry.id} className="relative group">
                    <button
                      type="button"
                      onClick={() => setActivePlantId(entry.id)}
                      className={`rounded-full border px-3 py-1.5 text-xs transition ${
                        entry.id === activePlantId
                          ? "border-lime-300/28 bg-lime-300/16 text-lime-100"
                          : "border-white/10 bg-black/25 text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      <span className="inline-flex items-center gap-2">
                        {getStageIcon(entry.stage)}
                        {entry.strainName}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removePlant(entry.id)}
                      className="absolute -top-2 -right-2 rounded-full bg-red-500/90 hover:bg-red-600 p-0.5 text-white opacity-0 group-hover:opacity-100 transition"
                      title={`Delete ${entry.strainName}`}
                      aria-label={`Delete ${entry.strainName}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <CompactMetric
                label={t.climate}
                icon={<Thermometer className="h-4 w-4" />}
                value={
                  <EditableText
                    value={`${activePlant.growTempC} C / ${activePlant.growHumidity}%`}
                    className="text-xl font-semibold text-lime-100"
                    onSave={(value) => {
                      const match = value.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:C|c)?\s*\/\s*([0-9]+(?:\.[0-9]+)?)\s*%?/);
                      if (!match) return;
                      patchActivePlant({ growTempC: Number(match[1]), growHumidity: Number(match[2]) });
                    }}
                  />
                }
                helper={
                  <EditableText
                    value={`${weather?.temperatureC} C / ${weather?.humidity}%`}
                    className="text-xs leading-5 text-lime-100/70"
                    onSave={(value) => {
                      const match = value.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:C|c)?\s*\/\s*([0-9]+(?:\.[0-9]+)?)\s*%?/);
                      if (!match) return;
                      patchActivePlant({ outsideTempC: Number(match[1]), outsideHumidity: Number(match[2]) });
                    }}
                  />
                }
              />

              <CompactMetric
                label="VPD"
                icon={<Waves className="h-4 w-4" />}
                value={<span className="text-xl font-semibold text-lime-100">{liveVpd} kPa</span>}
                helper={
                  <span className={`${vpdBand.tone} text-xs`}>
                    {vpdBand.label} | {vpdBand.range}
                  </span>
                }
              />

              <CompactMetric
                label={t.water}
                icon={<Droplets className="h-4 w-4" />}
                value={
                  <EditableText
                    value={`${activePlant.waterInputMl} ml`}
                    className="text-xl font-semibold text-lime-100"
                    onSave={(value) => {
                      const num = Number(value.replace(/[^\d.]/g, ""));
                      if (!Number.isFinite(num)) return;
                      patchActivePlant({ waterInputMl: num });
                    }}
                  />
                }
                helper={
                  <EditableText
                    value={`pH ${activePlant.waterPh} | EC ${activePlant.waterEc}`}
                    className="text-xs leading-5 text-lime-100/70"
                    onSave={(value) => {
                      const match = value.match(/pH\s*([0-9]+(?:\.[0-9]+)?)\s*\|\s*EC\s*([0-9]+(?:\.[0-9]+)?)/i);
                      if (!match) return;
                      patchActivePlant({ waterPh: Number(match[1]), waterEc: Number(match[2]) });
                    }}
                  />
                }
              />

              <CompactMetric
                label={t.cycle}
                icon={getStageIcon(activePlant.stage)}
                value={<span className="text-xl font-semibold text-lime-100">{cycle.daysInStage} days</span>}
                helper={
                  <span className="text-xs text-lime-100/70">
                    {activePlant.stage} | {cycle.totalDays} total
                  </span>
                }
              />
            </div>

            <div className="mt-3 rounded-2xl border border-white/8 bg-black/20 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-lime-200">Watering</p>
                
                <span className="text-xs text-lime-100/75">
                  Last{" "}
                  <EditableDateTime
                    dateIso={activePlant.lastWateredAt}
                    onSave={(value) => {
                      const sorted = [...activePlant.wateringData].sort(
                        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                      );
                      if (!sorted.length) {
                        patchActivePlant({ lastWateredAt: value });
                        return;
                      }
                      const latest = sorted[sorted.length - 1];
                      patchWateringData(
                        sorted.map((entry) => (entry.id === latest.id ? { ...entry, timestamp: value } : entry))
                      );
                    }}
                    displayValue={lastWateredLabel}
                  />

                 
                </span>
                <span className="text-xs text-lime-100/75">
                  Next <span className="text-left text-sm text-lime-100">{nextWateringLabel}</span>
                </span>
                 <p className="text-sm font-semibold text-lime-100"> {wateringCountdown}</p>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-amber-500/90 via-sky-300/70 to-sky-500/90 transition-all duration-700"
                  style={{ width: `${wateringProgress}%` }}
                />
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              <MiniInfo
                label={t.lightHours}
                value={
                  <div className="space-y-3">
                    {/* Light Schedule Row */}
                    <div className="flex items-center justify-between gap-3 text-xs text-lime-100/80">
                      <span className={`text-sm font-semibold ${scheduleDisplay.color}`}>
                        {scheduleDisplay.text}
                      </span>
                      <span>
                        On{" "}
                        <input
                          type="time"
                          value={activeLight?.lightsOn ?? activePlant.lightsOn}
                          onChange={(e) => handleLightsOnChange(e.target.value, !!activeLight)}
                          className="rounded-lg border border-lime-300/20 bg-black/30 px-2 py-1 text-sm text-lime-100 outline-none"
                        />
                      </span>
                      <span>
                        Off{" "}
                        <input
                          type="time"
                          value={activeLight?.lightsOff ?? activePlant.lightsOff}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (activeLight) {
                              const updatedLights = activeLights.map((l) =>
                                l.id === activeLightId ? { ...l, lightsOff: value } : l
                              );
                              patchActivePlant({ lights: updatedLights, lightsOff: value });
                            } else {
                              patchActivePlant({ lightsOff: value });
                            }
                          }}
                          className="rounded-lg border border-lime-300/20 bg-black/30 px-2 py-1 text-sm text-lime-100 outline-none"
                        />
                      </span>
                      <span className=" flex items-center gap-3">
                        {/* DLI Status Indicator with Tooltip */}
                        {currentPpfd !== null && dliTooltip && (
                          <span className="group relative flex items-center gap-1.5">
                            <span className={`h-2.5 w-2.5 rounded-full ${dliStatus.color} shadow-[0_0_8px_currentColor]`} />
                            <span className={`text-xs font-medium ${dliStatus.tone}`}>{dliStatus.label}</span>
                            <Info className="h-3.5 w-3.5 text-lime-100/50 cursor-help" />
                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-xl border border-lime-300/20 bg-slate-900/95 p-3 text-xs opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none shadow-lg">
                              <p className="font-semibold text-lime-100 mb-1">{dliTooltip.title}</p>
                              <p className="text-lime-100/80">{dliTooltip.dli}</p>
                              <p className="text-lime-100/80">{dliTooltip.ppfd}</p>
                              <p className="text-lime-100/60 mt-1 italic">{dliTooltip.description}</p>
                              {/* Arrow */}
                              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
                                <div className="h-2 w-2 rotate-45 border-r border-b border-lime-300/20 bg-slate-900/95"></div>
                              </div>
                            </div>
                          </span>
                        )}
                        {/* Lights ON/OFF Indicator */}
                        <span className="flex items-center gap-2">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${
                              lightsOnNow ? "bg-green-500 shadow-[0_0_10px_rgba(158,255,102,0.9)]" : "bg-slate-600"
                            }`}
                          />
                          {lightsOnNow ? "Lights ON" : "Lights OFF"}
                        </span>
                      </span>
                    </div>

                    {/* Light Selection Row */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <p className="text-[11px] text-lime-100/65 mb-1">Active Light</p>
                        {activeLights.length > 0 ? (
                          <div className="relative">
                            <select
                              value={activeLightId ?? ""}
                              onChange={(e) => handleSelectLight(e.target.value)}
                              className="w-full rounded-lg border border-lime-300/20 bg-black/30 px-3 py-2 text-sm text-lime-100 outline-none"
                            >
                              {activeLights.map((light) => (
                                <option key={light.id} value={light.id}>
                                  {light.type}{light.hasDimmer ? ` (${light.dimmerPercent}%)` : ""}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <p className="text-sm text-lime-100/40 italic">No lights configured</p>
                        )}
                      </div>
                      <div className="pt-5">
                        <button
                          type="button"
                          onClick={() => setIsLightModalOpen(true)}
                          className="rounded-full border border-lime-300/20 bg-lime-300/12 p-2 text-lime-100 hover:bg-lime-300/22 transition"
                          title="Add light"
                          aria-label="Add new light"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Light Details Row */}
                    {activeLight && (
                      <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        <div>
                          <p className="text-[11px] text-lime-100/65">Type</p>
                          <p className="text-sm font-semibold text-lime-100">{activeLight.type}</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-lime-100/65">Watts</p>
                          <p className="text-sm font-semibold text-lime-100">{activeLight.watts} W</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-lime-100/65">PPFD</p>
                          <p className="text-sm font-semibold text-lime-100">
                            {currentPpfd !== null ? `${currentPpfd} μmol/m²/s` : "--"}
                          </p>
                        </div>
                        {activeLight.hasDimmer && (
                          <div className="sm:col-span-3 pb-4">
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
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  const updatedLights = activeLights.map((l) =>
                                    l.id === activeLightId ? { ...l, dimmerPercent: val } : l
                                  );
                                  patchActivePlant({ lights: updatedLights, lightDimmerPercent: val });
                                }}
                                className="absolute top-0 left-0 w-full h-2 opacity-0 cursor-pointer z-10"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                }
              />
            </div>
          </div>

          {/* AI Assistant Panel - hidden on mobile, shown on desktop */}
          <div className="hidden md:block">
            <AiAssistantPanel 
              locale={locale} 
              plant={activePlant}
              plants={plants}
              weather={weather} 
              onPlantUpdate={onPlantUpdate}
              onPatchPlant={patchActivePlant}
              onSelectPlant={setActivePlantId}
              onUpdateWateringData={patchWateringData}
              onUpdateClimateData={patchClimateData}
              onToggleNotification={handleToggleNotification}
              notificationsEnabled={notificationsEnabled}
            />
          </div>
        </div>

        <div className="grid gap-4">
          {/* Growth Progression Chart */}
          <VPDChart
            currentVpd={liveVpd}
            currentTemp={activePlant.growTempC}
            currentHumidity={activePlant.growHumidity}
            currentStage={activePlant.stage}
            isOpen={isVpdChartOpen}
            onClose={() => setIsVpdChartOpen(false)}
            onStageChange={(newStage) => patchActivePlant({ stage: newStage })}
          />

          {/* AI Assistant Tutorial Modal */}
          <AiAssistantTutorialModal
            isOpen={isTutorialOpen}
            onClose={() => setIsTutorialOpen(false)}
          />

          {/* Confirmation Modal */}
          <ConfirmationModal
            isOpen={confirmState.isOpen}
            options={confirmState.options}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
          />

          {/* Light Configuration Modal */}
          <LightConfigModal
            isOpen={isLightModalOpen}
            onClose={() => setIsLightModalOpen(false)}
            onSave={handleSaveLight}
            existingLights={activeLights}
            onDeleteLight={handleDeleteLight}
            onSelectLight={handleSelectLight}
            activeLightId={activeLightId}
            currentStage={activePlant.stage}
          />

          {/* Calendar Configuration Modal */}
          <CalendarConfigModal
            isOpen={isCalendarConfigOpen}
            onClose={() => setIsCalendarConfigOpen(false)}
            onSave={() => {}}
          />

          <GrowChart
            onOpenVpdChart={() => setIsVpdChartOpen(true)}
            plantId={activePlant.id}
            logs={dailyLogs}
            wateringData={activePlant.wateringData}
            climateData={activePlant.climateData}
            stage={activePlant.stage}
            locale={locale}
            wateringIntervalDays={activePlant.wateringIntervalDays}
            onWateringDataChange={patchWateringData}
            onClimateDataChange={patchClimateData}
            onUpdateInterval={(days) => patchActivePlant({ wateringIntervalDays: days })}
            onWaterNow={() =>
              patchWateringData([
                ...activePlant.wateringData,
                {
                  id: generateUUID(),
                  timestamp: new Date().toISOString(),
                  amountMl: activePlant.waterInputMl,
                  ph: activePlant.waterPh,
                  ec: activePlant.waterEc
                }
              ])
            }
            labels={{ progression: t.progression, tempHumidityVpd: t.tempHumidityVpd }}
          />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
            <div className="glass-panel rounded-3xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-lime-200">{t.timeline}</p>
                  <h3 className="mt-2 text-lg font-semibold text-lime-100">{activePlant.strainName}</h3>
                </div>
                <button
                  onClick={() => setIsCalendarConfigOpen(true)}
                  className="p-2 hover:bg-white/10 border border-lime-300/20 rounded-lg transition"
                  title="Timeline Settings"
                >
                  <Settings className="h-5 w-5 text-lime-300" />
                </button>
              </div>
               <div className="mt-4 flex  gap-2 sm:grid-cols-2">
                 <MiniInfo label={t.stage} value={<EditableStage value={activePlant.stage} onSave={handleStageChange} />} />
                 <MiniInfo label={t.totalDays} value={<span className="text-sm font-semibold text-lime-100">{elapsedSeedling + elapsedVeg + elapsedBloom} days</span>} />
                 
                 {/* Seedling Stage - Start Date (read-only days calculated from startedAt) */}
                 <MiniInfo
                   label={<span className="flex items-center gap-1.5"><Sprout className="h-3.5 w-3.5 text-sky-500" /> Seedling Start</span>}
                   value={
                     <EditableDate
                       dateIso={activePlant.startedAt}
                       locale={locale}
                       onSave={(value) => patchActivePlant({ startedAt: `${value}T09:00:00.000Z` })}
                       maxDate={new Date().toISOString().slice(0, 10)}
                       disabled={!!activePlant.vegStartedAt}
                     />
                   }
                 />
                 <MiniInfo
                   label="Days in Seedling"
                   value={<span className="text-sm font-semibold text-lime-100">{elapsedSeedling} days</span>}
                 />
                 
                 {/* Veg Stage - Date Picker (read-only days calculated from vegStartedAt) */}
                 <MiniInfo
                   label={<span className="flex items-center gap-1.5"><Cannabis className="h-3.5 w-3.5 text-green-500" /> Veg Start</span>}
                   value={
                     <EditableDate
                       dateIso={activePlant.vegStartedAt || ""}
                       locale={locale}
                       onSave={(value) => {
                         if (!value) {
                           // Clearing veg date - reset to seedling and cascade
                           const patch: Partial<PlantProfile> = {
                             vegStartedAt: undefined,
                             stage: "Seedling"
                           };
                           // Also clear bloom if it exists (can't have bloom without veg)
                           if (activePlant.bloomStartedAt) {
                             patch.bloomStartedAt = undefined;
                           }
                           patchActivePlant(patch);
                         } else {
                           const newVegDate = new Date(`${value}T09:00:00.000Z`).toISOString();
                           const patch: Partial<PlantProfile> = {
                             vegStartedAt: newVegDate
                           };
                           // Auto-update stage based on dates
                           if (!activePlant.vegStartedAt) {
                             // First time setting veg - move to veg stage
                             patch.stage = "Veg";
                           }
                           // If bloom exists and is before new veg date, clear bloom
                           if (activePlant.bloomStartedAt && new Date(activePlant.bloomStartedAt) < new Date(newVegDate)) {
                             patch.bloomStartedAt = undefined;
                             patch.stage = "Veg";
                           }
                           patchActivePlant(patch);
                         }
                       }}
                       placeholder="Not set"
                       minDate={activePlant.startedAt?.slice(0, 10) || ""}
                       maxDate={activePlant.bloomStartedAt ? activePlant.bloomStartedAt.slice(0, 10) : new Date().toISOString().slice(0, 10)}
                       disabled={!!activePlant.bloomStartedAt}
                     />
                   }
                 />
                 <MiniInfo
                   label="Days in Veg"
                   value={<span className="text-sm font-semibold text-lime-100">{elapsedVeg} days</span>}
                 />
                 
                 {/* Bloom Stage - Date Picker (read-only days calculated from bloomStartedAt) */}
                 <MiniInfo
                   label={<span className="flex items-center gap-1.5"><Wheat className="h-3.5 w-3.5 text-indigo-500" /> Bloom Start</span>}
                   value={
                     <EditableDate
                       dateIso={activePlant.bloomStartedAt || ""}
                       locale={locale}
                       onSave={(value) => {
                         if (!value) {
                           // Clearing bloom date - reset to veg stage
                           const patch: Partial<PlantProfile> = {
                             bloomStartedAt: undefined,
                             stage: activePlant.vegStartedAt ? "Veg" : "Seedling"
                           };
                           patchActivePlant(patch);
                         } else {
                           const newBloomDate = new Date(`${value}T09:00:00.000Z`).toISOString();
                           const patch: Partial<PlantProfile> = {
                             bloomStartedAt: newBloomDate
                           };
                           // Auto-update stage based on dates
                           if (!activePlant.bloomStartedAt) {
                             // First time setting bloom - move to bloom stage
                             patch.stage = "Bloom";
                           }
                           patchActivePlant(patch);
                         }
                       }}
                       placeholder="Not set"
                       minDate={activePlant.vegStartedAt ? activePlant.vegStartedAt.slice(0, 10) : activePlant.startedAt?.slice(0, 10) || ""}
                       maxDate={new Date().toISOString().slice(0, 10)}
                     />
                   }
                 />
                 <MiniInfo
                   label="Days in Bloom"
                   value={<span className="text-sm font-semibold text-lime-100">{elapsedBloom} days</span>}
                 />
               </div>

              {/* Calendar View */}
              <div className="mt-6 border-t border-white/10 pt-6">
                <PlantTimelineCalendar plant={activePlant} />
              </div>
            </div>

            <div className="glass-panel rounded-3xl p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-lime-200">Setup</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <MiniInfo
                  label="Container"
                  value={
                    <EditableText
                      value={`${activePlant.containerVolumeL} L`}
                      className="text-sm font-semibold text-lime-100"
                      onSave={(value) =>
                        patchActivePlant({ containerVolumeL: Number(value.replace(/[^\d.]/g, "")) || activePlant.containerVolumeL })
                      }
                    />
                  }
                />
                <MiniInfo
                  label="Media"
                  value={
                    <EditableText
                      value={`${activePlant.mediaVolumeL} L`}
                      className="text-sm font-semibold text-lime-100"
                      onSave={(value) =>
                        patchActivePlant({ mediaVolumeL: Number(value.replace(/[^\d.]/g, "")) || activePlant.mediaVolumeL })
                      }
                    />
                  }
                />
                <MiniInfo
                  label="Type"
                  value={<EditableText value={activePlant.mediaType} className="text-sm font-semibold text-lime-100" onSave={(value) => patchActivePlant({ mediaType: value })} />}
                />
              </div>

              <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.28em] text-lime-200">{t.feedRecipe}</p>
              <EditableText
                value={activePlant.feedRecipe.title}
                className="mt-2 text-lg font-semibold text-lime-100"
                onSave={(value) => patchActivePlant({ feedRecipe: { ...activePlant.feedRecipe, title: value } })}
              />
              <div className="mt-3 grid grid-cols-2 gap-2">
                <MiniInfo
                  label="Average pH"
                  value={<span className="text-sm font-semibold text-lime-100">{formatAvgPh(activePlant.wateringData)}</span>}
                />
                <MiniInfo
                  label="Average PPM"
                  value={<span className="text-sm font-semibold text-lime-100">{formatAvgPpm(activePlant.wateringData)}</span>}
                />
              </div>

              <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 p-3">
                {/* Toggle between Classic and Checker */}
                <div className="flex items-center justify-between mb-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-lime-200">Nutrient calculator</p>
                  <div className="flex rounded-full border border-lime-300/20 bg-black/30 p-0.5">
                    <button
                      type="button"
                      onClick={() => setNutrientView("classic")}
                      className={`rounded-full px-3 py-1 text-[10px] font-mono uppercase tracking-wider transition ${
                        nutrientView === "classic"
                          ? "bg-lime-300/20 text-lime-200"
                          : "text-slate-400 hover:text-slate-300"
                      }`}
                    >
                      Classic
                    </button>
                    <button
                      type="button"
                      onClick={() => setNutrientView("checker")}
                      className={`rounded-full px-3 py-1 text-[10px] font-mono uppercase tracking-wider transition ${
                        nutrientView === "checker"
                          ? "bg-lime-300/20 text-lime-200"
                          : "text-slate-400 hover:text-slate-300"
                      }`}
                    >
                      Checker
                    </button>
                  </div>
                </div>

                {/* Classic Nutrient Calculator */}
                <div className={nutrientView === "classic" ? "" : "hidden"}>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <p className="text-[11px] text-lime-100/65">Period</p>
                    <select
                      value={nutrientPeriodKey}
                      onChange={(event) => setNutrientPeriodKey(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-lime-300/20 bg-black/30 px-2 py-1 text-sm text-lime-100 outline-none"
                    >
                      {CANNA_AQUA_PERIODS.map((p) => (
                        <option key={p.key} value={p.key}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <p className="text-[11px] text-lime-100/65">Water (L)</p>
                    <input
                      type="number"
                      min={0.5}
                      step={0.5}
                      value={nutrientLiters}
                      onChange={(e) => setNutrientLiters(Math.max(0.5, Number(e.target.value) || 0.5))}
                      className="mt-1 w-full rounded-lg border border-lime-300/20 bg-black/30 px-2 py-1 text-sm text-lime-100 outline-none"
                    />
                  </div>
                  <div>
                    <p className="text-[11px] text-lime-100/65">Target EC</p>
                    <input
                      type="number"
                      min={0}
                      step={0.05}
                      value={nutrientTargetEc}
                      onChange={(e) => setNutrientTargetEc(Math.max(0, Number(e.target.value) || 0))}
                      className="mt-1 w-full rounded-lg border border-lime-300/20 bg-black/30 px-2 py-1 text-sm text-lime-100 outline-none"
                    />
                  </div>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {renderCannaMix({
                    periodKey: nutrientPeriodKey,
                    liters: nutrientLiters,
                    targetEc: nutrientTargetEc
                  })}
                </div>
                </div>

                {/* Smart Nutrient Checker */}
                <div className={nutrientView === "checker" ? "" : "hidden"}>
                  <NutrientChecker plant={activePlant} />
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-white/8 bg-black/20 p-3">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-lime-200">Custom additives</p>
                  <button
                    type="button"
                    onClick={() =>
                      patchActivePlant({
                        feedRecipe: {
                          ...activePlant.feedRecipe,
                          additives: [
                            ...activePlant.feedRecipe.additives,
                            {
                              id: `add-${Date.now()}`,
                              label: `Additive ${activePlant.feedRecipe.additives.length + 1}`,
                              amountMl: 1
                            }
                          ]
                        }
                      })
                    }
                    className="rounded-full border border-lime-300/20 bg-lime-300/12 p-1 text-lime-100"
                    title="Add additive"
                    aria-label="Add new additive"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-2 space-y-2">
                  {activePlant.feedRecipe.additives.map((entry) => (
                    <div key={entry.id} className="grid grid-cols-[1fr_auto] items-center gap-2">
                      <EditableText
                        value={entry.label}
                        className="text-sm font-semibold text-lime-100"
                        onSave={(value) =>
                          patchActivePlant({
                            feedRecipe: {
                              ...activePlant.feedRecipe,
                              additives: activePlant.feedRecipe.additives.map((item) =>
                                item.id === entry.id ? { ...item, label: value } : item
                              )
                            }
                          })
                        }
                      />
                      <EditableNumber
                        suffix=" ml"
                        value={entry.amountMl}
                        onSave={(value) =>
                          patchActivePlant({
                            feedRecipe: {
                              ...activePlant.feedRecipe,
                              additives: activePlant.feedRecipe.additives.map((item) =>
                                item.id === entry.id ? { ...item, amountMl: value } : item
                              )
                            }
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mobile Floating Action Button - only visible on mobile */}
      <button
        type="button"
        onClick={() => setIsAiChatOpen(true)}
        className="md:hidden fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-lime-300/40 bg-gradient-to-br from-lime-300/25 via-emerald-400/20 to-teal-300/25 text-lime-100 shadow-[0_0_30px_8px_rgba(178,255,102,0.18),0_0_50px_16px_rgba(16,185,129,0.12)] hover:from-lime-300/35 hover:via-emerald-400/30 hover:to-teal-300/35 transition-all hover:scale-105 active:scale-95"
        aria-label="Open AI chat"
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      {/* AI Chat Modal - mobile only */}
      <AiChatModal
        isOpen={isAiChatOpen}
        onClose={() => setIsAiChatOpen(false)}
        locale={locale}
        plant={activePlant}
        plants={plants}
        weather={weather}
        onPlantUpdate={onPlantUpdate}
        onPatchPlant={patchActivePlant}
        onSelectPlant={setActivePlantId}
        onUpdateWateringData={patchWateringData}
        onUpdateClimateData={patchClimateData}
        onToggleNotification={handleToggleNotification}
        notificationsEnabled={notificationsEnabled}
      />
    </main>
  );
}

function CompactMetric({
  label,
  value,
  helper,
  icon
}: {
  label: string;
  value: React.ReactNode;
  helper: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-lime-200">{label}</p>
        <div className="rounded-xl border border-lime-300/20 bg-lime-300/12 p-2 text-lime-200">{icon}</div>
      </div>
      <div className="mt-3">{value}</div>
      <div className="mt-1">{helper}</div>
    </div>
  );
}

function MiniInfo({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/5 p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-lime-200">{label}</p>
      <div className="mt-2 text-sm font-semibold text-lime-100">{value}</div>
    </div>
  );
}

function EditableText({ value, onSave, className }: { value: string; onSave: (value: string) => void; className?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!editing) {
      setDraft(value);
    }
  }, [editing, value]);

  if (!editing) {
    return (
      <button type="button" onDoubleClick={() => setEditing(true)} className={`text-left ${className ?? ""}`} title="Double click to edit">
        {value}
      </button>
    );
  }

  return (
    <input
      autoFocus
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        setEditing(false);
        if (draft.trim()) {
          onSave(draft.trim());
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          setEditing(false);
          if (draft.trim()) {
            onSave(draft.trim());
          }
        }
      }}
      className="w-full rounded-lg border border-lime-300/30 bg-black/20 px-2 py-1 text-sm text-lime-100 outline-none"
    />
  );
}

function EditableDate({ dateIso, locale, onSave, placeholder, minDate, maxDate, disabled }: { dateIso: string; locale: Locale; onSave: (value: string) => void; placeholder?: string; minDate?: string; maxDate?: string; disabled?: boolean }) {
  const [editing, setEditing] = useState(false);
  const hasDate = dateIso && dateIso.length > 0;
  const formatted = hasDate 
    ? new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" }).format(new Date(dateIso))
    : placeholder || "Not set";
  const inputValue = hasDate ? dateIso.slice(0, 10) : "";

  if (disabled) {
    return (
      <div className="text-left text-sm font-semibold text-lime-100/40 cursor-not-allowed" title="Locked: a later stage has started">
        {formatted}
      </div>
    );
  }

  if (!editing) {
    return (
      <button type="button" onDoubleClick={() => setEditing(true)} className={`text-left text-sm font-semibold ${hasDate ? "text-lime-100" : "text-lime-100/50 italic"}`} title="Double click to edit">
        {formatted}
      </button>
    );
  }

  return (
    <input
      type="date"
      autoFocus
      defaultValue={inputValue}
      min={minDate || ""}
      max={maxDate || ""}
      onBlur={(event) => {
        setEditing(false);
        if (event.target.value) {
          onSave(event.target.value);
        } else {
          // Clear the date when input is emptied
          onSave("");
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          const value = (event.currentTarget as HTMLInputElement).value;
          setEditing(false);
          if (value) {
            onSave(value);
          } else {
            onSave("");
          }
        } else if (event.key === "Escape") {
          setEditing(false);
        }
      }}
      className="w-full rounded-lg border border-lime-300/30 bg-black/20 px-2 py-1 text-sm text-lime-100 outline-none"
    />
  );
}

function EditableStage({ value, onSave }: { value: GrowStage; onSave: (value: GrowStage) => void }) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <button type="button" onDoubleClick={() => setEditing(true)} className="text-left text-sm font-semibold text-lime-100" title="Double click to edit">
        {value}
      </button>
    );
  }

  return (
    <select
      autoFocus
      defaultValue={value}
      onBlur={(event) => {
        setEditing(false);
        onSave(event.target.value as GrowStage);
      }}
      className="w-full rounded-lg border border-lime-300/30 bg-black/20 px-2 py-1 text-sm text-lime-100 outline-none"
    >
      <option value="Seedling">Seedling</option>
      <option value="Veg">Vegging</option>
      <option value="Bloom">Bloom</option>
    </select>
  );
}

function EditableNumber({
  value,
  onSave,
  suffix
}: {
  value: number;
  onSave: (value: number) => void;
  suffix?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    if (!editing) {
      setDraft(String(value));
    }
  }, [editing, value]);

  if (!editing) {
    return (
      <button type="button" onDoubleClick={() => setEditing(true)} className="text-left text-sm font-semibold text-lime-100">
        {value}
        {suffix ?? ""}
      </button>
    );
  }

  return (
    <input
      autoFocus
      type="number"
      step="0.01"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        setEditing(false);
        const numeric = Number(draft);
        if (Number.isFinite(numeric)) {
          onSave(numeric);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          setEditing(false);
          const numeric = Number(draft);
          if (Number.isFinite(numeric)) {
            onSave(numeric);
          }
        }
      }}
      className="w-20 rounded-lg border border-lime-300/30 bg-black/20 px-2 py-1 text-sm text-lime-100 outline-none"
    />
  );
}

function EditableDateTime({
  dateIso,
  onSave,
  displayValue
}: {
  dateIso: string;
  onSave: (value: string) => void;
  displayValue: string;
}) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <button type="button" onDoubleClick={() => setEditing(true)} className="text-left text-xs text-lime-100">
        {displayValue}
      </button>
    );
  }

  return (
    <input
      type="datetime-local"
      autoFocus
      defaultValue={toDatetimeLocal(dateIso)}
      onBlur={(event) => {
        setEditing(false);
        if (event.target.value) {
          onSave(new Date(event.target.value).toISOString());
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          setEditing(false);
          const value = (event.currentTarget as HTMLInputElement).value;
          if (value) {
            onSave(new Date(value).toISOString());
          }
        }
      }}
      className="w-40 rounded-lg border border-lime-300/30 bg-black/20 px-2 py-1 text-xs text-lime-100 outline-none"
    />
  );
}

function getWateringCountdown(lastWateredAt: string, intervalDays: number) {
  const last = new Date(lastWateredAt).getTime();
  const next = last + intervalDays * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const diff = Math.max(0, next - now);
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  return `${days}d ${hours}h`;
}

function getDrybackPercent(lastWateredAt: string, intervalDays: number) {
  const last = new Date(lastWateredAt).getTime();
  const next = last + intervalDays * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const total = Math.max(1, next - last);
  const elapsed = Math.max(0, Math.min(total, now - last));
  return Math.round(100 - (elapsed / total) * 100);
}

function parseTimeToMinutes(value: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour > 23 || minute > 59) {
    return null;
  }
  return hour * 60 + minute;
}

function isLightsOnNow(lightsOn: string, lightsOff: string, nowMs: number) {
  const on = parseTimeToMinutes(lightsOn);
  const off = parseTimeToMinutes(lightsOff);
  if (on === null || off === null || on === off) {
    return false;
  }

  const nowDate = new Date(nowMs);
  const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
  if (on < off) {
    return nowMinutes >= on && nowMinutes < off;
  }
  return nowMinutes >= on || nowMinutes < off;
}

function toDatetimeLocal(iso: string) {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
}

function estimatePpfd(lightType: "blurple_40w" | "panel_100w", dimmerPercent: number) {
  if (lightType === "blurple_40w") {
    return 230;
  }

  const p = Math.max(1, Math.min(100, dimmerPercent || 1));
  const points: Array<[number, number]> = [
    [1, 580],
    [50, 750],
    [100, 1200]
  ];

  if (p <= points[0][0]) return points[0][1];
  for (let i = 0; i < points.length - 1; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    if (p >= x1 && p <= x2) {
      const t = (p - x1) / Math.max(1e-9, x2 - x1);
      return Math.round(y1 + (y2 - y1) * t);
    }
  }
  return points[points.length - 1][1];
}

function getStageIcon(stage: GrowStage) {
  if (stage === "Seedling") return <Sprout className="h-4 w-4 text-sky-500" />;
  if (stage === "Veg") return <Cannabis className="h-4 w-4 text-green-500" />;
  if (stage === "Bloom") return <Wheat className="h-4 w-4 text-indigo-500" />;
  return <Leaf className="h-4 w-4 text-lime-300" />;
}

function StageProgressBar({
  seedlingDays,
  vegDays,
  bloomDays,
  seedlingTarget,
  vegTarget,
  bloomTarget
}: {
  seedlingDays: number;
  vegDays: number;
  bloomDays: number;
  seedlingTarget: number;
  vegTarget: number;
  bloomTarget: number;
}) {
  const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
  const seedlingPct = clamp01(seedlingDays / seedlingTarget);
  const vegPct = clamp01(vegDays / vegTarget);
  const bloomPct = clamp01(bloomDays / bloomTarget);

  return (
    <div className="mt-2 grid grid-cols-3 gap-2">
      <div className="overflow-hidden rounded-full bg-white/10">
        <div className="h-2 rounded-full bg-green-500/80" style={{ width: `${Math.round(seedlingPct * 100)}%` }} />
      </div>
      <div className="overflow-hidden rounded-full bg-white/10">
        <div className="h-2 rounded-full bg-green-300/80" style={{ width: `${Math.round(vegPct * 100)}%` }} />
      </div>
      <div className="overflow-hidden rounded-full bg-white/10">
        <div className="h-2 rounded-full bg-indigo-500/100" style={{ width: `${Math.round(bloomPct * 100)}%` }} />
      </div>
      <div className="col-span-3 flex justify-between text-[10px] text-lime-100/70">
        <span>Seedling</span>
        <span>Vegging</span>
        <span>Bloom</span>
      </div>
    </div>
  );
}

function formatAvgPh(watering: PlantProfile["wateringData"]) {
  const inVals = watering.map((w) => w.ph).filter((n) => Number.isFinite(n));
  const runoffVals = watering.map((w) => w.runoffPh).filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  const avg = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
  const inAvg = avg(inVals);
  const runoffAvg = avg(runoffVals);
  return `${inAvg ? inAvg.toFixed(2) : "--"} in / ${runoffAvg ? runoffAvg.toFixed(2) : "--"} runoff`;
}

function formatAvgPpm(watering: PlantProfile["wateringData"]) {
  const toPpm = (ec: number) => ec * 700;
  const inVals = watering.map((w) => w.ec).filter((n) => Number.isFinite(n));
  const runoffVals = watering.map((w) => w.runoffEc).filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  const avg = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
  const inAvg = avg(inVals);
  const runoffAvg = avg(runoffVals);
  return `${inAvg ? Math.round(toPpm(inAvg)) : "--"} in / ${runoffAvg ? Math.round(toPpm(runoffAvg)) : "--"} runoff`;
}

const CANNA_AQUA_PERIODS: Array<{
  key: string;
  label: string;
  ecTotal: number;
  baseA?: number;
  baseB?: number;
  vega?: boolean;
  flores?: boolean;
  rhizotonic?: number | [number, number];
  cannazym?: number | [number, number];
  pk1314?: number;
  cannaboost?: number | [number, number];
}> = [
  { key: "rooting", label: "Start / rooting (3-5 days)", ecTotal: 1.1, baseA: 1.8, baseB: 1.8, vega: true, rhizotonic: 4 },
  { key: "veg_phase_1", label: "Vegetative phase I (0-3 weeks)", ecTotal: 1.3, baseA: 2.2, baseB: 2.2, vega: true, rhizotonic: 2, cannazym: 2.5 },
  { key: "veg_phase_2", label: "Vegetative phase II (2-4 weeks)", ecTotal: 1.6, baseA: 2.8, baseB: 2.8, vega: true, rhizotonic: 2, cannazym: 2.5, cannaboost: [2, 4] },
  { key: "gen_1", label: "Generative period I (2-3 weeks)", ecTotal: 1.8, baseA: 3.4, baseB: 3.4, flores: true, rhizotonic: 0.5, cannazym: 2.5, cannaboost: [2, 4] },
  { key: "gen_2", label: "Generative period II (1 week)", ecTotal: 2.0, baseA: 3.5, baseB: 3.5, flores: true, rhizotonic: 0.5, cannazym: 2.5, pk1314: 1.5, cannaboost: [2, 4] },
  { key: "gen_3", label: "Generative period III (2-3 weeks)", ecTotal: 1.4, baseA: 2.5, baseB: 2.5, flores: true, rhizotonic: 0.5, cannazym: 2.5, cannaboost: [2, 4] },
  { key: "gen_4", label: "Generative period IV (1-2 weeks)", ecTotal: 0.2, flores: true, cannazym: [2.5, 5], cannaboost: [2, 4] }
];

function renderCannaMix({ periodKey, liters, targetEc }: { periodKey: string; liters: number; targetEc: number }) {
  const period = CANNA_AQUA_PERIODS.find((p) => p.key === periodKey) ?? CANNA_AQUA_PERIODS[0];
  const scale = period.ecTotal > 0 ? targetEc / period.ecTotal : 1;

  const calcMl = (mlPerL?: number) => (typeof mlPerL === "number" ? Math.max(0, mlPerL * liters * scale) : null);
  const calcRange = (range?: [number, number]) =>
    range ? ([range[0] * liters * scale, range[1] * liters * scale] as [number, number]) : null;

  const items: Array<{ label: string; value: string }> = [];
  if (period.vega) items.push({ label: "Aqua Vega (A/B)", value: "" });
  if (period.flores) items.push({ label: "Aqua Flores (A/B)", value: "" });

  const baseA = calcMl(period.baseA);
  const baseB = calcMl(period.baseB);
  if (baseA !== null && baseB !== null) items.push({ label: "Base A", value: `${baseA.toFixed(1)} ml` });
  if (baseA !== null && baseB !== null) items.push({ label: "Base B", value: `${baseB.toFixed(1)} ml` });

  const rhizo = Array.isArray(period.rhizotonic) ? calcRange(period.rhizotonic) : null;
  const rhizoSingle = !Array.isArray(period.rhizotonic) ? calcMl(period.rhizotonic) : null;
  if (rhizoSingle !== null) items.push({ label: "Rhizotonic", value: `${rhizoSingle.toFixed(1)} ml` });
  if (rhizo) items.push({ label: "Rhizotonic", value: `${rhizo[0].toFixed(1)}–${rhizo[1].toFixed(1)} ml` });

  const zym = Array.isArray(period.cannazym) ? calcRange(period.cannazym) : null;
  const zymSingle = !Array.isArray(period.cannazym) ? calcMl(period.cannazym) : null;
  if (zymSingle !== null) items.push({ label: "Cannazym", value: `${zymSingle.toFixed(1)} ml` });
  if (zym) items.push({ label: "Cannazym", value: `${zym[0].toFixed(1)}–${zym[1].toFixed(1)} ml` });

  const pk = calcMl(period.pk1314);
  if (pk !== null) items.push({ label: "PK 13/14", value: `${pk.toFixed(1)} ml` });

  const boost = Array.isArray(period.cannaboost) ? calcRange(period.cannaboost) : null;
  const boostSingle = !Array.isArray(period.cannaboost) ? calcMl(period.cannaboost) : null;
  if (boostSingle !== null) items.push({ label: "Cannaboost", value: `${boostSingle.toFixed(1)} ml` });
  if (boost) items.push({ label: "Cannaboost", value: `${boost[0].toFixed(1)}–${boost[1].toFixed(1)} ml` });

  return (
    <>
      <div className="rounded-2xl border border-white/8 bg-white/5 p-3 sm:col-span-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-lime-200">Mix result</p>
        <div className="mt-2 grid grid-cols-[1.2fr_1fr_1fr] gap-2 text-[11px] text-lime-100/75">
          <span>Product</span>
          <span className="text-right">ml/L (scaled)</span>
          <span className="text-right">Total ml</span>
        </div>
        <div className="mt-1 border-t border-lime-300/15" />
        <div className="mt-2 space-y-1.5">
          {items.map((item) => {
            const numericMatch = item.value.match(/^([0-9.]+)(?:–([0-9.]+))?\s*ml$/i);
            const totalMl = numericMatch
              ? numericMatch[2]
                ? `${numericMatch[1]}-${numericMatch[2]}`
                : numericMatch[1]
              : item.value;
            const perLiter = numericMatch
              ? numericMatch[2]
                ? `${(Number(numericMatch[1]) / liters).toFixed(2)}-${(Number(numericMatch[2]) / liters).toFixed(2)}`
                : (Number(numericMatch[1]) / liters).toFixed(2)
              : "-";
            return (
              <div key={item.label + item.value} className="grid grid-cols-[1.2fr_1fr_1fr] gap-2 text-sm">
                <span className="text-lime-100/80">{item.label}</span>
                <span className="text-right text-lime-100/80">{perLiter}</span>
                <span className="text-right font-semibold text-lime-100">{totalMl}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] text-lime-100/65">
          Scaled from chart EC total {period.ecTotal} to target EC {targetEc} (x{Number(scale.toFixed(2))}).
        </p>
      </div>
      <div className="rounded-2xl border border-white/8 bg-white/5 p-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-lime-200">PPM target</p>
        <p className="mt-2 text-sm font-semibold text-lime-100">{Math.round(targetEc * 700)} PPM (Hanna)</p>
        <p className="mt-1 text-[11px] text-lime-100/65">Uses 700 ppm/EC conversion.</p>
      </div>
    </>
  );
}