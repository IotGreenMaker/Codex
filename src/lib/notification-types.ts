export type NotificationSource =
  | "light-config"
  | "calendar-config"
  | "timeline"
  | "plant-detail"
  | "ai-assistant"
  | "system";

export type NotificationVariant =
  | "info"
  | "success"
  | "warning"
  | "error"
  | "toggle-on"
  | "toggle-off"
  | "schedule-on"
  | "schedule-off"
  | "watering";

export type NotificationPayload = {
  source: NotificationSource;
  variant: NotificationVariant;
  title: string;
  message: string;
  icon?: string;
  durationMs?: number;
  requestPermission?: boolean;
};

export type NotificationEntry = NotificationPayload & {
  id: string;
  createdAt: number;
  dismissed: boolean;
};
