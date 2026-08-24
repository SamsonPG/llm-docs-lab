/**
 * scripts/fetch-corpus.mjs
 *
 * WHAT: Downloads the source pages for the corpus into corpus/raw/ as HTML.
 * WHY:  See "snapshot, don't scrape" below — this is the most consequential decision
 *       on day one and the reason the evals later mean anything.
 * WHEN: Rarely. Run it to create the corpus, and again only when deliberately refreshing.
 *
 * SNAPSHOT, DON'T SCRAPE LIVE
 * ───────────────────────────
 * The obvious design is to fetch pages at query time so answers are always current. That
 * is wrong here, and the reason is the evaluation in stage 02.
 *
 * An eval compares a system against a fixed set of expected answers. If the corpus changes
 * underneath it, a score that drops tells you nothing: the retrieval may have regressed, or
 * Google may simply have repriced Gemini overnight. You cannot tell those apart, and a
 * measurement you cannot attribute is not a measurement.
 *
 * So the corpus is frozen and committed. Every score is comparable to every other score,
 * and a refresh is a deliberate act with its own commit — which is also how you would
 * handle a production index.
 *
 * The cost of this choice is honest and belongs in the README: answers reflect the snapshot
 * date, not today. FETCHED_AT is carried through to the cleaned files so the application can
 * say so, rather than implying a freshness it does not have.
 *
 * LAYER: Corpus tooling (manual, local only).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'corpus', 'raw');

/*
  A deliberately small, deliberately chosen corpus.

  Seven pages, not seven hundred. Retrieval quality is easy to reason about at this size and
  impossible at scale on day one, and — the deciding factor — I can personally verify every
  answer the system gives. A golden set requires knowing the truth, and I know this domain
  from TryTokka's provider integrations. A corpus I would have to look up would make the
  eval in stage 02 worthless.

  All seven were checked to return server-rendered content to a plain fetch on 25 Aug 2026;
  several other provider pricing pages are JavaScript shells that return nothing useful.
*/
const SOURCES = [
  { id: 'cloudflare-workers-ai-pricing', url: 'https://developers.cloudflare.com/workers-ai/platform/pricing/' },
  { id: 'gemini-pricing',                url: 'https://ai.google.dev/gemini-api/docs/pricing' },
  { id: 'gemini-rate-limits',            url: 'https://ai.google.dev/gemini-api/docs/rate-limits' },
  { id: 'anthropic-pricing',             url: 'https://docs.anthropic.com/en/docs/about-claude/pricing' },
  { id: 'groq-rate-limits',              url: 'https://console.groq.com/docs/rate-limits' },
  { id: 'openai-pricing',                url: 'https://platform.openai.com/docs/pricing' },
  { id: 'openrouter-limits',             url: 'https://openrouter.ai/docs/api-reference/limits' },
];

/*
  An honest user-agent that says what this is — and it is also the only one that works.

  The first version sent a full Chrome string, on the assumption that a "real browser"
  gets served better content. For ai.google.dev the opposite is true: presented with a
  Chrome UA it redirects into an OAuth flow that never terminates —

      hop 0  302 -> /oauth2authorize?return_url=...
      hop 1  302 -> accounts.google.com/o/oauth2/v2/auth
      hop 2  302 -> /oauth2callback?state=...
      hop 3  302 -> /gemini-api/docs/pricing        (back to the start)
      hop 4  302 -> /oauth2authorize...             (and again, forever)

  — until the client gives up with "redirect count exceeded". Sent no UA, a short one, or
  this one, the same URL returns 242 KB of content immediately. Google is serving the
  signed-in web app to anything that looks like a browser and the plain document to
  everything else.

  Two lessons kept because both cost time: an error that says only "fetch failed" is hiding
  its cause in `err.cause`, and imitating a browser is a guess, not a default. Identifying
  the client honestly is both better manners for a public docs page and, here, the thing
  that actually works.
*/
const UA = 'llm-docs-lab/0.1 (corpus snapshot; +https://github.com/acsavenhq/llm-docs-lab)';

mkdirSync(outDir, { recursive: true });

const fetchedAt = new Date().toISOString();
let failures = 0;

for (const { id, url } of SOURCES) {
  try {
    /*
      accept-language is not optional here.

      Without it Google served the Gemini rate-limits page in Korean, so the corpus held
      "비율 제한 > 사용 등급" where the English limits should be. An English question cannot
      match that text, but the chunk still competes for retrieval slots — a corpus in a
      language the questions are not asked in is worse than a missing document, because it
      ranks.
    */
    const res = await fetch(url, {
      headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9' },
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    /*
      Fail loudly on a suspiciously small page.

      A JavaScript shell returns 200 with a few kilobytes of nothing. Silently accepting it
      would put an empty document in the corpus, and the failure would only surface much
      later as "retrieval is bad" — the hardest kind of bug to trace back. 5,000 bytes is
      well under the smallest real page measured here (~10 KB of extractable text).
    */
    if (html.length < 5000) throw new Error(`only ${html.length} bytes — probably a JS shell`);

    writeFileSync(join(outDir, `${id}.html`), html, 'utf8');
    writeFileSync(join(outDir, `${id}.meta.json`), JSON.stringify({ id, url, fetchedAt, bytes: html.length }, null, 2), 'utf8');
    console.log(`  ok    ${id.padEnd(32)} ${(html.length / 1024).toFixed(0)} KB`);
  } catch (err) {
    failures += 1;
    // err.cause carries the real reason; err.message is the useless generic "fetch failed".
    const why = err.cause?.message ?? err.message;
    console.error(`  FAIL  ${id.padEnd(32)} ${why}`);
  }
}

console.log(`\n  ${SOURCES.length - failures}/${SOURCES.length} fetched into corpus/raw`);
if (failures) {
  console.error('  A source failed. Fix or remove it before building — a partial corpus makes');
  console.error('  the eval measure something other than what you think it measures.');
  process.exit(1);
}
