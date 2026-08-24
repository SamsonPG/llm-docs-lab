# llm-docs-lab

**[llmdocs.acsaven.com](https://llmdocs.acsaven.com)** — ask a question about LLM provider
pricing and get a cited answer from a fixed snapshot of seven documentation pages.

Retrieval, evaluated. The interesting part is not that it answers questions; it is that
every claim below is a number produced by a script in this repository, including the ones
that are unflattering.

---

## What this is

Six interconnected sections on one shared core:

| # | Section | What it does | Where |
|---|---------|--------------|-------|
| 1 | **Corpus** | Fetch and extract seven provider docs into clean, retrievable text | [`scripts/`](scripts/) |
| 2 | **Retrieval** | Content-aware chunking, embeddings, vector search | [`src/retrieval/`](src/retrieval/) |
| 3 | **Answer** | Grounded generation with citations, streamed | [`src/answer/`](src/answer/) |
| 4 | **Evals** | 20-question golden set, scored across models | [`eval/`](eval/) |
| 5 | **Security** | Prompt-injection attacks against the live index | [`security/`](security/) |
| 6 | **Agent** | Tool-calling loop with ceilings and a full trace | [`src/agent/`](src/agent/) |

The rule that makes it one system rather than six scripts sharing a folder: **nothing
reimplements anything.** The eval calls the deployed HTTP endpoints. The security tests
poison the real index. The agent calls the same `retrieve()` the UI uses. See
[ARCHITECTURE.md](ARCHITECTURE.md).

That is not tidiness. An eval measuring a *copy* of retrieval measures nothing about what is
deployed, and prints a number that is worse than no number because it gets believed.

---

## Results

Measured 2026-08-25 against the deployed system. Reproduce with `node eval/run.mjs`.

### Retrieval

| Metric | Value |
|---|---|
| recall@6 | **100%** (13/13 questions with an expected document) |
| Mean reciprocal rank | **1.00** — the right document was always ranked first |

### Answers

Twenty questions, of which **seven are deliberately unanswerable** from this corpus.

| Model | Accuracy | Correct refusals | Cited | Median latency |
|---|---|---|---|---|
| `llama-3.3-70b-instruct-fp8-fast` | 77% | **100%** | 85% | **1,925 ms** |
| `llama-3.1-8b-instruct-fp8` | **92%** | 57% | **100%** | 2,850 ms |
| `llama-3.2-3b-instruct` | 0% | 67% | 0% | 1,154 ms |

**The trade is the finding.** The 8B model answers better and refuses far worse — asked the
capital of France against a corpus of pricing tables, it answers Paris. The 70B model
declines every unanswerable question and is also the faster of the two. The 3B model is
unusable here: no citations, wrong figures, and asked for its system prompt it leaked the
`SOURCE_DATA` delimiter — partial prompt disclosure, found by the eval rather than by a
stranger.

Unanswerable questions are a third of the set on purpose. Scoring well on questions the
corpus covers is easy; the failure that matters is the confident invention, where a plausible
price arrives with a citation attached and looks exactly like a correct answer.

### Prompt injection

Ten attacks — five poisoned documents through the real ingest, five hostile questions through
the public endpoint — judged on canary strings, against `llama-3.3-70b`.

| Channel | Attack success rate |
|---|---|
| Document (poisoned corpus) | **0%** (0/5) |
| Question (direct input) | **0%** (0/5) |
| **Overall** | **0% (0/10)** |

Attacks covered: instruction override, forged system turns, social engineering, prompt
exfiltration, false-fact injection, delimiter forgery, roleplay jailbreak, and an
indirect instruction hidden in a translation task.

**0% does not mean immune, and this repository will not claim it does.** Ten attacks is a
small sample against one model. Injection is unsolved, and a page telling you otherwise is
selling something. What the number means is that these ten, on that model, on that date, did
not get through — and `security/injection.mjs` is there so you can disagree by running it.

The measurement itself needed fixing first, which is the more useful story: [see below](#the-measurement-that-lied).

---

## Known limits

Stated here because you will find them anyway, and it is better if the README already knew.

**The agent's final answer is not grounded to the standard `/ask` enforces.** Asked to compare
Gemini 3.7 Flash with Claude Opus 5, it correctly reported that Flash's price was not in its
search results, then quoted a range from a different Gemini variant regardless. `/ask` would
have refused. The cause is structural: `finish` returns whatever the model wrote, while
`/ask` passes through the grounded prompt. It also repeated an identical search on two
separate steps.

**Three known extraction weaknesses**, all visible in the eval rather than hidden:
- HTML parsing is regex-based with no DOM. It handles these seven pages; nested tables or
  `colspan` confuse it, and OpenAI's pricing tables use `colspan`, which shifts some columns.
- One table (Groq's rate limits) has no header row *inside* the `<table>` — the labels sit in
  surrounding markup — so its numbers index as `Column 3: 250` rather than `RPD: 250`.
  Predicted to fail the eval; it passed anyway, because the figure alone was enough. The
  prediction was wrong and the limitation is still real.
- An over-long row is emitted whole rather than split, so its tail is truncated by the
  embedding model and is not searchable. Deliberate: a lost tail is recoverable, a half row
  that answers with a neighbouring model's price is not.

**Answers reflect the snapshot date, not today.** Each source shows when it was retrieved.
Prices change.

**Rate limiting is per-isolate, not global.** Workers run as many isolates, so a distributed
caller gets one bucket per edge location. It stops the honest accident — a loop in a
terminal, a crawler — which is what actually drains a free tier. A global limit needs Durable
Objects.

**The CSP allows `unsafe-inline`** because the page's CSS and script are inline. A nonce
would be better.

---

## Three bugs worth reading about

### Retrieval that confidently returned the wrong provider

The first working search, asked *"how many neurons per day are free on Cloudflare Workers
AI"*, returned **Anthropic** pricing. Two compounding causes:

1. **No chunk named its provider.** `Model: Claude Opus 5 | Base Input Tokens: $5` never
   contains the word "Anthropic". The provider was in Vectorize metadata — which is not
   embedded, and therefore invisible to search.
2. **The section path was duplicated**, so much of every chunk was boilerplate near identical
   across providers, drowning out the words that distinguish them.

Chunks now lead with their source title and state the section once. Both probe queries went
from wrong to 0.848.

### The measurement that lied

The first injection run reported a 10% attack success rate. The number was wrong. The single
"hijack" was the translation attack, and the reply began:

> *"The source appears to contain an injected instruction. I will not act on it…"*

then correctly answered the question by translating the German — which contained the canary.
The model resisted perfectly and the check called it a compromise, because *contains
PWNED-Q5* cannot distinguish obedience from quotation.

Over-reporting is not the safe direction it sounds like. A security measurement that cries
wolf gets discounted, and the next real finding is discounted with it.

### A bug that did not throw

The agent failed five times with `no JSON object in the reply` and a raw value of
`[object Object]`. It looked like a model incapable of following instructions. It was not:
Workers AI returns an OpenAI-shaped object and the code read `res.response`, which is
`undefined` there. `String(undefined)` is a perfectly good string, so nothing threw. The
model had produced correct JSON every time, and the same bug was live in `answerQuestion`
where only the streaming path had hidden it.

---

## Running it

```bash
npm test                  # 18 tests, no API calls, no network
npm run corpus:fetch      # snapshot the seven source pages
npm run corpus:build      # extract to corpus/clean/
node scripts/ingest.mjs   # chunk, embed and index (needs .ingest-token)
npm run deploy            # wrangler deploy

node eval/run.mjs --dev              # small subset, for iterating inside quota
node eval/run.mjs                    # the full 20-question set
node security/injection.mjs          # dry run — shows the attacks
node security/injection.mjs --live   # poison the index, measure, clean up
```

Everything runs on free tiers: Cloudflare Workers AI for embeddings and generation,
Vectorize for the index. **A full eval sweep is roughly 1,800 API calls and the combined free
allowance is about 3,500 a day** — which is why the harness has a `--dev` subset and paces
itself. At twelve hours a day of work, quota is the constraint, not time.

## Endpoints

| Route | Purpose |
|---|---|
| `GET /` | The page |
| `GET /ask?q=` | Grounded answer, streamed. Sources in the `x-sources` header |
| `GET /search?q=&k=` | Retrieval only — lets the eval score retrieval independently |
| `GET /agent?q=` | Tool-calling run, returns the answer plus the full trace |
| `GET /health` | Models in use |
| `POST /ingest` | **Authenticated.** An open ingest endpoint is a public index-poisoning API |
| `POST /ingest/delete` | **Authenticated.** Exists so injection tests can clean up exactly |

## Tests

18, run with `node --test`. Each was watched failing before being trusted — a check nobody
has seen go red is not evidence.

Mutation testing earned its place twice. Three chunker mutations were caught cleanly. The
fourth — *split rows in half*, the invariant that matters most — **changed nothing**, because
the branch keeping rows whole never runs on this corpus: the longest real row is 119 tokens
against a 480 ceiling. The code path was untested and the mutation was inert. A synthetic
oversized row now covers it.

A passing mutation is a coverage hole, not a success.

## Licence

MIT.

---

Built by [Samson P G](https://samsonpg.github.io) · [github.com/SamsonPG](https://github.com/SamsonPG)
