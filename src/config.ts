import fs from "node:fs";
import path from "node:path";

/** Tiny .env loader (no dependency). Real environment variables win. */
function loadDotEnv() {
  const file = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (!m || line.trim().startsWith("#")) continue;
    const value = m[2].replace(/^["']|["']$/g, "");
    if (process.env[m[1]] === undefined && value !== "") process.env[m[1]] = value;
  }
}
loadDotEnv();

export const config = {
  dataDir: path.resolve(process.cwd(), "data"),
  openRouterKey: process.env.OPENROUTER_API_KEY ?? "",
  openRouterModel: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini",
  openRouterBaseUrl: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
  /** Same value the original project uses for OpenRouter answers. */
  aiConfidence: 0.6,
  /** Below this an AI answer is not learned as a conceptual memory. */
  aiLearnThreshold: 0.5,
  /** Conceptual match must reach this total score to count as an answer. */
  conceptualThreshold: 0.65,
  get aiEnabled() {
    return this.openRouterKey.length > 0;
  },
};
