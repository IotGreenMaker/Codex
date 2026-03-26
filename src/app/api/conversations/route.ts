import { NextRequest, NextResponse } from "next/server";
import { appendConversationMessages, readConversationState } from "@/lib/conversations-store";
import type { ConversationMessage } from "@/lib/conversations-store";

type GetQuery = {
  plantId?: string;
  assistantKey?: string;
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const plantId = searchParams.get("plantId")?.trim() ?? "";
    const assistantKey = searchParams.get("assistantKey")?.trim() ?? "";
    if (!plantId || !assistantKey) {
      return NextResponse.json({ ok: false, error: "Missing plantId or assistantKey." }, { status: 400 });
    }
    const state = await readConversationState({ plantId, assistantKey });
    return NextResponse.json({ ok: true, state });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to read conversation." },
      { status: 500 }
    );
  }
}

type PostBody = {
  plantId?: string;
  assistantKey?: string;
  messages?: ConversationMessage[];
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PostBody;
    const plantId = body.plantId?.trim() ?? "";
    const assistantKey = body.assistantKey?.trim() ?? "";
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (!plantId || !assistantKey || !messages.length) {
      return NextResponse.json({ ok: false, error: "Missing plantId, assistantKey, or messages." }, { status: 400 });
    }
    const next = await appendConversationMessages({ plantId, assistantKey, messages });
    return NextResponse.json({ ok: true, state: next });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to write conversation." },
      { status: 500 }
    );
  }
}

