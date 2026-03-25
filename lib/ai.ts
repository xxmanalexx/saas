const OLLAMA_BASE = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const DEFAULT_MODEL = process.env.AI_MODEL ?? "llama3.2";

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiResponse {
  content: string;
  tokens?: number;
  latencyMs?: number;
}

export interface AiOptions {
  ollamaUrl?: string;
  model?: string;
  temperature?: number;
  timeoutMs?: number;
  thinking?: boolean; // default true; set false to disable extended thinking
}

const DEFAULT_TIMEOUT_MS = 90_000; // 90s — gemma3/large models need more time

export async function aiComplete(
  messages: AiMessage[],
  options?: AiOptions
): Promise<AiResponse> {
  const start = Date.now();
  const url = options?.ollamaUrl ?? OLLAMA_BASE;
  const model = options?.model ?? DEFAULT_MODEL;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  try {
    const res = await fetch(`${url}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        temperature: options?.temperature ?? 0.7,
        stream: false,
        // Keep model loaded for 5 minutes after this request completes
        // so the next message doesn't wait for a cold load
        keep_alive: 5 * 60,
        // Disable extended thinking if user turned it off in settings
        ...(options?.thinking === false && { think: false }),
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      throw new Error(`Ollama error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return {
      content: data.message?.content ?? "",
      tokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    // Return a user-friendly error rather than crashing the conversation
    return {
      content: "عذراً، استغرق الرد وقتاً طويلاً. حاول مرة أخرى.",
      latencyMs: Date.now() - start,
    };
  }
}

export async function aiCompleteSimple(
  prompt: string,
  system?: string,
  options?: AiOptions
): Promise<AiResponse> {
  const messages: AiMessage[] = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });
  return aiComplete(messages, options);
}

export async function* aiStream(
  messages: AiMessage[],
  options?: AiOptions
): AsyncGenerator<string, void, unknown> {
  const url = (options?.ollamaUrl ?? OLLAMA_BASE) + "/api/chat";
  const model = options?.model ?? DEFAULT_MODEL;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: true, keep_alive: 5 * 60, ...(options?.thinking === false && { think: false }) }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
  if (!res.body) throw new Error("No response body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split("\n")) {
        if (!line.trim() || !line.startsWith("{")) continue;
        try {
          const parsed = JSON.parse(line);
          const content = parsed.message?.content;
          if (content) yield content;
        } catch { /* skip invalid JSON lines */ }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
