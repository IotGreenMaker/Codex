"use client";

import { Bell, BellOff, Check, Info, Lightbulb, Sprout, Volume2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNotification } from "@/contexts/notification-context";
import type { NotificationEntry, NotificationVariant } from "@/lib/notification-types";

const VARIANT_STYLES: Record<NotificationVariant, {
  icon: typeof Bell;
  iconClass: string;
  ringClass: string;
  bgClass: string;
  textClass: string;
}> = {
  info:           { icon: Info,           iconClass: "text-sky-300",    ringClass: "border-sky-400/30",    bgClass: "bg-sky-500/10",    textClass: "text-sky-300"    },
  success:        { icon: Check,         iconClass: "text-lime-300",   ringClass: "border-lime-400/30",   bgClass: "bg-lime-500/10",   textClass: "text-lime-300"   },
  warning:        { icon: Bell,          iconClass: "text-amber-300", ringClass: "border-amber-400/30", bgClass: "bg-amber-500/10", textClass: "text-amber-300" },
  error:          { icon: X,            iconClass: "text-red-300",   ringClass: "border-red-400/30",   bgClass: "bg-red-500/10",   textClass: "text-red-300"   },
  "toggle-on":    { icon: Bell,         iconClass: "text-lime-300",  ringClass: "border-lime-400/40",  bgClass: "bg-lime-500/15",  textClass: "text-lime-300"  },
  "toggle-off":   { icon: BellOff,      iconClass: "text-slate-300", ringClass: "border-white/10",     bgClass: "bg-white/5",       textClass: "text-slate-300" },
  "schedule-on":  { icon: Lightbulb,   iconClass: "text-lime-300",  ringClass: "border-lime-400/40",  bgClass: "bg-lime-500/15",  textClass: "text-lime-300"  },
  "schedule-off": { icon: Lightbulb,   iconClass: "text-indigo-300",ringClass: "border-indigo-400/40",bgClass: "bg-indigo-500/15",textClass: "text-indigo-300"},
  watering:       { icon: Sprout,       iconClass: "text-sky-300",   ringClass: "border-sky-400/30",   bgClass: "bg-sky-500/10",   textClass: "text-sky-300"   },
};

const SOURCE_LABELS: Record<string, string> = {
  "light-config": "Light Settings",
  "calendar-config": "Timeline Settings",
  timeline: "Timeline",
  "plant-detail": "Plant Details",
  "ai-assistant": "AI Assistant",
  system: "System",
};

function Toast({ entry, onDismiss }: { entry: NotificationEntry; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);
  const style = VARIANT_STYLES[entry.variant];
  const Icon = style.icon;

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(onDismiss, 300);
  };

  return (
    <div
      className={`
        glass-panel rounded-2xl border p-4 shadow-2xl
        ${style.ringClass} ${style.bgClass}
        transition-all duration-300 ease-out
        ${visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"}
      `}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${style.ringClass} ${style.bgClass}`}>
          <Icon className={`h-5 w-5 ${style.iconClass}`} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-lime-100">{entry.title}</p>
          <p className="mt-0.5 text-xs text-lime-100/80">{entry.message}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest ${style.ringClass} ${style.bgClass} ${style.textClass}`}>
              <Volume2 className="h-2.5 w-2.5" />
              {SOURCE_LABELS[entry.source] ?? entry.source}
            </span>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="shrink-0 rounded-full p-1.5 hover:bg-white/10 transition"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4 text-lime-100/60" />
        </button>
      </div>
    </div>
  );
}

export function Notifications() {
  const { notifications, dismiss } = useNotification();
  const visible = notifications.filter((n) => !n.dismissed).slice(-5);

  if (visible.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 w-96 max-w-[calc(100vw-2rem)]">
      {visible.map((n) => (
        <Toast key={n.id} entry={n} onDismiss={() => dismiss(n.id)} />
      ))}
    </div>
  );
}
