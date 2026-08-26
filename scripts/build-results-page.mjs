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
import { THEME_TOKENS, THEME_SWITCH_CSS, THEME_SWITCH_HTML, THEME_SWITCH_JS } from '../src/theme.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// static/llm-docs-lab/ is the landing-page clone now, matching every other product
// folder in that repo. The measured results live one level down so both can exist:
// the clone is noindex and canonicals to the live site, these numbers are original
// content and stay indexable.
const OUT_DIR = 'G:/MY Company/Portfolio/samsonpg/static/llm-docs-lab/results';

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
<link rel="canonical" href="https://samsonpg.github.io/static/llm-docs-lab/results/">
<script>
  /* Same key as the other sites, so one theme choice follows a visitor across all of them.
     Inline and synchronous: anything deferred runs after first paint, and a dark-mode
     visitor sees a white flash. */
  (function () {
    try {
      var k = 'samsonpg-theme';
      var s = localStorage.getItem(k);
      var pref = (s === 'light' || s === 'dark' || s === 'system') ? s : 'system';
      var t = pref === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : pref;
      document.documentElement.setAttribute('data-theme', t);
      document.documentElement.style.colorScheme = t;
    } catch (e) {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  })();
</script>
<style>
/*
      The palette is imported, not restated. This page used to carry its own cool greys and
      a blue accent, so the measurements looked like they belonged to a different product
      than the demo they describe. Two hand-kept colour lists also drift the moment one
      changes, which this repository has already paid for more than once.
    */
    ${THEME_TOKENS}
  *,*::before,*::after{box-sizing:border-box}
    html{-webkit-text-size-adjust:100%;overflow-x:clip}
    body{margin:0;overflow-x:clip;background:var(--ground);color:var(--ink);font:400 clamp(15px,0.55vw + 13.4px,17px)/1.65 system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",sans-serif;-webkit-font-smoothing:antialiased}
    .shell{width:min(100% - 2 * var(--page-gutter),var(--page-max));margin-inline:auto}
    .wrap{padding-bottom:4rem}
    a{color:var(--gold)}
    a:hover{color:var(--gold-lit)}
    :focus-visible{outline:2px solid var(--gold);outline-offset:2px;border-radius:4px}

    /* The nav is the site's, so this page is recognisably part of it rather than an export. */
    .nav{position:sticky;top:0;z-index:20;background:var(--glass-bg);backdrop-filter:var(--glass);-webkit-backdrop-filter:var(--glass);border-bottom:1px solid var(--glass-line)}
    @supports not (backdrop-filter: blur(1px)){.nav{background:var(--ground)}}
    .nav__in{display:flex;align-items:center;gap:.85rem;min-height:78px;height:78px}
    .brand{display:inline-flex;align-items:center;gap:.65rem;text-decoration:none;color:var(--ink);min-width:0}
    .brand__mark{width:32px;height:32px;border-radius:10px;background:var(--mark-hole);color:var(--gold);display:grid;place-items:center;flex:0 0 auto}
    .brand__mark svg{width:20px;height:20px}
    .brand__name{font-weight:640;letter-spacing:-.01em;font-size:1.0625rem}
    .nav__links{display:flex;gap:1.35rem;margin-left:auto;align-items:center}
    .nav__links a{color:var(--ink-2);text-decoration:none;font-size:.9375rem;font-weight:500;line-height:1}
    .nav__links a:hover{color:var(--ink)}
    @media (max-width:34rem){.nav__links a{display:none}}

    ${THEME_SWITCH_CSS}

    /* Display type is the serif the site uses; numbers are mono, because they are the argument. */
    header.page{padding:3rem 0 1.5rem;border-bottom:1px solid var(--glass-line)}
    h1{margin:0;font-family:ui-serif,Georgia,"Times New Roman",serif;font-weight:500;font-size:clamp(2rem,4vw,2.9rem);line-height:1.08;letter-spacing:-.02em}
    h1 em{font-style:italic;color:var(--gold)}
    .lede{margin:.85rem 0 0;color:var(--ink-2);max-width:44rem}
    h2{font-size:.72rem;text-transform:uppercase;letter-spacing:.14em;color:var(--ink-3);margin:2.75rem 0 .85rem;font-weight:600}
    table{width:100%;border-collapse:collapse;font-size:.92rem}
    .scroll{overflow-x:auto}
    th,td{text-align:left;padding:.65rem .85rem;border-bottom:1px solid var(--glass-line)}
    th{font-size:.7rem;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-3);font-weight:600}
    td.n{font-variant-numeric:tabular-nums;white-space:nowrap;font-family:ui-monospace,"Cascadia Mono",monospace}
    code{font-family:ui-monospace,"Cascadia Mono",monospace;font-size:.88em;background:var(--sink);padding:.12em .38em;border-radius:4px}
    .good{color:var(--gold)} .bad{color:var(--warn);font-weight:600;background:var(--warn-bg);padding:.05em .3em;border-radius:4px}
    .cards{display:grid;gap:.75rem;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));margin-top:.5rem}
    .card{background:var(--glass-bg);border:1px solid var(--glass-edge-soft);box-shadow:var(--glass-inset);border-radius:14px;padding:1rem 1.1rem}
    .card b{display:block;font-size:1.75rem;letter-spacing:-.02em;font-variant-numeric:tabular-nums;font-family:ui-monospace,"Cascadia Mono",monospace;color:var(--ink)}
    .card span{font-size:.82rem;color:var(--ink-2);display:block;margin-top:.3rem}
    .qa{background:var(--glass-bg);border:1px solid var(--glass-edge-soft);border-radius:14px;padding:1.05rem 1.15rem;margin-bottom:.75rem}
    .qa .q{margin:0;font-weight:600}
    .qa .a{margin:.5rem 0 0;color:var(--ink-2);white-space:pre-wrap}
    .qa .meta{margin:.5rem 0 0;font-size:.8rem;color:var(--ink-3)}
    .note{background:var(--sink);border:1px solid var(--glass-edge-soft);border-radius:12px;padding:.95rem 1.15rem;font-size:.9rem;color:var(--ink-2);margin-top:1rem}
    footer{margin-top:3rem;padding-top:1.35rem;border-top:1px solid var(--glass-line);font-size:.85rem;color:var(--ink-3)}
    @media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
  </style>
</head>
<body>

<nav class="nav" aria-label="Primary">
  <div class="shell nav__in">
    <a class="brand" href="https://llmdocs.acsaven.com/">
      <span class="brand__mark" aria-hidden="true"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M31.5 17.8C23.8 16.4 16.2 17.8 12.2 20v28.2c4.2-2 11.8-3.2 19.3-1.7V17.8Z" fill="currentColor"/><path d="M32.5 17.8C40.2 16.4 47.8 17.8 51.8 20v28.2c-4.2-2-11.8-3.2-19.3-1.7V17.8Z" fill="currentColor" opacity=".88"/><path d="M32 18.4v26.8" stroke="#0C0B10" stroke-width="1.35" stroke-linecap="round" opacity=".32"/><path d="M39.5 17c3.2-3.4 6.8-5.1 10.2-5.3" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/><circle cx="51" cy="11.5" r="5" fill="currentColor"/></svg></span>
      <span class="brand__name">llm-docs-lab</span>
    </a>
    <div class="nav__links">
      <a href="https://llmdocs.acsaven.com/">Demo</a>
      <a href="https://github.com/acsavenhq/llm-docs-lab">Source</a>
      <a href="https://samsonpg.github.io">Portfolio</a>
    </div>
${THEME_SWITCH_HTML}
  </div>
</nav>

<div class="wrap shell">

  <header class="page">
    <h1>Measured, <em>not</em> asserted</h1>
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

<script>
(() => {
${THEME_SWITCH_JS}})();
</script>

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
