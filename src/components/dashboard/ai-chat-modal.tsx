"use client";

import { AiAssistantPanel } from "@/components/dashboard/ai-assistant-panel-livekit";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";

export function AiChatModal({
  isOpen,
  onClose,
  locale,
  plant,
  plants = [],
  weather,
  onPlantUpdate,
  onPatchPlant,
  onSelectPlant,
  onUpdateWateringData,
  onUpdateClimateData,
  onToggleNotification,
  notificationsEnabled = false,
  onAddNote
}: {
  isOpen: boolean;
  onClose: () => void;
  locale: string;
  plant: any;
  plants?: any[];
  weather?: { temperatureC: number | null; humidity: number | null; location: string } | null;
  onPlantUpdate: (next: any) => void;
  onPatchPlant?: (patch: Partial<any>) => void;
  onSelectPlant?: (plantId: string) => void;
  onUpdateWateringData?: (data: any[]) => void;
  onUpdateClimateData?: (data: any[]) => void;
  onToggleNotification?: (enabled: boolean) => void;
  notificationsEnabled?: boolean;
  onAddNote?: (text: string, timestamp?: string) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleEscape);
    }
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Panel */}
      <div
        ref={panelRef}
        className="relative z-10 w-full max-w-2xl max-h-[90vh] sm:max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-white/10 bg-slate-900/95 shadow-2xl animate-slide-up sm:animate-fade-in"
        style={{
          animationFillMode: "forwards"
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-20 rounded-full border border-white/20 bg-black/40 p-2 text-white/80 hover:bg-black/60 hover:text-white transition backdrop-blur-sm"
          aria-label="Close AI chat"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="sticky top-0 z-10 rounded-t-3xl sm:rounded-t-3xl border-b border-white/10 bg-gradient-to-b from-slate-800/95 to-slate-900/95 px-6 py-4 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-lime-300/20 to-emerald-400/20 border border-lime-300/30">
              <span className="text-lg">🤖</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">AI Assistant</h2>
              <p className="text-xs text-slate-400">Your personal grow companion</p>
            </div>
          </div>
        </div>

        {/* Chat Content */}
        <div className="p-4 sm:p-6">
          <AiAssistantPanel
            locale={locale as any}
            plant={plant}
            plants={plants}
            weather={weather}
            onPlantUpdate={onPlantUpdate}
            onPatchPlant={onPatchPlant}
            onSelectPlant={onSelectPlant}
            onUpdateWateringData={onUpdateWateringData}
            onUpdateClimateData={onUpdateClimateData}
            onToggleNotification={onToggleNotification}
            notificationsEnabled={notificationsEnabled}
            onAddNote={onAddNote}
          />
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}