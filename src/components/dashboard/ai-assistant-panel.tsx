"use client";

import { useEffect, useRef, useState } from "react";
import { getChatMessages, saveAndTruncateChatMessage, getAiConfig, saveAiConfig } from "@/lib/indexeddb-storage";
import { AiConfigModal, type AiConfig } from "@/components/dashboard/ai-config-modal";
import { Mic, Volume2, Send, Settings, VolumeOff } from "lucide-react";
import { stopSpeaking } from "@/lib/tts";
import type { Locale } from "@/lib/i18n";
import { translations } from "@/lib/i18n";
import { speak } from "@/lib/tts";
import { buildGrowContext } from "@/lib/buildGrowContext";
import { generateUUID } from "@/lib/uuid";
import type { PlantProfile, GrowStage } from "@/lib/types";

const VOICE_IDLE_TIMEOUT_MS = 2600;
const SHARED_CONVERSATION_ID = "global_ai_conversation"; // Global conversation shared across all plants

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
  onUpdateClimateData,
  onToggleNotification,
  notificationsEnabled = false,
  onCreatePlant,
  onAddNote,
  calendarConfig
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
  onToggleNotification?: (enabled: boolean) => void;
  notificationsEnabled?: boolean;
  onCreatePlant?: (data: { strainName: string; stage: GrowStage }) => void;
  onAddNote?: (text: string, timestamp?: string) => void;
  calendarConfig?: any;
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
  const [isMuted, setIsMuted] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [assistantAudioLevel, setAssistantAudioLevel] = useState(0);
  const [micAudioLevel, setMicAudioLevel] = useState(0);
  const [micAudioVariance, setMicAudioVariance] = useState(0);
  const [aiConfig, setAiConfig] = useState<AiConfig>({
    aiProvider: "groq",
    aiApiKey: "",
    voiceProvider: "inworld",
    voiceApiKey: ""
  });

  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const voiceDraftRef = useRef("");
  const voiceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAudioContextRef = useRef<AudioContext | null>(null);
  const micAnimationFrameRef = useRef<number | null>(null);
  const lastMicLevelRef = useRef(0);

  // ─── Ref-based State Sync (Fixes Stale Closures in Async Callbacks) ────────
  const plantRef = useRef(plant);
  const plantsRef = useRef(plants);
  const messagesRef = useRef(messages);
  const aiConfigRef = useRef(aiConfig);
  const notificationsEnabledRef = useRef(notificationsEnabled);

  useEffect(() => {
    plantRef.current = plant;
    plantsRef.current = plants;
    messagesRef.current = messages;
    aiConfigRef.current = aiConfig;
    notificationsEnabledRef.current = notificationsEnabled;
  });

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Load persisted AI config on mount
  useEffect(() => {
    getAiConfig().then(setAiConfig).catch(() => {});
  }, []);

  // Load global conversation once on mount
  useEffect(() => {
    void loadConversation();
  }, []);

  const handleSaveConfig = async (config: AiConfig) => {
    setAiConfig(config);
    await saveAiConfig(config).catch(() => {});
  };

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
        recognition.lang = locale ===  "pt-BR" ? "pt-BR" : "en-US";

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

          const normalizedFinal = final.trim();
          if (normalizedFinal) {
            voiceDraftRef.current = [voiceDraftRef.current, normalizedFinal].filter(Boolean).join(" ").trim();
          }

          const normalizedInterim = interim.trim();
          const liveTranscript = [voiceDraftRef.current, normalizedInterim].filter(Boolean).join(" ").trim();

          setInterimTranscript(normalizedInterim);
          setDraft(liveTranscript);
          scheduleVoiceSend(liveTranscript);
        };

        recognition.onerror = (event: any) => {
          // Don't show error for 'no-speech', it's common in idle state
          if (event.error !== "no-speech") {
            setMicError(`Voice error: ${event.error}`);
          }
        };

        recognition.onend = () => {
          setIsListening(false);
          stopMicVisualization();
        };

        recognitionRef.current = recognition;
      } catch (error) {
        setMicError("Failed to initialize voice");
      }

      void loadConversation();
    };

    initializeVoice();

    return () => {
      clearVoiceTimeout();
      stopMicVisualization();
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop?.();
      }
    };
  }, [locale]);

  const clearVoiceTimeout = () => {
    if (voiceTimeoutRef.current) {
      clearTimeout(voiceTimeoutRef.current);
      voiceTimeoutRef.current = null;
    }
  };

  const resetVoiceDraft = () => {
    voiceDraftRef.current = "";
    setDraft("");
    setInterimTranscript("");
  };

  const stopMicVisualization = () => {
    if (micAnimationFrameRef.current) {
      window.cancelAnimationFrame(micAnimationFrameRef.current);
      micAnimationFrameRef.current = null;
    }

    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;

    if (micAudioContextRef.current) {
      void micAudioContextRef.current.close().catch(() => {});
      micAudioContextRef.current = null;
    }

    lastMicLevelRef.current = 0;
    setMicAudioLevel(0);
    setMicAudioVariance(0);
  };

  const startMicVisualization = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return;

    try {
      stopMicVisualization();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.75;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const samples = new Uint8Array(analyser.fftSize);

      micStreamRef.current = stream;
      micAudioContextRef.current = audioContext;

      const tick = () => {
        analyser.getByteTimeDomainData(samples);

        let sum = 0;
        for (const sample of samples) {
          const normalized = (sample - 128) / 128;
          sum += normalized * normalized;
        }

        const rms = Math.sqrt(sum / samples.length);
        const level = Math.min(1, rms * 5.5);
        const variance = Math.min(1, Math.abs(level - lastMicLevelRef.current) * 5);

        lastMicLevelRef.current = level;
        setMicAudioLevel(level);
        setMicAudioVariance(variance);
        micAnimationFrameRef.current = window.requestAnimationFrame(tick);
      };

      await audioContext.resume().catch(() => {});
      tick();
    } catch {
      setMicAudioLevel(0);
      setMicAudioVariance(0);
    }
  };

  const getVoiceDraftValue = () => {
    return [voiceDraftRef.current, interimTranscript].filter(Boolean).join(" ").trim();
  };

  const submitMessage = async (text: string, source: "text" | "voice") => {
    const normalized = text.trim();
    if (!normalized) return;

    clearVoiceTimeout();

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: normalized,
      source,
      createdAt: new Date().toISOString()
    };

    setMessages((prev) => [...prev, userMessage]);

    if (source === "voice") {
      resetVoiceDraft();
      stopMicVisualization();
    } else {
      setDraft("");
      setInterimTranscript("");
    }

    void persistMessages([
      {
        id: userMessage.id,
        createdAt: userMessage.createdAt ?? new Date().toISOString(),
        role: "user",
        content: userMessage.content,
        source
      }
    ]);

    await getAIResponse(normalized, source);
  };

  const scheduleVoiceSend = (text: string) => {
    const normalized = text.trim();
    clearVoiceTimeout();

    if (!normalized) return;

    voiceTimeoutRef.current = setTimeout(() => {
      recognitionRef.current?.stop?.();
      setIsListening(false);
      void submitMessage(normalized, "voice");
    }, VOICE_IDLE_TIMEOUT_MS);
  };
  const getAIResponse = async (userMessage: string, source: "text" | "voice") => {
    setConnectionState("connecting");
    const assistantId = `assistant-${Date.now()}`;

    try {
      // Use Ref-based latest data to avoid stale context during switches
      const currentPlant = plantRef.current;
      const currentPlants = plantsRef.current;
      const currentMessages = messagesRef.current;
      const currentAiConfig = aiConfigRef.current;
      const currentNotificationsEnabled = notificationsEnabledRef.current;

      const plantContext = buildGrowContext(
        currentPlant,
        currentPlants,
        currentNotificationsEnabled,
        (calendarConfig?.measurementUnit as 'EC' | 'PPM') || 'EC',
        calendarConfig?.hannaScale || 500
      );

      // Use Groq API for AI response
      const response = await fetch("/api/groq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          plantContext: plantContext,
          plantId: currentPlant.id,
          history: currentMessages.map((m) => ({
            role: m.role,
            content: m.content
          })),
          apiKey: currentAiConfig.aiApiKey || undefined
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

      // ─── Zero-Leak Parser (TODO #20 FIX) ──────────────────────────────
      // This parser is "cynical" — it doesn't trust the AI to follow code fences.
      // It scans the entire response for any JSON structure and extracts it.
      let parsedData: any = null;
      let cleanedMessage = assistantMessage;

      try {
        // Step 1: Look for code-fenced JSON (```json ... ```)
        const fencedMatch = assistantMessage.match(/```json\s*([\s\S]*?)\s*```/);
        if (fencedMatch) {
          try {
            parsedData = JSON.parse(fencedMatch[1]);
            // Strip the fence for the text fallback
            cleanedMessage = assistantMessage.replace(/```json[\s\S]*?```/g, "").trim();
          } catch (e) { /* invalid JSON in fence, skip */ }
        }

        // Step 2: If no fence worked, hunt for raw JSON { ... } anywhere in the string
        if (!parsedData) {
          const firstBrace = assistantMessage.indexOf('{');
          const lastBrace = assistantMessage.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            const potentialJsonTarget = assistantMessage.substring(firstBrace, lastBrace + 1);
            try {
              const detected = JSON.parse(potentialJsonTarget);
              // If it has a message field OR any of our command keys, it's our JSON
              if (detected && typeof detected === 'object' && (detected.message || detected.watering || detected.climate || detected.plant || detected.selectPlant || detected.createPlant)) {
                parsedData = detected;
                // Text before the JSON is our fallback message
                cleanedMessage = assistantMessage.substring(0, firstBrace).trim();
              }
            } catch (e) { /* not JSON, continue */ }
          }
        }

        // Step 3: Priority Message — if JSON has a message, that IS the response
        if (parsedData && parsedData.message && typeof parsedData.message === "string") {
          cleanedMessage = parsedData.message;
        }
      } catch (err) {
        // Parsing failed entirely, keep original but strip technical symbols below
      }

      // Step 4: Final Sanitization — strip stray backticks or partial markers
      assistantMessage = cleanedMessage
        .replace(/```[\s\S]*?```/g, "")
        .replace(/`{1,3}/g, "")
        .trim();

      // Ensure we never show an empty bubble
      if (!assistantMessage) {
        assistantMessage = parsedData?.message || "Processed your request.";
      }

      // Apply data updates from AI
      if (parsedData) {
        // Update watering data
        if (parsedData.watering && onUpdateWateringData) {
          // Determine the raw value provided by AI (could be 'ec', 'ppm', or 'nutrientValue')
          const rawNutrient = parsedData.watering.nutrientValue ?? parsedData.watering.ec ?? parsedData.watering.ppm;
          let finalEc = 1.4; // Default fallback

          if (typeof rawNutrient === "number") {
            const isPpmMode = (calendarConfig?.measurementUnit === 'PPM');
            const hannaScale = calendarConfig?.hannaScale || 500;

            if (isPpmMode) {
              // User is in PPM mode, so we treat the raw AI value as PPM and convert to storage EC
              finalEc = Number((rawNutrient / hannaScale).toFixed(3));
            } else {
              // User is in EC mode, use the value directly
              finalEc = rawNutrient;
            }
          }

          const newWatering = {
            id: generateUUID(),
            timestamp: new Date().toISOString(),
            amountMl: parsedData.watering.amountMl ?? 0,
            ph: parsedData.watering.ph ?? 6.0,
            ec: finalEc,
            runoffPh: parsedData.watering.runoffPh,
            runoffEc: parsedData.watering.runoffEc
          };
          onUpdateWateringData([...(plantRef.current.wateringData ?? []), newWatering]);
        }

        // Update climate data
        if (parsedData.climate && onUpdateClimateData) {
          const newClimate = {
            id: generateUUID(),
            timestamp: new Date().toISOString(),
            tempC: parsedData.climate.tempC ?? plantRef.current.growTempC,
            humidity: parsedData.climate.humidity ?? plantRef.current.growHumidity
          };
          onUpdateClimateData([...(plantRef.current.climateData ?? []), newClimate]);
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
          
          // Handle stageDays update
          if (parsedData.plant.stageDays) {
            plantUpdate.stageDays = {
              ...plantRef.current.stageDays,
              ...parsedData.plant.stageDays
            };
            
            // Set start dates if moving to a new stage
            const now = new Date().toISOString();
            if (parsedData.plant.stageDays.veg > 0 && !plantRef.current.vegStartedAt) {
              plantUpdate.vegStartedAt = now;
            }
            if (parsedData.plant.stageDays.bloom > 0 && !plantRef.current.bloomStartedAt) {
              plantUpdate.bloomStartedAt = now;
            }
          }
          
          if (Object.keys(plantUpdate).length > 0) {
            onPatchPlant(plantUpdate);
          }
        }

        // Handle plant creation
        if (parsedData.createPlant && onCreatePlant) {
          onCreatePlant({
            strainName: parsedData.createPlant.strainName,
            stage: parsedData.createPlant.stage || "Seedling"
          });
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

        // Handle notification toggle
        if (parsedData.notifications && typeof parsedData.notifications.enabled === "boolean" && onToggleNotification) {
          onToggleNotification(parsedData.notifications.enabled);
        }

        // Handle note recording
        if (parsedData.note && onAddNote) {
          onAddNote(parsedData.note.text, parsedData.note.timestamp);
        }
      }

      const aiMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: assistantMessage,
        source,
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
          source,
          meta: { model: "llama-3.3-70b-versatile (Groq)" }
        }
      ]);

      // Read AI response with voice (skip if muted)
      if (!isMuted) {
        await speak(assistantMessage, {
          apiKey: currentAiConfig.voiceApiKey,
          provider: currentAiConfig.voiceProvider,
          onStart: () => setIsPlaying(true),
          onEnd: () => {
            setIsPlaying(false);
            setAssistantAudioLevel(0);
          },
          onAudioLevel: setAssistantAudioLevel
        });
      }
    } catch (error) {
      setConnectionState("failed");
      setIsPlaying(false);
      setAssistantAudioLevel(0);
      const errorMessage =
        error instanceof Error ? error.message : "Assistant request failed.";

      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: "assistant",
          content: errorMessage,
          source,
          model: "assistant",
          createdAt: new Date().toISOString()
        }
      ]);
    }
  };

  const toggleMicrophone = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      const pendingTranscript = getVoiceDraftValue();
      clearVoiceTimeout();
      recognitionRef.current.stop();
      setIsListening(false);
      if (pendingTranscript) {
        void submitMessage(pendingTranscript, "voice");
      } else {
        resetVoiceDraft();
        stopMicVisualization();
      }
    } else {
      resetVoiceDraft();
      setMicError(null);
      recognitionRef.current.start();
      setIsListening(true);
      void startMicVisualization();
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    await submitMessage(text, "text");
  };

  async function loadConversation() {
    try {
      // Load last 20 messages from IndexedDB using global conversation ID
      const msgs = await getChatMessages(SHARED_CONVERSATION_ID, 20);
      const restored = msgs.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        source: msg.source as "text" | "voice",
        createdAt: msg.createdAt,
        model: msg.model
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
      // Save each message to IndexedDB using global conversation ID
      for (const msg of payload) {
        const chatMessage = {
          id: msg.id,
          plantId: SHARED_CONVERSATION_ID,
          role: msg.role,
          content: msg.content,
          source: msg.source,
          createdAt: msg.createdAt,
          model: msg.meta?.model as string | undefined
        };
        await saveAndTruncateChatMessage(chatMessage, 20);
      }
    } catch {
      // ignore
    }
  }

  return (
    <div className="rounded-2xl lg:h-[51rem] border border-white/8 bg-black/20 p-5">
      <AiConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        config={aiConfig}
        onSave={handleSaveConfig}
      />

      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-xs uppercase tracking-[0.28em] text-lime-300/70">
          {t.aiConversation}
        </p>
        <button
          type="button"
          onClick={() => setIsConfigOpen(true)}
          title="AI Settings"
          className="rounded-full p-1.5 text-slate-400 hover:bg-white/10 hover:text-lime-300 transition"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-white/8 bg-white/5 p-4">
        {/* Error message */}
        {micError && <p className="mb-2 text-xs text-amber-300">{micError}</p>}

        {/* Chat messages - responsive height */}
        <div
          className="mt-3 max-h-[43rem] sm:max-h-[36rem] space-y-3 overflow-y-auto pr-1"
          ref={chatContainerRef}
        >
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
                <p className="mt-1 text-sm leading-6 text-slate-100">
                  {message.content}
                </p>
              </div>
            ))
          )}
        </div>
        {/* Connection status with mute toggle */}
        <div className="flex items-center gap-2">
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
          {/* Mute / Unmute button */}
<button
            type="button"
            onClick={() => {
              const newMuted = !isMuted;
              setIsMuted(newMuted);
              if (newMuted) {
                // Stop any currently playing audio when muting
                stopSpeaking();
                setIsPlaying(false);
                setAssistantAudioLevel(0);
              }
            }}
            className={`ml-auto rounded-full p-1 border-none transition ${
              isPlaying ? "text-lime-200" : "text-green-500/70 hover:text-green-500"
            }`}
            title={isMuted ? "Unmute voice" : "Mute voice"}
            style={{
              opacity: isPlaying ? 0.45 + assistantAudioLevel * 0.55 : 1,
              filter: isPlaying
                ? `drop-shadow(0 0 ${6 + assistantAudioLevel * 14}px rgba(163,230,53,0.45))`
                : "none",
              transform: isPlaying ? `scale(${1 + assistantAudioLevel * 0.08})` : "scale(1)"
            }}
          >
            {isMuted ? <VolumeOff /> : <Volume2 />}
          </button>
        </div>
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
            className="flex-1 rounded-full border border-lime-300/20 bg-black/30 px-3 py-2 text-sm text-lime-100 placeholder-slate-500 outline-none focus:border-lime-300/50"
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
            style={{
              boxShadow: isListening
                ? `0 0 ${22 + micAudioLevel * 20}px ${4 + micAudioVariance * 10}px rgba(178,107,255,${0.14 + micAudioVariance * 0.18}), 0 0 ${34 + micAudioLevel * 34}px ${8 + micAudioVariance * 16}px rgba(158,255,102,${0.14 + micAudioLevel * 0.18})`
                : undefined,
              transform: isListening ? `scale(${1 + micAudioLevel * 0.06})` : "scale(1)"
            }}
          >
            {isListening ? (
              <>
                <span
                  className="absolute h-10 w-10 animate-pulse rounded-full"
                  style={{
                    background:
                      `radial-gradient(circle at 60% 40%, rgba(158,255,102,${0.2 + micAudioLevel * 0.25}) 35%, rgba(178,107,255,${0.16 + micAudioVariance * 0.24}) 100%)`,
                    boxShadow:
                      `0 0 ${24 + micAudioVariance * 22}px ${6 + micAudioVariance * 8}px rgba(178,107,255,${0.12 + micAudioVariance * 0.16}), 0 0 ${40 + micAudioLevel * 30}px ${12 + micAudioLevel * 14}px rgba(158,255,102,${0.12 + micAudioLevel * 0.18})`,
                    opacity: 0.72 + micAudioLevel * 0.28
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
            disabled={!draft.trim()}
            className="flex items-center gap-2 rounded-lg border border-lime-300/20 bg-lime-300/12 px-4 py-2 text-sm font-semibold text-lime-100 transition hover:bg-lime-300/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
