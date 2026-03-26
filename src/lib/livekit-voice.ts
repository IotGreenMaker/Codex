import { Room, RoomEvent, AudioTrack, Participant, TrackEvent } from "livekit-client";

export interface VoiceCallbacks {
  onTranscript?: (text: string, isFinal: boolean) => void;
  onAudioTrack?: (track: any, participant: any) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Error) => void;
}

export class LiveKitVoiceService {
  private room: Room | null = null;
  private callbacks: VoiceCallbacks = {};
  private localAudioTrack: AudioTrack | null = null;

  async connect(
    url: string,
    token: string,
    callbacks: VoiceCallbacks
  ): Promise<void> {
    try {
      this.callbacks = callbacks;

      this.room = new Room({
        dynacast: true,
        adaptiveStream: true,
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Add event listeners
      this.room.on(RoomEvent.Connected, () => {
        this.callbacks.onConnected?.();
      });

      this.room.on(RoomEvent.Disconnected, () => {
        this.callbacks.onDisconnected?.();
      });

      this.room.on(RoomEvent.TrackSubscribed, (track, participant) => {
        if (track.kind === "audio") {
          this.callbacks.onAudioTrack?.(track, participant);
          // Attach audio to hidden element for playback
          const audio = document.createElement("audio");
          audio.autoplay = true;
          (audio as any).playsinline = true;
          track.attach(audio);
          document.body.appendChild(audio);
        }
      });

      this.room.on(RoomEvent.ParticipantMetadataChanged, (metadata, participant) => {
        // Handle incoming AI transcripts/responses
        if (typeof metadata === "string") {
          try {
            const data = JSON.parse(metadata);
            if (data.type === "transcript" && data.text) {
              this.callbacks.onTranscript?.(data.text, data.isFinal ?? false);
            }
          } catch {
            // Ignore parse errors
          }
        }
      });

      // Connect to LiveKit room
      await this.room.connect(url, token);

      // Publish local audio
      await this.room.localParticipant.setMicrophoneEnabled(true);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.callbacks.onError?.(err);
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    if (this.room) {
      await this.room.disconnect();
      this.room = null;
    }
  }

  toggleMicrophone(enabled: boolean): void {
    if (this.room && this.room.localParticipant) {
      this.room.localParticipant.setMicrophoneEnabled(enabled);
    }
  }

  isMicrophoneEnabled(): boolean {
    return this.room?.localParticipant?.isMicrophoneEnabled ?? false;
  }

  getRoom(): Room | null {
    return this.room;
  }

  async sendMessage(message: string): Promise<void> {
    if (!this.room) return;

    const encoder = new TextEncoder();
    const data = encoder.encode(
      JSON.stringify({
        type: "user_message",
        text: message,
        timestamp: Date.now()
      })
    );

    await this.room.localParticipant.publishData(data, {
      topic: "conversation"
    });
  }
}

export const livekitVoiceService = new LiveKitVoiceService();
