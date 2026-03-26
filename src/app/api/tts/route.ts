import { NextRequest, NextResponse } from "next/server";

type Body = {
  text?: string;
  voiceId?: string;
  modelId?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Body;
    const text = body.text?.trim();
    if (!text) {
      return NextResponse.json({ ok: false, error: "Missing text." }, { status: 400 });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "Missing ELEVENLABS_API_KEY." }, { status: 500 });
    }

    const voiceId = body.voiceId?.trim() || process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb";
    const modelId = body.modelId?.trim() || process.env.ELEVENLABS_MODEL_ID || "eleven_v3";

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg"
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        output_format: "mp3_44100_128"
      }),
      cache: "no-store"
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        {
          ok: false,
          error: `ElevenLabs request failed with ${response.status}.`,
          detail: errorText.slice(0, 280)
        },
        { status: 502 }
      );
    }

    const audio = Buffer.from(await response.arrayBuffer());
    return new NextResponse(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown ElevenLabs TTS error." },
      { status: 500 }
    );
  }
}
