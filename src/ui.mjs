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
 * ~10 KB of HTML with inline CSS and JS. A framework would add a build step, a bundle and a
 * dependency tree to render one form and one answer — and this project's argument is that
 * the interesting engineering is in retrieval and measurement, not the front end.
 *
 * CONSISTENT WITH THE OTHER SITES
 * ───────────────────────────────
 * The theme switch stores under `samsonpg-theme` and sets `data-theme` on the root element,
 * matching the QR hub, the portfolio and the Try-family sites. Same key means one choice
 * follows a visitor across all of them rather than each site asking again.
 *
 * The boot script runs BEFORE the stylesheet is applied, inline in <head>. Reading the
 * preference after first paint means a dark-mode visitor gets a white flash on every
 * navigation, which is the single most noticeable way a theme toggle can be done badly.
 *
 * ACCESSIBILITY IS NOT DECORATION
 * ───────────────────────────────
 *   - a real <form>, so Enter submits and a screen reader announces it
 *   - the answer region is aria-live="polite", so streamed text is read as it lands
 *   - the theme switch is a radio-style group with aria-pressed, reachable by keyboard
 *   - back-to-top is a real <button>, focusable, and hidden from assistive tech until useful
 *   - visible focus, WCAG AA contrast in both themes, usable at 200% zoom
 *   - every animation is disabled under prefers-reduced-motion, including the scroll
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
<meta name="theme-color" content="#f7f8f8">

<script>
  /*
    Theme, before first paint.

    Inline and synchronous on purpose: anything deferred runs after the browser has already
    painted, so a dark-mode visitor sees a white flash. The key matches the other sites, so
    a choice made on the QR hub or the portfolio carries over here.
  */
  (function () {
    try {
      var k = 'samsonpg-theme';
      var s = localStorage.getItem(k);
      var pref = (s === 'light' || s === 'dark' || s === 'system') ? s : 'system';
      var theme = pref === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : pref;
      document.documentElement.setAttribute('data-theme', theme);
      document.documentElement.setAttribute('data-theme-pref', pref);
      document.documentElement.style.colorScheme = theme;
    } catch (e) {
      /* Private mode can throw on localStorage. A readable page matters more than the choice. */
      document.documentElement.setAttribute('data-theme', 'light');
      document.documentElement.setAttribute('data-theme-pref', 'system');
    }
  })();
</script>

<style>
  /*
    Light is the base palette; dark is layered twice — once for the system preference and
    once for an explicit choice — so the toggle wins in both directions. A colour defined
    only inside a media query never applies when the attribute is set, which is how themed
    pages end up rendering one theme's text on the other theme's background.
  */
  :root {
    --bg: #f7f8f8; --panel: #fff; --sunk: #eef1f2; --ink: #14191c; --muted: #55636b;
    --faint: #7d8b93; --rule: #dbe1e4; --accent: #0f5f66; --accent-ink: #fff;
    --warn-bg: #fdf3e7; --warn-ink: #8a4b12; --shadow: 0 2px 10px rgba(20, 25, 28, .10);
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg: #0d1316; --panel: #141c20; --sunk: #1a2429; --ink: #e9eff1; --muted: #9aa8ae;
      --faint: #6f7f87; --rule: #26333a; --accent: #5cc4cc; --accent-ink: #06222a;
      --warn-bg: #2a1d10; --warn-ink: #e0a668; --shadow: 0 2px 10px rgba(0, 0, 0, .45);
    }
  }
  :root[data-theme="dark"] {
    --bg: #0d1316; --panel: #141c20; --sunk: #1a2429; --ink: #e9eff1; --muted: #9aa8ae;
    --faint: #6f7f87; --rule: #26333a; --accent: #5cc4cc; --accent-ink: #06222a;
    --warn-bg: #2a1d10; --warn-ink: #e0a668; --shadow: 0 2px 10px rgba(0, 0, 0, .45);
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
  .skip:focus { left: 0; top: 0; background: var(--accent); color: var(--accent-ink); padding: .6rem 1rem; z-index: 6; }

  /* Header + theme switch ------------------------------------------------- */

  header { padding: 2rem 0 1.25rem; border-bottom: 1px solid var(--rule); }
  .head-row { display: flex; gap: 1rem; align-items: flex-start; justify-content: space-between; }
  h1 { margin: 0; font-size: 1.5rem; letter-spacing: -.02em; }
  .sub { margin: .4rem 0 0; color: var(--muted); font-size: .95rem; }

  .theme-switch {
    display: inline-flex; gap: 2px; padding: 2px; flex: 0 0 auto;
    background: var(--sunk); border: 1px solid var(--rule); border-radius: 999px;
  }
  .theme-switch button {
    display: grid; place-items: center; width: 30px; height: 30px; padding: 0;
    background: none; border: 0; border-radius: 999px; cursor: pointer; color: var(--muted);
  }
  .theme-switch button svg { width: 15px; height: 15px; fill: currentColor; }
  .theme-switch button[aria-pressed="true"] { background: var(--panel); color: var(--accent); box-shadow: var(--shadow); }

  /* Form ------------------------------------------------------------------ */

  form { display: flex; gap: .5rem; margin: 1.5rem 0 .5rem; flex-wrap: wrap; }
  label { flex: 1 1 18rem; }
  .lbl { display: block; font-size: .82rem; color: var(--muted); margin-bottom: .3rem; }
  input[type=search] {
    width: 100%; padding: .7rem .85rem; font: inherit; color: var(--ink);
    background: var(--panel); border: 1px solid var(--rule); border-radius: 7px;
  }
  .ask {
    padding: .7rem 1.3rem; font: inherit; font-weight: 600; cursor: pointer;
    background: var(--accent); color: var(--accent-ink);
    border: 1px solid transparent; border-radius: 7px; align-self: flex-end;
  }
  .ask[disabled] { opacity: .55; cursor: progress; }

  .examples { display: flex; flex-wrap: wrap; gap: .4rem; margin: .3rem 0 0; padding: 0; list-style: none; }
  .examples button {
    background: var(--sunk); color: var(--muted); font: inherit; font-size: .82rem;
    padding: .3rem .6rem; border: 1px solid var(--rule); border-radius: 999px; cursor: pointer;
  }

  /* Answer + sources ------------------------------------------------------ */

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

  /* Back to top ----------------------------------------------------------- */

  .to-top {
    position: fixed; right: 1rem; bottom: 1rem; z-index: 5;
    display: grid; place-items: center; width: 42px; height: 42px; padding: 0;
    background: var(--panel); color: var(--accent);
    border: 1px solid var(--rule); border-radius: 999px; box-shadow: var(--shadow);
    cursor: pointer; opacity: 0; visibility: hidden; transform: translateY(8px);
    transition: opacity .18s ease, transform .18s ease, visibility .18s;
  }
  .to-top.is-visible { opacity: 1; visibility: visible; transform: none; }
  .to-top svg { width: 17px; height: 17px; fill: currentColor; }
  @media (max-width: 30rem) { .to-top { right: .7rem; bottom: .7rem; } }

  @media (prefers-reduced-motion: reduce) {
    * { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
  }
</style>
</head>
<body>
<a class="skip" href="#q">Skip to the question</a>
<div class="wrap">

  <header>
    <div class="head-row">
      <div>
        <h1>llm-docs-lab</h1>
        <p class="sub">
          Ask about LLM provider pricing and rate limits. Answers come only from a fixed
          snapshot of seven provider documentation pages, and every claim is cited.
        </p>
      </div>

      <div class="theme-switch" role="group" aria-label="Colour theme">
        <button type="button" data-theme-pref="light" aria-pressed="false" title="Light" aria-label="Light theme">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 17a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-13a1 1 0 0 1-1-1V1a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1Zm0 19a1 1 0 0 1-1-1v-2a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1ZM4 13H2a1 1 0 1 1 0-2h2a1 1 0 1 1 0 2Zm18 0h-2a1 1 0 1 1 0-2h2a1 1 0 1 1 0 2ZM5.6 6.99 4.19 5.58a1 1 0 0 1 1.42-1.42L7.02 5.58A1 1 0 1 1 5.6 6.99Zm12.79 12.8-1.41-1.42a1 1 0 0 1 1.41-1.41l1.42 1.41a1 1 0 0 1-1.42 1.42ZM7.02 18.4l-1.41 1.42a1 1 0 0 1-1.42-1.42l1.42-1.41A1 1 0 0 1 7.02 18.4ZM19.8 5.58 18.4 7a1 1 0 1 1-1.41-1.42l1.41-1.41a1 1 0 1 1 1.41 1.41Z"/></svg>
        </button>
        <button type="button" data-theme-pref="system" aria-pressed="true" title="Match system" aria-label="Match system theme">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-5v2h3a1 1 0 1 1 0 2H7a1 1 0 1 1 0-2h3v-2H5a2 2 0 0 1-2-2V5Zm2 0v9h14V5H5Z"/></svg>
        </button>
        <button type="button" data-theme-pref="dark" aria-pressed="false" title="Dark" aria-label="Dark theme">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.64 13a1 1 0 0 0-1.05-.14 8 8 0 0 1-10.45-10.4A1 1 0 0 0 9 1.11 10 10 0 1 0 22 14.05a1 1 0 0 0-.36-1.05Z"/></svg>
        </button>
      </div>
    </div>
  </header>

  <main id="main">
    <form id="f">
      <label>
        <span class="lbl" id="qlabel">Your question</span>
        <input id="q" name="q" type="search" autocomplete="off" required
               aria-labelledby="qlabel"
               placeholder="How many neurons per day are free on Workers AI?">
      </label>
      <button type="submit" class="ask" id="go">Ask</button>
    </form>

    <ul class="examples" aria-label="Example questions">
      <li><button type="button" data-q="How many neurons per day are free on Cloudflare Workers AI?">free neurons per day</button></li>
      <li><button type="button" data-q="What does Gemini 3.7 Flash cost for input tokens on the paid tier?">Gemini input price</button></li>
      <li><button type="button" data-q="What are the rate limits on the Gemini free tier?">Gemini free limits</button></li>
      <li><button type="button" data-q="What is the base input token price for Claude Opus 5?">Claude Opus price</button></li>
    </ul>

    <div class="answer" id="a" role="region" aria-live="polite" aria-atomic="false" aria-label="Answer"></div>

    <div id="src-wrap" hidden>
      <h2>Sources</h2>
      <ol class="sources" id="src"></ol>
    </div>

    <p class="note">
      Answers reflect a snapshot of the documentation, not today's live pages — each source
      shows when it was retrieved. Prices change; check the provider before relying on a figure.
    </p>
  </main>

  <footer>
    Built by <a href="https://samsonpg.github.io">Samson P G</a> ·
    <a href="https://github.com/acsavenhq/llm-docs-lab">source, evals and measured limits on GitHub</a>
  </footer>
</div>

<button type="button" class="to-top" id="totop" aria-label="Back to top" title="Back to top" hidden>
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4a1 1 0 0 1 .7.3l7 7a1 1 0 0 1-1.4 1.4L13 7.4V19a1 1 0 1 1-2 0V7.4l-5.3 5.3a1 1 0 1 1-1.4-1.4l7-7A1 1 0 0 1 12 4Z"/></svg>
</button>

<script>
(() => {
  /* ── Theme ──────────────────────────────────────────────────────────── */

  const KEY = 'samsonpg-theme';
  const root = document.documentElement;
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const themeMeta = document.querySelector('meta[name="theme-color"]');

  const resolve = (pref) => (pref === 'system' ? (media.matches ? 'dark' : 'light') : pref);

  function applyTheme(pref) {
    const theme = resolve(pref);
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-theme-pref', pref);
    root.style.colorScheme = theme;
    if (themeMeta) themeMeta.setAttribute('content', theme === 'dark' ? '#0d1316' : '#f7f8f8');
    document.querySelectorAll('[data-theme-pref]').forEach((b) => {
      if (b.tagName === 'BUTTON') b.setAttribute('aria-pressed', String(b.dataset.themePref === pref));
    });
  }

  let stored = 'system';
  try {
    const s = localStorage.getItem(KEY);
    if (s === 'light' || s === 'dark' || s === 'system') stored = s;
  } catch (e) { /* private mode; fall back to system */ }
  applyTheme(stored);

  document.querySelectorAll('.theme-switch [data-theme-pref]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pref = btn.dataset.themePref;
      applyTheme(pref);
      try { localStorage.setItem(KEY, pref); } catch (e) { /* choice is session-only */ }
    });
  });

  /* Following the system while set to "system" — otherwise the choice goes stale mid-visit. */
  media.addEventListener('change', () => {
    if (root.getAttribute('data-theme-pref') === 'system') applyTheme('system');
  });

  /* ── Back to top ────────────────────────────────────────────────────── */

  const toTop = document.getElementById('totop');
  /* Never show on a page barely longer than the window — the control would be noise. */
  const MIN_SCROLLABLE = 240;
  /* Past this many pixels, scrolling back by hand is a nuisance. */
  const SHOW_AFTER = 320;
  let ticking = false;

  function syncToTop() {
    /*
      The threshold adapts to how much the page can actually scroll.

      A fixed 320px was wrong, and measurably so: this page is scrollable by exactly 320px
      at a 1100x820 window, so scrollY greater than 320 could never be true and the button
      was unreachable no matter how far you scrolled. A threshold equal to the maximum
      scroll is a feature that silently does not exist.

      (No backticks in this file, ever. The whole page is a template literal, so one
      backtick inside a comment ends the string and the module stops parsing — which is
      exactly how this comment broke the build the first time it was written.)

      Taking the lesser of the fixed distance and 60% of what is scrollable means the
      control appears near the bottom of a short page and after a sensible distance on a
      long one, while MIN_SCROLLABLE keeps it off pages that hardly scroll at all.
    */
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const threshold = Math.min(SHOW_AFTER, scrollable * 0.6);
    const show = scrollable > MIN_SCROLLABLE && window.scrollY >= threshold;

    toTop.hidden = !show;
    toTop.classList.toggle('is-visible', show);
    ticking = false;
  }
  /*
    Scroll fires far more often than a frame renders, so the handler only schedules work and
    the class change happens once per frame. Reading scrollY in the handler itself is what
    makes a back-to-top button janky on a long page.
  */
  addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(syncToTop); }
  }, { passive: true });
  syncToTop();

  toTop.addEventListener('click', () => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    /* Focus returns to the top so a keyboard user continues from where the page now is. */
    document.getElementById('q').focus({ preventScroll: true });
  });

  /* ── Ask ────────────────────────────────────────────────────────────── */

  const form = document.getElementById('f');
  const input = document.getElementById('q');
  const out = document.getElementById('a');
  const go = document.getElementById('go');
  const srcWrap = document.getElementById('src-wrap');
  const srcList = document.getElementById('src');

  document.querySelectorAll('.examples button').forEach((b) => {
    b.addEventListener('click', () => { input.value = b.dataset.q; form.requestSubmit(); });
  });

  /* Text, never innerHTML. Model output and source text are untrusted and must not become markup. */
  function renderSources(sources) {
    srcList.textContent = '';
    for (const s of sources) {
      const li = document.createElement('li');
      const snippet = document.createElement('span');
      snippet.className = 'snippet';
      const t = s.text || '';
      snippet.textContent = t.slice(0, 220) + (t.length > 220 ? '…' : '');
      const meta = document.createElement('span');
      meta.className = 'meta';
      const link = document.createElement('a');
      link.href = s.source || '#';
      link.rel = 'noopener noreferrer';
      link.target = '_blank';
      try { link.textContent = s.source ? new URL(s.source).hostname : 'source'; }
      catch (e) { link.textContent = 'source'; }
      meta.append(link, document.createTextNode(s.fetchedAt ? ' · retrieved ' + String(s.fetchedAt).slice(0, 10) : ''));
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

    if (inflight) inflight.abort();
    inflight = new AbortController();

    go.disabled = true;
    srcWrap.hidden = true;
    out.classList.add('placeholder');
    out.textContent = 'Searching the corpus…';

    try {
      const res = await fetch('/ask?q=' + encodeURIComponent(q), { signal: inflight.signal });

      /*
        A rate limit is a normal outcome on a free tier, not an error to hide behind
        "something went wrong". Saying which limit was hit is the difference between a
        visitor waiting a minute and a visitor deciding the demo is broken.
      */
      if (res.status === 429) {
        out.classList.remove('placeholder');
        out.textContent = 'Rate limited — this runs on a free allowance shared by everyone. Wait about a minute and try again.';
        return;
      }
      if (!res.ok) throw new Error('HTTP ' + res.status);

      let sources = [];
      try { sources = JSON.parse(decodeURIComponent(res.headers.get('x-sources') || '%5B%5D')); }
      catch (err) { /* sources are a bonus; the answer still renders without them */ }
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
