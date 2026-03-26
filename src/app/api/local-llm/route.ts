import { NextRequest, NextResponse } from "next/server";
import { buildCommandPrompt, fallbackCommandParser, inferLocalLlmProvider, normalizeBaseUrl } from "@/lib/local-llm";
import type { GrowCommand, LocalLlmSettings, PlantProfile } from "@/lib/types";

type ChatBody = {
  mode: "test" | "chat";
  provider?: LocalLlmSettings["provider"];
  baseUrl: string;
  model: string;
  apiKey?: string;
  message?: string;
  plant?: PlantProfile;
  history?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChatBody;
    const resolved = resolveRequestDefaults(body);
    const baseUrl = normalizeBaseUrl(resolved.baseUrl);
    const provider = inferLocalLlmProvider({
      provider: resolved.provider,
      baseUrl
    });

    if (!baseUrl) {
      return NextResponse.json({ ok: false, error: "Missing base URL." }, { status: 400 });
    }

    if (resolved.mode === "test") {
      const data = await fetchModels({ baseUrl, provider, apiKey: resolved.apiKey });
      return NextResponse.json({
        ok: true,
        provider,
        baseUrl,
        model: resolved.model,
        models: data
      });
    }

    if (!resolved.message || !resolved.plant || !resolved.model) {
      return NextResponse.json({ ok: false, error: "Missing chat parameters." }, { status: 400 });
    }

    let parsed: { assistantMessage: string; command: GrowCommand };

    try {
      const content = await sendChat({
        baseUrl,
        provider,
        model: resolved.model,
        apiKey: resolved.apiKey,
        message: resolved.message,
        plant: resolved.plant,
        history: resolved.history ?? []
      });
      parsed = parseLocalLlmResponse(content, resolved.message);
    } catch (error) {
      const isRecoverableCloudFailure =
        provider === "xai" &&
        error instanceof Error &&
        (error.message.includes("401") ||
          error.message.includes("403") ||
          error.message.includes("429") ||
          error.message.toLowerCase().includes("rate limit"));

      if (!isRecoverableCloudFailure) {
        throw error;
      }

      parsed = {
        assistantMessage:
          "Cloud AI is temporarily unavailable, so I switched to local command fallback for this message.",
        command: fallbackCommandParser(resolved.message)
      };
    }

    return NextResponse.json({
      ok: true,
      provider,
      assistantMessage: parsed.assistantMessage,
      command: parsed.command
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown local LLM error."
      },
      { status: 500 }
    );
  }
}

function resolveRequestDefaults(body: ChatBody): ChatBody & {
  provider: LocalLlmSettings["provider"];
  baseUrl: string;
  model: string;
} {
  const envProvider = (process.env.G_BUDDY_LLM_PROVIDER as LocalLlmSettings["provider"] | undefined) ?? "xai";
  const provider = body.provider ?? envProvider;
  const defaultBaseUrl =
    provider === "xai"
      ? process.env.XAI_BASE_URL ?? "https://api.x.ai/v1"
      : process.env.G_BUDDY_LLM_BASE_URL ?? "";
  const defaultModel =
    provider === "xai"
      ? firstConfigured(process.env.XAI_MODELS) ?? process.env.XAI_MODEL ?? "grok-4-1-fast"
      : process.env.G_BUDDY_LLM_MODEL ?? "";

  return {
    ...body,
    provider,
    baseUrl: body.baseUrl?.trim() || defaultBaseUrl,
    model: body.model?.trim() || defaultModel,
    apiKey: body.apiKey?.trim() || (provider === "xai" ? process.env.XAI_API_KEY : process.env.G_BUDDY_LLM_API_KEY)
  };
}

async function fetchModels({
  baseUrl,
  provider,
  apiKey
}: {
  baseUrl: string;
  provider: LocalLlmSettings["provider"];
  apiKey?: string;
}) {
  if (provider === "xai") {
    const keyCandidates = uniqueValues([apiKey, ...splitCsv(process.env.XAI_API_KEYS), process.env.XAI_API_KEY]);
    let lastStatus = 0;

    for (const key of keyCandidates.length ? keyCandidates : [undefined]) {
      const response = await fetch(`${baseUrl}/models`, {
        cache: "no-store",
        headers: {
          ...(key ? { Authorization: `Bearer ${key}` } : {})
        }
      });

      if (response.ok) {
        const data = (await response.json()) as { data?: Array<{ id: string }> };
        return data.data?.map((item) => item.id) ?? [];
      }

      lastStatus = response.status;
      if (response.status !== 401 && response.status !== 403 && response.status !== 429) {
        throw new Error(`Cloud server responded with ${response.status}.`);
      }
    }

    if ((lastStatus === 401 || lastStatus === 403 || lastStatus === 429) && process.env.GOOGLE_AI_API_KEY) {
      return ["gemini-2.5-flash"];
    }
    if (lastStatus === 429) {
      return ["command-fallback"];
    }
    throw new Error(`Cloud server responded with ${lastStatus || 500}.`);
  }

  if (provider === "ollama") {
    const response = await fetch(`${baseUrl}/api/tags`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Local server responded with ${response.status}.`);
    }

    const data = (await response.json()) as {
      models?: Array<{
        name: string;
      }>;
    };

    return data.models?.map((item) => item.name) ?? [];
  }

  const response = await fetch(`${baseUrl}/models`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Local server responded with ${response.status}.`);
  }

  const data = (await response.json()) as { data?: Array<{ id: string }> };
  return data.data?.map((item) => item.id) ?? [];
}

async function sendChat({
  baseUrl,
  provider,
  model,
  apiKey,
  message,
  plant,
  history
}: {
  baseUrl: string;
  provider: LocalLlmSettings["provider"];
  model: string;
  apiKey?: string;
  message: string;
  plant: PlantProfile;
  history: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}) {
  const systemPrompt = buildCommandPrompt(message, plant);
  const trimmedHistory = history.slice(-8);

  if (provider === "ollama") {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        stream: false,
        options: {
          temperature: 0.1
        },
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          ...trimmedHistory,
          {
            role: "user",
            content: message
          }
        ]
      }),
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Chat request failed with ${response.status}.`);
    }

    const data = (await response.json()) as {
      message?: {
        content?: string;
      };
    };

    return data.message?.content?.trim() ?? "";
  }

  const keyCandidates = uniqueValues([apiKey, ...splitCsv(provider === "xai" ? process.env.XAI_API_KEYS : undefined), process.env.XAI_API_KEY]);
  const modelCandidates = uniqueValues([model, ...splitCsv(provider === "xai" ? process.env.XAI_MODELS : undefined)]);
  const modelsToTry = modelCandidates.length ? modelCandidates : [model];
  const keysToTry = keyCandidates.length ? keyCandidates : [undefined];

  let lastStatus = 0;

  for (const candidateModel of modelsToTry) {
    for (const candidateKey of keysToTry) {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(candidateKey ? { Authorization: `Bearer ${candidateKey}` } : {})
        },
        body: JSON.stringify({
          model: candidateModel,
          temperature: 0.1,
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            ...trimmedHistory,
            {
              role: "user",
              content: message
            }
          ]
        }),
        cache: "no-store"
      });

      if (response.ok) {
        const data = (await response.json()) as {
          choices?: Array<{
            message?: {
              content?: string;
            };
          }>;
        };
        return data.choices?.[0]?.message?.content?.trim() ?? "";
      }

      lastStatus = response.status;
      const retryable = response.status === 401 || response.status === 403 || response.status === 429 || response.status >= 500;
      if (!retryable) {
        throw new Error(`Chat request failed with ${response.status}.`);
      }
    }
  }

  if ((lastStatus === 401 || lastStatus === 403 || lastStatus === 429) && process.env.GOOGLE_AI_API_KEY) {
    try {
      return await sendGeminiChat({
        message,
        plant,
        history: trimmedHistory
      });
    } catch (fallbackError) {
      if (fallbackError instanceof Error) {
        throw new Error(`Cloud fallback failed: ${fallbackError.message}`);
      }
      throw new Error("Cloud fallback failed.");
    }
  }

  throw new Error(`Chat request failed with ${lastStatus || 500}.`);
}

async function sendGeminiChat({
  message,
  plant,
  history
}: {
  message: string;
  plant: PlantProfile;
  history: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}) {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GOOGLE_AI_API_KEY.");
  }

  const conversationText = history
    .map((entry) => `${entry.role === "assistant" ? "Assistant" : "User"}: ${entry.content}`)
    .join("\n");

  const prompt = [
    "Return valid JSON only. Do not use markdown fences.",
    "Schema:",
    '{"assistantMessage":"string","command":{"action":"update_active_plant","field":"strainName|stage|startedAt|bloomStartedAt|totalDaysOverride|lightSchedule|lightsOn|lightsOff|containerVolumeL|mediaVolumeL|mediaType|outsideTempC|outsideHumidity|growTempC|growHumidity|waterInputMl|waterPh|waterEc|lastWateredAt|wateringIntervalDays","value":"string|number"} | {"action":"add_watering_event","value":{"timestamp":"optional ISO date","amountMl":"number","ph":"number","ec":"number","runoffPh":"optional number","runoffEc":"optional number"}} | {"action":"add_climate_event","value":{"timestamp":"optional ISO date","tempC":"number","humidity":"number"}} | {"action":"none"}}',
    `Current active plant: ${JSON.stringify(plant)}`,
    conversationText ? `Recent history:\n${conversationText}` : "",
    `User message: ${message}`
  ]
    .filter(Boolean)
    .join("\n\n");

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
    apiKey
  )}`;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.1
        }
      }),
      cache: "no-store"
    });

    if (response.ok) {
      const data = (await response.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{
              text?: string;
            }>;
          };
        }>;
      };

      const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? "";
      return text;
    }

    if (response.status !== 429 || attempt === 1) {
      throw new Error(`Gemini fallback failed with ${response.status}.`);
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error("Gemini fallback failed with 429.");
}

function parseLocalLlmResponse(content: string, originalMessage: string): { assistantMessage: string; command: GrowCommand } {
  const normalized = extractJsonCandidate(content);

  try {
    const parsed = JSON.parse(normalized) as {
      assistantMessage?: string;
      command?: GrowCommand;
    };

    return {
      assistantMessage: parsed.assistantMessage ?? "Local model responded.",
      command: parsed.command ?? { action: "none" }
    };
  } catch {
    return {
      assistantMessage: content || "Local model responded, but the command output was not valid JSON.",
      command: fallbackCommandParser(originalMessage)
    };
  }
}

function extractJsonCandidate(content: string) {
  const trimmed = content.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch?.[1]) {
    return fenceMatch[1].trim();
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  return trimmed;
}

function splitCsv(value?: string) {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function uniqueValues(values: Array<string | undefined>) {
  const set = new Set<string>();
  for (const value of values) {
    if (value?.trim()) {
      set.add(value.trim());
    }
  }
  return [...set];
}

function firstConfigured(value?: string) {
  return splitCsv(value)[0];
}
