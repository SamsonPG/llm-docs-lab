# Architecture

Six sections on one shared core. The interconnection is the point — each section is a
different question asked of the *same* pipeline, not a separate project that happens to live
in the same repository.

```
                        ┌─────────────────────────────┐
                        │  1. corpus                  │
   provider docs  ───►  │  fetch → extract → clean    │
                        └──────────────┬──────────────┘
                                       │ corpus/clean/*.md
                                       ▼
                        ┌─────────────────────────────┐
                        │  2. retrieval               │  ◄── 6. agent calls this
                        │  chunk → embed → search     │      as a tool
                        └──────────────┬──────────────┘
                                       │ ranked chunks
                                       ▼
                        ┌─────────────────────────────┐
                        │  3. answer                  │
                        │  prompt → generate → cite   │
                        └──────────────┬──────────────┘
                                       │
                 ┌─────────────────────┴─────────────────────┐
                 ▼                                           ▼
   ┌─────────────────────────────┐             ┌─────────────────────────────┐
   │  4. evals                   │             │  5. security                │
   │  golden set, N models,      │             │  poisoned docs pushed       │
   │  quality vs cost vs latency │             │  through 1 → 3, attack rate │
   └─────────────────────────────┘             └─────────────────────────────┘
```

## The rule

**Nothing reimplements anything.**

- `eval/` imports `src/retrieval` and `src/answer`. It does not have its own copy.
- `security/` puts poisoned documents through the real `src/corpus` ingest and the real
  answer path. It does not simulate an attack.
- `src/agent` calls `src/retrieval` as one of its tools. It does not have a private search.

This is not tidiness. If the eval measures a *copy* of retrieval, it measures nothing about
what is deployed, and the number it prints is worse than no number because it is believed.
The same applies to the attack rate: an injection test against a mock proves the mock is
safe.

The practical consequence is that a change to chunking shows up immediately in the eval
score, the attack rate and the agent's answers — which is exactly the feedback loop the
whole project exists to have.

## Sections

| # | Path | Owns | Depends on |
|---|------|------|------------|
| 1 | `scripts/fetch-corpus.mjs`, `scripts/build-corpus.mjs`, `src/corpus/` | Fetching and extracting source docs | — |
| 2 | `src/retrieval/` | Chunking, embeddings, vector search | 1 |
| 3 | `src/answer/` | Prompt assembly, generation, citations | 2 |
| 4 | `eval/` | Golden set, scoring, model comparison | 2, 3 |
| 5 | `security/` | Poisoned corpus, attack measurement, defences | 1, 2, 3 |
| 6 | `src/agent/` | Tool definitions, the loop, traces, ceilings | 2 |

## Decisions already made

- **The corpus is a snapshot, not a live scrape.** An eval against a moving corpus cannot
  attribute a score change to retrieval rather than to a provider repricing overnight. See
  the header of `scripts/fetch-corpus.mjs`.
- **Table rows carry their full heading path.** Pricing lives in tables; a row that reads
  `Input price: $0.75` is unanswerable. Rows are denormalised to
  `Gemini Developer API pricing > Gemini 3.7 Flash > Standard > Input price | …` so a
  retrieved chunk stands alone. See the header of `scripts/build-corpus.mjs`.

Reasoning in my own words, written as I go, is in `DECISIONS.md`.
