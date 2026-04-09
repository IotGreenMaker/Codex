// src/lib/tts.ts
// Client-side TTS helper — calls server proxy at /api/tts

let currentAudio: HTMLAudioElement | null = null;

export async function speak(text: string): Promise<void> {
  if (!text || text.trim().length === 0) return;

  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      console.warn('[TTS] failed:', err);
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
    console.error('[TTS] error:', error);
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