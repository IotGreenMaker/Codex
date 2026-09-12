import type { NotificationPayload } from "./notification-types";

const SOUND_URL = "/Notification.wav";

let cachedAudio: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!cachedAudio) {
    cachedAudio = new Audio(SOUND_URL);
    cachedAudio.preload = "auto";
  }
  return cachedAudio;
}

export async function ensurePermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function playNotificationSound(): void {
  const audio = getAudio();
  if (!audio) return;
  try {
    audio.currentTime = 0;
    audio.play().catch((err) => console.warn("[Notification] Sound play failed:", err));
  } catch (err) {
    console.warn("[Notification] Audio error:", err);
  }
}

export function fireOSNotification(payload: NotificationPayload): void {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(payload.title, {
      body: payload.message,
      icon: "/g-icon.png",
      tag: `${payload.source}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      requireInteraction: false,
      silent: false,
    });
  } catch (err) {
    console.error("[Notification] OS notification failed:", err);
  }
}

export function logNotification(payload: NotificationPayload): void {
  console.log(
    `%c[Notification:${payload.source}]%c ${payload.variant}`,
    "color: #86efac; font-weight: bold;",
    "color: #a78bfa;",
    payload.title,
    "→",
    payload.message
  );
}

export function generateId(source: string): string {
  return `${source}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
