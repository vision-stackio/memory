export type MemorySource = "STATIC" | "DYNAMIC" | "CONCEPTUAL" | "AI" | "NONE";
export type VerificationStatus = "VERIFIED" | "UNVERIFIED" | "REQUIRES_REVIEW" | "REJECTED";

export interface StaticRecord {
  memoryKey: string;
  memoryType: string;
  title: string;
  content: string;
  importance: number;
}

export interface DynamicRecord {
  id: string;
  title: string;
  content: string;
  source: string; // ADMIN | AI | USER ...
  confidence: number;
  importance: number;
  verificationStatus: VerificationStatus;
  createdAt: string;
}

export interface VisualFeatures {
  shape?: string;
  primaryColour?: string;
  texture?: string;
  aspectRatio?: number;
  dimensions?: { width: number; height: number };
}

export interface ConceptualCandidate {
  id: string;
  name: string;
  features: VisualFeatures;
}

export interface SimilarityResult {
  candidateId: string;
  candidateName: string;
  totalScore: number;
  confidence: number;
  matchingFeatures: string[];
  conflictingFeatures: string[];
}

export type StepOutcome = "hit" | "miss" | "skipped";
export interface TraceStep {
  layer: Exclude<MemorySource, "NONE">;
  outcome: StepOutcome;
  note: string;
}

export interface LookupResult {
  source: MemorySource;
  confidence: number;
  answer: string;
  trace: TraceStep[];
  /** true when the AI answer was good enough to be learned as a conceptual memory */
  learnedConcept: boolean;
  /** the raw AI text, present only when the AI layer answered */
  aiText?: string;
}
