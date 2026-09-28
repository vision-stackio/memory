import { randomUUID } from "node:crypto";
import type { DynamicRecord, VerificationStatus } from "./types";
import { readJson, writeJson } from "./store";

const FILE = "dynamic.json";

/** Initial verification status, decided by source + confidence. */
export function initialVerificationStatus(source: string, confidence: number): VerificationStatus {
  if (source === "ADMIN") return "VERIFIED";
  if (confidence >= 0.85) return "UNVERIFIED"; // still needs human confirmation
  if (confidence >= 0.5) return "REQUIRES_REVIEW";
  return "REJECTED";
}

/**
 * Dynamic memory: things learned over time. Only VERIFIED records count as
 * a sufficient answer. Verify/reject are persisted to disk immediately
 * (the original project's in-memory verify() forgot this on restart).
 */
export class DynamicMemory {
  private records: DynamicRecord[];

  constructor() {
    this.records = readJson<DynamicRecord[]>(FILE, []);
  }

  add(input: { title: string; content: string; source: string; confidence: number; importance?: number }): DynamicRecord {
    const record: DynamicRecord = {
      id: randomUUID().slice(0, 8),
      title: input.title,
      content: input.content,
      source: input.source,
      confidence: input.confidence,
      importance: input.importance ?? 0.5,
      verificationStatus: initialVerificationStatus(input.source, input.confidence),
      createdAt: new Date().toISOString(),
    };
    this.records.push(record);
    this.save();
    return record;
  }

  private matches(r: DynamicRecord, q: string) {
    return r.title.toLowerCase().includes(q) || r.content.toLowerCase().includes(q);
  }

  searchVerified(query: string): DynamicRecord[] {
    const q = query.toLowerCase();
    return this.records.filter((r) => r.verificationStatus === "VERIFIED" && this.matches(r, q));
  }

  /** Matches that exist but are not usable yet (for a helpful hint). */
  searchNotVerified(query: string): DynamicRecord[] {
    const q = query.toLowerCase();
    return this.records.filter((r) => r.verificationStatus !== "VERIFIED" && this.matches(r, q));
  }

  setStatus(id: string, status: VerificationStatus): DynamicRecord | undefined {
    const r = this.records.find((x) => x.id === id);
    if (!r) return undefined;
    r.verificationStatus = status;
    this.save();
    return r;
  }

  all() {
    return this.records;
  }

  private save() {
    writeJson(FILE, this.records);
  }
}
