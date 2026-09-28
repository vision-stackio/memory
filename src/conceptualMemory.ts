import { randomUUID } from "node:crypto";
import type { ConceptualCandidate, SimilarityResult, VisualFeatures } from "./types";
import { readJson, writeJson } from "./store";
import { config } from "./config";

const FILE = "conceptual.json";

function scalarScore(a?: number, b?: number, tolerance = 0.25): number {
  if (a === undefined || b === undefined) return 0;
  const diff = Math.abs(a - b) / Math.max(a, b, 1e-6);
  return Math.max(0, 1 - diff / tolerance);
}

function categoricalScore(a?: string, b?: string): number {
  if (!a || !b) return 0;
  return a.toLowerCase() === b.toLowerCase() ? 1 : 0;
}

function compareFeatures(a: VisualFeatures, b: VisualFeatures) {
  return {
    shapeScore: categoricalScore(a.shape, b.shape),
    colourScore: categoricalScore(a.primaryColour, b.primaryColour),
    sizeScore: scalarScore(a.dimensions?.width, b.dimensions?.width),
    appearanceScore: categoricalScore(a.texture, b.texture),
    contextScore: 0.5, // needs scene context; defaulted
    featureScore: scalarScore(a.aspectRatio, b.aspectRatio, 0.15),
    semanticScore: 0.5, // needs semantic embeddings; defaulted
  };
}

const WEIGHTS: Record<string, number> = {
  shapeScore: 0.2,
  colourScore: 0.15,
  sizeScore: 0.15,
  appearanceScore: 0.15,
  contextScore: 0.1,
  featureScore: 0.15,
  semanticScore: 0.1,
};

/**
 * Conceptual memory: compares something by appearance against concepts
 * seen before, when there is no exact static/dynamic match.
 */
export class ConceptualMemory {
  private candidates: ConceptualCandidate[];

  constructor() {
    this.candidates = readJson<ConceptualCandidate[]>(FILE, []);
  }

  add(name: string, features: VisualFeatures): ConceptualCandidate {
    const c = { id: randomUUID().slice(0, 8), name, features };
    this.candidates.push(c);
    writeJson(FILE, this.candidates);
    return c;
  }

  compare(target: VisualFeatures) {
    const ranked: SimilarityResult[] = this.candidates
      .map((c) => {
        const scores = compareFeatures(target, c.features);
        const totalScore = Object.entries(scores).reduce((sum, [k, v]) => sum + v * WEIGHTS[k], 0);
        return {
          candidateId: c.id,
          candidateName: c.name,
          totalScore,
          confidence: totalScore,
          matchingFeatures: Object.entries(scores).filter(([, v]) => v >= 0.7).map(([k]) => k.replace("Score", "")),
          conflictingFeatures: Object.entries(scores).filter(([, v]) => v < 0.3).map(([k]) => k.replace("Score", "")),
        };
      })
      .sort((a, b) => b.totalScore - a.totalScore);
    const best = ranked[0];
    return { ranked, best, sufficient: !!best && best.totalScore >= config.conceptualThreshold };
  }

  all() {
    return this.candidates;
  }
}
