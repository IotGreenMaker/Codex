"use client";

import { useMemo, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Settings, Sprout, Cannabis, Wheat, Droplets, Bell, Pencil, Plus } from "lucide-react";
import type { PlantProfile } from "@/lib/types";
import { STAGE_TARGETS } from "@/lib/config";
import { TimelineEventFeed } from "@/components/dashboard/timeline-event-feed";
import { CalendarConfigModal, CalendarConfig, loadCalendarConfig } from "@/components/dashboard/calendar-config-modal";

type CalendarDay = {
  date: Date;
  isCurrentMonth: boolean;
  hasSeedling: boolean;
  hasVeg: boolean;
  hasBloom: boolean;
  hasNote: boolean;
  wateringCount: number;
  isSeedlingDay: boolean;
  isVegDay: boolean;
  isBloomDay: boolean;
  isNextWateringDay: boolean;
};

export function PlantTimelineCalendar({ 
  plant, 
  onUpdate, 
  onDeleteNote,
  calendarConfig
}: { 
  plant: PlantProfile, 
  onUpdate?: (plant: PlantProfile) => void,
  onDeleteNote?: (noteId: string) => void,
  calendarConfig?: CalendarConfig
}) {
  const today = new Date();
  const [displayMonth, setDisplayMonth] = useState(today.getMonth());
  const [displayYear, setDisplayYear] = useState(today.getFullYear());
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [config, setConfig] = useState<CalendarConfig>({
    seedlingDuration: STAGE_TARGETS.seedling,
    vegDuration: STAGE_TARGETS.veg,
    bloomDuration: STAGE_TARGETS.bloom,
    showWatering: true,
    showSeedling: true,
    showVeg: true,
    showBloom: true,
    nutrientDelta: 5,
    hannaScale: 700,
    measurementUnit: "EC"
  });

  // Load config on mount
  useEffect(() => {
    loadCalendarConfig().then(setConfig);
  }, []);

  // Use config values for stage durations
  const seedlingDuration = config.seedlingDuration;
  const vegDuration = config.vegDuration;
  const bloomDuration = config.bloomDuration;

  const { days, monthName, nextWateringDate } = useMemo(() => {
    const firstDay = new Date(displayYear, displayMonth, 1);
    const lastDay = new Date(displayYear, displayMonth + 1, 0);
    const prevLastDay = new Date(displayYear, displayMonth, 0);

    // Calculate next watering date
    let nextWateringDate: Date | null = null;
    if (plant.wateringData.length > 0) {
      const sorted = [...plant.wateringData].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      const latest = sorted[0];
      nextWateringDate = new Date(new Date(latest.timestamp).getTime() + plant.wateringIntervalDays * 24 * 60 * 60 * 1000);
    }

    // Calculate stage date ranges based on actual timestamps only
    const startedAt = new Date(plant.startedAt);
    const vegStartedAt = plant.vegStartedAt ? new Date(plant.vegStartedAt) : null;
    const bloomStartedAt = plant.bloomStartedAt ? new Date(plant.bloomStartedAt) : null;

    // Stage start dates from actual timestamps
    const vegStartDate = vegStartedAt ? new Date(vegStartedAt) : null;
    const bloomStartDate = bloomStartedAt ? new Date(bloomStartedAt) : null;
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    // Calculate stage end dates based on configured durations
    const seedlingEndFromDate = new Date(startedAt);
    seedlingEndFromDate.setDate(seedlingEndFromDate.getDate() + seedlingDuration);
    const seedlingEndDate = vegStartDate && vegStartDate < seedlingEndFromDate ? vegStartDate : seedlingEndFromDate;

    let vegEndDate: Date | null = null;
    if (vegStartDate) {
      const vegEndFromDate = new Date(vegStartDate);
      vegEndFromDate.setDate(vegEndFromDate.getDate() + vegDuration);
      vegEndDate = bloomStartDate && bloomStartDate < vegEndFromDate ? bloomStartDate : vegEndFromDate;
    }

    let bloomEndDate: Date | null = null;
    if (bloomStartDate) {
      bloomEndDate = new Date(bloomStartDate);
      bloomEndDate.setDate(bloomEndDate.getDate() + bloomDuration);
    }

    const daysArray: CalendarDay[] = [];

    // Previous month days
    const startDate = firstDay.getDay();
    for (let i = startDate - 1; i >= 0; i--) {
      const date = new Date(prevLastDay);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      daysArray.push({
        date,
        isCurrentMonth: false,
        hasSeedling: false,
        hasVeg: false,
        hasBloom: false,
        hasNote: false,
        wateringCount: 0,
        isSeedlingDay: false,
        isVegDay: false,
        isBloomDay: false,
        isNextWateringDay: false
      });
    }

    // Current month days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(displayYear, displayMonth, i);
      const dateStr = date.toDateString();
      const dateTime = date.getTime();

      const hasSeedling = startedAt.toDateString() === dateStr;
      const hasVeg = vegStartDate && vegStartDate.toDateString() === dateStr;
      const hasBloom = bloomStartDate && bloomStartDate.toDateString() === dateStr;
      const hasNote = (plant.notes || []).some((n) => {
        if (!n.timestamp) return false;
        const d = new Date(n.timestamp);
        return !isNaN(d.getTime()) && d.toDateString() === dateStr;
      });

      const isSeedlingDay = dateTime >= startedAt.getTime() && dateTime < seedlingEndDate.getTime();
      const isVegDay = vegStartDate !== null && vegEndDate !== null && dateTime >= vegStartDate.getTime() && dateTime < vegEndDate.getTime();
      const isBloomDay = bloomStartDate !== null && bloomEndDate !== null && dateTime >= bloomStartDate.getTime() && dateTime < bloomEndDate.getTime();

      const wateringCount = plant.wateringData.filter((w) => {
        if (!w.timestamp) return false;
        const d = new Date(w.timestamp);
        return !isNaN(d.getTime()) && d.toDateString() === dateStr;
      }).length;

      const isNextWateringDay = nextWateringDate !== null && nextWateringDate.toDateString() === dateStr;

      daysArray.push({
        date,
        isCurrentMonth: true,
        hasSeedling: !!hasSeedling,
        hasVeg: !!hasVeg,
        hasBloom: !!hasBloom,
        hasNote: !!hasNote,
        wateringCount,
        isSeedlingDay,
        isVegDay: !!isVegDay,
        isBloomDay: !!isBloomDay,
        isNextWateringDay
      });
    }

    // Next month days
    const remainingDays = 42 - daysArray.length;
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(displayYear, displayMonth + 1, i);
      daysArray.push({
        date,
        isCurrentMonth: false,
        hasSeedling: false,
        hasVeg: false,
        hasBloom: false,
        hasNote: false,
        wateringCount: 0,
        isSeedlingDay: false,
        isVegDay: false,
        isBloomDay: false,
        isNextWateringDay: false
      });
    }

    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December"
    ];

    return {
      days: daysArray,
      monthName: `${monthNames[displayMonth]} ${displayYear}`,
      nextWateringDate
    };
  }, [displayMonth, displayYear, plant, seedlingDuration, vegDuration, bloomDuration]);

  const handlePrevMonth = () => {
    if (displayMonth === 0) {
      setDisplayYear(displayYear - 1);
      setDisplayMonth(11);
    } else {
      setDisplayMonth(displayMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (displayMonth === 11) {
      setDisplayYear(displayYear + 1);
      setDisplayMonth(0);
    } else {
      setDisplayMonth(displayMonth + 1);
    }
  };

  const handleToday = () => {
    setDisplayMonth(today.getMonth());
    setDisplayYear(today.getFullYear());
  };

  return (
    <>
      <div className="glass-panel mt-5 rounded-3xl p-4 sm:w-full m-auto">
        {/* Calendar + Feed layout */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          {/* Calendar section - 60% width on desktop */}
          <div className="xl:col-span-7 min-w-0">
            {/* Header with nav and settings */}
            <div className="flex items-center justify-between gap-4 mb-4">
              <button
                onClick={handlePrevMonth}
                className="p-2 hover:bg-white/10 rounded-lg transition"
              >
                <ChevronLeft className="h-5 w-5 text-lime-300" />
              </button>

              <h2 className="text-center text-lg font-bold text-lime-100 min-w-48">
                {monthName}
              </h2>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleNextMonth}
                  className="p-2 hover:bg-white/10 rounded-lg transition"
                >
                  <ChevronRight className="h-5 w-5 text-lime-300" />
                </button>
              </div>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div
                  key={day}
                  className="text-center text-xs font-semibold text-lime-300/80 py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days - horizontal scroll on mobile */}
            <div className="overflow-x-auto -mx-1 sm:mx-0">
              <div className=" min-w-[280px] sm:min-w-0">
                <div className="grid grid-cols-7 gap-1 min-w-[280px] sm:min-w-0">
                  {days.map((day, idx) => {
                    const isToday = day.date.toDateString() === today.toDateString();

                    let stageBorderClass = "border border-white/10";
                    if (day.isCurrentMonth && !isToday) {
                      if (day.isBloomDay) {
                        stageBorderClass = "border-2 border-indigo-500/80";
                      } else if (day.isVegDay) {
                        stageBorderClass = "border-2 border-green-500/80";
                      } else if (day.isSeedlingDay) {
                        stageBorderClass = "border-2 border-green-200/80";
                      }
                    }

                    return (
                      <div
                        key={idx}
                        className={`aspect-square p-1 flex flex-col items-start justify-between text-sm transition min-w-[36px] sm:min-w-0 ${
                          isToday
                            ? "bg-lime-400/30 border-2 border-lime-300 font-bold text-lime-100"
                            : day.isCurrentMonth
                            ? `bg-white/5 ${stageBorderClass} text-lime-100`
                            : "bg-black/20 border border-white/5 text-lime-100/40"
                        }`}
                      >
                        <span className={isToday ? "font-bold" : ""}>
                          {day.date.getDate()}
                        </span>

                        {/* Event indicators */}
                        <div className="flex gap-0.5 flex-wrap justify-start w-full">
                          {day.isNextWateringDay && (
                            <span className="text-[10px] bg-amber-500/60 px-1 py-0.5 rounded text-white font-semibold">
                              <Bell className="h-3 w-3" />
                            </span>
                          )}
                          {day.hasSeedling && (
                            <span className="text-[10px] bg-green-200/60 px-1 py-0.5 rounded text-white font-semibold">
                              <Sprout className="h-3 w-3" />
                            </span>
                          )}
                          {day.hasVeg && (
                            <span className="text-[10px] bg-green-500/60 px-1 py-0.5 rounded text-white font-semibold">
                              <Cannabis className="h-3 w-3" />
                            </span>
                          )}
                          {day.hasBloom && (
                            <span className="text-[10px] bg-indigo-500/60 px-1 py-0.5 rounded text-white font-semibold">
                              <Wheat className="h-3 w-3" />
                            </span>
                          )}
                          {day.wateringCount > 0 && (
                            <span className="text-[10px] bg-blue-500/60 px-1 py-0.5 rounded text-white font-semibold">
                              <Droplets className="h-3 w-3" />
                            </span>
                          )}
                          {day.hasNote && (
                            <span className="text-[10px] bg-yellow-900/80 px-1 py-0.5 rounded text-white font-semibold">
                              <Pencil className="h-2.5 w-2.5" />
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Today button and legend */}
            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={handleToday}
                className="px-3 py-1 text-xs font-semibold bg-lime-300/20 border border-lime-300/40 rounded-lg hover:bg-lime-300/30 transition text-lime-200"
              >
                Today
              </button>

              <div className="flex gap-3 text-[10px] flex-wrap">
                <div className="flex items-center gap-1">
                  <Sprout className="h-3.5 w-3.5 text-sky-500" />
                  <span className="text-lime-100/70">Seedling</span>
                </div>
                <div className="flex items-center gap-1">
                  <Cannabis className="h-3.5 w-3.5 text-green-500" />
                  <span className="text-lime-100/70">Veg</span>
                </div>
                <div className="flex items-center gap-1">
                  <Wheat className="h-3.5 w-3.5 text-indigo-500" />
                  <span className="text-lime-100/70">Bloom</span>
                </div>
                <div className="flex items-center gap-1">
                  <Droplets className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-lime-100/70">Watering</span>
                </div>
                <div className="flex items-center gap-1">
                  <Bell className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-lime-100/70">Next Watering</span>
                </div>
                <div className="flex items-center gap-1">
                  <Pencil className="h-3.5 w-3.5 text-yellow-600" />
                  <span className="text-lime-100/70">Note</span>
                </div>
              </div>
            </div>
          </div>

          {/* Feed section - 40% width on desktop, 100% stacked on mobile */}
          <div className="xl:col-span-5 flex flex-col">
            <div className="flex items-center justify-center gap-2 mb-5 mt-3 relative">
              <h3 className="text-sm font-bold text-lime-100 uppercase tracking-wider">Activity Feed</h3>
              <button
                onClick={() => setIsAddingNote(!isAddingNote)}
                className="p-2 ml-auto rounded-full border border-lime-300/25 bg-lime-300/12 text-lime-200 hover:bg-lime-300/22 transition flex items-center justify-center min-h-[40px] min-w-[40px]"
                title={isAddingNote ? "Cancel" : "Add manual note"}
              >
                {isAddingNote ? (
                  <Pencil className="h-4 w-4 text-yellow-500" />
                ) : (
                  <Plus className="h-4 w-4 text-lime-300" />
                )}
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <TimelineEventFeed 
                plant={plant} 
                config={config} 
                isAddingNote={isAddingNote} 
                onCancelNote={() => setIsAddingNote(false)}
                onUpdate={onUpdate}
                onDeleteNote={onDeleteNote}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Config Modal */}
      <CalendarConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        onSave={(newConfig) => setConfig(newConfig)}
      />
    </>
  );
}