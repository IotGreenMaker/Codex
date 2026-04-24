"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type TimeContextValue = {
  nowMs: number;
  today: Date;
};

const TimeContext = createContext<TimeContextValue | null>(null);

export function CurrentTimeProvider({ children }: { children: React.ReactNode }) {
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const value = useMemo(
    () => ({
      nowMs,
      today: new Date(nowMs),
    }),
    [nowMs]
  );

  return <TimeContext.Provider value={value}>{children}</TimeContext.Provider>;
}

export function useCurrentTime() {
  const context = useContext(TimeContext);
  if (!context) {
    throw new Error("useCurrentTime must be used within a CurrentTimeProvider");
  }
  return context;
}

export function getStartOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  value.setMinutes(0, 0, 0);
  value.setSeconds(0, 0);
  value.setMilliseconds(0);
  return value;
}
