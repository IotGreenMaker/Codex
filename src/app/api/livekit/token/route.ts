import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";

export async function POST(req: Request) {
  try {
    const { roomName, participantName } = (await req.json()) as {
      roomName?: string;
      participantName?: string;
    };

    if (!roomName || !participantName) {
      return NextResponse.json(
        {
          ok: false,
          error: "roomName and participantName required"
        },
        { status: 400 }
      );
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        {
          ok: false,
          error: "LiveKit credentials not configured"
        },
        { status: 500 }
      );
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantName,
      name: participantName
    });

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true
    });

    return NextResponse.json({
      ok: true,
      token: at.toJwt()
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to generate token"
      },
      { status: 500 }
    );
  }
}

