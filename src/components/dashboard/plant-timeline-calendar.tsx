"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PlantProfile } from "@/lib/types";

type CalendarDay = {
  date: Date;
  isCurrentMonth: boolean;
  hasSeedling: boolean;
  hasVeg: boolean;
  hasBloom: boolean;
  wateringCount: number;
};

export function PlantTimelineCalendar({ plant }: { plant: PlantProfile }) {
  const today = new Date();
  const [displayMonth, setDisplayMonth] = useState(today.getMonth());
  const [displayYear, setDisplayYear] = useState(today.getFullYear());

  const { days, monthName } = useMemo(() => {
    const firstDay = new Date(displayYear, displayMonth, 1);
    const lastDay = new Date(displayYear, displayMonth + 1, 0);
    const prevLastDay = new Date(displayYear, displayMonth, 0);

    // Calculate stage start dates based on durations (not elapsed time)
    const seedlingStartDate = new Date(plant.startedAt);
    const vegStartDate = new Date(seedlingStartDate);
    vegStartDate.setDate(vegStartDate.getDate() + plant.stageDays.seedling);
    const bloomStartDate = new Date(vegStartDate);
    bloomStartDate.setDate(bloomStartDate.getDate() + plant.stageDays.veg);

    const daysArray: CalendarDay[] = [];

    // Previous month days
    const startDate = firstDay.getDay();
    for (let i = startDate - 1; i >= 0; i--) {
      const date = new Date(prevLastDay.getTime() - i * 24 * 60 * 60 * 1000);
      daysArray.push({
        date,
        isCurrentMonth: false,
        hasSeedling: false,
        hasVeg: false,
        hasBloom: false,
        wateringCount: 0
      });
    }

    // Current month days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(displayYear, displayMonth, i);
      const dateStr = date.toDateString();

      // Check for stage starts based on calculated dates
      const hasSeedling = seedlingStartDate.toDateString() === dateStr;
      const hasVeg = plant.stageDays.veg > 0 && vegStartDate.toDateString() === dateStr;
      const hasBloom = plant.stageDays.bloom > 0 && bloomStartDate.toDateString() === dateStr;

      // Count waterings
      const wateringCount = plant.wateringData.filter(
        (w) => new Date(w.timestamp).toDateString() === dateStr
      ).length;

      daysArray.push({
        date,
        isCurrentMonth: true,
        hasSeedling,
        hasVeg,
        hasBloom,
        wateringCount
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
        wateringCount: 0
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
      monthName: `${monthNames[displayMonth]} ${displayYear}`
    };
  }, [displayMonth, displayYear, plant]);

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
    <div className="glass-panel rounded-3xl p-4 w-[50%]">
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

        <button
          onClick={handleNextMonth}
          className="p-2 hover:bg-white/10 rounded-lg transition"
        >
          <ChevronRight className="h-5 w-5 text-lime-300" />
        </button>
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

      {/* Calendar days */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, idx) => {
          const isToday = day.date.toDateString() === today.toDateString();
          const hasEvents =
            day.hasSeedling || day.hasVeg || day.hasBloom || day.wateringCount > 0;

          return (
            <div
              key={idx}
              className={`aspect-square  p-1 flex flex-col items-start justify-between text-sm transition ${
                isToday
                  ? "bg-lime-400/30 border-2 border-lime-300 font-bold text-lime-100"
                  : day.isCurrentMonth
                  ? "bg-white/5 border border-white/10 text-lime-100"
                  : "bg-black/20 border border-white/5 text-lime-100/40"
              }`}
            >
              <span className={isToday ? "font-bold" : ""}>
                {day.date.getDate()}
              </span>

              {/* Event indicators */}
              <div className="flex gap-0.5 flex-wrap justify-start w-full">
                {day.hasSeedling && (
                  <span className="text-[10px] bg-green-500/60 px-1 py-0.5 rounded text-white font-semibold">
                    🌱
                  </span>
                )}
                {day.hasVeg && (
                  <span className="text-[10px] bg-green-400/60 px-1 py-0.5 rounded text-white font-semibold">
                    🌿
                  </span>
                )}
                {day.hasBloom && (
                  <span className="text-[10px] bg-indigo-500/60 px-1 py-0.5 rounded text-white font-semibold">
                    🌸
                  </span>
                )}
                {day.wateringCount > 0 && (
                  <span className="text-[10px] bg-blue-500/60 px-1 py-0.5 rounded text-white font-semibold">
                    💧 
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Today button and legend */}
      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={handleToday}
          className="px-3 py-1 text-xs font-semibold bg-lime-300/20 border border-lime-300/40 rounded-lg hover:bg-lime-300/30 transition text-lime-200"
        >
          Today
        </button>

        <div className="flex gap-3 text-[10px]">
          <div className="flex items-center gap-1">
            <span className="text-xs">🌱</span>
            <span className="text-lime-100/70">Seedling</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs">🌿</span>
            <span className="text-lime-100/70">Veg</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs">🌸</span>
            <span className="text-lime-100/70">Bloom</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs">💧</span>
            <span className="text-lime-100/70">Watering</span>
          </div>
        </div>
      </div>
    </div>
  );
}

