// src/lib/tts.ts
// Client-side TTS helper — calls server proxy at /api/tts

let currentAudio: HTMLAudioElement | null = null;

export async function speak(
  text: string, 
  options?: { apiKey?: string; provider?: "inworld" | "elevenlabs" | "browser" }
): Promise<void> {
  if (!text || text.trim().length === 0) return;

  const provider = options?.provider || "inworld";

  // Handle Browser Native TTS directly
  if (provider === "browser") {
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => resolve();
      utterance.onerror = (err) => {
        console.error('[TTS] Browser speech error:', err);
        resolve();
      };
      window.speechSynthesis.speak(utterance);
    });
  }

  // Try server-side TTS (Inworld, ElevenLabs, etc.)
  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        text,
        apiKey: options?.apiKey
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      console.warn('[TTS] Server TTS failed:', err);
      console.error('[TTS] No fallback to browser TTS as per configuration');
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    currentAudio = audio;

    audio.onended = () => {
      URL.revokeObjectURL(url);
      currentAudio = null;
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      currentAudio = null;
    };

    await audio.play().catch((err) => {
      console.error('[TTS] playback error:', err);
      URL.revokeObjectURL(url);
      currentAudio = null;
    });
  } catch (error) {
    console.error('[TTS] Server TTS error:', error);
    console.error('[TTS] No fallback to browser TTS as per configuration');
    return;
  }
}

export function stopSpeaking(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = '';
    currentAudio = null;
  }
}

export function isSpeaking(): boolean {
  return currentAudio !== null && !currentAudio.paused;
}