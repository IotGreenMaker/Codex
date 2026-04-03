import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type ConversationMessage = {
  id: string;
  createdAt: string;
  role: "user" | "assistant";
  content: string;
  source: "text" | "livekit";
  meta?: Record<string, unknown>;
};

export type ConversationState = {
  plantId: string;
  assistantKey: string;
  updatedAt: string;
  messages: ConversationMessage[];
};

const dataDir = path.join(process.cwd(), "g-data");
const conversationsDir = path.join(dataDir, "conversations");

function getConversationFile(plantId: string, assistantKey: string) {
  const safePlant = plantId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeAssistant = assistantKey.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(conversationsDir, `${safePlant}__${safeAssistant}.json`);
}

export async function readConversationState({
  plantId,
  assistantKey
}: {
  plantId: string;
  assistantKey: string;
}): Promise<ConversationState> {
  await mkdir(conversationsDir, { recursive: true });
  const file = getConversationFile(plantId, assistantKey);

  try {
    const raw = await readFile(file, "utf-8");
    const parsed = JSON.parse(raw) as Partial<ConversationState>;
    return {
      plantId,
      assistantKey,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
      messages: Array.isArray(parsed.messages) ? (parsed.messages as ConversationMessage[]) : []
    };
  } catch {
    const initial: ConversationState = {
      plantId,
      assistantKey,
      updatedAt: new Date().toISOString(),
      messages: []
    };
    await writeFile(file, JSON.stringify(initial, null, 2), "utf-8");
    return initial;
  }
}

export async function appendConversationMessages({
  plantId,
  assistantKey,
  messages
}: {
  plantId: string;
  assistantKey: string;
  messages: ConversationMessage[];
}) {
  const current = await readConversationState({ plantId, assistantKey });
  const next: ConversationState = {
    ...current,
    updatedAt: new Date().toISOString(),
    messages: [...current.messages, ...messages].slice(-5)
  };
  const file = getConversationFile(plantId, assistantKey);
  await writeFile(file, JSON.stringify(next, null, 2), "utf-8");
  return next;
}

