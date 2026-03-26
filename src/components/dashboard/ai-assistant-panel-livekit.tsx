"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Volume2 } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { translations } from "@/lib/i18n";
import { applyGrowCommand } from "@/lib/local-llm";
import { speakWithElevenLabs } from "@/lib/elevenlabs-tts";
import type { GrowCommand, PlantProfile } from "@/lib/types";

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
  onPlantUpdate
}: {
  locale: Locale;
  plant: PlantProfile;
  onPlantUpdate: (next: PlantProfile) => void;
}) {
  const t = translations[locale];
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
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

  const handleUserSpeech = async (text: string) => {
    if (!text.trim()) return;

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

    await getAIResponse(text);
  };

  const getAIResponse = async (userMessage: string) => {
    setConnectionState("connecting");
    const assistantId = `assistant-${Date.now()}`;

    try {
      const response = await fetch("/api/local-llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "chat",
          provider: "xai",
          baseUrl: "",
          model: "",
          message: userMessage,
          plant,
          history: messages.map((m) => ({
            role: m.role,
            content: m.content
          }))
        })
      });

      const data = (await response.json()) as {
        ok: boolean;
        assistantMessage?: string;
        command?: GrowCommand;
        error?: string;
      };

      setConnectionState(data.ok ? "connected" : "failed");

      if (data.command && data.command.action !== "none") {
        onPlantUpdate(applyGrowCommand(plant, data.command));
      }

      const assistantMessage =
        data.ok && data.assistantMessage
          ? data.assistantMessage
          : data.error ?? "Assistant request failed.";

      const aiMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: assistantMessage,
        source: "voice",
        model: "grok-4-1-fast / gemini-2.5-flash",
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
          meta: { model: "grok-4-1-fast / gemini-2.5-flash" }
        }
      ]);

      // Read AI response with ElevenLabs voice
      await speakWithElevenLabs(assistantMessage, setIsPlaying);
    } catch (error) {
      setConnectionState("failed");
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
    <div className="rounded-2xl border border-lime-300/14 bg-black/20 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-lime-300/70">
            {t.aiConversation}
          </p>
          <p className="mt-1 text-[11px] text-lime-100/65">Voice Assistant with ElevenLabs Natural Speech</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Voice button */}
          <button
            type="button"
            onClick={toggleMicrophone}
            title={isListening ? "Stop listening" : "Start listening"}
            className={`group relative grid h-16 w-16 place-items-center rounded-full border transition focus:outline-none ${
              isListening
                ? "border-lime-200/80 bg-gradient-to-br from-lime-300/35 via-fuchsia-400/25 to-emerald-300/25 text-lime-100 shadow-[0_0_30px_8px_rgba(178,107,255,0.18),0_0_60px_16px_rgba(158,255,102,0.18)]"
                : "border-lime-300/35 bg-gradient-to-br from-lime-300/18 via-fuchsia-400/10 to-emerald-300/10 text-lime-100 hover:from-lime-300/30 hover:via-fuchsia-400/20 hover:to-emerald-300/20"
            }`}
          >
            {isListening ? (
              <>
                <span
                  className="absolute h-16 w-16 animate-pulse rounded-full"
                  style={{
                    background:
                      "radial-gradient(circle at 60% 40%, rgba(158,255,102,0.22) 40%, rgba(178,107,255,0.18) 100%)",
                    boxShadow:
                      "0 0 40px 12px rgba(178,107,255,0.18), 0 0 80px 24px rgba(158,255,102,0.18)"
                  }}
                />
                <Mic className="relative h-6 w-6 scale-110" />
              </>
            ) : (
              <Mic className="relative h-6 w-6" />
            )}
          </button>

          {/* Speaker indicator */}
          {isPlaying && (
            <div className="animate-pulse">
              <Volume2 className="h-6 w-6 text-lime-300/70" />
            </div>
          )}

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
      </div>

      <div className="mt-4 rounded-2xl border border-white/8 bg-white/5 p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-lime-200">
            Conversation
          </p>
        </div>

        {/* Live transcription */}
        {interimTranscript && (
          <p className="mb-2 text-xs text-lime-300/75 animate-pulse italic">{interimTranscript}</p>
        )}

        {/* Error message */}
        {micError && <p className="mb-2 text-xs text-amber-300">{micError}</p>}

        {/* Chat messages */}
        <div className="mt-3 max-h-80 space-y-3 overflow-y-auto pr-1" ref={chatContainerRef}>
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
                    ? "border-lime-300/60"
                    : "border-white/20"
                }`}
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-400">
                  {message.role === "assistant" ? "🤖 Assistant" : "🎤 You"}{" "}
                  <span className="text-[10px] text-slate-500">
                    {message.source === "voice" ? "Voice" : "Text"}
                  </span>
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-100">{message.content}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick text input (optional) */}
      <div className="mt-4 rounded-2xl border border-white/8 bg-white/5 p-3">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Or type a message..."
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const target = e.currentTarget;
                sendMessage(target.value);
                target.value = "";
              }
            }}
            className="flex-1 rounded-lg border border-lime-300/20 bg-black/30 px-3 py-2 text-sm text-lime-100 placeholder-slate-500 outline-none focus:border-lime-300/50"
          />
          <button
            type="button"
            onClick={(e) => {
              const input = e.currentTarget
                .previousElementSibling as HTMLInputElement;
              if (input) {
                sendMessage(input.value);
                input.value = "";
              }
            }}
            className="rounded-lg border border-lime-300/20 bg-lime-300/12 px-4 py-2 text-sm font-semibold text-lime-100 transition hover:bg-lime-300/20"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
