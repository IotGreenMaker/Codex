import { NextRequest, NextResponse } from "next/server";
import { getAIResponseFromGroq } from "@/lib/groq-ai";
import { saveConversation } from "@/lib/supabase-client";

type RequestBody = {
  message: string;
  plantContext: string;
  plantId: string;
  history?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;
    const { message, plantContext, plantId, history = [] } = body;

    if (!message || !plantId) {
      return NextResponse.json(
        { error: "Missing message or plantId" },
        { status: 400 }
      );
    }

    // Get response from Groq
    const response = await getAIResponseFromGroq(
      message,
      history,
      plantContext
    );

    // Save to Supabase
    await saveConversation(plantId, "user", message);
    await saveConversation(plantId, "assistant", response);

    return NextResponse.json({
      ok: true,
      response: response,
    });
  } catch (error) {
    console.error("Groq API error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
