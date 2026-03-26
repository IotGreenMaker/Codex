/**
 * ElevenLabs Text-to-Speech Service
 * Reads messages with natural voice
 */

export async function speakWithElevenLabs(
  text: string,
  onPlayingChange?: (isPlaying: boolean) => void
): Promise<void> {
  try {
    if (!text.trim()) return;

    onPlayingChange?.(true);

    const apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
    const voiceId = process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb";

    if (!apiKey) {
      console.warn("ElevenLabs API key not configured");
      onPlayingChange?.(false);
      return;
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.8
          }
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("ElevenLabs API error:", error);
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
    console.error("ElevenLabs TTS error:", error);
    onPlayingChange?.(false);
  }
}
