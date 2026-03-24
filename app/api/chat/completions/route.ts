/**
 * POST /api/chat/completions
 * OpenAI-compatible chat completions API backed by Ollama.
 * Falls back gracefully if Ollama is unreachable.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { messages, stream } = body;

  if (!messages || !Array.isArray(messages)) {
    return NextResponse.json({ error: "messages is required" }, { status: 400 });
  }

  // Get workspace AI config
  const { db } = await import("@/lib/db");
  const workspace = await db.workspace.findFirst({
    where: { userId: session.user.id },
    select: { ollamaUrl: true, ollamaModel: true },
  });

  const ollamaUrl = workspace?.ollamaUrl ?? "http://localhost:11434";
  const model = workspace?.ollamaModel ?? "llama3.2";

  // Build Ollama request
  const ollamaMessages = messages.map((m: { role: string; content: string }) => ({
    role: m.role === "assistant" ? "assistant" : m.role === "user" ? "user" : "system",
    content: m.content,
  }));

  try {
    const upstream = await fetch(`${ollamaUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: ollamaMessages, stream: false }),
      signal: AbortSignal.timeout(30000),
    });

    if (!upstream.ok) {
      const err = await upstream.text();
      console.error("[Chat] Ollama error:", upstream.status, err);
      return NextResponse.json(
        { error: `Ollama error: ${upstream.status}`, details: err },
        { status: 502 }
      );
    }

    const data = await upstream.json();

    // Return in OpenAI-compatible format
    return NextResponse.json({
      id: `chatcmpl-${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: data.message?.content ?? "",
          },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: data.prompt_eval_count ?? 0,
        completion_tokens: data.eval_count ?? 0,
        total_tokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Chat] Ollama fetch error:", error.message);
    return NextResponse.json(
      { error: "AI service unavailable", details: error.message },
      { status: 503 }
    );
  }
}
