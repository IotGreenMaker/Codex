import { NextRequest, NextResponse } from "next/server";
import { getAIResponseFromGroq } from "@/lib/groq-ai";

type RequestBody = {
  message: string;
  plantContext: string;
  plantId: string;
  apiKey?: string;
  history?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
};

// Simple in-memory rate limiting for testing
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const MAX_REQUESTS_PER_DAY = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

function getRateLimitKey(request: NextRequest): string {
  // Use IP or a default key for rate limiting
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0] ?? "anonymous";
  return ip;
}

function checkRateLimit(key: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetTime) {
    // Reset or create new entry
    rateLimitMap.set(key, { count: 1, resetTime: now + DAY_MS });
    return { allowed: true, remaining: MAX_REQUESTS_PER_DAY - 1 };
  }

  if (entry.count >= MAX_REQUESTS_PER_DAY) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: MAX_REQUESTS_PER_DAY - entry.count };
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitKey = getRateLimitKey(request);
    const { allowed, remaining } = checkRateLimit(rateLimitKey);

    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again tomorrow." },
        { status: 429 }
      );
    }

    const body = (await request.json()) as RequestBody;
    const { message, plantContext, plantId, apiKey, history = [] } = body;

    if (!message || !plantId) {
      return NextResponse.json(
        { error: "Missing message or plantId" },
        { status: 400 }
      );
    }

    // Get response from Groq (plantContext is already built by the caller)
    const response = await getAIResponseFromGroq(
      message,
      history,
      plantContext,
      apiKey
    );

    return NextResponse.json({
      ok: true,
      response: response,
      remainingRequests: remaining,
    });
  } catch (error) {
    console.error("Groq API error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      error
    });
    
    // Check for specific error types if possible (e.g. 401 Unauthorized)
    const status = (error as any)?.status || 500;
    
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: status >= 400 && status < 600 ? status : 500 }
    );
  }
}
