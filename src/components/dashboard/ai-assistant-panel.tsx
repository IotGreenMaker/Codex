"use client";

import { useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { translations } from "@/lib/i18n";
import { applyGrowCommand } from "@/lib/local-llm";
import type { GrowCommand, PlantProfile } from "@/lib/types";

type SpeechRecognitionType = typeof window extends undefined
  ? never
  : {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onresult: ((event: SpeechRecognitionEventLike) => void) | null;
      onerror: ((event: { error: string }) => void) | null;
      onend: (() => void) | null;
      start: () => void;
      stop: () => void;
    };

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: {
      transcript: string;
    };
  }>;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  source?: "text";
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
  const [isListening, setIsListening] = useState(false);
  const [draft, setDraft] = useState("");
  const [micError, setMicError] = useState<string | null>(null);
  const [dictationSupported, setDictationSupported] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [connectionState, setConnectionState] = useState<"idle" | "testing" | "connected" | "failed">("idle");
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll chat container to bottom on new message
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const RecognitionCtor =
      typeof window !== "undefined"
        ? ((window as Window & { SpeechRecognition?: new () => SpeechRecognitionType; webkitSpeechRecognition?: new () => SpeechRecognitionType })
            .SpeechRecognition ??
            (window as Window & { webkitSpeechRecognition?: new () => SpeechRecognitionType }).webkitSpeechRecognition)
        : undefined;

    setDictationSupported(Boolean(RecognitionCtor));
    void testConnection();
    void loadConversation();

    return () => {
      stopListening();
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  async function speakText(text: string) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    window.speechSynthesis.speak(utterance);
  }

  async function testConnection() {
    setConnectionState("testing");
    try {
      const response = await fetch("/api/local-llm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mode: "test",
          provider: "xai",
          baseUrl: "",
          model: ""
        })
      });
      const data = (await response.json()) as { ok: boolean };
      setConnectionState(data.ok ? "connected" : "failed");
    } catch {
      setConnectionState("failed");
    }
  }

  async function startListening() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new window.AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.85;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      mediaStreamRef.current = stream;
      setMicError(null);
      setIsListening(true);

      const RecognitionCtor =
        (window as Window & { SpeechRecognition?: new () => SpeechRecognitionType; webkitSpeechRecognition?: new () => SpeechRecognitionType })
          .SpeechRecognition ??
        (window as Window & { webkitSpeechRecognition?: new () => SpeechRecognitionType }).webkitSpeechRecognition;

      if (RecognitionCtor) {
        const recognition = new RecognitionCtor();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = locale === "pt-BR" ? "pt-BR" : "en-US";
        recognition.onresult = (event) => {
          let finalText = "";
          let liveText = "";

          for (let index = event.resultIndex; index < event.results.length; index += 1) {
            const segment = event.results[index][0]?.transcript ?? "";
            if (event.results[index].isFinal) {
              finalText += segment;
            } else {
              liveText += segment;
            }
          }

          if (finalText.trim()) {
            const merged = `${draft}${draft.trim().length ? " " : ""}${finalText.trim()}`.trim();
            setDraft(merged);
            stopListening();
            void submitTextMessage(merged);
          }
          setInterimTranscript(liveText.trim());
        };
        recognition.onerror = (event) => {
          setMicError(`Speech recognition error: ${event.error}.`);
        };
        recognition.onend = () => {
          recognitionRef.current = null;
          setInterimTranscript("");
          stopListening();
        };
        recognitionRef.current = recognition;
        recognition.start();
      }
    } catch {
      setMicError("Microphone permission is required to display live audio feedback.");
      setIsListening(false);
    }
  }

  function stopListening() {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    if (frameRef.current) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    setIsListening(false);
    setInterimTranscript("");
  }

  async function toggleListening() {
    if (isListening) {
      stopListening();
      return;
    }

    await startListening();
  }

  async function submitTextMessage(forced?: string) {
    const cleaned = (forced ?? draft).trim();

    if (!cleaned) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: cleaned,
      source: "text",
      createdAt: new Date().toISOString()
    };
    const assistantId = `assistant-${Date.now()}`;
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    void persistMessages([
      {
        id: userMessage.id,
        createdAt: userMessage.createdAt ?? new Date().toISOString(),
        role: userMessage.role,
        content: userMessage.content,
        source: "text"
      }
    ]);
    setDraft("");
    setConnectionState("testing");

    try {
      const response = await fetch("/api/local-llm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mode: "chat",
          provider: "xai",
          baseUrl: "",
          model: "",
          message: cleaned,
          plant,
          history: nextMessages.map((entry) => ({
            role: entry.role,
            content: entry.content
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
        data.ok && data.assistantMessage ? data.assistantMessage : data.error ?? "Assistant request failed.";

      setMessages((current) => [
        ...current,
        {
          id: assistantId,
          role: "assistant",
          model: "grok-4-1-fast / gemini-2.5-flash",
          content: assistantMessage,
          source: "text",
          createdAt: new Date().toISOString()
        }
      ]);
      void persistMessages([
        {
          id: assistantId,
          createdAt: new Date().toISOString(),
          role: "assistant",
          content: assistantMessage,
          source: "text",
          meta: { model: "grok-4-1-fast / gemini-2.5-flash" }
        }
      ]);

      // Auto-read AI response
      await speakText(assistantMessage);

    } catch (error) {
      setConnectionState("failed");
      setMessages((current) => [
        ...current,
        {
          id: assistantId,
          role: "assistant",
          model: "assistant",
          content: error instanceof Error ? error.message : "Assistant request failed.",
          source: "text",
          createdAt: new Date().toISOString()
        }
      ]);
      void persistMessages([
        {
          id: assistantId,
          createdAt: new Date().toISOString(),
          role: "assistant",
          content: error instanceof Error ? error.message : "Assistant request failed.",
          source: "text",
          meta: { error: true }
        }
      ]);
    }
  }

  async function loadConversation() {
    try {
      const response = await fetch(`/api/conversations?plantId=${encodeURIComponent(plant.id)}&assistantKey=text`, {
        cache: "no-store"
      });
      const data = (await response.json()) as { ok: boolean; state?: { messages?: Array<{ id: string; role: "user" | "assistant"; content: string; source: "text"; createdAt: string; meta?: Record<string, unknown> }> } };
      if (!data.ok) return;
      const restored = (data.state?.messages ?? []).map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        source: msg.source,
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
      source: "text";
      meta?: Record<string, unknown>;
    }>
  ) {
    try {
      await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plantId: plant.id, assistantKey: "text", messages: payload })
      });
    } catch {
      // ignore
    }
  }

  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-lime-300/70">{t.aiConversation}</p>
          <p className="mt-1 text-[11px] text-lime-100/65">Dictation + Grok with Gemini fallback</p>
        </div>
        <button
          type="button"
          onClick={() => void toggleListening()}
          disabled={!dictationSupported}
          title={isListening ? "Stop dictation" : "Start dictation"}
          className={`group relative grid h-16 w-16 place-items-center rounded-full border transition focus:outline-none ${
            !dictationSupported
              ? "cursor-not-allowed border-lime-300/12 bg-black/40 text-slate-500"
              : isListening
                ? "border-lime-200/80 bg-gradient-to-br from-lime-300/35 via-fuchsia-400/25 to-emerald-300/25 text-lime-100 shadow-[0_0_30px_8px_rgba(178,107,255,0.18),0_0_60px_16px_rgba(158,255,102,0.18)]"
                : "border-lime-300/35 bg-gradient-to-br from-lime-300/18 via-fuchsia-400/10 to-emerald-300/10 text-lime-100 hover:from-lime-300/30 hover:via-fuchsia-400/20 hover:to-emerald-300/20"
          }`}
        >
          {isListening ? (
            <span className="absolute h-16 w-16 animate-pulse rounded-full" style={{
              background: "radial-gradient(circle at 60% 40%, rgba(158,255,102,0.22) 40%, rgba(178,107,255,0.18) 100%)",
              boxShadow: "0 0 40px 12px rgba(178,107,255,0.18), 0 0 80px 24px rgba(158,255,102,0.18)"
            }} />
          ) : null}
          <Mic className={`relative h-6 w-6 ${isListening ? "scale-110" : ""}`} />
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-white/8 bg-white/5 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-lime-200">Transcription</p>
          <span
            className={`rounded-full px-2 py-1 text-[11px] ${
              connectionState === "connected"
                ? "bg-lime-300/14 text-lime-100"
                : connectionState === "failed"
                  ? "bg-red-400/12 text-red-100"
                  : connectionState === "testing"
                    ? "bg-white/10 text-slate-200"
                    : "bg-white/6 text-slate-400"
            }`}
            title="Text assistant connectivity (Grok with Gemini fallback)"
          >
            {connectionState}
          </span>
        </div>

        {interimTranscript ? (
          <p className="mt-2 text-xs text-lime-300/75 animate-pulse">{interimTranscript}</p>
        ) : null}
        {micError ? <p className="mt-2 text-xs text-amber-300">{micError}</p> : null}

        <div className="mt-3 max-h-screen space-y-2 overflow-y-auto pr-1" ref={chatContainerRef}>
          {messages.map((message) => (
            <div
              key={message.id}
              className={`border-l-2 pl-3 ${
                message.role === "assistant" ? "border-white/8" : "border-white/20"
              }`}
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-400">
                {message.role === "assistant" ? "Bot" : "You"}{" "}
                <span className="text-[10px] text-slate-500">Text</span>
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-100">{message.content}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
