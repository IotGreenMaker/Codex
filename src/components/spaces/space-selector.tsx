"use client";

import { Layers } from "lucide-react";
import type { SpaceConfig } from "@/lib/types";

export function SpaceSelector({
  spaces,
  activeSpaceId,
  onSelectSpace,
}: {
  spaces: SpaceConfig[];
  activeSpaceId: string;
  onSelectSpace: (spaceId: string) => void;
}) {

  if (spaces.length === 0) return null;

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-lime-300/15 bg-lime-300/8 px-3 py-1.5 sm:py-2">
      <Layers className="h-4 w-4 text-lime-300" />
      <span className="font-mono text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-lime-200">Space</span>
      <select
        value={activeSpaceId}
        onChange={(e) => onSelectSpace(e.target.value)}
        className="rounded-lg border border-lime-300/20 bg-black/40 px-2 py-1 text-xs sm:text-sm text-lime-100 outline-none cursor-pointer focus:border-lime-400"
      >
        {spaces.map((space) => (
          <option key={space.id} value={space.id} className="bg-slate-900 text-lime-100">
            {space.name}
          </option>
        ))}
      </select>
    </div>
  );
}
