import { StaticMemory } from "./staticMemory";
import { DynamicMemory } from "./dynamicMemory";
import { ConceptualMemory } from "./conceptualMemory";
import { aiFallback } from "./ai";
import { config } from "./config";
import type { LookupResult, TraceStep, VisualFeatures } from "./types";

/**
 * Priority chain, stopping at the first layer that can answer:
 *   1. STATIC   2. VERIFIED DYNAMIC   3. CONCEPTUAL   4. AI (last resort)
 *
 * `getFeatures` is only called if the search actually reaches the
 * conceptual layer, so the terminal only asks for a description when needed.
 */
export class MemoryManager {
  constructor(
    public staticMemory = new StaticMemory(),
    public dynamicMemory = new DynamicMemory(),
    public conceptualMemory = new ConceptualMemory()
  ) {}

  async lookup(query: string, getFeatures: () => Promise<VisualFeatures | undefined>): Promise<LookupResult> {
    const trace: TraceStep[] = [];
    const done = (r: Omit<LookupResult, "trace" | "learnedConcept"> & { learnedConcept?: boolean }): LookupResult => ({
      learnedConcept: false,
      ...r,
      trace,
    });

    // 1. STATIC
    const s = this.staticMemory.search(query);
    if (s.length > 0) {
      trace.push({ layer: "STATIC", outcome: "hit", note: `${s.length} record(s)` });
      return done({
        source: "STATIC",
        confidence: 1,
        answer: s.map((r) => `- ${r.title}: ${r.content}`).join("\n"),
      });
    }
    trace.push({ layer: "STATIC", outcome: "miss", note: "not found" });

    // 2. DYNAMIC (verified only)
    const d = this.dynamicMemory.searchVerified(query);
    if (d.length > 0) {
      trace.push({ layer: "DYNAMIC", outcome: "hit", note: `${d.length} verified record(s)` });
      return done({
        source: "DYNAMIC",
        confidence: 0.85,
        answer: d.map((r) => `- ${r.title}: ${r.content}  (source: ${r.source}, id ${r.id})`).join("\n"),
      });
    }
    const pending = this.dynamicMemory.searchNotVerified(query);
    trace.push({
      layer: "DYNAMIC",
      outcome: "miss",
      note: pending.length
        ? `${pending.length} match(es) exist but are not VERIFIED (${pending.map((p) => `${p.id}:${p.verificationStatus}`).join(", ")}) - use :verify <id>`
        : "not found",
    });

    // 3. CONCEPTUAL (needs a description of what it looks like)
    // Always offer the description step: it is what lets a first concept be learned.
    const features = await getFeatures();
    if (this.conceptualMemory.all().length === 0) {
      trace.push({
        layer: "CONCEPTUAL",
        outcome: "skipped",
        note: features ? "no concepts stored yet (description kept so the AI answer can teach it)" : "no concepts stored yet",
      });
    } else if (!features) {
      trace.push({ layer: "CONCEPTUAL", outcome: "skipped", note: "no description given" });
    } else {
      const c = this.conceptualMemory.compare(features);
      if (c.sufficient && c.best) {
        trace.push({ layer: "CONCEPTUAL", outcome: "hit", note: `score ${c.best.totalScore.toFixed(2)} >= ${config.conceptualThreshold}` });
        return done({
          source: "CONCEPTUAL",
          confidence: c.best.confidence,
          answer:
            `Looks like "${c.best.candidateName}" (score ${c.best.totalScore.toFixed(2)}).\n` +
            `  matching: ${c.best.matchingFeatures.join(", ") || "none"}\n` +
            `  conflicting: ${c.best.conflictingFeatures.join(", ") || "none"}`,
        });
      }
      trace.push({
        layer: "CONCEPTUAL",
        outcome: "miss",
        note: c.best ? `best "${c.best.candidateName}" scored ${c.best.totalScore.toFixed(2)} < ${config.conceptualThreshold}` : "nothing to compare",
      });
    }

    // 4. AI fallback
    const ai = await aiFallback(query);
    if (!ai.success) {
      trace.push({ layer: "AI", outcome: "miss", note: ai.error ?? "failed" });
      return done({ source: "NONE", confidence: 0, answer: "No layer could answer this." });
    }
    trace.push({ layer: "AI", outcome: "hit", note: `model ${ai.model}` });

    // Learn: a good-enough AI answer for something we could describe becomes a concept.
    let learnedConcept = false;
    if (features && ai.confidence >= config.aiLearnThreshold) {
      this.conceptualMemory.add(query, features);
      learnedConcept = true;
    }
    return done({ source: "AI", confidence: ai.confidence, answer: ai.text, aiText: ai.text, learnedConcept });
  }
}
