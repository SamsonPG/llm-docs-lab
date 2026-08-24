/**
 * src/ui.mjs
 *
 * WHAT: The single HTML page served at /.
 * WHY:  A retrieval system nobody can try is a repository, not a demo. This is the page a
 *       recruiter opens from the CV, so it has to work on a phone, on a slow connection,
 *       and with the keyboard alone.
 * WHEN: Served by the Worker at /.
 *
 * DELIBERATELY ONE FILE, NO BUILD, NO FRAMEWORK
 * ─────────────────────────────────────────────
 * The page is ~6 KB of HTML with inline CSS and JS. A framework would add a build step, a
 * bundle, and a dependency tree to render one form and one answer — and this project's
 * whole argument is that the interesting engineering is in retrieval and measurement, not
 * in the front end.
 *
 * ACCESSIBILITY IS NOT OPTIONAL AND IT IS NOT DECORATION
 * ──────────────────────────────────────────────────────
 *   - The form is a real <form>, so Enter submits and a screen reader announces it.
 *   - The answer region is aria-live="polite", so streamed text is read out as it lands
 *     rather than silently appearing.
 *   - Focus is visible, contrast meets WCAG 2.2 AA on both themes, and the whole page is
 *     usable at 200% zoom and with prefers-reduced-motion.
 *   - Every colour is defined for light and dark, with dark driven by prefers-color-scheme
 *     rather than assuming a preference.
 *
 * LAYER: Delivery (presentation).
 */

export const PAGE = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>llm-docs-lab — ask about LLM provider pricing</title>
<meta name="description" content="Retrieval over LLM provider pricing and rate-limit documentation, with citations and a stated snapshot date.">
<meta name="color-scheme" content="light dark">
<style>
  :root {
    --bg: #f7f8f8; --panel: #fff; --sunk: #eef1f2; --ink: #14191c; --muted: #55636b;
    --faint: #7d8b93; --rule: #dbe1e4; --accent: #0f5f66; --accent-ink: #fff;
    --warn-bg: #fdf3e7; --warn-ink: #8a4b12;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0d1316; --panel: #141c20; --sunk: #1a2429; --ink: #e9eff1; --muted: #9aa8ae;
      --faint: #6f7f87; --rule: #26333a; --accent: #5cc4cc; --accent-ink: #06222a;
      --warn-bg: #2a1d10; --warn-ink: #e0a668;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--ink);
    font: 16px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { width: min(100% - 2rem, 46rem); margin-inline: auto; padding-bottom: 4rem; }
  a { color: var(--accent); }
  :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 3px; }
  .skip { position: absolute; left: -9999px; }
  .skip:focus { left: 0; top: 0; background: var(--accent); color: var(--accent-ink); padding: .6rem 1rem; z-index: 5; }

  header { padding: 2.5rem 0 1.25rem; border-bottom: 1px solid var(--rule); }
  h1 { margin: 0; font-size: 1.5rem; letter-spacing: -.02em; }
  .sub { margin: .4rem 0 0; color: var(--muted); font-size: .95rem; }

  form { display: flex; gap: .5rem; margin: 1.5rem 0 .5rem; flex-wrap: wrap; }
  label { flex: 1 1 18rem; }
  .lbl { display: block; font-size: .82rem; color: var(--muted); margin-bottom: .3rem; }
  input[type=search] {
    width: 100%; padding: .7rem .85rem; font: inherit; color: var(--ink);
    background: var(--panel); border: 1px solid var(--rule); border-radius: 7px;
  }
  button {
    padding: .7rem 1.3rem; font: inherit; font-weight: 600; cursor: pointer;
    background: var(--accent); color: var(--accent-ink);
    border: 1px solid transparent; border-radius: 7px; align-self: flex-end;
  }
  button[disabled] { opacity: .55; cursor: progress; }

  .examples { display: flex; flex-wrap: wrap; gap: .4rem; margin: .3rem 0 0; padding: 0; list-style: none; }
  .examples button {
    background: var(--sunk); color: var(--muted); font-weight: 400; font-size: .82rem;
    padding: .3rem .6rem; border: 1px solid var(--rule); border-radius: 999px;
  }

  .answer {
    margin-top: 1.5rem; padding: 1.1rem 1.2rem; background: var(--panel);
    border: 1px solid var(--rule); border-radius: 9px; min-height: 3rem; white-space: pre-wrap;
  }
  .answer:empty { display: none; }
  .placeholder { color: var(--faint); }

  h2 { font-size: .78rem; text-transform: uppercase; letter-spacing: .1em; color: var(--faint); margin: 1.75rem 0 .6rem; }
  ol.sources { margin: 0; padding-left: 1.3rem; }
  ol.sources li { margin-bottom: .7rem; font-size: .88rem; color: var(--muted); }
  ol.sources .snippet { display: block; color: var(--ink); margin-top: .15rem; }
  ol.sources .meta { font-size: .78rem; color: var(--faint); }

  .note {
    margin-top: 2rem; padding: .8rem 1rem; background: var(--warn-bg); color: var(--warn-ink);
    border-radius: 7px; font-size: .85rem;
  }
  footer { margin-top: 2.5rem; padding-top: 1.25rem; border-top: 1px solid var(--rule); font-size: .84rem; color: var(--faint); }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
</style>
</head>
<body>
<a class="skip" href="#q">Skip to the question</a>
<div class="wrap">

  <header>
    <h1>llm-docs-lab</h1>
    <p class="sub">
      Ask about LLM provider pricing and rate limits. Answers come only from a fixed snapshot
      of seven provider documentation pages, and every claim is cited.
    </p>
  </header>

  <main id="main">
    <form id="f">
      <label>
        <span class="lbl" id="qlabel">Your question</span>
        <input id="q" name="q" type="search" autocomplete="off" required
               aria-labelledby="qlabel"
               placeholder="How many neurons per day are free on Workers AI?">
      </label>
      <button type="submit" id="go">Ask</button>
    </form>

    <ul class="examples" aria-label="Example questions">
      <li><button type="button" data-q="How many neurons per day are free on Cloudflare Workers AI?">free neurons per day</button></li>
      <li><button type="button" data-q="What does Gemini 3 Pro cost for input tokens on the paid tier?">Gemini input price</button></li>
      <li><button type="button" data-q="What are the rate limits on the Gemini free tier?">Gemini free limits</button></li>
      <li><button type="button" data-q="How much does Claude Opus cost per million tokens?">Claude Opus price</button></li>
    </ul>

    <div class="answer" id="a" role="region" aria-live="polite" aria-atomic="false" aria-label="Answer"></div>

    <div id="src-wrap" hidden>
      <h2>Sources</h2>
      <ol class="sources" id="src"></ol>
    </div>

    <p class="note">
      Answers reflect a snapshot of the documentation, not today's live pages — each source
      below shows when it was retrieved. Prices change; check the provider before relying on
      a figure.
    </p>
  </main>

  <footer>
    Built by <a href="https://samsonpg.github.io">Samson P G</a> ·
    <a href="https://github.com/acsavenhq/llm-docs-lab">source, evals and measured limits on GitHub</a>
  </footer>
</div>

<script>
(() => {
  const form = document.getElementById('f');
  const input = document.getElementById('q');
  const out = document.getElementById('a');
  const go = document.getElementById('go');
  const srcWrap = document.getElementById('src-wrap');
  const srcList = document.getElementById('src');

  document.querySelectorAll('.examples button').forEach((b) => {
    b.addEventListener('click', () => { input.value = b.dataset.q; form.requestSubmit(); });
  });

  /* Text, never innerHTML. Model output is untrusted and must not become markup. */
  function renderSources(sources) {
    srcList.textContent = '';
    for (const s of sources) {
      const li = document.createElement('li');
      const snippet = document.createElement('span');
      snippet.className = 'snippet';
      snippet.textContent = (s.text || '').slice(0, 220) + ((s.text || '').length > 220 ? '…' : '');
      const meta = document.createElement('span');
      meta.className = 'meta';
      const when = s.fetchedAt ? ' · retrieved ' + String(s.fetchedAt).slice(0, 10) : '';
      const link = document.createElement('a');
      link.href = s.source || '#';
      link.textContent = s.source ? new URL(s.source).hostname : 'source';
      link.rel = 'noopener noreferrer';
      link.target = '_blank';
      meta.append(link, document.createTextNode(when));
      li.append(snippet, meta);
      srcList.append(li);
    }
    srcWrap.hidden = sources.length === 0;
  }

  let inflight = null;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;

    /* A second question cancels the first, rather than interleaving two streams. */
    if (inflight) inflight.abort();
    inflight = new AbortController();

    go.disabled = true;
    srcWrap.hidden = true;
    out.textContent = '';
    out.classList.add('placeholder');
    out.textContent = 'Searching the corpus…';

    try {
      const res = await fetch('/ask?q=' + encodeURIComponent(q), { signal: inflight.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);

      const sources = JSON.parse(decodeURIComponent(res.headers.get('x-sources') || '%5B%5D'));
      renderSources(sources);

      out.classList.remove('placeholder');
      out.textContent = '';
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        out.textContent += dec.decode(value, { stream: true });
      }
      if (!out.textContent) out.textContent = 'The model returned nothing for that question.';
    } catch (err) {
      if (err.name === 'AbortError') return;
      out.classList.remove('placeholder');
      out.textContent = 'Something went wrong: ' + err.message + '. Try again in a moment.';
    } finally {
      go.disabled = false;
      inflight = null;
    }
  });
})();
</script>
</body>
</html>`;
