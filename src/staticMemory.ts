import fs from "node:fs";
import type { StaticRecord } from "./types";
import { readJson, writeJson } from "./store";

const FILE = "static.json";

/**
 * Static memory: information seeded by the admin. Highest priority.
 * Starts EMPTY - nothing is built in. The admin fills it with
 * `:add-static`, `:seed <file.json>`, or by editing data/static.json.
 */
export class StaticMemory {
  private records: StaticRecord[];

  constructor() {
    this.records = readJson<StaticRecord[]>(FILE, []);
  }

  search(query: string): StaticRecord[] {
    const q = query.toLowerCase();
    return this.records.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.content.toLowerCase().includes(q) ||
        r.memoryKey.toLowerCase().includes(q)
    );
  }

  /** Insert or replace by memoryKey. */
  upsert(record: StaticRecord) {
    const i = this.records.findIndex((r) => r.memoryKey === record.memoryKey);
    if (i >= 0) this.records[i] = record;
    else this.records.push(record);
    this.save();
  }

  remove(memoryKey: string): boolean {
    const before = this.records.length;
    this.records = this.records.filter((r) => r.memoryKey !== memoryKey);
    if (this.records.length === before) return false;
    this.save();
    return true;
  }

  /**
   * Bulk-load admin seed data from a JSON file: an array of
   * { "memoryKey", "title", "content", "memoryType"?, "importance"? }.
   * Existing keys are updated, new keys are added. Returns how many were loaded.
   */
  seedFromFile(file: string): number {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<StaticRecord>[];
    if (!Array.isArray(raw)) throw new Error("Seed file must be a JSON array.");
    let n = 0;
    for (const r of raw) {
      if (!r.memoryKey || !r.title || !r.content) throw new Error(`Each item needs memoryKey, title and content (bad item: ${JSON.stringify(r)})`);
      const i = this.records.findIndex((x) => x.memoryKey === r.memoryKey);
      const rec: StaticRecord = { memoryKey: r.memoryKey, title: r.title, content: r.content, memoryType: r.memoryType ?? "ADMIN", importance: r.importance ?? 1 };
      if (i >= 0) this.records[i] = rec;
      else this.records.push(rec);
      n++;
    }
    this.save();
    return n;
  }

  all() {
    return this.records;
  }

  private save() {
    writeJson(FILE, this.records);
  }
}
