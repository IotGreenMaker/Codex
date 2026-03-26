/**
 * LiveKit TTS Service - Uses the LiveKit agent bot voice (Jamie) for natural speech
 */

export async function deliverVoiceResponse(
  message: string,
  onPlayingChange?: (isPlaying: boolean) => void
): Promise<void> {
  try {
    onPlayingChange?.(true);

    // Get LiveKit token for the voice session
    const tokenResponse = await fetch("/api/livekit/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomName: `voice-session-${Date.now()}`,
        participantName: "user"
      })
    });

    if (!tokenResponse.ok) {
      throw new Error("Failed to get LiveKit token");
    }

    const { token } = (await tokenResponse.json()) as { token?: string };

    if (!token) {
      throw new Error("No token received");
    }

    // Send voice message to LiveKit agent for TTS delivery
    // This triggers the Jamie bot voice to speak the response
    const voiceUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL?.replace("wss://", "https://") || "";

    if (!voiceUrl) {
      throw new Error("LiveKit URL not configured");
    }

    // Send the message as audio through LiveKit voice service
    const voiceResponse = await fetch(`${voiceUrl}/api/agent/speak`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        text: message,
        agent_name: process.env.NEXT_PUBLIC_LIVEKIT_AGENT_NAME || "Jamie-1a6c",
        agent_id: process.env.NEXT_PUBLIC_LIVEKIT_AGENT_ID || "CA_VTchbF4qrNE9",
        voice: "jamie"
      })
    });

    if (!voiceResponse.ok) {
      // Fallback to browser TTS if LiveKit voice fails
      await fallbackToSpeechSynthesis(message);
    } else {
      // Wait for voice delivery to complete
      const voiceData = await voiceResponse.json() as { duration?: number };
      const duration = (voiceData.duration || 3) * 1000; // Default 3 seconds

      await new Promise((resolve) => setTimeout(resolve, duration));
    }
  } catch (error) {
    console.error("Voice delivery error, falling back to browser TTS:", error);
    try {
      await fallbackToSpeechSynthesis(message);
    } catch (fallbackError) {
      console.error("Fallback TTS also failed:", fallbackError);
    }
  } finally {
    onPlayingChange?.(false);
  }
}

async function fallbackToSpeechSynthesis(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) {
      resolve();
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();

    window.speechSynthesis.speak(utterance);
  });
}
