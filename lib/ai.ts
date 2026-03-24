const OLLAMA_BASE = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const MODEL = process.env.AI_MODEL ?? "llama3.2";

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiResponse {
  content: string;
  tokens?: number;
  latencyMs?: number;
}

export async function aiComplete(
  messages: AiMessage[],
  options?: { model?: string; temperature?: number }
): Promise<AiResponse> {
  const start = Date.now();
  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: options?.model ?? MODEL,
      messages,
      temperature: options?.temperature ?? 0.7,
      stream: false,
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return {
    content: data.message?.content ?? "",
    tokens: data.prompt_eval_count + data.eval_count,
    latencyMs: Date.now() - start,
  };
}

export async function aiCompleteSimple(
  prompt: string,
  system?: string
): Promise<AiResponse> {
  const messages: AiMessage[] = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });
  return aiComplete(messages);
}
