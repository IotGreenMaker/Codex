"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { NotificationEntry, NotificationPayload, NotificationSource } from "@/lib/notification-types";
import {
  ensurePermission,
  fireOSNotification,
  generateId,
  logNotification,
  playNotificationSound
} from "@/lib/notification-service";

type NotifyOptions = Partial<NotificationPayload> & { title: string; message: string };

type NotificationContextValue = {
  notifications: NotificationEntry[];
  lastSource: NotificationSource | null;
  notify: (opts: NotifyOptions) => Promise<void>;
  dismiss: (id: string) => void;
  ensurePermission: () => Promise<boolean>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const [lastSource, setLastSource] = useState<NotificationSource | null>(null);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, dismissed: true } : n)));
    const t = timersRef.current.get(id);
    if (t) {
      clearTimeout(t);
      timersRef.current.delete(id);
    }
  }, []);

  const notify = useCallback(
    async (opts: NotifyOptions) => {
      const payload: NotificationPayload = {
        source: opts.source ?? "system",
        variant: opts.variant ?? "info",
        title: opts.title,
        message: opts.message,
        icon: opts.icon,
        durationMs: opts.durationMs ?? 6000,
        requestPermission: opts.requestPermission ?? false,
      };

      logNotification(payload);

      if (payload.requestPermission) {
        const granted = await ensurePermission();
        if (!granted) {
          console.warn(`[Notification:${payload.source}] Permission denied — aborting`);
          return;
        }
      }

      playNotificationSound();
      fireOSNotification(payload);

      const id = generateId(payload.source);
      const entry: NotificationEntry = {
        ...payload,
        id,
        createdAt: Date.now(),
        dismissed: false,
      };
      setLastSource(payload.source);
      setNotifications((prev) => [...prev, entry]);

      if (payload.durationMs && payload.durationMs > 0) {
        const t = setTimeout(() => dismiss(id), payload.durationMs);
        timersRef.current.set(id, t);
      }
    },
    [dismiss]
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  return (
    <NotificationContext.Provider
      value={{ notifications, lastSource, notify, dismiss, ensurePermission }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotification must be used inside NotificationProvider");
  return ctx;
}
