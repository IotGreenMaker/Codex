"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Calendar, Layers, Leaf, Sprout, Wheat, Cannabis, X } from "lucide-react";
import type { GrowStage, PlantProfile, SpaceConfig } from "@/lib/types";
import { useNotification } from "@/contexts/notification-context";

type PlantDetailModalProps = {
  isOpen: boolean;
  plant: PlantProfile | null;
  spaces: SpaceConfig[];
  currentSpaceId: string | null;
  onClose: () => void;
  onPatch: (patch: Partial<PlantProfile>) => void;
  onMoveToSpace: (plantId: string, spaceId: string) => void;
};

const STAGES: GrowStage[] = ["Seedling", "Veg", "Bloom"];

function StageIcon({ stage, className }: { stage: GrowStage; className?: string }) {
  if (stage === "Seedling") return <Sprout className={className ?? "h-4 w-4 text-green-200"} />;
  if (stage === "Veg") return <Cannabis className={className ?? "h-4 w-4 text-green-500"} />;
  if (stage === "Bloom") return <Wheat className={className ?? "h-4 w-4 text-indigo-500"} />;
  return <Leaf className={className ?? "h-4 w-4 text-lime-300"} />;
}

function toDateInputValue(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function fromDateInputValue(value: string): string {
  if (!value) return new Date().toISOString();
  return new Date(`${value}T09:00:00.000Z`).toISOString();
}

export function PlantDetailModal({
  isOpen,
  plant,
  spaces,
  currentSpaceId,
  onClose,
  onPatch,
  onMoveToSpace
}: PlantDetailModalProps) {
  const { notify, ensurePermission } = useNotification();
  const [draftName, setDraftName] = useState("");
  const [draftStage, setDraftStage] = useState<GrowStage>("Veg");
  const [draftStartedAt, setDraftStartedAt] = useState("");
  const [targetSpaceId, setTargetSpaceId] = useState("");

  useEffect(() => {
    if (!plant) return;
    setDraftName(plant.strainName);
    setDraftStage(plant.stage);
    setDraftStartedAt(toDateInputValue(plant.startedAt));
    setTargetSpaceId(currentSpaceId ?? "");
  }, [plant, currentSpaceId, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen || !plant) return null;

  const handleSaveBasics = () => {
    const patch: Partial<PlantProfile> = {};
    const trimmedName = draftName.trim();
    if (trimmedName && trimmedName !== plant.strainName) patch.strainName = trimmedName;
    if (draftStage !== plant.stage) patch.stage = draftStage;
    const nextStart = draftStartedAt ? fromDateInputValue(draftStartedAt) : plant.startedAt;
    if (draftStartedAt && nextStart !== plant.startedAt) patch.startedAt = nextStart;
    if (Object.keys(patch).length > 0) onPatch(patch);
  };

  const handleMoveSpace = () => {
    if (!targetSpaceId || targetSpaceId === currentSpaceId) return;
    onMoveToSpace(plant.id, targetSpaceId);
    onClose();
  };

  const handleToggleNotification = async () => {
    const next = !plant.notificationEnabled;
    if (next) {
      const ok = await ensurePermission();
      if (!ok) {
        await notify({
          source: "plant-detail",
          variant: "error",
          title: "Permission Required",
          message: `Enable notifications in your browser settings for ${plant.strainName} reminders.`
        });
        return;
      }
    }
    onPatch({ notificationEnabled: next });
    await notify({
      source: "plant-detail",
      variant: next ? "toggle-on" : "toggle-off",
      title: next ? `${plant.strainName} Notifications On` : `${plant.strainName} Notifications Off`,
      message: next
        ? `Watering reminders for ${plant.strainName} are now active.`
        : `Watering reminders for ${plant.strainName} are now muted.`
    });
  };

  const dirty =
    (draftName.trim() && draftName.trim() !== plant.strainName) ||
    draftStage !== plant.stage ||
    (draftStartedAt && fromDateInputValue(draftStartedAt) !== plant.startedAt);

  const canMove = targetSpaceId && targetSpaceId !== currentSpaceId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div className="relative z-10 w-full max-w-md mx-4 glass-panel rounded-3xl p-6 border border-white/10 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-lime-300/30 bg-lime-300/15 text-lime-300">
              <StageIcon stage={plant.stage} className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-lime-200/70">Plant Details</p>
              <p className="truncate text-lg font-semibold text-lime-100">{plant.strainName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-white/10 transition"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-lime-100/70" />
          </button>
        </div>

        {/* Name */}
        <div className="mt-5">
          <label className="block font-mono text-[10px] uppercase tracking-[0.2em] text-lime-200">Name</label>
          <input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={handleSaveBasics}
            className="mt-1 w-full rounded-lg border border-lime-300/20 bg-black/30 px-3 py-2 text-sm text-lime-100 outline-none focus:border-lime-400"
            placeholder="Plant name"
          />
        </div>

        {/* Stage */}
        <div className="mt-3">
          <label className="block font-mono text-[10px] uppercase tracking-[0.2em] text-lime-200">Stage</label>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {STAGES.map((stage) => {
              const active = draftStage === stage;
              return (
                <button
                  key={stage}
                  type="button"
                  onClick={() => {
                    setDraftStage(stage);
                    if (stage !== plant.stage) {
                      onPatch({ stage });
                      if (stage === "Seedling") onPatch({ vegStartedAt: undefined, bloomStartedAt: undefined });
                      if (stage === "Veg" && !plant.vegStartedAt) onPatch({ vegStartedAt: new Date().toISOString() });
                      if (stage === "Bloom" && !plant.bloomStartedAt) onPatch({ bloomStartedAt: new Date().toISOString() });
                    }
                  }}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    active
                      ? "border-lime-300/40 bg-lime-300/15 text-lime-100"
                      : "border-white/10 bg-black/30 text-lime-100/70 hover:border-white/20"
                  }`}
                >
                  <StageIcon stage={stage} className="h-4 w-4" />
                  {stage}
                </button>
              );
            })}
          </div>
        </div>

        {/* Start date */}
        <div className="mt-3">
          <label className="block font-mono text-[10px] uppercase tracking-[0.2em] text-lime-200">Start date</label>
          <div className="mt-1 flex items-center gap-2 rounded-lg border border-lime-300/20 bg-black/30 px-3 py-2">
            <Calendar className="h-4 w-4 text-lime-200" />
            <input
              type="date"
              value={draftStartedAt}
              onChange={(e) => setDraftStartedAt(e.target.value)}
              onBlur={handleSaveBasics}
              className="w-full bg-transparent text-sm text-lime-100 outline-none"
            />
          </div>
        </div>

        {/* Space */}
        <div className="mt-3">
          <label className="block font-mono text-[10px] uppercase tracking-[0.2em] text-lime-200">Space</label>
          <div className="mt-1 flex items-center gap-2 rounded-lg border border-lime-300/20 bg-black/30 px-3 py-2">
            <Layers className="h-4 w-4 text-lime-200" />
            <select
              value={targetSpaceId}
              onChange={(e) => setTargetSpaceId(e.target.value)}
              className="w-full bg-transparent text-sm text-lime-100 outline-none"
            >
              {spaces.map((space) => (
                <option key={space.id} value={space.id} className="bg-slate-900 text-lime-100">
                  {space.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handleMoveSpace}
            disabled={!canMove}
            className={`mt-2 w-full rounded-xl border px-3 py-2 text-xs font-semibold transition ${
              canMove
                ? "border-lime-300/40 bg-lime-300/15 text-lime-100 hover:bg-lime-300/25"
                : "border-white/10 bg-black/30 text-lime-100/40 cursor-not-allowed"
            }`}
          >
            {canMove ? "Move to selected space" : "Already in this space"}
          </button>
        </div>

        {/* Notification bell */}
        <div className="mt-3 flex items-center justify-between rounded-xl border border-white/8 bg-black/25 px-3 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/10 text-amber-300">
              {plant.notificationEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-lime-100">Watering reminder</p>
              <p className="text-[11px] text-lime-100/60">
                {plant.notificationEnabled ? "Enabled for this plant" : "Disabled for this plant"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleToggleNotification}
            className={`rounded-full px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider transition ${
              plant.notificationEnabled
                ? "border border-amber-400/40 bg-amber-400/20 text-amber-200 hover:bg-amber-400/30"
                : "border border-white/10 bg-white/5 text-lime-100/70 hover:bg-white/10"
            }`}
          >
            {plant.notificationEnabled ? "Disable" : "Enable"}
          </button>
        </div>

        {dirty && (
          <p className="mt-3 text-[11px] text-lime-100/60">Changes are saved when you click outside the field.</p>
        )}
      </div>
    </div>
  );
}
