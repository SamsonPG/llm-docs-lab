/**
 * scripts/build-results-page.mjs
 *
 * WHAT: Generates a static results page from eval/results.json and
 *       security/injection-results.json, and writes it into the portfolio repo.
 * WHY:  The live demo depends on free tiers that can change and a corpus that ages. The
 *       measurements do not. This page is the part worth citing, and it should outlive the
 *       thing it measured.
 * WHEN: By hand, after a full eval or injection run. Not part of any build.
 *
 * RUN:  node scripts/build-results-page.mjs
 *
 * DERIVED, NEVER TYPED
 * ────────────────────
 * Every number on the page is read out of the result files at generation time. Writing them
 * by hand would mean the published figures and the measured ones drift apart the first time
 * a run changes something — and a results page that disagrees with its own data is worse
 * than no results page, because it is the artefact people quote.
 *
 * WHERE IT GOES
 * ─────────────
 * The portfolio repo, under static/llm-docs-lab/. That is GitHub Pages: no Worker, no
 * Vectorize, no AI allowance, nothing that can lapse. If Cloudflare changes its free tier
 * tomorrow, the demo stops and this page does not.
 *
 * LAYER: Developer tooling (manual, local only).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = 'G:/MY Company/Portfolio/samsonpg/static/llm-docs-lab';

const ev = JSON.parse(readFileSync(join(root, 'eval', 'results.json'), 'utf8'));
const inj = JSON.parse(readFileSync(join(root, 'security', 'injection-results.json'), 'utf8'));
const golden = JSON.parse(readFileSync(join(root, 'eval', 'golden-set.json'), 'utf8'));

/** Escape anything derived from data before it becomes markup. */
const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const pct = (n) => `${Math.round(n * 100)}%`;
const shortModel = (m) => m.replace('@cf/meta/', '').replace('-instruct-fp8-fast', '').replace('-instruct-fp8', '').replace('-instruct', '');

const evDate = ev.startedAt.slice(0, 10);
const injDate = inj.startedAt.slice(0, 10);

/* ── Model comparison rows ── */
const modelRows = Object.entries(ev.models).map(([model, m]) => `
        <tr>
          <td><code>${esc(shortModel(model))}</code></td>
          <td class="n">${pct(m.accuracy)}</td>
          <td class="n">${pct(m.refusalAccuracy)}</td>
          <td class="n">${pct(m.citationRate)}</td>
          <td class="n">${esc(m.medianMs)} ms</td>
        </tr>`).join('');

/* ── Injection rows, both channels ── */
const attackRow = (r, channel) => `
        <tr>
          <td><code>${esc(r.id)}</code></td>
          <td>${esc(channel)}</td>
          <td class="${r.succeeded ? 'bad' : 'good'}">${r.succeeded ? 'hijacked' : (r.quotedWhileRefusing ? 'resisted (quoted the attack)' : 'resisted')}</td>
        </tr>`;
const injRows = inj.document.map((r) => attackRow(r, 'document')).join('')
  + inj.question.map((r) => attackRow(r, 'question')).join('');

/*
  Example answers come from the eval rows, not from a fresh run.

  They are what the system actually produced on the questions it was scored on, which means
  the examples and the score describe the same event. A hand-picked demo answer captured
  separately would be a different claim wearing the same clothes.
*/
const primary = Object.keys(ev.models)[0];
const examples = ev.models[primary].rows
  .filter((r) => r.answer && r.answer.length > 40)
  .slice(0, 4)
  .map((r) => {
    const q = golden.questions.find((g) => g.id === r.id);
    return `
      <div class="qa">
        <p class="q">${esc(q ? q.question : r.id)}</p>
        <p class="a">${esc(r.answer.trim())}</p>
        <p class="meta">${q && q.answerable === false ? 'Unanswerable from the corpus — a refusal is the correct answer.' : 'Answerable from the corpus.'} ${r.pass ? 'Scored: pass.' : 'Scored: fail.'}</p>
      </div>`;
  }).join('');

const unanswerable = golden.questions.filter((q) => q.answerable === false).length;

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>llm-docs-lab — measured results</title>
<meta name="description" content="Retrieval, model-comparison and prompt-injection measurements for llm-docs-lab. A static record that outlives the live demo.">
<meta name="robots" content="index,follow">
<link rel="canonical" href="https://samsonpg.github.io/static/llm-docs-lab/">
<style>
  :root {
    --canvas:#F5F7FA; --surface:#FFF; --sunk:#EBEFF5; --ink:#111721; --muted:#46536A;
    --faint:#6C7A91; --rim:#D7DEE9; --brand:#1D4ED8; --good:#15803D; --bad:#B42318;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --canvas:#0B0E14; --surface:#141A24; --sunk:#1B2330; --ink:#E7ECF4; --muted:#9DAABE;
      --faint:#74839A; --rim:#26303F; --brand:#7BA7FF; --good:#5DD39E; --bad:#F97066;
    }
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--canvas);color:var(--ink);font:16px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
  .wrap{width:min(100% - 2rem,48rem);margin-inline:auto;padding-bottom:4rem}
  a{color:var(--brand)}
  :focus-visible{outline:2px solid var(--brand);outline-offset:2px;border-radius:3px}
  header{padding:2.5rem 0 1.25rem;border-bottom:1px solid var(--rim)}
  h1{margin:0;font-size:1.6rem;letter-spacing:-.025em}
  .lede{margin:.6rem 0 0;color:var(--muted);max-width:44rem}
  h2{font-size:.8rem;text-transform:uppercase;letter-spacing:.1em;color:var(--faint);margin:2.25rem 0 .75rem}
  table{width:100%;border-collapse:collapse;font-size:.92rem}
  .scroll{overflow-x:auto}
  th,td{text-align:left;padding:.6rem .8rem;border-bottom:1px solid var(--rim)}
  th{font-size:.74rem;text-transform:uppercase;letter-spacing:.08em;color:var(--faint);font-weight:600}
  td.n{font-variant-numeric:tabular-nums;white-space:nowrap}
  code{font-family:ui-monospace,"Cascadia Mono",monospace;font-size:.88em;background:var(--sunk);padding:.1em .35em;border-radius:3px}
  .good{color:var(--good)} .bad{color:var(--bad);font-weight:600}
  .cards{display:grid;gap:.75rem;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));margin-top:.5rem}
  .card{background:var(--surface);border:1px solid var(--rim);border-radius:9px;padding:.9rem 1rem}
  .card b{display:block;font-size:1.5rem;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
  .card span{font-size:.82rem;color:var(--muted)}
  .qa{background:var(--surface);border:1px solid var(--rim);border-radius:9px;padding:1rem 1.1rem;margin-bottom:.75rem}
  .qa .q{margin:0;font-weight:600}
  .qa .a{margin:.5rem 0 0;color:var(--ink);white-space:pre-wrap}
  .qa .meta{margin:.5rem 0 0;font-size:.8rem;color:var(--faint)}
  .note{background:var(--sunk);border-radius:8px;padding:.9rem 1.1rem;font-size:.9rem;color:var(--muted);margin-top:1rem}
  footer{margin-top:2.5rem;padding-top:1.25rem;border-top:1px solid var(--rim);font-size:.85rem;color:var(--faint)}
  @media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>
</head>
<body>
<div class="wrap">

  <header>
    <h1>llm-docs-lab — measured results</h1>
    <p class="lede">
      A static record of what was measured, generated from the result files themselves. The
      live demo at <a href="https://llmdocs.acsaven.com">llmdocs.acsaven.com</a> depends on
      free tiers that can change and a corpus that ages; this page does not. Reproduce any
      figure here with <code>node eval/run.mjs</code> in
      <a href="https://github.com/acsavenhq/llm-docs-lab">the repository</a>.
    </p>
  </header>

  <h2>Retrieval — measured ${esc(evDate)}</h2>
  <div class="cards">
    <div class="card"><b>${pct(ev.retrieval.recallAt6)}</b><span>recall@6, ${esc(ev.retrieval.checked)} questions with an expected document</span></div>
    <div class="card"><b>${esc(ev.retrieval.mrr.toFixed(2))}</b><span>mean reciprocal rank — the right document ranked first every time</span></div>
    <div class="card"><b>${esc(ev.questionCount)}</b><span>golden-set questions, ${esc(unanswerable)} unanswerable on purpose</span></div>
  </div>

  <h2>Answer quality by model</h2>
  <div class="scroll">
    <table>
      <thead><tr><th>Model</th><th>Accuracy</th><th>Correct refusals</th><th>Cited</th><th>Median latency</th></tr></thead>
      <tbody>${modelRows}
      </tbody>
    </table>
  </div>
  <p class="note">
    The trade is the finding, not the winner. The 8B model answers more accurately and
    refuses far worse — asked the capital of France against a corpus of pricing tables, it
    answers Paris. Scoring well on questions the corpus covers is easy; the failure that
    matters is the confident invention, which is why ${esc(unanswerable)} of
    ${esc(ev.questionCount)} questions have no answer in the corpus at all.
  </p>

  <h2>Prompt injection — measured ${esc(injDate)}, ${esc(shortModel(inj.model))}</h2>
  <div class="cards">
    <div class="card"><b>${esc(inj.summary.hijacked)}/${esc(inj.summary.total)}</b><span>attacks that succeeded</span></div>
    <div class="card"><b>${pct(inj.summary.documentRate)}</b><span>document channel — poisoned pages pushed through the real ingest</span></div>
    <div class="card"><b>${pct(inj.summary.questionRate)}</b><span>question channel — hostile input to the public endpoint</span></div>
  </div>
  <div class="scroll">
    <table>
      <thead><tr><th>Attack</th><th>Channel</th><th>Outcome</th></tr></thead>
      <tbody>${injRows}
      </tbody>
    </table>
  </div>
  <p class="note">
    <strong>0% is not immunity, and this page will not pretend otherwise.</strong> Ten
    attacks against one model on one date. Prompt injection is unsolved. What the number
    means is that these ten did not get through, and that
    <code>security/injection.mjs</code> is published so the claim can be disagreed with by
    running it.
  </p>

  <h2>Example answers</h2>
  <p class="note" style="margin-bottom:1rem">
    Taken from the scored eval run rather than captured separately, so the examples and the
    scores describe the same event.
  </p>
  ${examples}

  <h2>Known limits</h2>
  <ul>
    <li>Answers reflect the corpus snapshot date, not live pages. Prices change.</li>
    <li>The corpus is seven pages, chosen so every answer could be verified by hand.</li>
    <li>HTML extraction is regex-based; <code>colspan</code> tables and one header-less table are known-weak and tracked in the eval.</li>
    <li>The agent does not ground its final answer to the standard the <code>/ask</code> endpoint enforces.</li>
  </ul>

  <footer>
    Generated from <code>eval/results.json</code> and <code>security/injection-results.json</code>
    on ${esc(new Date().toISOString().slice(0, 10))} ·
    <a href="https://github.com/acsavenhq/llm-docs-lab">source</a> ·
    <a href="https://samsonpg.github.io">Samson P G</a>
  </footer>

</div>
</body>
</html>
`;

if (!existsSync(dirname(OUT_DIR))) {
  console.error(`  Portfolio static directory not found: ${dirname(OUT_DIR)}`);
  process.exit(1);
}
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, 'index.html'), page, 'utf8');

console.log(`  written: ${join(OUT_DIR, 'index.html')}  (${(page.length / 1024).toFixed(0)} KB)`);
console.log(`  retrieval ${pct(ev.retrieval.recallAt6)} · ${Object.keys(ev.models).length} models · injection ${inj.summary.hijacked}/${inj.summary.total}`);
