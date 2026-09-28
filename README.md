<p align="center">
<a>
<img alt="Vision Logo" src="assets/Vision.png" width="132">
</a>
</p>

<p align="center">
<a href="#setup"><img alt="Node" src="https://img.shields.io/badge/node-26%2B-339933?style=flat-square&logo=node.js&logoColor=white" /></a>
<a href="#setup"><img alt="TypeScript" src="https://img.shields.io/badge/typescript-5-3178C6?style=flat-square&logo=typescript&logoColor=white" /></a>
<a href="#ai-fallback-openrouter"><img alt="OpenRouter" src="https://img.shields.io/badge/ai-openrouter-6467F2?style=flat-square" /></a>
</p>

<p align="center">
<b>Vision's Memory Lookup</b>: A terminal tool that searches Static, Dynamic and Conceptual memory, falls back to an AI, and tells you exactly which layer answered
</p>

> **Note:** This package is the **memory chain** on its own, lifted out of Vision's brain. There is no robot, no dashboard and no database. You type an item, it is searched in a fixed order, and the first layer that can answer wins. Anything the AI says is treated as candidate information until you verify it.

---

## Table of Contents
1. [What it does](#what-it-does)
2. [Layout](#layout)
3. [Setup](#setup)
4. [Run the Memory Lookup](#run-the-memory-lookup)
5. [Try it](#try-it)
6. [Commands](#commands)
7. [Notes & Technical Details](#notes--technical-details)

<br/>

## What it does

- **Fixed priority chain** — every search goes through the layers in the same order and stops at the first one that answers.
- **Tells you the source** — the output shows every step (`FOUND`, `miss`, `skipped`, `not reached`) and ends with `Answer from: ...`.
- **Admin-seeded static memory** — nothing is built in. The admin fills it with `:add-static`, `:seed`, or by editing `data/static.json`.
- **Verified-only dynamic memory** — learned facts are only used once they are marked `VERIFIED`.
- **Learns by appearance** — when the AI answers an item you described, its look is saved as a concept, so a similar item is recognised next time without the AI.

| Order | Layer | Answers when | Confidence |
| :---: | :---- | :----------- | :--------- |
| 1 | **Static** | Any record's key, title or content contains your search | `1.00` |
| 2 | **Dynamic** | A `VERIFIED` record's title or content contains your search | `0.85` |
| 3 | **Conceptual** | The item you describe scores `0.65` or more against a stored concept | the match score |
| 4 | **AI fallback** | Everything above missed (needs an OpenRouter key) | `0.60` |

<br/>

## Setup

```bash
# Install dependencies
npm install

# Configure the AI fallback (optional)
cp .env.example .env     # For WSL, Linux or macOS
copy .env.example .env   # For Windows
```

Edit `.env`:

```env
OPENROUTER_API_KEY=sk-or-v1-your-key
OPENROUTER_MODEL=openai/gpt-4o-mini
```

| Variable              | Description |
|-----------------------|-------------|
| `OPENROUTER_API_KEY`  | Your OpenRouter key. Leave empty to run without the AI step |
| `OPENROUTER_MODEL`    | Model id (default `openai/gpt-4o-mini`) |
| `OPENROUTER_BASE_URL` | Optional override for any OpenRouter-compatible server |

You can skip the key entirely: Static, Dynamic and Conceptual memory all work, and the AI step just reports that it is not configured.

<br/>

## Run the Memory Lookup

```bash
npm start
```

> ⚠️ **Important:** Run it from the `vision-memory` folder. The `data/` folder and `.env` are read from wherever you launch the app, so starting it from another directory looks like your memories vanished.

The startup line tells you whether the AI is on:

```
Vision memory lookup   STATIC -> DYNAMIC -> CONCEPTUAL -> AI
AI fallback: on (openai/gpt-4o-mini)
```

Optional scripts:

```bash
npm run typecheck    # type-check without building
npm run build        # compile to dist/
```

<br/>

## Try it

**1. Static memory.** Seed something, then search for it.

```
search> :add-static item.apple | Apple | A red fruit.
search> apple
  [1/4] Static memory     FOUND 1 record(s)
Answer from: STATIC MEMORY
```

**2. Dynamic memory.** Admin-added facts are verified straight away.

```
search> :add-dynamic zebra | A striped horse.
search> zebra
  [2/4] Dynamic memory    FOUND 1 verified record(s)
Answer from: DYNAMIC MEMORY
```

**3. AI fallback, then verify.** Search something that is stored nowhere.

```
search> banana peel
  [4/4] AI fallback       FOUND
Answer from: AI FALLBACK (OpenRouter)

Save this AI answer as dynamic memory for review? (y/N): y
Saved as 7c62b8a3 [REQUIRES_REVIEW].

search> :verify 7c62b8a3
search> banana peel
Answer from: DYNAMIC MEMORY
```

**4. Conceptual memory.** Teach it once, then let it recognise by look.

| Search | You describe | What happens |
| :----- | :----------- | :----------- |
| `football` | round, white, smooth, 22 × 22 | AI answers, and the look is saved as a concept |
| `soccer ball` | round, white, smooth, 21 × 21 | `Answer from: CONCEPTUAL MEMORY`, no AI call |

The description prompt only matters for the conceptual step. Press Enter to skip any field, or skip them all to skip the step.

<br/>

## Commands

Type `:help` inside the app to see these.

| Command | What it does |
| :------ | :----------- |
| `:list static\|dynamic\|conceptual` | Show stored memories |
| `:add-static key \| title \| content` | Admin: add or replace a static fact |
| `:remove-static key` | Admin: delete a static fact |
| `:seed <file.json>` | Admin: bulk-load static facts from a file |
| `:add-dynamic title \| content` | Add an admin-sourced (auto-verified) dynamic fact |
| `:verify <id>` / `:reject <id>` | Change a dynamic fact's status (saved to disk) |
| `:quit` | Exit |

Seed files are a JSON array. `memoryType` and `importance` are optional:

```json
[
  { "memoryKey": "item.apple", "title": "Apple", "content": "A red fruit." }
]
```

Load it with `:seed seed/mydata.json`. The example file is only a template: the app never reads it on its own.

<br/>

## Notes & Technical Details

* **Static search:** matches your text against each record's key, title and content (case-insensitive, substring). Searches shorter than 2 characters are rejected, otherwise a single letter would match everything.
* **Dynamic verification:** the starting status depends on source and confidence. `ADMIN` is `VERIFIED`. Confidence `0.85` or more is `UNVERIFIED`. `0.5` to `0.85` is `REQUIRES_REVIEW`. Below `0.5` is `REJECTED`. Only `VERIFIED` records count as an answer. If a match exists but is not verified, the output shows its id so you can `:verify` it.
* **Conceptual scoring:** a weighted mix of shape (0.20), colour (0.15), size (0.15), texture (0.15), aspect ratio (0.15), and two placeholder dimensions, context and semantic (0.10 each, fixed at 0.5). The best match must reach `0.65`. Shape, colour and texture are exact matches, size and aspect ratio are tolerance based.
* **Learning:** an AI answer with confidence `0.5` or more is only learned if you described the item. The first concept can be learned even when conceptual memory is empty.
* **AI confidence:** OpenRouter answers are given a fixed `0.60`. They are candidate information, never auto-verified.
* **AI errors:** a missing key, a network failure or a bad model id shows up as `miss` on the AI line with the reason, and the search ends with `No answer`.
* **Storage:** memories are plain JSON in `data/` (`static.json`, `dynamic.json`, `conceptual.json`). Delete the folder to reset. It is git-ignored, and `.env` is too, so your key is never committed.

<br/>