"use client";

import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { ClimateEntry } from "@/lib/types";
import { calculateVpd } from "@/lib/grow-math";

type ClimateChartProps = {
  climateData: ClimateEntry[];
};

type FilterPeriod = "DAY" | "WEEK" | "MONTH" | "ALL";

export function ClimateChart({ climateData }: ClimateChartProps) {
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>("WEEK");

  const filteredData = useMemo(() => {
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

    return climateData
      .filter((entry) => new Date(entry.timestamp).getTime() >= cutoffTime)
      .map((entry) => ({
        timestamp: new Date(entry.timestamp).toLocaleDateString("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
        temp: entry.tempC,
        humidity: entry.humidity,
        vpd: Number(calculateVpd(entry.tempC, entry.humidity).toFixed(2))
      }));
  }, [climateData, filterPeriod]);

  if (filteredData.length === 0) {
    return (
      <div className="rounded-2xl border border-lime-300/14 bg-black/20 p-5">
        <p className="text-sm text-slate-400">No climate data available</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-lime-300/14 bg-black/20 p-5">
      {/* Header with filters */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-lime-300/70">Climate History</p>
          <p className="mt-1 text-[11px] text-lime-100/65">Temperature, Humidity & VPD Trends</p>
        </div>
        <div className="flex gap-1">
          {(["DAY", "WEEK", "MONTH", "ALL"] as const).map((period) => (
            <button
              key={period}
              onClick={() => setFilterPeriod(period)}
              className={`rounded px-3 py-1 text-xs font-semibold transition ${
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

      {/* Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={filteredData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(107, 114, 128, 0.1)" />
          <XAxis
            dataKey="timestamp"
            stroke="rgba(156, 163, 175, 0.5)"
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis
            yAxisId="left"
            stroke="rgba(156, 163, 175, 0.5)"
            tick={{ fontSize: 12 }}
            label={{ value: "Temp (°C) / Humidity (%)", angle: -90, position: "insideLeft", offset: 10 }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="rgba(156, 163, 175, 0.5)"
            tick={{ fontSize: 12 }}
            label={{ value: "VPD (kPa)", angle: 90, position: "insideRight", offset: 10 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(15, 23, 42, 0.8)",
              border: "1px solid rgba(197, 224, 180, 0.3)",
              borderRadius: "8px"
            }}
            formatter={(value) => Number(value).toFixed(2)}
          />
          <Legend wrapperStyle={{ color: "rgba(212, 212, 212, 0.7)" }} />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="temp"
            stroke="rgb(239, 68, 68)"
            dot={false}
            strokeWidth={2}
            name="Temperature (°C)"
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="humidity"
            stroke="rgb(59, 130, 246)"
            dot={false}
            strokeWidth={2}
            name="Humidity (%)"
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="vpd"
            stroke="rgb(34, 197, 94)"
            dot={false}
            strokeWidth={2}
            name="VPD (kPa)"
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
