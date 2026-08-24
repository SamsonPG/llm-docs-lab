# llm-docs-lab

Retrieval over LLM provider pricing and rate-limit documentation — built as one system with
six interconnected sections, so that the evaluation measures the retrieval that actually runs
rather than a copy of it.

> **Status: day 1 of 7. Sections 1 and 2 partially built.**
> This README describes what exists today and says so where something does not exist yet.
> The results tables below are empty because they have not been measured.

## Why this exists

I build infrastructure *around* language models — provider billing integrations, cost
attribution, spend monitoring — and had never called one from code. This closes that gap with
something measurable rather than a demo.

The corpus is LLM provider pricing and rate limits, chosen deliberately: I know this domain
from building an eight-provider billing integration, so I can tell a correct answer from a
plausible one. That is a prerequisite for writing a golden set, and it is why the evaluation
in section 4 will mean something.

## Sections

| # | Section | Status |
|---|---------|--------|
| 1 | **Corpus** — fetch, extract, clean | Built. 7 sources, snapshotted |
| 2 | **Retrieval** — chunk, embed, search | Not started |
| 3 | **Answer** — generate with citations | Not started |
| 4 | **Evals** — golden set, model comparison | Not started |
| 5 | **Security** — prompt injection, measured | Not started |
| 6 | **Agent** — tool calling with traces | Not started |

See [ARCHITECTURE.md](ARCHITECTURE.md) for how the six connect, and the rule that keeps them
one system: nothing reimplements anything. The eval imports the real retrieval; the security
tests push poisoned documents through the real ingest; the agent calls retrieval as a tool.

## Decisions worth knowing

**The corpus is a snapshot, not a live scrape.** Answers therefore reflect the fetch date, not
today. Scraping live would keep answers current and make the evaluation worthless — when a
score drops you could not tell whether retrieval regressed or a provider repriced overnight.

**Table rows carry their full heading path.** Pricing lives in tables, and a row extracted as
`Input price: $0.75` cannot answer anything: $0.75 for which model, on which tier? Rows are
denormalised so each one stands alone:

```
Gemini Developer API pricing > Gemini 3.7 Flash > Standard > Input price
  | Free Tier: Free of charge | Paid Tier, per 1M tokens in USD: $0.75
```

That property matters because a chunk boundary can fall anywhere.

## Known limits

Stated here rather than discovered later:

- HTML extraction is regex-based with no DOM parser. It handles these seven pages; nested
  tables or `colspan` would confuse it. The evaluation in section 4 should be what triggers a
  rewrite, not a hunch.
- One table in the corpus has no `<th>` and falls back to positional column labels. It
  retrieves worse and is the first suspect if a rate-limit question fails.
- Answers are only as current as the snapshot date recorded in each file's frontmatter.

## Results

Not yet measured. Sections 4 and 5 will fill in:

- Answer quality against a golden set, across several models
- Cost and latency per model
- Prompt-injection success rate, before and after defences
- The query types where retrieval fails, with the rate

An empty table here is deliberate. Numbers appear when they have been measured.

## Running it

```bash
npm run corpus:fetch    # download the source pages into corpus/raw (gitignored)
npm run corpus:build    # extract to corpus/clean/*.md (committed)
```

Everything runs on free tiers: Cloudflare Workers AI and Vectorize for embeddings and
inference, with Groq, Gemini and OpenRouter used for the multi-model comparison.

## Licence

MIT.
