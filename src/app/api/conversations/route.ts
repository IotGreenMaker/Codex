import { NextRequest, NextResponse } from "next/server";
import { getChatMessages, saveAndTruncateChatMessage } from "@/lib/indexeddb-storage";
import type { ChatMessageEntry } from "@/lib/indexeddb-storage";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const plantId = searchParams.get("plantId") || "global";
    
    // Fetch messages from IndexedDB
    const messages = await getChatMessages(plantId, 20); // Get last 20 messages
    
    // Transform to expected response format
    const transformedMessages = messages.map((msg) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      source: msg.source,
      createdAt: msg.createdAt,
      meta: msg.model ? { model: msg.model } : undefined
    }));

    return NextResponse.json({ 
      ok: true, 
      state: { 
        messages: transformedMessages 
      } 
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to load conversation" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      plantId?: string;
      messages: Array<{
        id: string;
        createdAt: string;
        role: "user" | "assistant";
        content: string;
        source: "text" | "voice";
        meta?: Record<string, unknown>;
      }>;
    };

    const plantId = body.plantId || "global";

    if (!Array.isArray(body.messages)) {
      return NextResponse.json(
        { ok: false, error: "Invalid request body. Required: messages" },
        { status: 400 }
      );
    }

    // Save each message to IndexedDB
    for (const msg of body.messages) {
      const chatMessage: ChatMessageEntry = {
        id: msg.id,
        plantId,
        role: msg.role,
        content: msg.content,
        source: msg.source,
        createdAt: msg.createdAt,
        model: msg.meta?.model as string | undefined
      };
      
      await saveAndTruncateChatMessage(chatMessage, 20);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to save conversation" },
      { status: 500 }
    );
  }
}
