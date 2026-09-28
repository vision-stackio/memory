import fs from "node:fs";
import path from "node:path";
import { config } from "./config";

export function readJson<T>(name: string, fallback: T): T {
  const file = path.join(config.dataDir, name);
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    console.warn(`Warning: could not parse ${file}, starting empty.`);
    return fallback;
  }
}

export function writeJson(name: string, data: unknown) {
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.writeFileSync(path.join(config.dataDir, name), JSON.stringify(data, null, 2));
}
