"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Droplets, Leaf, Lightbulb, Minus, Plus, RotateCcw, Thermometer, Waves, X } from "lucide-react";
import { GrowChart } from "@/components/charts/grow-chart";
import { AiAssistantPanel } from "@/components/dashboard/ai-assistant-panel-livekit";
import { VPDChart } from "@/components/dashboard/vpd-chart";
import { PlantTimelineCalendar } from "@/components/dashboard/plant-timeline-calendar";
import { calculateVpd, getCycleSummary, getDetailedCycleSummary, getVpdBand } from "@/lib/grow-math";
import { Locale, translations } from "@/lib/i18n";
import { dailyLogs, createNewPlant } from "@/lib/mock-data";
import { generateUUID } from "@/lib/uuid";
import type { GrowStage, PlantProfile } from "@/lib/types";

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
  const t = translations[locale];

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

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
    const weatherTimer = window.setInterval(() => void loadWeather(), 60_000);
    return () => {
      ignore = true;
      window.clearInterval(weatherTimer);
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    const loadState = async () => {
      try {
        const response = await fetch("/api/plants", { cache: "no-store" });
        const data = (await response.json()) as {
          ok: boolean;
          plants?: PlantProfile[];
          activePlantId?: string;
        };

        if (!ignore && data.ok && Array.isArray(data.plants) && data.plants.length) {
          setPlants(data.plants);
          if (!data.activePlantId) {
            // Set active plant to first in list order (by startedAt)
            const sorted = [...data.plants].sort((a, b) => {
              const aDate = new Date(a.startedAt).getTime();
              const bDate = new Date(b.startedAt).getTime();
              return aDate - bDate;
            });
            setActivePlantId(sorted[0]?.id || data.plants[0].id);
          } else {
            setActivePlantId(data.activePlantId);
          }
        }
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

  useEffect(() => {
    if (!loadedFromServer) {
      return;
    }

    void fetch("/api/plants", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        plants,
        activePlantId
      })
    });
  }, [activePlantId, loadedFromServer, plants]);

  const getFirstPlantByList = () => {
    if (plants.length === 0) return undefined;
    const sorted = [...plants].sort((a, b) => {
      const aDate = new Date(a.startedAt).getTime();
      const bDate = new Date(b.startedAt).getTime();
      return aDate - bDate;
    });
    return sorted[0];
  };

  const activePlant = useMemo(
    () => plants.find((entry) => entry.id === activePlantId) ?? getFirstPlantByList(),
    [plants, activePlantId]
  );

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
    if (confirm("Are you sure you want to delete this plant? This action cannot be undone.")) {
      try {
        const response = await fetch("/api/plants", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ plantId })
        });

        const result = (await response.json()) as { ok: boolean; error?: string };
        if (result.ok) {
          setPlants((current) => current.filter((p) => p.id !== plantId));
          if (activePlantId === plantId) {
            const remaining = plants.filter((p) => p.id !== plantId);
            setActivePlantId(remaining[0]?.id || "");
          }
        } else {
          console.error("Failed to delete plant:", result.error);
          alert("Failed to delete plant. Check console for details.");
        }
      } catch (error) {
        console.error("Error deleting plant:", error);
        alert("Error deleting plant. Check console for details.");
      }
    }
  };

  if (!activePlant) {
    return (
      <main className="min-h-screen bg-hero-grid flex items-center justify-center">
        <div className="glass-panel rounded-3xl p-8 max-w-md text-center">
          <p className="text-xl font-semibold text-lime-100 mb-4">No Plants Yet</p>
          <p className="text-lime-100/70 mb-6">Create your first plant to get started tracking growth, climate, and nutrition.</p>
          <button
            onClick={addPlant}
            className="rounded-lg bg-lime-400/20 border border-lime-300/30 hover:bg-lime-400/30 px-6 py-3 font-semibold text-lime-100 transition"
          >
            Create First Plant
          </button>
        </div>
      </main>
    );
  }

  const cycle = getCycleSummary(activePlant);
  const cycleDetailed = getDetailedCycleSummary(activePlant);
  const daysSeedling = Math.max(0, cycleDetailed.totalDays - cycleDetailed.daysInVeg - cycleDetailed.daysInBloom);
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
    onPlantUpdate({
      ...activePlant,
      ...patch
    });
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

  return (
    <main className="min-h-screen bg-hero-grid">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 lg:px-6">
        <div className="glass-panel rounded-3xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-lime-200">Live Clock</p>
              <p className="mt-1 text-2xl font-semibold text-lime-100">
                {new Intl.DateTimeFormat(locale, {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false
                }).format(new Date(now))}
              </p>
              <p className="text-xs text-lime-100/75">
                {new Intl.DateTimeFormat(locale, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric"
                }).format(new Date(now))}
              </p>
            </div>
            <div className="rounded-2xl border border-lime-300/15 bg-lime-300/8 px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-lime-200">Outside Weather</p>
              <p className="mt-1 text-lg font-semibold text-lime-100">
                {weather?.temperatureC !== null && weather?.temperatureC !== undefined ? `${weather.temperatureC} C` : "-- C"}
              </p>
              <p className="text-xs text-lime-100/80">
                Humidity: {weather?.humidity !== null && weather?.humidity !== undefined ? `${weather.humidity}%` : "--%"}
              </p>
              {/* location intentionally hidden */}
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[2fr_0.95fr]">
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
                  <Leaf className={`h-4 w-4 ${getStageLeafTone(activePlant.stage)}`} />
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
                    seedlingDays={daysSeedling}
                    vegDays={cycleDetailed.daysInVeg}
                    bloomDays={cycleDetailed.daysInBloom}
                    seedlingTarget={Math.max(1, activePlant.stageDays.seedling)}
                    vegTarget={Math.max(1, activePlant.stageDays.veg)}
                    bloomTarget={45}
                  />
                </div>
              </div>
             
            </div>

            <div className="mt-4 rounded-2xl border border-white/8 bg-white/5 p-3">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-lime-200">Plant list</p>
                <button
                  type="button"
                  onClick={addPlant}
                  className="rounded-full border border-lime-300/20 bg-lime-300/12 p-1 text-lime-100"
                  title="Add plant"
                >
                  <Plus className="h-4 w-4" />
                </button>
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
                        <Leaf className={`h-4 w-4 ${getStageLeafTone(entry.stage)}`} />
                        {entry.strainName}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removePlant(entry.id)}
                      className="absolute -top-2 -right-2 rounded-full bg-red-500/90 hover:bg-red-600 p-0.5 text-white opacity-0 group-hover:opacity-100 transition"
                      title={`Delete ${entry.strainName}`}
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
                icon={<Leaf className="h-4 w-4" />}
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
                  <div className="space-y-1">
                    
                    <div className="flex items-center justify-between gap-3 text-xs text-lime-100/80">

                     <EditableText
                      value={activePlant.lightSchedule}
                      className="text-sm font-semibold text-lime-100"
                      onSave={(value) => patchActivePlant({ lightSchedule: value })}
                      />
                      <span>
                        On {" "}
                        <EditableText
                          value={activePlant.lightsOn}
                          className="font-semibold text-lime-100"
                          onSave={(value) => patchActivePlant({ lightsOn: value })}
                        />
                      </span>
                      <span>
                        Off {" "}
                        <EditableText
                          value={activePlant.lightsOff}
                          className="font-semibold text-lime-100"
                          onSave={(value) => patchActivePlant({ lightsOff: value })}
                        />
                      </span>
                      <span className="ml-auto flex items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            lightsOnNow ? "bg-green-500 shadow-[0_0_10px_rgba(158,255,102,0.9)]" : "bg-slate-600"
                          }`}
                        />
                        {lightsOnNow ? "Lights ON" : "Lights OFF"}
                      </span>
                    </div>
                    {/* <div className="mt-2 rounded-2xl border border-white/8 bg-black/20 p-3"> */}
                      {/* <div className="flex items-center justify-between gap-2">
                        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-lime-200">Light</p>
                        <div className="rounded-xl border border-lime-300/20 bg-lime-300/10 p-2 text-lime-200">
                          <Lightbulb className="h-4 w-4" />
                        </div>
                      </div> */}
                      <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        <div className="sm:col-span-1">
                          <p className="text-[11px] text-lime-100/65">Lamp name</p>
                          <EditableText
                            value={activePlant.lightLampName ?? ""}
                            className="text-sm font-semibold text-lime-100"
                            onSave={(value) => patchActivePlant({ lightLampName: value })}
                          />
                        </div>
                        <div>
                          <p className="text-[11px] text-lime-100/65">Watts</p>
                          <EditableNumber
                            suffix=" W"
                            value={activePlant.lightLampWatts ?? (activePlant.lightType === "blurple_40w" ? 40 : 100)}
                            onSave={(value) => patchActivePlant({ lightLampWatts: value })}
                          />
                        </div>
                         <div className="sm:col-span-1">
                          <p className="text-[11px] text-lime-100/65"> PPFD</p>
                          <p className="text-sm font-semibold text-lime-100">
                            {ppfd === null ? "--" : `${ppfd}  PPFD`}
                          </p>
                        </div>
                        <div className="sm:col-span-2">
                          <p className="text-[11px] text-lime-100/65">Type</p>
                          <select
                            value={activePlant.lightType ?? "panel_100w"}
                            onChange={(event) => patchActivePlant({ lightType: event.target.value as "blurple_40w" | "panel_100w" })}
                            className="mt-1 w-full rounded-lg border border-lime-300/20 bg-black/30 px-2 py-1 text-sm text-lime-100 outline-none"
                          >
                            <option value="blurple_40w">Vegging Light</option>
                            <option value="panel_100w">Bloom Light </option>
                          </select>
                        </div>
                        <div>
                          <p className="text-[11px] text-lime-100/65">%</p>
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={typeof activePlant.lightDimmerPercent === "number" ? activePlant.lightDimmerPercent : ""}
                            onChange={(event) => {
                              const raw = event.target.value;
                              if (!raw) {
                                patchActivePlant({ lightDimmerPercent: undefined });
                                return;
                              }
                              patchActivePlant({
                                lightDimmerPercent: Math.max(1, Math.min(100, Number(raw) || 1))
                              });
                            }}
                            className="mt-1 w-full rounded-lg border border-lime-300/20 bg-black/30 px-2 py-1 text-sm text-lime-100 outline-none"
                            disabled={(activePlant.lightType ?? "panel_100w") === "blurple_40w"}
                          />
                        </div>
                       
                      </div>
                    </div>
                  // </div>
                }
              />
            </div>
          </div>

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
          />
        </div>

        <div className="grid gap-4">
          {/* VPD Chart */}
          <VPDChart
            currentVpd={liveVpd}
            currentTemp={activePlant.growTempC}
            currentHumidity={activePlant.growHumidity}
            currentStage={activePlant.stage}
            onStageChange={(newStage) => patchActivePlant({ stage: newStage })}
          />

          {/* Growth Progression Chart */}
          <GrowChart
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
                <CalendarDays className="h-4 w-4 text-lime-300" />
              </div>
              <div className="mt-4 flex  gap-2 sm:grid-cols-2">
                <MiniInfo label={t.stage} value={<EditableStage value={activePlant.stage} onSave={handleStageChange} />} />
                <MiniInfo label={t.totalDays} value={<span className="text-sm font-semibold text-lime-100">{cycleDetailed.totalDays}</span>} />
                <MiniInfo
                  label="Days Seedling"
                  value={
                    <EditableNumber
                      value={activePlant.stageDays.seedling}
                      onSave={(value) => patchActivePlant({ stageDays: { ...activePlant.stageDays, seedling: value } })}
                    />
                  }
                />
                <MiniInfo
                  label="Days Vegging"
                  value={
                    <EditableNumber
                      value={activePlant.stageDays.veg}
                      onSave={(value) => {
                        const wasInactive = activePlant.stageDays.veg === 0;
                        const isActivating = wasInactive && value > 0;
                        patchActivePlant({
                          stageDays: { ...activePlant.stageDays, veg: value },
                          ...(isActivating && !activePlant.vegStartedAt ? { vegStartedAt: new Date().toISOString() } : {})
                        });
                      }}
                    />
                  }
                />
                <MiniInfo
                  label="Days Bloom"
                  value={
                    <EditableNumber
                      value={activePlant.stageDays.bloom}
                      onSave={(value) => {
                        const wasInactive = activePlant.stageDays.bloom === 0;
                        const isActivating = wasInactive && value > 0;
                        patchActivePlant({
                          stageDays: { ...activePlant.stageDays, bloom: value },
                          ...(isActivating && !activePlant.bloomStartedAt ? { bloomStartedAt: new Date().toISOString() } : {})
                        });
                      }}
                    />
                  }
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
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-lime-200">Nutrient calculator</p>
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

function MiniInfo({ label, value }: { label: string; value: React.ReactNode }) {
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

function EditableDate({ dateIso, locale, onSave }: { dateIso: string; locale: Locale; onSave: (value: string) => void }) {
  const [editing, setEditing] = useState(false);
  const formatted = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" }).format(new Date(dateIso));
  const inputValue = dateIso.slice(0, 10);

  if (!editing) {
    return (
      <button type="button" onDoubleClick={() => setEditing(true)} className="text-left text-sm font-semibold text-lime-100" title="Double click to edit">
        {formatted}
      </button>
    );
  }

  return (
    <input
      type="date"
      autoFocus
      defaultValue={inputValue}
      onBlur={(event) => {
        setEditing(false);
        if (event.target.value) {
          onSave(event.target.value);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          const value = (event.currentTarget as HTMLInputElement).value;
          setEditing(false);
          if (value) {
            onSave(value);
          }
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
      <option value="Veg">Veg</option>
      <option value="Bloom">Bloom</option>
      <option value="Dry">Dry</option>
      <option value="Cure">Cure</option>
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

function getStageLeafTone(stage: GrowStage) {
  if (stage === "Seedling") return "text-green-500";
  if (stage === "Veg") return "text-green-300";
  if (stage === "Bloom") return "text-indigo-300";
  return "text-indigo-500";
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
