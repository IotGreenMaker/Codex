"use client";

import { useState, useEffect, useCallback } from "react";
import { getSetting, setSetting } from "@/lib/indexeddb-storage";
import { loadCalendarConfig } from "@/components/dashboard/calendar-config-modal";
import type { CalendarConfig } from "@/lib/types";

export function useSettings() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [calendarConfig, setCalendarConfig] = useState<CalendarConfig | null>(null);

  useEffect(() => {
    getSetting("wateringNotification").then((val) => {
      setNotificationsEnabled(val === "true");
    });
    loadCalendarConfig().then(setCalendarConfig);
  }, []);

  const toggleNotifications = useCallback(async (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    await setSetting("wateringNotification", String(enabled));
  }, []);

  return {
    notificationsEnabled,
    toggleNotifications,
    calendarConfig,
    setCalendarConfig
  };
}
