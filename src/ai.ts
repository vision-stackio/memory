import { config } from "./config";

export interface AIResult {
  success: boolean;
  text: string;
  confidence: number;
  model: string;
  error?: string;
}

/** Last resort. Output is candidate information, never auto-verified truth. */
export async function aiFallback(query: string): Promise<AIResult> {
  if (!config.aiEnabled) {
    return { success: false, text: "", confidence: 0, model: "none", error: "OPENROUTER_API_KEY is not set (copy .env.example to .env)." };
  }
  try {
    const res = await fetch(`${config.openRouterBaseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.openRouterKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.openRouterModel,
        messages: [
          { role: "system", content: "You are the knowledge fallback for a small robot. Answer briefly (max 3 sentences). If you are not sure, say so." },
          { role: "user", content: query },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenRouter request failed: HTTP ${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) throw new Error("OpenRouter returned an empty answer.");
    return { success: true, text, confidence: config.aiConfidence, model: config.openRouterModel };
  } catch (err) {
    return { success: false, text: "", confidence: 0, model: config.openRouterModel, error: (err as Error).message };
  }
}
