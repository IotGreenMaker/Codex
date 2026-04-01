"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Volume2, Send } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { translations } from "@/lib/i18n";
import { speak } from "@/lib/tts";
import { buildGrowContext } from "@/lib/buildGrowContext";
import { getPreviousContext } from "@/lib/supabase-client";
import { generateUUID } from "@/lib/uuid";
import type { PlantProfile } from "@/lib/types";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  source?: "text" | "voice";
  createdAt?: string;
};

export function AiAssistantPanel({
  locale,
  plant,
  plants = [],
  weather,
  onPlantUpdate,
  onPatchPlant,
  onSelectPlant,
  onUpdateWateringData,
  onUpdateClimateData
}: {
  locale: Locale;
  plant: PlantProfile;
  plants?: PlantProfile[];
  weather?: { temperatureC: number | null; humidity: number | null; location: string } | null;
  onPlantUpdate: (next: PlantProfile) => void;
  onPatchPlant?: (patch: Partial<PlantProfile>) => void;
  onSelectPlant?: (plantId: string) => void;
  onUpdateWateringData?: (data: PlantProfile["wateringData"]) => void;
  onUpdateClimateData?: (data: PlantProfile["climateData"]) => void;
}) {
  const t = translations[locale];
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [micError, setMicError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<
    "idle" | "connecting" | "connected" | "failed"
  >("idle");
  const [isPlaying, setIsPlaying] = useState(false);

  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Initialize LiveKit connection and voice recognition
  useEffect(() => {
    const initializeVoice = async () => {
      try {
        // Set up Web Speech API for voice input
        const SpeechRecognition =
          (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

        if (!SpeechRecognition) {
          setMicError("Speech recognition not supported");
          return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = locale === "pt-BR" ? "pt-BR" : "en-US";

        recognition.onstart = () => {
          setMicError(null);
        };

        recognition.onresult = (event: any) => {
          let interim = "";
          let final = "";

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;

            if (event.results[i].isFinal) {
              final += transcript + " ";
            } else {
              interim += transcript;
            }
          }

          setInterimTranscript(interim);

          if (final) {
            handleUserSpeech(final.trim());
          }
        };

        recognition.onerror = (event: any) => {
          setMicError(`Voice error: ${event.error}`);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      } catch (error) {
        setMicError("Failed to initialize voice");
      }

      void loadConversation();
    };

    initializeVoice();

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop?.();
      }
    };
  }, [locale]);

  const voiceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleUserSpeech = async (text: string) => {
    if (!text.trim()) return;

    // Clear any existing timeout
    if (voiceTimeoutRef.current) {
      clearTimeout(voiceTimeoutRef.current);
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      source: "voice",
      createdAt: new Date().toISOString()
    };

    setMessages((prev) => [...prev, userMessage]);
    setInterimTranscript("");

    void persistMessages([
      {
        id: userMessage.id,
        createdAt: userMessage.createdAt ?? new Date().toISOString(),
        role: "user",
        content: userMessage.content,
        source: "voice"
      }
    ]);

    // Add 1 second delay before sending to AI
    voiceTimeoutRef.current = setTimeout(() => {
      void getAIResponse(text);
    }, 1000);
  };

  const getAIResponse = async (userMessage: string) => {
    setConnectionState("connecting");
    const assistantId = `assistant-${Date.now()}`;

    try {
      // Build comprehensive plant context with real-time data
      const latestClimate = plant.climateData?.[plant.climateData.length - 1];
      const latestWatering = plant.wateringData?.[plant.wateringData.length - 1];
      
      const plantContext = buildGrowContext(plant, plants);

      // Use Groq API for AI response
      const response = await fetch("/api/groq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          plantContext: plantContext,
          plantId: plant.id,
          history: messages.map((m) => ({
            role: m.role,
            content: m.content
          }))
        })
      });

      const data = (await response.json()) as {
        ok: boolean;
        response?: string;
        error?: string;
      };

      setConnectionState(data.ok ? "connected" : "failed");

      let assistantMessage = data.ok && data.response
        ? data.response
        : data.error ?? "Assistant request failed.";

      // Try to parse structured response with data commands
      let parsedData: any = null;
      try {
        // Look for JSON block in response
        const jsonMatch = assistantMessage.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          parsedData = JSON.parse(jsonMatch[1]);
          // Extract just the message text if available
          if (parsedData.message) {
            assistantMessage = parsedData.message;
          }
        }
      } catch {
        // Not structured JSON, continue with plain text
      }

      // Apply data updates from AI
      if (parsedData) {
        // Update watering data
        if (parsedData.watering && onUpdateWateringData) {
          const newWatering = {
            id: generateUUID(),
            timestamp: new Date().toISOString(),
            amountMl: parsedData.watering.amountMl ?? 0,
            ph: parsedData.watering.ph ?? 6.0,
            ec: parsedData.watering.ec ?? 1.4,
            runoffPh: parsedData.watering.runoffPh,
            runoffEc: parsedData.watering.runoffEc
          };
          onUpdateWateringData([...(plant.wateringData ?? []), newWatering]);
        }

        // Update climate data
        if (parsedData.climate && onUpdateClimateData) {
          const newClimate = {
            id: generateUUID(),
            timestamp: new Date().toISOString(),
            tempC: parsedData.climate.tempC ?? plant.growTempC,
            humidity: parsedData.climate.humidity ?? plant.growHumidity
          };
          onUpdateClimateData([...(plant.climateData ?? []), newClimate]);
        }

        // Update plant profile (stage, strain, light settings, etc.)
        if (parsedData.plant && onPatchPlant) {
          const plantUpdate: Partial<PlantProfile> = {};
          
          if (parsedData.plant.stage) plantUpdate.stage = parsedData.plant.stage;
          if (parsedData.plant.strainName) plantUpdate.strainName = parsedData.plant.strainName;
          if (parsedData.plant.lightType) plantUpdate.lightType = parsedData.plant.lightType;
          if (typeof parsedData.plant.lightDimmerPercent === "number") plantUpdate.lightDimmerPercent = parsedData.plant.lightDimmerPercent;
          if (parsedData.plant.lightsOn) plantUpdate.lightsOn = parsedData.plant.lightsOn;
          if (parsedData.plant.lightsOff) plantUpdate.lightsOff = parsedData.plant.lightsOff;
          if (typeof parsedData.plant.wateringIntervalDays === "number") plantUpdate.wateringIntervalDays = parsedData.plant.wateringIntervalDays;
          if (typeof parsedData.plant.growTempC === "number") plantUpdate.growTempC = parsedData.plant.growTempC;
          if (typeof parsedData.plant.growHumidity === "number") plantUpdate.growHumidity = parsedData.plant.growHumidity;
          
          if (Object.keys(plantUpdate).length > 0) {
            onPatchPlant(plantUpdate);
          }
        }

        // Handle plant selection by name
        if (parsedData.selectPlant && onSelectPlant && plants.length > 0) {
          const selectedPlant = plants.find(
            p => p.strainName.toLowerCase() === parsedData.selectPlant.toLowerCase()
          );
          if (selectedPlant) {
            onSelectPlant(selectedPlant.id);
          }
        }
      }

      const aiMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: assistantMessage,
        source: "voice",
        model: "llama-3.3-70b-versatile (Groq)",
        createdAt: new Date().toISOString()
      };

      setMessages((prev) => [...prev, aiMessage]);

      void persistMessages([
        {
          id: assistantId,
          createdAt: new Date().toISOString(),
          role: "assistant",
          content: assistantMessage,
          source: "voice",
          meta: { model: "llama-3.3-70b-versatile (Groq)" }
        }
      ]);

      // Read AI response with voice
      setIsPlaying(true);
      await speak(assistantMessage);
      setIsPlaying(false);
    } catch (error) {
      setConnectionState("failed");
      setIsPlaying(false);
      const errorMessage =
        error instanceof Error ? error.message : "Assistant request failed.";

      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: "assistant",
          content: errorMessage,
          source: "voice",
          model: "assistant",
          createdAt: new Date().toISOString()
        }
      ]);
    }
  };

  const toggleMicrophone = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setInterimTranscript("");
      setDraft("");
      setMicError(null);
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    await handleUserSpeech(text);
  };

  async function loadConversation() {
    try {
      // Try to load from Supabase first
      try {
        const supabaseHistory = await getPreviousContext(plant.id, 50);
        if (supabaseHistory && supabaseHistory.length > 0) {
          const restored = supabaseHistory.map((msg: any) => ({
            id: `${msg.role}-${msg.created_at}`,
            role: msg.role as "user" | "assistant",
            content: msg.content,
            source: "voice" as const,
            createdAt: msg.created_at
          })) satisfies ChatMessage[];
          setMessages(restored);
          return;
        }
      } catch (supabaseError) {
        console.log("Supabase not available, falling back to local API");
      }

      // Fallback to local API
      const response = await fetch(
        `/api/conversations?plantId=${encodeURIComponent(plant.id)}&assistantKey=voice`,
        { cache: "no-store" }
      );
      const data = (await response.json()) as {
        ok: boolean;
        state?: {
          messages?: Array<{
            id: string;
            role: "user" | "assistant";
            content: string;
            source: "text" | "voice";
            createdAt: string;
            meta?: Record<string, unknown>;
          }>;
        };
      };
      if (!data.ok) return;
      const restored = (data.state?.messages ?? []).map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        source: msg.source as "text" | "voice",
        createdAt: msg.createdAt,
        model: typeof msg.meta?.model === "string" ? msg.meta.model : undefined
      })) satisfies ChatMessage[];
      setMessages(restored);
    } catch {
      // ignore
    }
  }

  async function persistMessages(
    payload: Array<{
      id: string;
      createdAt: string;
      role: "user" | "assistant";
      content: string;
      source: "text" | "voice";
      meta?: Record<string, unknown>;
    }>
  ) {
    try {
      await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plantId: plant.id,
          assistantKey: "voice",
          messages: payload
        })
      });
    } catch {
      // ignore
    }
  }

  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-xs uppercase tracking-[0.28em] text-lime-300/70">
          {t.aiConversation}
        </p>

        <div className="flex items-center gap-2">
          {/* Speaker indicator */}
          {isPlaying && (
            <div className="animate-pulse">
              <Volume2 className="h-6 w-6 text-lime-300/70" />
            </div>
          )}

        
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/8 bg-white/5 p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-lime-200">
            Conversation
          </p>
        </div>

        {/* Error message */}
        {micError && <p className="mb-2 text-xs text-amber-300">{micError}</p>}

        {/* Chat messages */}
        <div className="mt-3 max-h-screen space-y-3 overflow-y-auto pr-1" ref={chatContainerRef}>
          {messages.length === 0 ? (
            <p className="text-xs text-slate-400 italic">
              Click the microphone to start a natural conversation...
            </p>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`border-l-2 pl-3 pb-2 ${
                  message.role === "assistant"
                    ? "border-indigo-500/80"
                    : "border-green-500/80"
                }`}
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-400">
                  {message.role === "assistant" ? "🤖 Assistant " : "You"}
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-100">{message.content}</p>
              </div>
            ))
          )}
        </div>
          {/* Connection status */}
          <span
            className={`rounded-full px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest ${
              connectionState === "connected"
                ? "bg-lime-300/14 text-lime-100"
                : connectionState === "failed"
                  ? "bg-red-400/12 text-red-100"
                  : connectionState === "connecting"
                    ? "bg-white/10 text-slate-200"
                    : "bg-white/6 text-slate-400"
            }`}
          >
            {connectionState}
          </span>
      </div>

      {/* Quick text input with integrated voice */}
      <div className="mt-4 rounded-2xl border border-white/8 bg-white/5 p-3">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder={isListening ? "Listening..." : "Type or speak..."}
            value={draft}
            onChange={(e) => setDraft(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && draft.trim()) {
                sendMessage(draft);
                setDraft("");
                setInterimTranscript("");
              }
            }}
            disabled={isListening}
            className="flex-1 rounded-full border border-lime-300/20 bg-black/30 px-3 py-2 text-sm text-lime-100 placeholder-slate-500 outline-none focus:border-lime-300/50 disabled:opacity-50 disabled:cursor-not-allowed"
          />

          {/* Mic button - small, integrated with Send */}
          <button
            type="button"
            onClick={toggleMicrophone}
            title={isListening ? "Stop listening" : "Start listening"}
            className={`group relative grid h-10 w-10 place-items-center rounded-full border transition focus:outline-none ${
              isListening
                ? "border-lime-200/80 bg-gradient-to-br from-lime-300/35 via-fuchsia-400/25 to-emerald-300/25 text-lime-100 shadow-[0_0_20px_6px_rgba(178,107,255,0.12),0_0_40px_12px_rgba(158,255,102,0.12)]"
                : "border-lime-300/35 bg-gradient-to-br from-lime-300/18 via-fuchsia-400/10 to-emerald-300/10 text-lime-100 hover:from-lime-300/30 hover:via-fuchsia-400/20 hover:to-emerald-300/20"
            }`}
          >
            {isListening ? (
              <>
                <span
                  className="absolute h-10 w-10 animate-pulse rounded-full"
                  style={{
                    background:
                      "radial-gradient(circle at 60% 40%, rgba(158,255,102,0.22) 40%, rgba(178,107,255,0.18) 100%)",
                    boxShadow:
                      "0 0 30px 8px rgba(178,107,255,0.12), 0 0 60px 16px rgba(158,255,102,0.12)"
                  }}
                />
                <Mic className="relative h-4 w-4" />
              </>
            ) : (
              <Mic className="relative h-4 w-4" />
            )}
          </button>

          {/* Send button */}
          <button
            type="button"
            onClick={() => {
              if (draft.trim()) {
                sendMessage(draft);
                setDraft("");
                setInterimTranscript("");
              }
            }}
            disabled={!draft.trim() || isListening}
            className="rounded-lg border border-lime-300/20 bg-lime-300/12 px-4 py-2 text-sm font-semibold text-lime-100 transition hover:bg-lime-300/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
