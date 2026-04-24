"use client";

import { Locale } from "@/lib/i18n";
import { useCurrentTime } from "@/lib/time-context";

interface LiveClockProps {
  locale: Locale;
}

export function LiveClock({ locale }: LiveClockProps) {
  const { nowMs } = useCurrentTime();

  return (
    <div className="flex-1 w-full sm:w-auto">
      <p className="font-mono text-xs sm:text-[11px] uppercase tracking-[0.22em] text-lime-200">Live Clock</p>
      <p className="mt-1 text-xl sm:text-2xl font-semibold text-lime-100">
        {new Intl.DateTimeFormat(locale, {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false
        }).format(new Date(nowMs))}
      </p>
      <p className="text-lime-100/75 text-sm sm:text-xs">
        {new Intl.DateTimeFormat(locale, {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric"
        }).format(new Date(nowMs))}
      </p>
    </div>
  );
}
