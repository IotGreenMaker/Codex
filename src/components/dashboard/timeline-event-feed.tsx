"use client";

import { Droplets, Sprout, Cannabis, Wheat, Bell, BellOff, Pencil, Send, X, Calendar } from "lucide-react";
import type { PlantProfile, GrowStage, NoteEntry } from "@/lib/types";
import { generateUUID } from "@/lib/uuid";
import type { CalendarConfig } from "@/components/dashboard/calendar-config-modal";
import { useState, useEffect, useCallback } from "react";
import { getSetting, setSetting } from "@/lib/indexeddb-storage";

type TimelineEvent = {
  id: string;
  type: "watering" | "stage-change" | "watering-reminder" | "note";
  stage?: GrowStage;
  timestamp: string;
  dateLabel: string;
  timeLabel: string;
  ph?: number;
  ec?: number;
  amountMl?: number;
  stageFrom?: GrowStage | null;
  stageTo: GrowStage;
  noteText?: string;
};

type TimelineEventFeedProps = {
  plant: PlantProfile;
  config?: CalendarConfig;
  isAddingNote?: boolean;
  onCancelNote?: () => void;
  onUpdate?: (plant: PlantProfile) => void;
  onDeleteNote?: (noteId: string) => void;
};

function getBorderClasses(type: TimelineEvent["type"], stage?: GrowStage): string {
  if (type === "watering-reminder") {
    return "border-l-[3px] border-amber-500/70";
  }
  if (type === "watering") {
    return "border-l-[3px] border-sky-500/70";
  }
  if (type === "note") {
    return "border-l-[3px] border-yellow-900/90";
  }
  switch (stage) {
    case "Seedling":
      return "border-l-[3px] border-sky-400/70";
    case "Veg":
      return "border-l-[3px] border-green-500/70";
    case "Bloom":
      return "border-l-[3px] border-indigo-500/70";
    default:
      return "border-l-[3px] border-white/30";
  }
}

function getEventIcon(type: TimelineEvent["type"], stage?: GrowStage) {
  if (type === "watering-reminder") {
    return null; // Rendered separately with click handler
  }
  if (type === "watering") {
    return <Droplets className="h-5 w-5 text-sky-400" />;
  }
  if (type === "note") {
    return <Pencil className="h-4.5 w-4.5 text-yellow-500/90" />;
  }
  switch (stage) {
    case "Seedling":
      return <Sprout className="h-5 w-5  text-green-200" />;
    case "Veg":
      return <Cannabis className="h-5 w-5 text-green-500" />;
    case "Bloom":
      return <Wheat className="h-5 w-5 text-indigo-400" />;
    default:
      return <Sprout className="h-5 w-5 text-lime-300" />;
  }
}

function getEventLabel(type: TimelineEvent["type"], stage?: GrowStage): string {
  if (type === "watering-reminder") {
    return "Next Watering";
  }
  if (type === "watering") {
    return "Watering";
  }
  if (type === "note") {
    return "Note";
  }
  return `${stage || ""} Started`;
}

function formatDate(dateIso: string): { dateLabel: string; timeLabel: string } {
  try {
    const date = new Date(dateIso);
    if (isNaN(date.getTime())) {
      return { dateLabel: "Invalid Date", timeLabel: "--:--" };
    }
    const dateLabel = new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(date);
    const timeLabel = new Intl.DateTimeFormat("en", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(date);
    return { dateLabel, timeLabel };
  } catch (error) {
    console.error("Error formatting date:", error);
    return { dateLabel: "Error", timeLabel: "--:--" };
  }
}

type WateringReminderProps = {
  nextWateringDate: Date | null;
  onToggleNotification: (enabled: boolean) => void;
  notificationsEnabled: boolean;
};

function WateringReminder({ nextWateringDate, onToggleNotification, notificationsEnabled }: WateringReminderProps) {
  const dateLabel = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(nextWateringDate!);
  const timeLabel = new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(nextWateringDate!);

  return (
    <div
      className="glass-panel rounded-xl p-3 relative border-l-[3px] border-amber-500/70 transition hover:bg-white/[0.08]"
    >
      {/* Bell icon on top-right with click handler */}
      <div className="absolute top-2 right-2 flex items-center gap-1.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleNotification(!notificationsEnabled);
          }}
          className="rounded-full border border-amber-500/50 bg-amber-500/20 p-2 transition hover:bg-amber-500/40"
          title={notificationsEnabled ? "Disable watering reminder" : "Enable watering reminder"}
        >
          {notificationsEnabled ? (
            <BellOff className="h-4 w-4 text-amber-400/80" />
          ) : (
            <Bell className="h-4 w-4 text-amber-400/50" />
          )}
        </button>
      </div>

      {/* Event label */}
      <p className="text-sm font-semibold text-lime-100 pr-8">
        Next Watering
      </p>

      {/* Date & time */}
      <p className="text-xs text-lime-100/60 mt-1">
        {dateLabel} · {timeLabel}
      </p>
    </div>
  );
}

export function TimelineEventFeed({ plant, config, isAddingNote, onCancelNote, onUpdate, onDeleteNote }: TimelineEventFeedProps) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteDate, setNoteDate] = useState(new Date().toISOString().split("T")[0]);
  const [isSaving, setIsSaving] = useState(false);
  // Default config: show everything
  const showWatering = config?.showWatering ?? true;
  const showSeedling = config?.showSeedling ?? true;
  const showVeg = config?.showVeg ?? true;
  const showBloom = config?.showBloom ?? true;
  const events: TimelineEvent[] = [];

  // Collect stage change events (respecting visibility config)
  if (plant.startedAt && showSeedling) {
    const { dateLabel, timeLabel } = formatDate(plant.startedAt);
    events.push({
      id: `stage-seedling-${plant.startedAt}`,
      type: "stage-change",
      stage: "Seedling",
      timestamp: plant.startedAt,
      dateLabel,
      timeLabel,
      stageFrom: null,
      stageTo: "Seedling"
    });
  }

  if (plant.vegStartedAt && showVeg) {
    const { dateLabel, timeLabel } = formatDate(plant.vegStartedAt);
    events.push({
      id: `stage-veg-${plant.vegStartedAt}`,
      type: "stage-change",
      stage: "Veg",
      timestamp: plant.vegStartedAt,
      dateLabel,
      timeLabel,
      stageFrom: "Seedling",
      stageTo: "Veg"
    });
  }

  if (plant.bloomStartedAt && showBloom) {
    const { dateLabel, timeLabel } = formatDate(plant.bloomStartedAt);
    events.push({
      id: `stage-bloom-${plant.bloomStartedAt}`,
      type: "stage-change",
      stage: "Bloom",
      timestamp: plant.bloomStartedAt,
      dateLabel,
      timeLabel,
      stageFrom: "Veg",
      stageTo: "Bloom"
    });
  }

  // Collect watering events (respecting visibility config)
  if (showWatering) {
    for (const w of plant.wateringData) {
      const { dateLabel, timeLabel } = formatDate(w.timestamp);
      events.push({
        id: `watering-${w.id}`,
        type: "watering",
        timestamp: w.timestamp,
        dateLabel,
        timeLabel,
        ph: w.ph,
        ec: w.ec,
        amountMl: w.amountMl,
        stageTo: plant.stage
      });
    }
  }

  // Collect note events
  if (plant.notes) {
    for (const note of plant.notes) {
      const { dateLabel, timeLabel } = formatDate(note.timestamp);
      events.push({
        id: `note-${note.id}`,
        type: "note",
        timestamp: note.timestamp,
        dateLabel,
        timeLabel,
        noteText: note.text,
        stageTo: plant.stage // Defaulting to current stage when note was recorded could be better, but we don't store that.
      });
    }
  }

  // Sort by timestamp descending (most recent first)
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Load notification preference
  useEffect(() => {
    getSetting("wateringNotification").then((val) => {
      setNotificationsEnabled(val === "true");
    });
  }, []);

  // Calculate next watering date
  const getNextWateringDate = useCallback(() => {
    if (plant.wateringData.length === 0) {
      return null;
    }
    const sorted = [...plant.wateringData].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    const latest = sorted[0];
    const nextDate = new Date(new Date(latest.timestamp).getTime() + plant.wateringIntervalDays * 24 * 60 * 60 * 1000);
    return nextDate;
  }, [plant.wateringData, plant.wateringIntervalDays]);

  const nextWateringDate = getNextWateringDate();

  const handleToggleNotification = useCallback(async (enabled: boolean) => {
    if (enabled) {
      // Request permission
      if (!("Notification" in window)) {
        alert("This browser does not support notifications.");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        alert("Notification permission denied.");
        return;
      }
    }
    setNotificationsEnabled(enabled);
    await setSetting("wateringNotification", String(enabled));
  }, []);

  const handleAddNote = useCallback(async () => {
    if (!noteText.trim() || !onUpdate) return;
    setIsSaving(true);
    try {
      // Use the selected date but keep the current time for chronological sorting
      const selectedDate = new Date(noteDate);
      const currentTime = new Date();
      selectedDate.setHours(currentTime.getHours(), currentTime.getMinutes(), currentTime.getSeconds());
      
      const newNote: NoteEntry = {
        id: generateUUID(),
        timestamp: selectedDate.toISOString(),
        text: noteText.trim()
      };
      
      const updatedPlant: PlantProfile = {
        ...plant,
        notes: [newNote, ...(plant.notes || [])]
      };
      
      onUpdate(updatedPlant);
      setNoteText("");
      if (onCancelNote) onCancelNote();
    } finally {
      setIsSaving(false);
    }
  }, [noteText, plant, onUpdate, onCancelNote]);

  if (events.length === 0 && !nextWateringDate) {
    return (
      <div className="glass-panel rounded-3xl p-4 flex items-center justify-center  min-h-[200px]">
        <p className="text-sm text-lime-100/60">No events yet</p>
      </div>
    );
  }

  // Schedule notification if enabled and we have a next watering date
  useEffect(() => {
    if (notificationsEnabled && nextWateringDate && "Notification" in window) {
      const now = new Date().getTime();
      const target = nextWateringDate.getTime();
      const delay = target - now;

      if (delay > 0 && delay < 2147483647) { // max setTimeout delay
        const timer = setTimeout(() => {
          if (Notification.permission === "granted") {
            new Notification("G-Buddy - Watering Reminder", {
              body: `Time to water ${plant.strainName}!`,
              icon: "/gbuddy-icon.svg",
              tag: "watering-reminder"
            });
          }
        }, delay);

        return () => clearTimeout(timer);
      }
    }
  }, [notificationsEnabled, nextWateringDate, plant.strainName]);

  return (
    <div className="flex flex-col gap-3 max-h-[50vh] sm:max-h-[800px] overflow-y-auto overflow-x-hidden pl-1 pr-2 p-4 pt-0">
      {/* Next Watering Reminder - Always first if exists */}
      {nextWateringDate && (
        <WateringReminder
          nextWateringDate={nextWateringDate}
          onToggleNotification={handleToggleNotification}
          notificationsEnabled={notificationsEnabled}
        />
      )}

      {/* Add Note Form */}
      {isAddingNote && (
        <div className="glass-panel rounded-xl p-3 border border-white/10 bg-white/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-lime-100 flex items-center gap-1.5">
              <Pencil className="h-3.5 w-3.5 text-yellow-500" /> New Note
            </span>
            <button 
              onClick={onCancelNote}
              className="p-1 hover:bg-white/10 rounded-full transition"
            >
              <X className="h-4 w-4 text-lime-100/40" />
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 bg-black/20 border border-white/5 rounded-lg px-2 py-1.5">
              <Calendar className="h-3.5 w-3.5 text-lime-400/60" />
              <input 
                type="date"
                value={noteDate}
                onChange={(e) => setNoteDate(e.target.value)}
                className="bg-transparent border-none text-xs text-lime-100 focus:outline-none w-full [color-scheme:dark]"
              />
            </div>
            
            <textarea
              autoFocus
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Record plant progress, observations..."
              className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-sm text-lime-100 placeholder:text-lime-100/30 focus:outline-none focus:border-lime-500/30 resize-none h-24"
            />
          </div>

          <div className="flex justify-end mt-2">
            <button
              onClick={handleAddNote}
              disabled={!noteText.trim() || isSaving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-lime-300/25 bg-lime-300/12 text-lime-200 hover:bg-lime-300/22 text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="h-3 w-3" />
              {isSaving ? "Saving..." : "Save Note"}
            </button>
          </div>
        </div>
      )}

      {events.map((event) => (
        <div
          key={event.id}
          className={`glass-panel rounded-xl p-3 relative group ${getBorderClasses(event.type, event.stage)} transition hover:bg-white/[0.08]`}
        >
          {/* Delete Button for Notes */}
          {event.type === "note" && onDeleteNote && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const noteId = event.id.replace("note-", "");
                onDeleteNote(noteId);
              }}
              className="absolute -top-1.5 -right-1.5 rounded-full bg-red-500/90 hover:bg-red-600 p-0.5 text-white opacity-0 group-hover:opacity-100 transition shadow-lg z-10"
              title="Delete note"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          )}

          {/* Icon on top-right */}
          <div className="absolute top-2 right-2 flex items-center gap-1.5">
            {getEventIcon(event.type, event.stage)}
          </div>

          {/* Event label */}
          <p className="text-sm font-semibold text-lime-100 pr-8">
            {getEventLabel(event.type, event.stage)}
          </p>

          {/* Date & time */}
          <p className="text-xs text-lime-100/60 mt-1">
            {event.dateLabel} · {event.timeLabel}
          </p>

          {/* Watering details */}
          {event.type === "watering" && (
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {event.ph !== undefined && (
                <span className="text-xs text-lime-100/70">
                  pH: <span className="font-medium text-lime-200">{event.ph}</span>
                </span>
              )}
              {event.ec !== undefined && (
                <span className="text-xs text-lime-100/70">
                  EC: <span className="font-medium text-lime-200">{event.ec}</span>
                </span>
              )}
              {event.amountMl !== undefined && (
                <span className="text-xs text-lime-100/70">
                  <span className="font-medium text-lime-200">{event.amountMl}</span> ml
                </span>
              )}
            </div>
          )}

          {/* Note details */}
          {event.type === "note" && (
            <p className="mt-2 text-sm text-lime-100/90 whitespace-pre-wrap leading-relaxed">
              {event.noteText}
            </p>
          )}

          {/* Stage change details */}
          {event.type === "stage-change" && event.stageFrom && (
            <p className="text-xs text-lime-100/60 mt-1">
              from {event.stageFrom}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}