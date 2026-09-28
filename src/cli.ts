import readline from "node:readline";
import { MemoryManager } from "./memoryManager";
import { config } from "./config";
import type { LookupResult, VerificationStatus, VisualFeatures } from "./types";

const useColor = process.stdout.isTTY;
const c = (code: number, s: string) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const green = (s: string) => c(32, s);
const red = (s: string) => c(31, s);
const yellow = (s: string) => c(33, s);
const dim = (s: string) => c(2, s);
const bold = (s: string) => c(1, s);

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
const lines = rl[Symbol.asyncIterator]();

/** Prompt that works with both a real terminal and piped input. undefined = EOF. */
async function ask(prompt: string): Promise<string | undefined> {
  process.stdout.write(prompt);
  const { value, done } = await lines.next();
  return done ? undefined : String(value).trim();
}

const HELP = `
Type an item to search, e.g.   tennis ball
Commands:
  :help                                   show this help
  :list static|dynamic|conceptual         show stored memories
  :add-static key | title | content       admin: add/replace a static fact
  :remove-static key                      admin: delete a static fact
  :seed <file.json>                       admin: bulk-load static facts from a file
  :add-dynamic title | content            add an admin-verified dynamic fact
  :verify <id>   /  :reject <id>          change a dynamic fact's status
  :quit                                   exit
`;

function parseNumber(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

async function askFeatures(): Promise<VisualFeatures | undefined> {
  console.log(dim("  Conceptual memory compares by appearance. Describe it (press Enter to skip a field; skip all to skip this step)."));
  const shape = (await ask("    shape (round/square/wide/tall...): ")) || undefined;
  const primaryColour = (await ask("    main colour: ")) || undefined;
  const texture = (await ask("    texture (fuzzy/smooth/...): ")) || undefined;
  const width = parseNumber(await ask("    width (any unit, number): "));
  const height = parseNumber(await ask("    height (same unit): "));
  const features: VisualFeatures = { shape, primaryColour, texture };
  if (width) features.dimensions = { width, height: height ?? width };
  if (width && height) features.aspectRatio = width / height;
  const empty = !shape && !primaryColour && !texture && !width;
  return empty ? undefined : features;
}

function printResult(query: string, r: LookupResult) {
  console.log(`\nSearching for ${bold(`"${query}"`)}`);
  const order = ["STATIC", "DYNAMIC", "CONCEPTUAL", "AI"] as const;
  const label = { STATIC: "Static memory", DYNAMIC: "Dynamic memory", CONCEPTUAL: "Conceptual memory", AI: "AI fallback" };
  order.forEach((layer, i) => {
    const step = r.trace.find((t) => t.layer === layer);
    const head = `  [${i + 1}/4] ${label[layer].padEnd(18)}`;
    if (!step) console.log(head + dim("not reached"));
    else if (step.outcome === "hit") console.log(head + green("FOUND ") + dim(step.note));
    else if (step.outcome === "skipped") console.log(head + yellow("skipped ") + dim(step.note));
    else console.log(head + red("miss ") + dim(step.note));
  });

  console.log("\n" + "-".repeat(60));
  if (r.source === "NONE") {
    console.log(red("No answer. ") + "Nothing in memory matched and the AI fallback could not answer.");
  } else {
    console.log(`${bold("Answer from:")} ${green(r.source === "AI" ? "AI FALLBACK (OpenRouter)" : r.source + " MEMORY")}   ${dim(`confidence ${r.confidence.toFixed(2)}`)}`);
    console.log(r.answer);
    if (r.source === "AI") console.log(dim("\n(AI output is candidate information, not verified truth.)"));
    if (r.learnedConcept) console.log(dim("Learned: saved its appearance as a new conceptual memory."));
  }
  console.log("-".repeat(60) + "\n");
}

async function main() {
  const mm = new MemoryManager();
  console.log(bold("\nVision memory lookup") + dim("   STATIC -> DYNAMIC -> CONCEPTUAL -> AI"));
  console.log(dim(`AI fallback: ${config.aiEnabled ? `on (${config.openRouterModel})` : "off (no OPENROUTER_API_KEY)"}`));
  console.log(dim("Type :help for commands.\n"));

  for (;;) {
    const raw = await ask("search> ");
    if (raw === undefined || raw === ":quit" || raw === ":q") break;
    if (!raw) continue;

    if (raw.startsWith(":")) {
      const [cmd, ...restParts] = raw.slice(1).split(/\s+/);
      const rest = restParts.join(" ");
      switch (cmd) {
        case "help":
          console.log(HELP);
          break;
        case "list": {
          if (rest === "static") {
            if (!mm.staticMemory.all().length) console.log("  (empty - seed it with :add-static or :seed <file.json>)");
            mm.staticMemory.all().forEach((r) => console.log(`  ${r.memoryKey}  ${r.title}: ${r.content}`));
          } else if (rest === "dynamic") {
            const all = mm.dynamicMemory.all();
            if (!all.length) console.log("  (empty)");
            all.forEach((r) => console.log(`  ${r.id}  [${r.verificationStatus}] ${r.title}: ${r.content}  (src ${r.source}, conf ${r.confidence})`));
          } else if (rest === "conceptual") {
            const all = mm.conceptualMemory.all();
            if (!all.length) console.log("  (empty)");
            all.forEach((r) => console.log(`  ${r.id}  ${r.name}  ${JSON.stringify(r.features)}`));
          } else console.log("Usage: :list static|dynamic|conceptual");
          break;
        }
        case "add-static": {
          const [key, title, ...content] = rest.split("|").map((s) => s.trim());
          if (!key || !title || content.length === 0) console.log("Usage: :add-static key | title | content");
          else {
            mm.staticMemory.upsert({ memoryKey: key, memoryType: "ADMIN", title, content: content.join(" | "), importance: 1 });
            console.log(green("Saved static memory ") + key);
          }
          break;
        }
        case "remove-static":
          console.log(mm.staticMemory.remove(rest) ? green("Removed ") + rest : red(`No static memory with key "${rest}"`));
          break;
        case "seed": {
          try {
            const n = mm.staticMemory.seedFromFile(rest);
            console.log(green(`Seeded ${n} static record(s) from ${rest}`));
          } catch (e) {
            console.log(red("Seed failed: ") + (e as Error).message);
          }
          break;
        }
        case "add-dynamic": {
          const [title, ...content] = rest.split("|").map((s) => s.trim());
          if (!title || content.length === 0) console.log("Usage: :add-dynamic title | content");
          else {
            const rec = mm.dynamicMemory.add({ title, content: content.join(" | "), source: "ADMIN", confidence: 1 });
            console.log(green(`Saved dynamic memory ${rec.id} `) + `[${rec.verificationStatus}]`);
          }
          break;
        }
        case "verify":
        case "reject": {
          const status: VerificationStatus = cmd === "verify" ? "VERIFIED" : "REJECTED";
          const rec = mm.dynamicMemory.setStatus(rest, status);
          console.log(rec ? green(`${rec.id} is now ${status}`) : red(`No dynamic memory with id "${rest}"`));
          break;
        }
        default:
          console.log(`Unknown command :${cmd}. Type :help`);
      }
      continue;
    }

    if (raw.length < 2) {
      console.log(yellow("Please type at least 2 characters.\n"));
      continue;
    }
    const result = await mm.lookup(raw, askFeatures);
    printResult(raw, result);

    // Offer to keep an AI answer as dynamic memory (starts unverified, per the rules).
    if (result.source === "AI" && result.aiText) {
      const yn = await ask("Save this AI answer as dynamic memory for review? (y/N): ");
      if (yn && yn.toLowerCase().startsWith("y")) {
        const rec = mm.dynamicMemory.add({ title: raw, content: result.aiText, source: "AI", confidence: result.confidence });
        console.log(`Saved as ${rec.id} [${rec.verificationStatus}]. Run ${bold(`:verify ${rec.id}`)} to make it count as an answer next time.\n`);
      }
    }
  }
  rl.close();
  console.log("Bye.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
