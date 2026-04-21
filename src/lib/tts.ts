// src/lib/tts.ts
// Client-side TTS helper - calls server proxy at /api/tts

type SpeakOptions = {
  apiKey?: string;
  provider?: "inworld" | "elevenlabs" | "browser";
  onStart?: () => void;
  onEnd?: () => void;
  onAudioLevel?: (level: number) => void;
};

let currentAudio: HTMLAudioElement | null = null;
let currentCleanup: (() => void) | null = null;

function clearCurrentPlayback() {
  currentCleanup?.();
  currentCleanup = null;
  currentAudio = null;
}

function createAudioLevelTracker(
  audio: HTMLAudioElement,
  onAudioLevel?: (level: number) => void
) {
  if (!onAudioLevel) {
    return () => {};
  }

  const AudioContextCtor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextCtor) {
    onAudioLevel(0.55);
    return () => onAudioLevel(0);
  }

  const audioContext = new AudioContextCtor();
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.72;

  const source = audioContext.createMediaElementSource(audio);
  source.connect(analyser);
  analyser.connect(audioContext.destination);

  const buffer = new Uint8Array(analyser.frequencyBinCount);
  let frameId = 0;

  const tick = () => {
    analyser.getByteFrequencyData(buffer);
    const average = buffer.reduce((sum, value) => sum + value, 0) / Math.max(buffer.length, 1);
    onAudioLevel(Math.min(1, average / 110));
    frameId = window.requestAnimationFrame(tick);
  };

  void audioContext.resume().catch(() => {});
  tick();

  return () => {
    window.cancelAnimationFrame(frameId);
    onAudioLevel(0);
    source.disconnect();
    analyser.disconnect();
    void audioContext.close().catch(() => {});
  };
}

function createSpeechPulse(onAudioLevel?: (level: number) => void) {
  if (!onAudioLevel) {
    return () => {};
  }

  let phase = 0;
  const intervalId = window.setInterval(() => {
    phase += 0.38;
    const level = 0.3 + ((Math.sin(phase) + 1) / 2) * 0.5;
    onAudioLevel(level);
  }, 90);

  return () => {
    window.clearInterval(intervalId);
    onAudioLevel(0);
  };
}

export async function speak(text: string, options?: SpeakOptions): Promise<void> {
  if (!text || text.trim().length === 0) return;

  const provider = options?.provider || "inworld";
  stopSpeaking();
  options?.onStart?.();

  if (provider === "browser") {
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      currentCleanup = createSpeechPulse(options?.onAudioLevel);

      utterance.onend = () => {
        clearCurrentPlayback();
        options?.onEnd?.();
        resolve();
      };

      utterance.onerror = (err) => {
        console.error("[TTS] Browser speech error:", err);
        clearCurrentPlayback();
        options?.onEnd?.();
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  }

  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        apiKey: options?.apiKey
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Unknown error" }));
      console.warn("[TTS] Server TTS failed:", err);
      console.error("[TTS] No fallback to browser TTS as per configuration");
      options?.onEnd?.();
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    currentAudio = audio;
    currentCleanup = createAudioLevelTracker(audio, options?.onAudioLevel);

    audio.onended = () => {
      URL.revokeObjectURL(url);
      clearCurrentPlayback();
      options?.onEnd?.();
    };

    audio.onerror = () => {
      URL.revokeObjectURL(url);
      clearCurrentPlayback();
      options?.onEnd?.();
    };

    await audio.play().catch((err) => {
      console.error("[TTS] playback error:", err);
      URL.revokeObjectURL(url);
      clearCurrentPlayback();
      options?.onEnd?.();
    });
  } catch (error) {
    console.error("[TTS] Server TTS error:", error);
    console.error("[TTS] No fallback to browser TTS as per configuration");
    options?.onEnd?.();
  }
}

export function stopSpeaking(): void {
  window.speechSynthesis.cancel();

  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = "";
  }

  clearCurrentPlayback();
}

export function isSpeaking(): boolean {
  return currentAudio !== null && !currentAudio.paused;
}
