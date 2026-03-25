/**
 * Whisper-based audio transcription using Ollama (if whisper model available)
 * or returning a fallback message asking the user to type.
 */

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const WHISPER_MODEL = "whisper"; // model name to pull if not available

export interface TranscriptionResult {
  text: string;
  success: boolean;
  error?: string;
}

async function ensureWhisperModel(): Promise<boolean> {
  try {
    const tagsRes = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!tagsRes.ok) return false;
    const tags = await tagsRes.json();
    const hasWhisper = (tags.models ?? []).some((m: { name: string }) => m.name.startsWith("whisper"));
    if (hasWhisper) return true;

    // Try to pull the whisper model
    console.log("[Whisper] Pulling whisper model...");
    const pullRes = await fetch(`${OLLAMA_BASE}/api/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: WHISPER_MODEL }),
      signal: AbortSignal.timeout(300_000), // 5 min timeout for pull
    });
    return pullRes.ok;
  } catch (err) {
    console.error("[Whisper] Model check/pull error:", err);
    return false;
  }
}

export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string
): Promise<TranscriptionResult> {
  try {
    const hasModel = await ensureWhisperModel();
    if (!hasModel) {
      return {
        success: false,
        error: "Whisper model not installed. Please install it by running: ollama pull whisper",
        text: "",
      };
    }

    // Convert to base64 for Ollama
    const base64Audio = audioBuffer.toString("base64");
    const formData = {
      model: WHISPER_MODEL,
      file: `data:${mimeType};base64,${base64Audio}`,
    };

    const res = await fetch(`${OLLAMA_BASE}/api/transcribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `Transcription failed: ${errText}`, text: "" };
    }

    const data = await res.json();
    return { success: true, text: data.text ?? "" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Whisper] Transcription error:", message);
    return { success: false, error: message, text: "" };
  }
}
