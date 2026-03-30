"use client";

import { calculateVpd } from "@/lib/grow-math";
import { getVPDStatus } from "@/lib/vpd-utils";
import type { ClimateEntry, GrowStage } from "@/lib/types";

type ClimateTableProps = {
  climateData: ClimateEntry[];
  stage: GrowStage;
};

export function ClimateTable({ climateData, stage }: ClimateTableProps) {
  // Get last 10 entries, sorted by most recent first
  const recentData = [...climateData]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);

  if (recentData.length === 0) {
    return (
      <div className="rounded-2xl border border-lime-300/14 bg-black/20 p-5">
        <p className="text-sm text-slate-400">No climate data available</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-lime-300/14 bg-black/20 p-5 overflow-auto max-height-[35vh]">
      <p className="mb-4 font-mono text-xs uppercase tracking-[0.28em] text-lime-300/70">Recent Climate Readings</p>
      
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-lime-300/20">
            <th className="table-header px-3 py-2 text-left text-xs font-semibold text-lime-300">Timestamp</th>
            <th className="table-header px-3 py-2 text-left text-xs font-semibold text-lime-300">Temperature</th>
            <th className="table-header px-3 py-2 text-left text-xs font-semibold text-lime-300">Humidity</th>
            <th className="table-header px-3 py-2 text-left text-xs font-semibold text-lime-300">VPD</th>
          </tr>
        </thead>
        <tbody>
          {recentData.map((entry, index) => {
            const vpd = calculateVpd(entry.tempC, entry.humidity);
            const vpdStatus = getVPDStatus(vpd, stage);
            const timestamp = new Date(entry.timestamp).toLocaleString();

            return (
              <tr key={index} className="border-b border-lime-300/10 hover:bg-lime-300/5 transition">
                <td className="px-3 py-2 text-slate-300">{timestamp}</td>
                <td className="px-3 py-2">
                  <span className="font-mono text-lime-200">{entry.tempC}°C</span>
                </td>
                <td className="px-3 py-2">
                  <span className="font-mono text-blue-200">{entry.humidity}%</span>
                </td>
                <td className="px-3 py-2">
                  <div
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-1 font-mono font-semibold ${vpdStatus.bgColor} ${vpdStatus.color} border ${
                      vpdStatus.status === "optimal"
                        ? "border-green-500/100"
                        : vpdStatus.status === "low"
                          ? "border-sky-300/80"
                          : "border-orange-300/80"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        vpdStatus.status === "optimal"
                          ? "bg-green-500/30"
                          : vpdStatus.status === "low"
                            ? "bg-blue-300"
                            : "bg-red-300"
                      }`}
                    />
                    {vpd.toFixed(2)} kPa
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
