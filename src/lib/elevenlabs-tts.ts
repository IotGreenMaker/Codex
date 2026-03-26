/**
 * ElevenLabs Text-to-Speech Service (via /api/tts proxy)
 * Reads messages with natural voice using server-side proxy
 */

export async function speakWithElevenLabs(
  text: string,
  onPlayingChange?: (isPlaying: boolean) => void
): Promise<void> {
  try {
    if (!text.trim()) return;

    onPlayingChange?.(true);

    const response = await fetch("/api/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      console.error("TTS API error:", error);
      onPlayingChange?.(false);
      return;
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);

    audio.onended = () => {
      onPlayingChange?.(false);
      URL.revokeObjectURL(audioUrl);
    };

    audio.onerror = () => {
      onPlayingChange?.(false);
      URL.revokeObjectURL(audioUrl);
    };

    audio.play().catch((err) => {
      console.error("Audio playback error:", err);
      onPlayingChange?.(false);
      URL.revokeObjectURL(audioUrl);
    });
  } catch (error) {
    console.error("TTS error:", error);
    onPlayingChange?.(false);
  }
}
