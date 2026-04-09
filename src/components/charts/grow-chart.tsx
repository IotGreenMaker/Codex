"use client";

import { Plus, Trash2, Minus, RotateCcw } from "lucide-react";
import { useState, useMemo } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { ClimateEntry, GrowLogEntry, GrowStage, WateringEntry } from "@/lib/types";
import { generateUUID } from "@/lib/uuid";
import type { Locale } from "@/lib/i18n";

type FilterPeriod = "DAY" | "WEEK" | "MONTH" | "ALL";

  type GrowChartProps = {
    plantId: string;
    logs: GrowLogEntry[];
    wateringData: WateringEntry[];
    climateData: ClimateEntry[];
    stage: GrowStage;
    locale: Locale;
    wateringIntervalDays: number;
    onWateringDataChange: (next: WateringEntry[]) => void;
    onClimateDataChange: (next: ClimateEntry[]) => void;
    onUpdateInterval?: (intervalDays: number) => void;
    onWaterNow?: () => void;
    onOpenVpdChart?: () => void;
    labels: {
      progression: string;
      tempHumidityVpd: string;
    };
  };

export function GrowChart({
  plantId,
  logs: _logs,
  wateringData,
  climateData,
  stage,
  locale,
  wateringIntervalDays,
  onWateringDataChange,
  onClimateDataChange,
  onUpdateInterval,
  onWaterNow,
  onOpenVpdChart,
  labels
}: GrowChartProps) {
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>("WEEK");

  const deleteWateringEntry = async (wateringId: string) => {
    try {
      const response = await fetch("/api/plants", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete-watering",
          wateringId,
          plantId
        })
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (result.ok) {
        onWateringDataChange(wateringData.filter((row) => row.id !== wateringId));
      } else {
        console.error("Failed to delete watering entry:", result.error);
        alert("Failed to delete watering entry");
      }
    } catch (error) {
      console.error("Error deleting watering entry:", error);
      alert("Error deleting watering entry");
    }
  };

  const deleteClimateEntry = async (climateId: string) => {
    try {
      const response = await fetch("/api/plants", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete-climate",
          climateId,
          plantId
        })
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (result.ok) {
        onClimateDataChange(climateData.filter((row) => row.id !== climateId));
      } else {
        console.error("Failed to delete climate entry:", result.error);
        alert("Failed to delete climate entry");
      }
    } catch (error) {
      console.error("Error deleting climate entry:", error);
      alert("Error deleting climate entry");
    }
  };

  const filteredClimate = useMemo(() => {
    const now = Date.now();
    let cutoffTime = now;

    switch (filterPeriod) {
      case "DAY":
        cutoffTime = now - 24 * 60 * 60 * 1000;
        break;
      case "WEEK":
        cutoffTime = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case "MONTH":
        cutoffTime = now - 30 * 24 * 60 * 60 * 1000;
        break;
      case "ALL":
        cutoffTime = 0;
        break;
    }

    return climateData.filter((entry) => {
      if (!entry.timestamp) return false;
      const ts = new Date(entry.timestamp).getTime();
      return !isNaN(ts) && ts >= cutoffTime;
    });
  }, [climateData, filterPeriod]);

  const sortedClimate = [...filteredClimate].sort((a, b) => {
    const aTime = new Date(a.timestamp).getTime();
    const bTime = new Date(b.timestamp).getTime();
    return aTime - bTime;
  });
  const climateChartData = sortedClimate.map((entry) => ({
    tick: formatShortDate(entry.timestamp, locale),
    temp: entry.tempC,
    humidity: entry.humidity,
    vpd: calculateVpd(entry.tempC, entry.humidity)
  }));

  const sortedWatering = [...wateringData].filter((w) => w.timestamp).sort((a, b) => {
    const aTime = new Date(a.timestamp).getTime();
    const bTime = new Date(b.timestamp).getTime();
    return aTime - bTime;
  });
  const newestFirstWatering = [...sortedWatering].sort((a, b) => {
    const aTime = new Date(a.timestamp).getTime();
    const bTime = new Date(b.timestamp).getTime();
    return bTime - aTime;
  });
  const latestWatering = sortedWatering[sortedWatering.length - 1];
  const projectedNextWatering = latestWatering && latestWatering.timestamp
    ? {
        id: "next-watering",
        timestamp: new Date(new Date(latestWatering.timestamp).getTime() + wateringIntervalDays * 24 * 60 * 60 * 1000).toISOString(),
        amountMl: latestWatering.amountMl,
        drybackPercent: 0,
        projected: true
      }
    : null;

  const hydrationChartData = buildDrybackSeries(sortedWatering, locale, wateringIntervalDays);

  if (projectedNextWatering) {
    hydrationChartData.push({
      id: projectedNextWatering.id,
      tick: formatShortDate(projectedNextWatering.timestamp, locale),
      waterMl: projectedNextWatering.amountMl,
      drybackPercent: 0,
      ph: null,
      runoffPh: null,
      projected: true
    });
  }

  // Calculate watering progress percentage (dryback: 100% when wet, 0% when dry)
  const wateringProgressPercent = latestWatering && projectedNextWatering
    ? Math.min(
        100,
        Math.max(
          0,
          100 - ((Date.now() - new Date(latestWatering.timestamp).getTime()) /
            (new Date(projectedNextWatering.timestamp).getTime() - new Date(latestWatering.timestamp).getTime())) * 100
        )
      )
    : 0;

  const idealVpd = getIdealVpd(stage);
  const nextWateringLabel = projectedNextWatering ? formatShortDate(projectedNextWatering.timestamp, locale) : "";

  return (
    <div className="grid gap-4">
      <div className="glass-panel rounded-3xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-lime-300/80">{labels.progression}</p>
           
          </div>
          <div className="flex items-center gap-2">
            {onOpenVpdChart && (
              <button
                type="button"
                onClick={onOpenVpdChart}
                className="rounded-lg px-2 py-1 ml-5 text-xs font-semibold  border border-lime-300/20 bg-slate-300/20 text-lime-200/50 hover:bg-lime-300/25 transition flex items-center gap-1"
                title="Open VPD Chart"
              >
                VPD CHART
              </button>
            )}
            {(["DAY", "WEEK", "MONTH", "ALL"] as const).map((period) => (
              <button
                key={period}
                onClick={() => setFilterPeriod(period)}
                className={`rounded px-2 py-1 text-xs font-semibold transition ${
                  filterPeriod === period
                    ? "bg-lime-300/30 text-lime-200"
                    : "bg-lime-300/10 text-lime-100/50 hover:bg-lime-300/15"
                }`}
              >
                {period}
              </button>
            ))}
            <button
              type="button"
              onClick={() =>
                onClimateDataChange([
                  ...climateData,
                  {
                    id: generateUUID(),
                    timestamp: new Date().toISOString(),
                    tempC: climateData[0]?.tempC ?? 25,
                    humidity: climateData[0]?.humidity ?? 60
                  }
                ])
              }
              className="rounded-lg border-2 font-bold  border-lime-300/70 bg-lime-300/20 p-3 text-slate-300 hover:bg-lime-300/60"
              title="Add climate datapoint"
            >
              <Plus className="h-4 w-4 " />
            </button>
          </div>
        </div>
        <p className="mb-3 text-xs text-lime-100/70">{labels.tempHumidityVpd}</p>
        <div className="h-40 sm:h-52">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={climateChartData}>
              <defs>
                <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#9eff66" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#9eff66" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="humidityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2b7fff" stopOpacity={0.34} />
                  <stop offset="100%" stopColor="#2b7fff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="tick" stroke="#a8a2bb" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
              <YAxis yAxisId="climate" stroke="#a8a2bb" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
              <YAxis yAxisId="vpd" orientation="right" stroke="#a8a2bb" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
              <ReferenceArea yAxisId="vpd" y1={idealVpd.min} y2={idealVpd.max} fill="rgba(158,255,102,0.8)" />
              <Tooltip
                contentStyle={{
                  background: "#120f1c",
                  border: "1px solid rgba(158, 255, 102, 0.18)",
                  borderRadius: "16px"
                }}
              />
              <Area yAxisId="climate" type="monotone" dataKey="temp" stroke="#9eff66" fill="url(#tempGradient)" strokeWidth={2.5} />
              <Area yAxisId="climate" type="monotone" dataKey="humidity" stroke="#2b7fff" fill="url(#humidityGradient)" strokeWidth={2} />
              <Line yAxisId="vpd" type="monotone" dataKey="vpd" stroke="#fe9a00" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 rounded-2xl bg-black/20 overflow-x-auto max-h-[30vh]">
          <table className="w-full border-collapse text-[10px] sm:text-xs text-lime-100 min-w-[400px]">
            <thead className="bg-black/25 sticky top-0 z-10">
              <tr className="text-left font-mono uppercase tracking-[0.16em] text-lime-200">
                <th className="px-2 sm:px-3 py-1.5 sm:py-2">Weather</th>
                <th className="px-2 sm:px-3 py-1.5 sm:py-2">Temp C</th>
                <th className="px-2 sm:px-3 py-1.5 sm:py-2">Hum %</th>
                <th className="px-2 sm:px-3 py-1.5 sm:py-2">VPD</th>
                <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-right">x</th>
              </tr>
            </thead>
            <tbody>
              {[...climateData]
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                .map((entry) => (
                  <tr key={entry.id} className="border-t border-black/30">
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2">
                      <input
                        type="datetime-local"
                        value={toDatetimeLocal(entry.timestamp)}
                        onChange={(event) =>
                          onClimateDataChange(
                            climateData.map((row) =>
                              row.id === entry.id ? { ...row, timestamp: fromDatetimeLocal(event.target.value) } : row
                            )
                          )
                        }
                        className="w-full rounded-lg border border-lime-300/10 bg-black/30 px-2 sm:px-3 py-1 sm:py-2 text-[10px] sm:text-xs text-lime-100 outline-none"
                      />
                    </td>
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2">
                      <input
                        type="number"
                        step="0.1"
                        value={entry.tempC}
                        onChange={(event) =>
                          onClimateDataChange(
                            climateData.map((row) =>
                              row.id === entry.id ? { ...row, tempC: Number(event.target.value) || 0 } : row
                            )
                          )
                        }
                        className="w-16 sm:w-20 rounded-lg border border-lime-300/10 bg-black/30 px-2 sm:px-3 py-1 sm:py-2 text-[10px] sm:text-xs text-lime-100 outline-none"
                      />
                    </td>
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2">
                      <input
                        type="number"
                        step="0.1"
                        value={entry.humidity}
                        onChange={(event) =>
                          onClimateDataChange(
                            climateData.map((row) =>
                              row.id === entry.id ? { ...row, humidity: Number(event.target.value) || 0 } : row
                            )
                          )
                        }
                        className="w-16 sm:w-20 rounded-lg border border-lime-300/10 bg-black/30 px-2 sm:px-3 py-1 sm:py-2 text-[10px] sm:text-xs text-lime-100 outline-none"
                      />
                    </td>
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2">
                      <span
                        title={getVpdTooltip(stage, calculateVpd(entry.tempC, entry.humidity))}
                        className={`rounded-full px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs ${getVpdPillClass(stage, calculateVpd(entry.tempC, entry.humidity))}`}
                      >
                        {calculateVpd(entry.tempC, entry.humidity).toFixed(2)} kPa
                      </span>
                    </td>
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-right">
                      <button
                        type="button"
                        onClick={() => deleteClimateEntry(entry.id)}
                        className="rounded-full border border-red-300/20 bg-red-400/10 p-0.5 sm:p-1 text-red-100"
                        title="Delete row"
                      >
                        <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-panel rounded-3xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-lime-300/80">Watering & Dryback</p>
          <button
            type="button"
            onClick={() =>
              onWateringDataChange([
                ...wateringData,
                {
                  id: generateUUID(),
                  timestamp: new Date().toISOString(),
                  amountMl: latestWatering?.amountMl ?? 500,
                  ph: latestWatering?.ph ?? 6,
                  ec: latestWatering?.ec ?? 1
                }
              ])
            }
            className="rounded-lg border-2 font-bold  border-lime-300/70 bg-lime-300/20 p-3 text-slate-300 hover:bg-lime-300/60"
            title="Add watering datapoint"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="h-40 sm:h-52">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={hydrationChartData}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="tick" stroke="#a8a2bb" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
              <YAxis yAxisId="water" stroke="#a8a2bb" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
              <YAxis yAxisId="dryback" orientation="right" domain={[0, 100]} stroke="#fe9a00" tickLine={true} axisLine={false} tick={{ fontSize: 10 }} />
              <YAxis yAxisId="ph" orientation="right" domain={[4.5, 7]} hide />
              <Tooltip
                contentStyle={{
                  background: "#120f1c",
                  border: "1px solid rgba(158, 255, 102, 0.18)",
                  borderRadius: "16px"
                }}
              />
              <Bar yAxisId="water" dataKey="waterMl" radius={[6, 6, 0, 0]}>
                {hydrationChartData.map((entry) => (
                  <Cell
                    key={entry.id}
                    fill={entry.projected ? "rgba(250, 204, 21, 0.808)" : "rgba(54, 132, 250, 0.616)"}
                  />
                ))}
              </Bar>
              <Line yAxisId="dryback" type="monotone" dataKey="drybackPercent" stroke="#9eff66" strokeWidth={2.5} dot={false} />
              <Line yAxisId="ph" type="monotone" dataKey="ph" stroke="#fe9a00" strokeWidth={2} dot={false} connectNulls />
              <Line yAxisId="ph" type="monotone" dataKey="runoffPh" stroke="#c160fa" strokeWidth={2} dot={false} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-sm text-amber-500/90">{projectedNextWatering ? `Next watering projected: ${nextWateringLabel}` : ""}</p>

        {/* Watering progress bar */}
        {projectedNextWatering && (
          <div className="mt-3 h-4 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-4 rounded-full bg-gradient-to-r from-amber-500/90 via-sky-300/70 to-sky-500/90 transition-all duration-700"
              style={{ width: `${wateringProgressPercent}%` }}
            />
          </div>
        )}

        {/* Interval controls */}
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onUpdateInterval?.(Math.max(1, wateringIntervalDays - 1))}
              className="rounded-full border border-white/10 bg-white/8 p-1.5 text-slate-200 hover:bg-white/12"
              title="Decrease interval"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="text-xs text-lime-100/80 font-semibold">{wateringIntervalDays}d</span>
            <button
              type="button"
              onClick={() => onUpdateInterval?.(wateringIntervalDays + 1)}
              className="rounded-full border border-white/10 bg-white/8 p-1.5 text-slate-200 hover:bg-white/12"
              title="Increase interval"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => onWaterNow?.()}
            className="rounded-full border border-lime-300/20 bg-lime-300/12 p-1.5 text-lime-100 hover:bg-lime-300/20"
            title="Water now / reset timer"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 rounded-2xl bg-black/20 overflow-x-auto max-h-[30vh]">
          <table className="w-full border-collapse text-[10px] sm:text-xs text-lime-100 min-w-[400px]">
            <thead className="bg-black/25 sticky top-0 z-10">
              <tr className="text-left font-mono uppercase tracking-[0.16em] text-lime-200">
                <th className="px-2 sm:px-3 py-1.5 sm:py-2">Time</th>
                <th className="px-2 sm:px-3 py-1.5 sm:py-2">ml</th>
                {/* <th className="px-2 sm:px-3 py-1.5 sm:py-2">L</th> */}
                <th className="px-2 sm:px-3 py-1.5 sm:py-2">pH in</th>
                <th className="px-2 sm:px-3 py-1.5 sm:py-2">EC in</th>
                <th className="px-2 sm:px-3 py-1.5 sm:py-2">pH Out</th>
                <th className="px-2 sm:px-3 py-1.5 sm:py-2">EC Out</th>
                <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-right">x</th>
              </tr>
            </thead>
            <tbody>
              {projectedNextWatering ? (
                <tr className="border-t border-lime-300/80 bg-amber-300/12">
                  <td className="px-2 sm:px-3 py-1.5 sm:py-2">{nextWateringLabel}</td>
                  <td className="px-2 sm:px-3 py-1.5 sm:py-2">{projectedNextWatering.amountMl}</td>
                  {/* <td className="px-2 sm:px-3 py-1.5 sm:py-2">{(projectedNextWatering.amountMl / 1000).toFixed(2)}</td> */}
                  <td className="px-2 sm:px-3 py-1.5 sm:py-2">5.8-6.0</td>
                  <td className="px-2 sm:px-3 py-1.5 sm:py-2"></td>
                  <td className="px-2 sm:px-3 py-1.5 sm:py-2"></td>
                  <td className="px-2 sm:px-3 py-1.5 sm:py-2"></td>
                  <td className="px-2 sm:px-3 py-1.5 sm:py-2"></td>
                </tr>
              ) : null}
              {newestFirstWatering.map((entry) => (
                <tr key={entry.id} className="border-t border-black/30">
                  <td className="px-2 sm:px-3 py-1.5 sm:py-2">
                    <input
                      type="datetime-local"
                      value={toDatetimeLocal(entry.timestamp)}
                      onChange={(event) =>
                        onWateringDataChange(
                          wateringData.map((row) =>
                            row.id === entry.id ? { ...row, timestamp: fromDatetimeLocal(event.target.value) } : row
                          )
                        )
                      }
                      className="w-full rounded-lg border border-lime-300/10 bg-black/30 px-2 sm:px-3 py-1 sm:py-2 text-[10px] sm:text-xs text-lime-100 outline-none"
                    />
                  </td>
                  <td className="px-2 sm:px-3 py-1.5 sm:py-2">
                    <input
                      type="number"
                      value={entry.amountMl}
                      onChange={(event) =>
                        onWateringDataChange(
                          wateringData.map((row) =>
                            row.id === entry.id ? { ...row, amountMl: Number(event.target.value) || 0 } : row
                          )
                        )
                      }
                      className="w-16 sm:w-20 rounded-lg border border-lime-300/10 bg-black/30 px-2 sm:px-3 py-1 sm:py-2 text-[10px] sm:text-xs text-lime-100 outline-none"
                    />
                  </td>
                  {/* <td className="px-2 sm:px-3 py-1.5 sm:py-2">{(entry.amountMl / 1000).toFixed(2)}</td> */}
                  <td className="px-2 sm:px-3 py-1.5 sm:py-2">
                    <input
                      type="number"
                      step="0.01"
                      value={entry.ph}
                      onChange={(event) =>
                        onWateringDataChange(
                          wateringData.map((row) => (row.id === entry.id ? { ...row, ph: Number(event.target.value) || 0 } : row))
                        )
                      }
                      className="w-14 sm:w-16 rounded-lg border border-lime-300/10 bg-black/30 px-2 sm:px-3 py-1 sm:py-2 text-[10px] sm:text-xs text-lime-100 outline-none"
                    />
                  </td>
                  <td className="px-2 sm:px-3 py-1.5 sm:py-2">
                    <input
                      type="number"
                      step="0.01"
                      value={entry.ec}
                      onChange={(event) =>
                        onWateringDataChange(
                          wateringData.map((row) => (row.id === entry.id ? { ...row, ec: Number(event.target.value) || 0 } : row))
                        )
                      }
                      className="w-14 sm:w-16 rounded-lg border border-lime-300/10 bg-black/30 px-2 sm:px-3 py-1 sm:py-2 text-[10px] sm:text-xs text-lime-100 outline-none"
                    />
                  </td>
                  <td className="px-2 sm:px-3 py-1.5 sm:py-2">
                    <input
                      type="number"
                      step="0.01"
                      value={entry.runoffPh ?? ""}
                      onChange={(event) =>
                        onWateringDataChange(
                          wateringData.map((row) =>
                            row.id === entry.id ? { ...row, runoffPh: Number(event.target.value) || undefined } : row
                          )
                        )
                      }
                      className="w-14 sm:w-16 rounded-lg border border-lime-300/10 bg-black/30 px-2 sm:px-3 py-1 sm:py-2 text-[10px] sm:text-xs text-lime-100 outline-none"
                    />
                  </td>
                  <td className="px-2 sm:px-3 py-1.5 sm:py-2">
                    <input
                      type="number"
                      step="0.01"
                      value={entry.runoffEc ?? ""}
                      onChange={(event) =>
                        onWateringDataChange(
                          wateringData.map((row) =>
                            row.id === entry.id ? { ...row, runoffEc: Number(event.target.value) || undefined } : row
                          )
                        )
                      }
                      className="w-14 sm:w-16 rounded-lg border border-lime-300/10 bg-black/30 px-2 sm:px-3 py-1 sm:py-2 text-[10px] sm:text-xs text-lime-100 outline-none"
                    />
                  </td>
                  <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-right">
                    <button
                      type="button"
                      onClick={() => deleteWateringEntry(entry.id)}
                      className="rounded-full border border-red-300/20 bg-red-400/10 p-0.5 sm:p-1 text-red-100"
                      title="Delete row"
                    >
                      <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function calculateVpd(tempC: number, humidity: number) {
  const saturationVaporPressure = 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3));
  const vaporPressure = saturationVaporPressure * (humidity / 100);
  return saturationVaporPressure - vaporPressure;
}

function getIdealVpd(stage: GrowStage) {
  const map: Record<GrowStage, { min: number; max: number }> = {
    Seedling: { min: 0.4, max: 0.8 },
    Veg: { min: 0.8, max: 1.2 },
    Bloom: { min: 1.2, max: 1.5 }
  };
  return map[stage];
}

function getVpdPillClass(stage: GrowStage, vpd: number) {
  const ideal = getIdealVpd(stage);
  const span = ideal.max - ideal.min;
  const caution = Math.max(0.1, span * 0.25);
  if (vpd < ideal.min - caution || vpd > ideal.max + caution) {
    return "bg-red-500/20 text-red-100 border border-red-500/30";
  }
  if (vpd < ideal.min || vpd > ideal.max) {
    return "bg-amber-500/20 text-amber-100 border border-amber-500/30";
  }
  return "bg-green-500/20 text-lime-100 border border-green-500/30";
}

function getVpdTooltip(stage: GrowStage, vpd: number) {
  const ideal = getIdealVpd(stage);
  const deltaLow = Number((vpd - ideal.min).toFixed(2));
  const deltaHigh = Number((vpd - ideal.max).toFixed(2));
  if (vpd < ideal.min) {
    return `Ideal ${ideal.min}-${ideal.max} kPa. You are ${Math.abs(deltaLow)} kPa below ideal.`;
  }
  if (vpd > ideal.max) {
    return `Ideal ${ideal.min}-${ideal.max} kPa. You are ${deltaHigh} kPa above ideal.`;
  }
  return `Ideal ${ideal.min}-${ideal.max} kPa. In range.`;
}

function buildDrybackSeries(watering: WateringEntry[], locale: Locale, intervalDays: number) {
  const sorted = [...watering]
    .filter((w) => w.timestamp && new Date(w.timestamp).getTime())
    .sort((a, b) => {
      const aTime = new Date(a.timestamp).getTime();
      const bTime = new Date(b.timestamp).getTime();
      return aTime - bTime;
    });
  if (!sorted.length) return [];

  const series: Array<{
    id: string;
    tick: string;
    waterMl: number;
    drybackPercent: number;
    ph: number | null;
    runoffPh: number | null;
    projected: boolean;
  }> = [];

  const targetFloor = 18;
  const stepsPerInterval = 7;

  for (let i = 0; i < sorted.length; i += 1) {
    const entry = sorted[i];
    const t0 = new Date(entry.timestamp).getTime();
    const t1 =
      i < sorted.length - 1
        ? new Date(sorted[i + 1].timestamp).getTime()
        : t0 + intervalDays * 24 * 60 * 60 * 1000;
    const span = Math.max(1, t1 - t0);

    series.push({
      id: `${entry.id}-water`,
      tick: formatShortDate(entry.timestamp, locale),
      waterMl: entry.amountMl,
      drybackPercent: 100,
      ph: entry.ph ?? null,
      runoffPh: entry.runoffPh ?? null,
      projected: false
    });

    for (let s = 1; s <= stepsPerInterval; s += 1) {
      const ratio = s / (stepsPerInterval + 1);
      const k = 3.2;
      const dry = targetFloor + (100 - targetFloor) * Math.exp(-k * ratio);
      const ts = new Date(t0 + span * ratio).toISOString();
      series.push({
        id: `${entry.id}-dry-${s}`,
        tick: formatShortDate(ts, locale),
        waterMl: 0,
        drybackPercent: Math.round(dry),
        ph: null,
        runoffPh: null,
        projected: true
      });
    }
  }

  return series;
}

function formatShortDate(iso: string, locale: Locale) {
  if (!iso) return "";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(date);
}

function formatDateTime(iso: string, locale: Locale) {
  if (!iso) return "";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function toDatetimeLocal(iso: string) {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
}

function fromDatetimeLocal(value: string) {
  if (!value) return new Date().toISOString();
  return new Date(value).toISOString();
}