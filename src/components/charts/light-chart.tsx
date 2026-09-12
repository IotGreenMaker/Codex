"use client";

import { useState, useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { LightSnapshotEntry } from "@/lib/types";
import { generateUUID } from "@/lib/uuid";
import type { Locale } from "@/lib/i18n";

type FilterPeriod = "DAY" | "WEEK" | "MONTH" | "ALL";

type LightChartProps = {
  lightHistory: LightSnapshotEntry[];
  electricityPricePerKwh: number;
  onLightHistoryChange: (next: LightSnapshotEntry[]) => void;
  locale: Locale;
};

export function LightChart({
  lightHistory,
  electricityPricePerKwh,
  onLightHistoryChange,
  locale
}: LightChartProps) {
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>("ALL");

  const filteredHistory = useMemo(() => {
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

    return lightHistory
      .filter((entry) => {
        if (!entry.timestamp) return false;
        const ts = new Date(entry.timestamp).getTime();
        return !isNaN(ts) && ts >= cutoffTime;
      })
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [lightHistory, filterPeriod]);

  const chartData = filteredHistory.map((entry) => ({
    tick: formatShortDate(entry.timestamp, locale),
    dli: entry.dli,
    watts: entry.actualWatts,
    cost: electricityPricePerKwh > 0
      ? (entry.actualWatts * entry.dli / 1000 * electricityPricePerKwh)
      : 0
  }));

  const deleteEntry = (id: string) => {
    onLightHistoryChange(lightHistory.filter((e) => e.id !== id));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-lime-300/80">Light History</p>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData}>
            <defs>
              <linearGradient id="dliGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#9eff66" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#9eff66" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="wattGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#b48cff" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#b48cff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="tick" stroke="#a8a2bb" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
            <YAxis yAxisId="dli" stroke="#a8a2bb" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
            <YAxis yAxisId="watts" orientation="right" stroke="#a8a2bb" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
            <Tooltip
              contentStyle={{
                background: "#120f1c",
                border: "1px solid rgba(158, 255, 102, 0.18)",
                borderRadius: "16px"
              }}
              formatter={(value: number, name: string) => {
                if (name === "dli") return [`${value.toFixed(2)} mol/m²/d`, "DLI"];
                if (name === "watts") return [`${value} W`, "Watts"];
                return [value, name];
              }}
            />
            <Area yAxisId="dli" type="monotone" dataKey="dli" stroke="#9eff66" fill="url(#dliGradient)" strokeWidth={2} />
            <Line yAxisId="watts" type="monotone" dataKey="watts" stroke="#b48cff" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="text-xs text-lime-100/50">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-lime-400" />
          DLI (mol/m²/d)
        </span>
        <span className="ml-3 inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-purple-400" />
          Watts
        </span>
        {electricityPricePerKwh > 0 && (
          <span className="ml-3 text-lime-100/30">Cost: {chartData.reduce((sum, d) => sum + d.cost, 0).toFixed(4)}/mo</span>
        )}
      </div>

      <div className="rounded-xl bg-black/20 overflow-x-auto max-h-[25vh]">
        <table className="w-full border-collapse text-[10px] sm:text-xs text-lime-100 min-w-[320px]">
          <thead className="bg-black/25 sticky top-0 z-10">
            <tr className="text-left font-mono uppercase tracking-[0.16em] text-lime-200">
              <th className="px-3 py-2.5">Time</th>
              <th className="px-3 py-2.5">PPFD</th>
              <th className="px-3 py-2.5">DLI</th>
              <th className="px-3 py-2.5">Watts</th>
              <th className="px-3 py-2.5">Dimmer</th>
              <th className="px-3 py-2.5">State</th>
              <th className="px-3 py-2.5 text-right">x</th>
            </tr>
          </thead>
          <tbody>
            {[...filteredHistory]
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
              .map((entry) => (
                <tr key={entry.id} className="border-t border-black/30">
                  <td className="px-3 py-2">{formatShortDate(entry.timestamp, locale)}</td>
                  <td className="px-3 py-2">{entry.ppfd}</td>
                  <td className="px-3 py-2">{entry.dli.toFixed(2)}</td>
                  <td className="px-3 py-2">{entry.actualWatts}</td>
                  <td className="px-3 py-2">{entry.dimmerPercent}%</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                      entry.isOn ? "bg-green-500/20 text-green-300" : "bg-slate-500/20 text-slate-400"
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${entry.isOn ? "bg-green-400" : "bg-slate-400"}`} />
                      {entry.isOn ? "ON" : "OFF"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => deleteEntry(entry.id)}
                      className="rounded-full border border-red-300/20 bg-red-400/10 p-1 text-red-100 hover:bg-red-400/20 transition"
                      title="Delete entry"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
            {filteredHistory.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-lime-100/40 italic">
                  No light history entries yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatShortDate(iso: string, locale: Locale) {
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
