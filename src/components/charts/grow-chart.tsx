"use client";

import { Plus, Trash2 } from "lucide-react";
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
import type { Locale } from "@/lib/i18n";

type GrowChartProps = {
  logs: GrowLogEntry[];
  wateringData: WateringEntry[];
  climateData: ClimateEntry[];
  stage: GrowStage;
  locale: Locale;
  wateringIntervalDays: number;
  onWateringDataChange: (next: WateringEntry[]) => void;
  onClimateDataChange: (next: ClimateEntry[]) => void;
  labels: {
    progression: string;
    climateDrift: string;
    tempHumidityVpd: string;
  };
};

export function GrowChart({
  logs: _logs,
  wateringData,
  climateData,
  stage,
  locale,
  wateringIntervalDays,
  onWateringDataChange,
  onClimateDataChange,
  labels
}: GrowChartProps) {
  const sortedClimate = [...climateData].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const climateChartData = sortedClimate.map((entry) => ({
    tick: formatShortDate(entry.timestamp, locale),
    temp: entry.tempC,
    humidity: entry.humidity,
    vpd: calculateVpd(entry.tempC, entry.humidity)
  }));

  const sortedWatering = [...wateringData].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const newestFirstWatering = [...sortedWatering].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const latestWatering = sortedWatering[sortedWatering.length - 1];
  const projectedNextWatering = latestWatering
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

  const idealVpd = getIdealVpd(stage);
  const nextWateringLabel = projectedNextWatering ? formatDateTime(projectedNextWatering.timestamp, locale) : "";

  return (
    <div className="grid gap-4">
      <div className="glass-panel rounded-3xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-lime-300/80">{labels.progression}</p>
            <h3 className="mt-2 text-lg font-semibold text-white">{labels.climateDrift}</h3>
          </div>
          <button
            type="button"
            onClick={() =>
              onClimateDataChange([
                ...climateData,
                {
                  id: `climate-${Date.now()}`,
                  timestamp: new Date().toISOString(),
                  tempC: climateData[0]?.tempC ?? 25,
                  humidity: climateData[0]?.humidity ?? 60
                }
              ])
            }
            className="rounded-full border border-lime-300/20 bg-lime-300/12 p-1.5 text-lime-100"
            title="Add climate datapoint"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-3 text-xs text-lime-100/70">{labels.tempHumidityVpd}</p>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={climateChartData}>
              <defs>
                <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#9eff66" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#9eff66" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="humidityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#b26bff" stopOpacity={0.34} />
                  <stop offset="100%" stopColor="#b26bff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="tick" stroke="#a8a2bb" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis yAxisId="climate" stroke="#a8a2bb" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis yAxisId="vpd" orientation="right" stroke="#a8a2bb" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <ReferenceArea yAxisId="vpd" y1={idealVpd.min} y2={idealVpd.max} fill="rgba(158,255,102,0.08)" />
              <Tooltip
                contentStyle={{
                  background: "#120f1c",
                  border: "1px solid rgba(158, 255, 102, 0.18)",
                  borderRadius: "16px"
                }}
              />
              <Area yAxisId="climate" type="monotone" dataKey="temp" stroke="#9eff66" fill="url(#tempGradient)" strokeWidth={2.5} />
              <Area yAxisId="climate" type="monotone" dataKey="humidity" stroke="#b26bff" fill="url(#humidityGradient)" strokeWidth={2} />
              <Line yAxisId="vpd" type="monotone" dataKey="vpd" stroke="#f472b6" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl bg-black/20">
          <table className="w-full border-collapse text-xs text-lime-100">
            <thead className="bg-black/25">
              <tr className="text-left font-mono uppercase tracking-[0.16em] text-lime-200">
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Temp C</th>
                <th className="px-3 py-2">Humidity %</th>
                <th className="px-3 py-2">VPD</th>
                <th className="px-3 py-2 text-right">Del</th>
              </tr>
            </thead>
            <tbody>
              {[...climateData]
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                .map((entry) => (
                  <tr key={entry.id} className="border-t border-black/30">
                    <td className="px-3 py-2">
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
                        className="w-full rounded-lg border border-lime-300/10 bg-black/30 px-2 py-1 text-xs text-lime-100 outline-none"
                      />
                    </td>
                    <td className="px-3 py-2">
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
                        className="w-20 rounded-lg border border-lime-300/10 bg-black/30 px-2 py-1 text-xs text-lime-100 outline-none"
                      />
                    </td>
                    <td className="px-3 py-2">
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
                        className="w-20 rounded-lg border border-lime-300/10 bg-black/30 px-2 py-1 text-xs text-lime-100 outline-none"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <span
                        title={getVpdTooltip(stage, calculateVpd(entry.tempC, entry.humidity))}
                        className={`rounded-full px-2 py-1 ${getVpdPillClass(stage, calculateVpd(entry.tempC, entry.humidity))}`}
                      >
                        {calculateVpd(entry.tempC, entry.humidity).toFixed(2)} kPa
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => onClimateDataChange(climateData.filter((row) => row.id !== entry.id))}
                        className="rounded-full border border-red-300/20 bg-red-400/10 p-1 text-red-100"
                        title="Delete row"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
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
                  id: `water-${Date.now()}`,
                  timestamp: new Date().toISOString(),
                  amountMl: latestWatering?.amountMl ?? 500,
                  ph: latestWatering?.ph ?? 6,
                  ec: latestWatering?.ec ?? 1
                }
              ])
            }
            className="rounded-full border border-lime-300/20 bg-lime-300/12 p-1.5 text-lime-100"
            title="Add watering datapoint"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={hydrationChartData}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="tick" stroke="#a8a2bb" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis yAxisId="water" stroke="#a8a2bb" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis yAxisId="dryback" orientation="right" domain={[0, 100]} stroke="#a8a2bb" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
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
                    fill={entry.projected ? "rgba(250, 204, 21, 0.68)" : "rgba(158, 255, 102, 0.35)"}
                  />
                ))}
              </Bar>
              <Line yAxisId="dryback" type="monotone" dataKey="drybackPercent" stroke="#9eff66" strokeWidth={2.5} dot={false} />
              <Line yAxisId="ph" type="monotone" dataKey="ph" stroke="#60a5fa" strokeWidth={2} dot={false} connectNulls />
              <Line yAxisId="ph" type="monotone" dataKey="runoffPh" stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-amber-200/90">{projectedNextWatering ? `Next watering projected: ${nextWateringLabel}` : ""}</p>

        <div className="mt-3 overflow-hidden rounded-2xl bg-black/20">
          <table className="w-full border-collapse text-xs text-lime-100">
            <thead className="bg-black/25">
              <tr className="text-left font-mono uppercase tracking-[0.16em] text-lime-200">
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">ml</th>
                <th className="px-3 py-2">L</th>
                <th className="px-3 py-2">In pH</th>
                <th className="px-3 py-2">In EC</th>
                <th className="px-3 py-2">Runoff pH</th>
                <th className="px-3 py-2">Runoff EC</th>
                <th className="px-3 py-2 text-right">Del</th>
              </tr>
            </thead>
            <tbody>
              {projectedNextWatering ? (
                <tr className="border-t border-amber-300/35 bg-amber-300/12">
                  <td className="px-3 py-2">{nextWateringLabel}</td>
                  <td className="px-3 py-2">{projectedNextWatering.amountMl}</td>
                  <td className="px-3 py-2">{(projectedNextWatering.amountMl / 1000).toFixed(2)}</td>
                  <td className="px-3 py-2">-</td>
                  <td className="px-3 py-2">-</td>
                  <td className="px-3 py-2">-</td>
                  <td className="px-3 py-2">-</td>
                  <td className="px-3 py-2">-</td>
                </tr>
              ) : null}
              {newestFirstWatering.map((entry) => (
                <tr key={entry.id} className="border-t border-black/30">
                  <td className="px-3 py-2">
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
                      className="w-full rounded-lg border border-lime-300/10 bg-black/30 px-2 py-1 text-xs text-lime-100 outline-none"
                    />
                  </td>
                  <td className="px-3 py-2">
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
                      className="w-20 rounded-lg border border-lime-300/10 bg-black/30 px-2 py-1 text-xs text-lime-100 outline-none"
                    />
                  </td>
                  <td className="px-3 py-2">{(entry.amountMl / 1000).toFixed(2)}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.01"
                      value={entry.ph}
                      onChange={(event) =>
                        onWateringDataChange(
                          wateringData.map((row) => (row.id === entry.id ? { ...row, ph: Number(event.target.value) || 0 } : row))
                        )
                      }
                      className="w-16 rounded-lg border border-lime-300/10 bg-black/30 px-2 py-1 text-xs text-lime-100 outline-none"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.01"
                      value={entry.ec}
                      onChange={(event) =>
                        onWateringDataChange(
                          wateringData.map((row) => (row.id === entry.id ? { ...row, ec: Number(event.target.value) || 0 } : row))
                        )
                      }
                      className="w-16 rounded-lg border border-lime-300/10 bg-black/30 px-2 py-1 text-xs text-lime-100 outline-none"
                    />
                  </td>
                  <td className="px-3 py-2">
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
                      className="w-16 rounded-lg border border-lime-300/10 bg-black/30 px-2 py-1 text-xs text-lime-100 outline-none"
                    />
                  </td>
                  <td className="px-3 py-2">
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
                      className="w-16 rounded-lg border border-lime-300/10 bg-black/30 px-2 py-1 text-xs text-lime-100 outline-none"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onWateringDataChange(wateringData.filter((row) => row.id !== entry.id))}
                      className="rounded-full border border-red-300/20 bg-red-400/10 p-1 text-red-100"
                      title="Delete row"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
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
    Bloom: { min: 1.2, max: 1.5 },
    Dry: { min: 0.9, max: 1.2 },
    Cure: { min: 0.6, max: 1.0 }
  };
  return map[stage];
}

function getVpdPillClass(stage: GrowStage, vpd: number) {
  const ideal = getIdealVpd(stage);
  const span = ideal.max - ideal.min;
  const caution = Math.max(0.1, span * 0.25);
  if (vpd < ideal.min - caution || vpd > ideal.max + caution) {
    return "bg-red-400/12 text-red-100 border border-red-400/18";
  }
  if (vpd < ideal.min || vpd > ideal.max) {
    return "bg-amber-300/14 text-amber-100 border border-amber-300/18";
  }
  return "bg-lime-300/14 text-lime-100 border border-lime-300/18";
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
  const sorted = [...watering].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
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
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(new Date(iso));
}

function formatDateTime(iso: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(iso));
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
