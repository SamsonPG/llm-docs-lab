/**
 * eval/run.mjs
 *
 * WHAT: Scores retrieval and answer quality against the golden set, across models.
 * WHY:  "It seems to work" is not a claim anyone should accept, including me. This turns it
 *       into a number that can move, be compared between runs, and be argued with.
 * WHEN: node eval/run.mjs [--dev] [--models a,b] [--url https://…] [--out eval/results.json]
 *
 * IT MEASURES THE DEPLOYED SYSTEM, NOT A COPY
 * ───────────────────────────────────────────
 * Every question goes through the live HTTP endpoints, the same ones the UI calls. The
 * tempting alternative — importing the retrieval functions and running them here — would
 * measure a reimplementation, and a score for code that is not the code you deployed is
 * worse than no score, because it will be believed.
 *
 * DETERMINISTIC FIRST, JUDGE ONLY WHERE NECESSARY
 * ───────────────────────────────────────────────
 * Most questions have a checkable answer: a price, a limit, a document that must be
 * retrieved. Those are scored by string and by source, which costs nothing, never drifts,
 * and cannot be flattered. A judge model is used only for the questions where correctness
 * is a matter of phrasing — and a judge is itself a model that can be wrong, so its verdict
 * is recorded separately and never silently folded into the headline number.
 *
 * QUOTA
 * ─────
 * A full run is (questions x models) generations plus one embedding each. --dev restricts
 * to the handful of questions marked dev:true, which is what to use while iterating; the
 * full set is for when a change is believed to be finished. Free tiers are a daily budget,
 * not a per-run one.
 *
 * LAYER: Evaluation.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};

const BASE = flag('url', 'https://llmdocs.acsaven.com');
const DEV_ONLY = args.includes('--dev');
const OUT = flag('out', join(root, 'eval', 'results.json'));

/*
  Models compared.

  All three are reachable on the Cloudflare free allowance, which is the constraint that
  chose them. The point is not to crown a winner but to show the trade: the 70B model costs
  more neurons per answer and should earn that.
*/
const MODELS = (flag('models', [
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  '@cf/meta/llama-3.1-8b-instruct-fp8',
  '@cf/meta/llama-3.2-3b-instruct',
].join(','))).split(',');

const golden = JSON.parse(readFileSync(join(root, 'eval', 'golden-set.json'), 'utf8'));
const questions = golden.questions.filter((q) => (DEV_ONLY ? q.dev : true));

const includesAll = (text, needles = []) =>
  needles.every((n) => text.toLowerCase().includes(String(n).toLowerCase()));
const includesAny = (text, needles = []) =>
  needles.some((n) => text.toLowerCase().includes(String(n).toLowerCase()));

/** Retrieval scored on its own: did the right document come back, and at what rank. */
async function scoreRetrieval(question) {
  await sleep(PACE_MS);
  const res = await fetch(`${BASE}/search?q=${encodeURIComponent(question.question)}&k=6`,
    { headers: TOKEN ? { authorization: `Bearer ${TOKEN}` } : {} });
  if (!res.ok) return { ok: false, rank: null, error: `HTTP ${res.status}` };
  const { matches } = await res.json();

  if (!question.expectDoc) {
    // Nothing specific should be found; this only records what came back.
    return { ok: true, rank: null, topDoc: matches[0]?.docId ?? null, n: matches.length };
  }
  const rank = matches.findIndex((m) => m.docId === question.expectDoc);
  return {
    ok: rank !== -1,
    rank: rank === -1 ? null : rank + 1,
    topDoc: matches[0]?.docId ?? null,
    n: matches.length,
  };
}

/*
  The operator token, when present, lifts the Worker's per-IP rate limit.

  Without it the first full run was throttled after twelve questions and every later row
  scored zero — a result that looks exactly like a broken model. Read from the same local,
  gitignored file the ingest script uses; absent, the eval still runs and simply paces
  itself against the public limit.
*/
const TOKEN = (() => {
  try { return readFileSync(join(root, '.ingest-token'), 'utf8').trim(); } catch { return null; }
})();

/** Politeness delay between requests, so the eval never becomes the thing the limiter exists for. */
const PACE_MS = TOKEN ? 250 : 5500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Read a streamed /ask response to completion. */
async function ask(question, model) {
  const started = Date.now();
  await sleep(PACE_MS);
  const res = await fetch(`${BASE}/ask?q=${encodeURIComponent(question)}&model=${encodeURIComponent(model)}`,
    { headers: TOKEN ? { authorization: `Bearer ${TOKEN}` } : {} });
  if (!res.ok) return { text: '', ms: Date.now() - started, error: `HTTP ${res.status}` };
  const text = await res.text();
  return { text, ms: Date.now() - started, error: null };
}

/**
 * Score one answer deterministically.
 *
 * An unanswerable question is scored on whether the system declined. "not in the sources"
 * counts; a price does not, however plausible.
 */
function scoreAnswer(question, text) {
  const reasons = [];
  let pass = true;

  if (question.mustInclude?.length && !includesAll(text, question.mustInclude)) {
    pass = false;
    reasons.push(`missing: ${question.mustInclude.filter((n) => !text.toLowerCase().includes(String(n).toLowerCase())).join(', ')}`);
  }
  if (question.mustNotSay?.length && includesAny(text, question.mustNotSay)) {
    pass = false;
    reasons.push(`said something it should not: ${question.mustNotSay.filter((n) => text.toLowerCase().includes(String(n).toLowerCase())).join(', ')}`);
  }

  /*
    Citations are required on answerable questions only.

    Demanding one on a refusal would push the model to cite a source for saying nothing was
    found, which is worse than the refusal on its own.
  */
  const cited = /\[\d+\]/.test(text);
  if (question.answerable && !cited) {
    pass = false;
    reasons.push('no citation');
  }

  return { pass, cited, reasons };
}

const run = {
  startedAt: new Date().toISOString(),
  base: BASE,
  mode: DEV_ONLY ? 'dev' : 'full',
  questionCount: questions.length,
  models: {},
  retrieval: null,
};

console.log(`  ${questions.length} questions · ${MODELS.length} models · ${BASE}`);
console.log(`  mode: ${run.mode}\n`);

/* ── Retrieval, scored once. It does not depend on the generation model. ── */
console.log('  retrieval');
const retrievalRows = [];
for (const q of questions) {
  const r = await scoreRetrieval(q);
  retrievalRows.push({ id: q.id, ...r });
  const mark = q.expectDoc ? (r.ok ? `hit @${r.rank}` : 'MISS') : 'n/a';
  console.log(`    ${q.id.padEnd(26)} ${mark}`);
}
const withExpect = retrievalRows.filter((r, i) => questions[i].expectDoc);
run.retrieval = {
  checked: withExpect.length,
  recallAt6: withExpect.filter((r) => r.ok).length / (withExpect.length || 1),
  mrr: withExpect.reduce((a, r) => a + (r.rank ? 1 / r.rank : 0), 0) / (withExpect.length || 1),
  rows: retrievalRows,
};
console.log(`    recall@6 ${(run.retrieval.recallAt6 * 100).toFixed(0)}%  ·  MRR ${run.retrieval.mrr.toFixed(2)}\n`);

/* ── Answers, per model. ── */
for (const model of MODELS) {
  console.log(`  ${model}`);
  const rows = [];
  for (const q of questions) {
    const { text, ms, error } = await ask(q.question, model);
    const score = error ? { pass: false, cited: false, reasons: [error] } : scoreAnswer(q, text);
    rows.push({ id: q.id, answerable: q.answerable, pass: score.pass, cited: score.cited, ms, reasons: score.reasons, answer: text.slice(0, 400) });
    console.log(`    ${score.pass ? 'pass' : 'FAIL'}  ${q.id.padEnd(26)} ${String(ms).padStart(5)}ms  ${score.reasons.join('; ')}`);
  }

  /*
    TWO KINDS OF QUESTION, SCORED SEPARATELY
    ────────────────────────────────────────
    Some questions in the golden set have no answer in the corpus. They are
    there on purpose: the right behaviour is to refuse, and a system that
    invents a plausible price for them is worse than one that says nothing.

    Mixing both into a single accuracy figure would hide that. A model could
    score well by answering everything confidently, including the questions it
    should have declined. So they are counted apart:

      accuracy         did it get the answerable ones right?
      refusalAccuracy  did it correctly decline the unanswerable ones?

    The "|| 1" guards against dividing by zero when a category is empty — that
    would produce NaN, which then spreads through every figure derived from it.
  */
  const answerable = rows.filter((r) => r.answerable);
  const refusals = rows.filter((r) => !r.answerable);
  run.models[model] = {
    accuracy: answerable.filter((r) => r.pass).length / (answerable.length || 1),
    refusalAccuracy: refusals.filter((r) => r.pass).length / (refusals.length || 1),
    // Counted apart from correctness: an answer can be right and still not show
    // where it came from, and for this project that is its own failure.
    citationRate: answerable.filter((r) => r.cited).length / (answerable.length || 1),
    // Median rather than mean — one slow cold start would drag an average
    // upward and misrepresent the wait a visitor actually experiences.
    medianMs: rows.map((r) => r.ms).sort((a, b) => a - b)[Math.floor(rows.length / 2)],
    rows, // every individual result, so any headline figure can be rechecked
  };
  const m = run.models[model];
  console.log(`    accuracy ${(m.accuracy * 100).toFixed(0)}%  ·  correct refusals ${(m.refusalAccuracy * 100).toFixed(0)}%`
    + `  ·  cited ${(m.citationRate * 100).toFixed(0)}%  ·  median ${m.medianMs}ms\n`);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(run, null, 2), 'utf8');
console.log(`  written to ${OUT}`);
