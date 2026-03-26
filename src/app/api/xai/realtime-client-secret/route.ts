import { NextRequest, NextResponse } from "next/server";

type ClientSecretBody = {
  expires_after?: {
    seconds?: number;
  };
  session?: Record<string, unknown> | null;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ClientSecretBody;
    const apiKey = process.env.XAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "Missing XAI_API_KEY on server." }, { status: 500 });
    }

    const requestedSeconds = body.expires_after?.seconds ?? 300;
    const safeSeconds = Math.max(60, Math.min(3600, requestedSeconds));

    const response = await fetch("https://api.x.ai/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        expires_after: {
          seconds: safeSeconds
        },
        session: body.session ?? null
      }),
      cache: "no-store"
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { ok: false, error: `Realtime auth failed with ${response.status}.`, details: errorText },
        { status: response.status }
      );
    }

    const data = (await response.json()) as {
      value: string;
      expires_at: number;
    };

    return NextResponse.json({
      ok: true,
      value: data.value,
      expires_at: data.expires_at
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown realtime auth error."
      },
      { status: 500 }
    );
  }
}
