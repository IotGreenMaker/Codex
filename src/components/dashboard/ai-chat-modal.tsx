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
  onAddNote,
  calendarConfig
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
  calendarConfig?: any;
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
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Panel */}
      <div
        ref={panelRef}
        className="relative z-10 w-full max-w-2xl h-[70vh] sm:h-[70vh] flex flex-col rounded-t-3xl sm:rounded-3xl border border-white/10 glass-panel shadow-2xl animate-slide-up sm:animate-fade-in"
        style={{
          animationFillMode: "forwards"
        }}
      >
        {/* Header */}
        <div className="sticky top-0 z-20 flex items-center justify-between rounded-t-3xl sm:rounded-t-3xl border-b border-lime-300/10 bg-gradient-to-b from-black/40 to-black/20 px-6 py-4 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-lime-300/10 to-emerald-400/10 border border-lime-300/20">
              <img src="/g-icon.png" alt="logo" className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Assistant</h2>
            
            </div>
          </div>

          {/* Close Button - Now inside header */}
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 p-2 text-white/70 hover:bg-white/10 hover:text-white transition backdrop-blur-sm"
            aria-label="Close AI chat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Chat Content */}
        <div className="flex-1 sm:max-h-[50vh] p-4 sm:p-6">
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
            calendarConfig={calendarConfig}
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