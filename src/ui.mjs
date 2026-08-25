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
<meta name="description" content="Ask about LLM provider pricing and rate limits. Answers come from a fixed snapshot of seven provider documentation pages, every claim cited, with published retrieval and prompt-injection measurements.">
<link rel="canonical" href="https://llmdocs.acsaven.com/">

<!--
  DISCOVERY: search engines, and the assistants that increasingly sit in front of them.

  Two audiences, one set of tags. A search engine wants a title, a description and a
  canonical. An assistant answering "is there a tool for comparing LLM provider pricing"
  wants something it can quote and attribute — which is why the structured data below
  states what this is, who made it, and what it measured, rather than a bag of keywords.

  The measured numbers are in the JSON-LD on purpose. A claim an assistant can attribute to
  a named source is worth more than an adjective it has to take on faith, and these are the
  same figures the README publishes and eval/run.mjs reproduces.
-->
<meta property="og:type" content="website">
<meta property="og:site_name" content="llm-docs-lab">
<meta property="og:title" content="llm-docs-lab — ask about LLM provider pricing">
<meta property="og:description" content="Cited answers from a fixed snapshot of seven provider documentation pages. 100% recall@6 on a 20-question golden set; 0/10 prompt-injection attacks landed.">
<meta property="og:url" content="https://llmdocs.acsaven.com/">
<meta name="twitter:card" content="summary">
<meta name="author" content="Samson P G">

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "llm-docs-lab",
      "applicationCategory": "DeveloperApplication",
      "url": "https://llmdocs.acsaven.com/",
      "description": "Retrieval over LLM provider pricing and rate-limit documentation. Answers are grounded in a fixed documentation snapshot and cite their sources, and the system's retrieval quality and prompt-injection resistance are published as measurements.",
      "operatingSystem": "Any",
      "isAccessibleForFree": true,
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
      "author": { "@id": "https://samsonpg.github.io/#person" },
      "codeRepository": "https://github.com/acsavenhq/llm-docs-lab",
      "featureList": [
        "Retrieval-augmented answers with numbered citations",
        "Fixed documentation snapshot with a stated retrieval date",
        "Published evaluation across multiple models",
        "Measured prompt-injection resistance",
        "Tool-calling agent with step and cost ceilings"
      ]
    },
    {
      "@type": "Person",
      "@id": "https://samsonpg.github.io/#person",
      "name": "Samson P G",
      "url": "https://samsonpg.github.io",
      "jobTitle": "Full-Stack Engineer",
      "worksFor": { "@type": "Organization", "name": "Acsaven", "url": "https://acsaven.com" },
      "sameAs": ["https://github.com/SamsonPG", "https://github.com/acsavenhq", "https://www.linkedin.com/in/samson-p-g-335964133"]
    },
    {
      "@type": "Dataset",
      "name": "llm-docs-lab evaluation results",
      "description": "Retrieval and answer-quality measurements across three models on a 20-question golden set, and prompt-injection attack results across two channels.",
      "url": "https://github.com/acsavenhq/llm-docs-lab#results",
      "creator": { "@id": "https://samsonpg.github.io/#person" },
      "license": "https://opensource.org/licenses/MIT",
      "variableMeasured": [
        { "@type": "PropertyValue", "name": "Retrieval recall@6", "value": "100%" },
        { "@type": "PropertyValue", "name": "Mean reciprocal rank", "value": "1.00" },
        { "@type": "PropertyValue", "name": "Prompt-injection attack success rate", "value": "0/10" }
      ]
    }
  ]
}
</script>
<meta name="theme-color" content="#080C0B" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#F2F9F5" media="(prefers-color-scheme: light)">

<!--
  Favicon as an inline SVG data URI.

  The page is deliberately a single response with no sub-resources, and a separate
  favicon.ico would be the only thing breaking that — one extra request, one more file to
  deploy, one more thing to 404. The mark is the brand green on the near-black canvas,
  matching TryTokka, and an SVG stays sharp on every display.
-->
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23080C0B'/%3E%3Cpath d='M18 44V20h6v18h11v6H18Z' fill='%2334E89A'/%3E%3Ccircle cx='44' cy='24' r='5' fill='%2334E89A'/%3E%3C/svg%3E">
<link rel="apple-touch-icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23080C0B'/%3E%3Cpath d='M18 44V20h6v18h11v6H18Z' fill='%2334E89A'/%3E%3Ccircle cx='44' cy='24' r='5' fill='%2334E89A'/%3E%3C/svg%3E">

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
    ITS OWN PALETTE. Deliberately not TryTokka's, and not the portfolio's.

    The first version copied TryTokka's green on near-black so the two would read as one
    studio. That was the wrong instinct: this is a different kind of thing — a reference
    tool you look something up in, not a dashboard you live in — and a family of products
    that all look identical stops being a family and starts being one product with several
    names. Shared identity should come from the quality of the work, not from every page
    using the same hex code.

    So: LIGHT-first, which none of the other sites are, and an ink-blue accent — the colour
    of a citation in a reference work rather than a SaaS accent. Green belongs to TryTokka
    and purple to the portfolio; neither appears here.

    Slate neutrals carry a slight blue bias so they sit with the accent rather than fighting
    it, and the whole thing is built to be read rather than admired.
  */
  :root {
    color-scheme: light;
    --canvas: #F5F7FA; --surface: #FFFFFF; --surface-2: #EBEFF5;
    --ink: #111721; --muted: #46536A; --faint: #6C7A91;
    --rim: #D7DEE9;
    --brand: #1D4ED8; --brand-dark: #1E40AF; --on-brand: #FFFFFF;
    --amber: #92400E; --amber-bg: #FDF6EC;
    --shadow: 0 1px 3px rgba(17, 23, 33, .08), 0 6px 18px rgba(17, 23, 33, .06);
  }

  /* No stored choice + a dark system preference. */
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      color-scheme: dark;
      --canvas: #0B0E14; --surface: #141A24; --surface-2: #1B2330;
      --ink: #E7ECF4; --muted: #9DAABE; --faint: #74839A;
      --rim: #26303F;
      --brand: #7BA7FF; --brand-dark: #A8C4FF; --on-brand: #0A1020;
      --amber: #E2A96B; --amber-bg: #241B0E;
      --shadow: 0 1px 3px rgba(0, 0, 0, .5), 0 8px 24px rgba(0, 0, 0, .35);
    }
  }

  /* An explicit dark choice wins over a light system. */
  :root[data-theme="dark"] {
    color-scheme: dark;
    --canvas: #0B0E14; --surface: #141A24; --surface-2: #1B2330;
    --ink: #E7ECF4; --muted: #9DAABE; --faint: #74839A;
    --rim: #26303F;
    --brand: #7BA7FF; --brand-dark: #A8C4FF; --on-brand: #0A1020;
    --amber: #E2A96B; --amber-bg: #241B0E;
    --shadow: 0 1px 3px rgba(0, 0, 0, .5), 0 8px 24px rgba(0, 0, 0, .35);
  }

  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--canvas); color: var(--ink);
    font: 16px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { width: min(100% - 2rem, 46rem); margin-inline: auto; padding-bottom: 4rem; }
  a { color: var(--brand); }
  :focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; border-radius: 3px; }
  .skip { position: absolute; left: -9999px; }
  .skip:focus { left: 0; top: 0; background: var(--brand); color: var(--on-brand); padding: .6rem 1rem; z-index: 6; }

  /* Navbar ---------------------------------------------------------------- */

  /*
    Sticky, and translucent over the canvas.

    A demo page with one form does not obviously need a navbar — but this one is opened
    from a CV, and a visitor who has scrolled into the sources needs a way back to the
    source code and the theme control without hunting. Sticky keeps both one click away at
    any scroll position; backdrop-filter keeps the answer readable behind it.
  */
  .nav {
    position: sticky; top: 0; z-index: 4;
    background: color-mix(in srgb, var(--canvas) 88%, transparent);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--rim);
  }
  @supports not (backdrop-filter: blur(1px)) { .nav { background: var(--canvas); } }

  .nav__inner {
    width: min(100% - 2rem, 46rem); margin-inline: auto;
    display: flex; align-items: center; gap: 1rem; height: 56px;
  }
  .brand { display: inline-flex; align-items: center; gap: .5rem; font-weight: 650; color: var(--ink); text-decoration: none; letter-spacing: -.01em; }
  .brand svg { width: 22px; height: 22px; flex: 0 0 auto; }
  .brand span { font-size: .98rem; }

  .nav__links { display: flex; gap: 1rem; margin-left: auto; align-items: center; }
  .nav__links a { color: var(--muted); text-decoration: none; font-size: .88rem; }
  .nav__links a:hover { color: var(--brand); }
  /* Below 30rem the links crowd the brand out; the footer still carries them. */
  @media (max-width: 30rem) { .nav__links a { display: none; } }

  /* Header ---------------------------------------------------------------- */

  header { padding: 2.25rem 0 1.25rem; border-bottom: 1px solid var(--rim); }
  h1 { margin: 0; font-size: 1.6rem; letter-spacing: -.025em; }
  .sub { margin: .5rem 0 0; color: var(--muted); font-size: .95rem; max-width: 42rem; }

  .theme-switch {
    display: inline-flex; gap: 2px; padding: 2px; flex: 0 0 auto;
    background: var(--surface-2); border: 1px solid var(--rim); border-radius: 999px;
  }
  .theme-switch-btn {
    display: grid; place-items: center; width: 28px; height: 28px; padding: 0;
    background: none; border: 0; border-radius: 999px; cursor: pointer; color: var(--muted);
  }
  .theme-switch-btn .theme-switch-icon { width: 15px; height: 15px; }
  .theme-switch-btn[aria-pressed="true"] { background: var(--surface); color: var(--brand); box-shadow: var(--shadow); }

  /* Form ------------------------------------------------------------------ */

  form { display: flex; gap: .5rem; margin: 1.5rem 0 .5rem; flex-wrap: wrap; }
  label { flex: 1 1 18rem; }
  .lbl { display: block; font-size: .82rem; color: var(--muted); margin-bottom: .3rem; }
  input[type=search] {
    width: 100%; padding: .7rem .85rem; font: inherit; color: var(--ink);
    background: var(--surface); border: 1px solid var(--rim); border-radius: 7px;
  }
  .ask {
    padding: .7rem 1.3rem; font: inherit; font-weight: 600; cursor: pointer;
    background: var(--brand); color: var(--on-brand);
    border: 1px solid transparent; border-radius: 7px; align-self: flex-end;
  }
  .ask[disabled] { opacity: .55; cursor: progress; }

  .examples { display: flex; flex-wrap: wrap; gap: .4rem; margin: .3rem 0 0; padding: 0; list-style: none; }
  .examples button {
    background: var(--surface-2); color: var(--muted); font: inherit; font-size: .82rem;
    padding: .3rem .6rem; border: 1px solid var(--rim); border-radius: 999px; cursor: pointer;
  }

  /* Answer + sources ------------------------------------------------------ */

  .answer {
    margin-top: 1.5rem; padding: 1.1rem 1.2rem; background: var(--surface);
    border: 1px solid var(--rim); border-radius: 9px; min-height: 3rem; white-space: pre-wrap;
  }
  .answer:empty { display: none; }
  .placeholder { color: var(--faint); }

  h2 { font-size: .78rem; text-transform: uppercase; letter-spacing: .1em; color: var(--faint); margin: 1.75rem 0 .6rem; }
  ol.sources { margin: 0; padding-left: 1.3rem; }
  ol.sources li { margin-bottom: .7rem; font-size: .88rem; color: var(--muted); }
  ol.sources .snippet { display: block; color: var(--ink); margin-top: .15rem; }
  ol.sources .meta { font-size: .78rem; color: var(--faint); }

  .note {
    margin-top: 2rem; padding: .8rem 1rem; background: var(--amber-bg); color: var(--amber);
    border-radius: 7px; font-size: .85rem;
  }
  footer { margin-top: 2.5rem; padding-top: 1.25rem; border-top: 1px solid var(--rim); font-size: .84rem; color: var(--faint); }

  /* Back to top ----------------------------------------------------------- */

  .to-top {
    position: fixed; right: 1rem; bottom: 1rem; z-index: 5;
    display: grid; place-items: center; width: 42px; height: 42px; padding: 0;
    background: var(--surface); color: var(--brand);
    border: 1px solid var(--rim); border-radius: 999px; box-shadow: var(--shadow);
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
<nav class="nav" aria-label="Primary">
  <div class="nav__inner">
    <a class="brand" href="/">
      <svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="currentColor" opacity=".12"/><path d="M18 44V20h6v18h11v6H18Z" fill="currentColor"/><circle cx="44" cy="24" r="5" fill="currentColor"/></svg>
      <span>llm-docs-lab</span>
    </a>
    <div class="nav__links">
      <a href="https://github.com/acsavenhq/llm-docs-lab">Source</a>
      <a href="https://github.com/acsavenhq/llm-docs-lab#results">Results</a>
      <a href="https://samsonpg.github.io">Portfolio</a>
    </div>
    <!--
      The theme switch, matching the other sites exactly.
    
      Same order (light, dark, system), same class names, and the stroked icons taken from
      acsaven's markup rather than redrawn. The earlier version used filled icons in a
      light/system/dark order: fine on its own, wrong the moment you move between two of
      these sites, because muscle memory reaches for the position rather than the picture.
    -->
    <div class="theme-switch theme-switch--compact" role="group" aria-label="Theme">
      <button type="button" class="theme-switch-btn" data-theme-pref="light" title="Light" aria-label="Use light theme" aria-pressed="false"><svg class="theme-switch-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path stroke-linecap="round" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path></svg></button>
      <button type="button" class="theme-switch-btn" data-theme-pref="dark" title="Dark" aria-label="Use dark theme" aria-pressed="false"><svg class="theme-switch-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M21 14.5A8.5 8.5 0 1111.5 4a6.5 6.5 0 109.5 10.5z"></path></svg></button>
      <button type="button" class="theme-switch-btn" data-theme-pref="system" title="System" aria-label="Use system theme" aria-pressed="true"><svg class="theme-switch-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="12" rx="2"></rect><path stroke-linecap="round" d="M8 19h8M12 17v2"></path></svg></button>
    </div>
  </div>
</nav>
<div class="wrap">

  <header>
    <h1>Ask about LLM provider pricing</h1>
    <p class="sub">
      Answers come only from a fixed snapshot of seven provider documentation pages, and
      every claim is cited. Retrieval scores 100% recall@6 on a 20-question golden set; ten
      prompt-injection attacks were measured against it.
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

  document.querySelectorAll('.theme-switch-btn[data-theme-pref]').forEach((btn) => {
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
