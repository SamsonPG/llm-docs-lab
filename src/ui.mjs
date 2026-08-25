/**
 * src/ui.mjs
 *
 * WHAT: The single HTML page served at /.
 * WHY:  This is the page a recruiter opens from a CV. It has to work on a phone, on a slow
 *       connection, with the keyboard alone — and it has to look like someone cared.
 * WHEN: Served by the Worker at /.
 *
 * THE DESIGN, AND WHY IT IS THIS AND NOT SOMETHING ELSE
 * ─────────────────────────────────────────────────────
 * This is not a chat product. It is a REFERENCE INSTRUMENT: you look something up and it
 * shows you its evidence. Everything below follows from that one sentence.
 *
 *   - The question is the hero. No marketing paragraph sits above the input, because the
 *     input is the product. A page that explains itself before letting you try it is a
 *     brochure.
 *   - Citations are true superscripts that light up their source on hover and focus, rather
 *     than inline [1] blobs. The link between a claim and its evidence is the whole point of
 *     the project, so it is an interaction rather than a printing convention.
 *   - Sources read as a bibliography: numbered, with the retrieval date set in mono. Dates
 *     are load-bearing — a price without a date is a rumour.
 *   - An editorial serif carries the display type against a clean system sans, with mono for
 *     every number. The numbers are the argument, so they get their own voice.
 *
 * NO WEB FONTS, DELIBERATELY
 * ──────────────────────────
 * A font CDN was the easy way to look distinctive and it was rejected. These sites carry an
 * external-asset tripwire in their build and a public promise that nothing third-party
 * loads; importing a font to appear modern would contradict the thing the studio sells, and
 * would stop the CSP being as strict as it is.
 *
 * So the page makes ZERO third-party requests and the character comes from scale, weight,
 * spacing and colour instead. The serif is the system's own — Georgia and its relatives are
 * on every machine and are properly drawn.
 *
 * ACCESSIBILITY IS NOT DECORATION
 * ───────────────────────────────
 *   - a real <form>; Enter submits, screen readers announce it
 *   - the answer is aria-live="polite", so streamed text is read as it lands
 *   - citations are real links with visible focus, not spans with click handlers
 *   - the theme switch is a labelled group with aria-pressed, matching the other sites
 *   - AA contrast in both themes, usable at 200% zoom, all motion off under
 *     prefers-reduced-motion
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
<meta name="theme-color" content="#0B0A0E" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#F7F8F6" media="(prefers-color-scheme: light)">

<meta property="og:type" content="website">
<meta property="og:site_name" content="llm-docs-lab">
<meta property="og:title" content="llm-docs-lab — ask about LLM provider pricing">
<meta property="og:description" content="Cited answers from a fixed snapshot of seven provider documentation pages. 100% recall@6 on a 20-question golden set; 0/10 prompt-injection attacks landed.">
<meta property="og:url" content="https://llmdocs.acsaven.com/">
<meta name="twitter:card" content="summary">
<meta name="author" content="Samson P G">

<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%230B0A0E'/%3E%3Cpath d='M18 44V20h6v18h11v6H18Z' fill='%23E8B44A'/%3E%3Ccircle cx='44' cy='24' r='5' fill='%23E8B44A'/%3E%3C/svg%3E">

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
      "codeRepository": "https://github.com/acsavenhq/llm-docs-lab"
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
      "url": "https://samsonpg.github.io/static/llm-docs-lab/",
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

<script>
  /*
    Theme, before first paint. Inline and synchronous: anything deferred runs after the
    browser has painted, and a dark-mode visitor sees a white flash. The key matches the
    other sites so one choice follows a visitor across all of them.
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
      document.documentElement.setAttribute('data-theme', 'light');
      document.documentElement.setAttribute('data-theme-pref', 'system');
    }
  })();
</script>

<style>
  /*
    Light is the base; dark is layered twice — once for the system preference, once for an
    explicit choice — so the switch wins in both directions. A colour defined only inside a
    media query never applies once data-theme is set, which is how themed pages render one
    theme's text on the other theme's ground.

    The neutrals are warm-biased toward the gold rather than being pure grey, so the accent
    sits inside the palette instead of on top of it.
  */
  :root {
    color-scheme: light;
    /* the clear-button glyph: geometry, not colour, so it is declared once for both themes */
    --x-glyph: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M2 2 14 14M14 2 2 14' stroke='%23000' stroke-width='2.2' stroke-linecap='round' fill='none'/%3E%3C/svg%3E");
    --ground: #F7F8F6;
    --raise: #FFFFFF;
    --sink: #EDEEEA;
    --ink: #14140F;
    --ink-2: #4A4A41;
    --ink-3: #75756A;
    --line: #DCDDD5;
    --gold: #8A6612;
    --gold-lit: #6E5010;
    --on-gold: #FFFFFF;
    --glow: rgba(138, 102, 18, .10);
    --warn: #8A4B12;
    --warn-bg: #FBF3E6;
    --pill: 0 1px 2px rgba(20, 20, 15, .18);
    --lift: 0 1px 2px rgba(20, 20, 15, .05), 0 12px 32px -12px rgba(20, 20, 15, .14);
  }

  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      color-scheme: dark;
      --ground: #0B0A0E;
      --raise: #141319;
      --sink: #1B1A21;
      --ink: #F2F0EA;
      --ink-2: #AFACA2;
      --ink-3: #85837A;
      --line: #262530;
      --gold: #E8B44A;
      --gold-lit: #F5C96B;
      --on-gold: #17130A;
      --glow: rgba(232, 180, 74, .13);
      --warn: #E0A868;
      --warn-bg: #221A0E;
      --pill: 0 1px 2px rgba(0, 0, 0, .5), inset 0 0 0 1px rgba(255, 255, 255, .07);
      --lift: 0 1px 2px rgba(0, 0, 0, .6), 0 18px 44px -16px rgba(0, 0, 0, .7);
    }
  }

  :root[data-theme="dark"] {
    color-scheme: dark;
    --ground: #0B0A0E;
    --raise: #141319;
    --sink: #1B1A21;
    --ink: #F2F0EA;
    --ink-2: #AFACA2;
    --ink-3: #85837A;
    --line: #262530;
    --gold: #E8B44A;
    --gold-lit: #F5C96B;
    --on-gold: #17130A;
    --glow: rgba(232, 180, 74, .13);
    --warn: #E0A868;
    --warn-bg: #221A0E;
    --pill: 0 1px 2px rgba(0, 0, 0, .5), inset 0 0 0 1px rgba(255, 255, 255, .07);
    --lift: 0 1px 2px rgba(0, 0, 0, .6), 0 18px 44px -16px rgba(0, 0, 0, .7);
  }

  *, *::before, *::after { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }

  body {
    margin: 0;
    background: var(--ground);
    color: var(--ink);
    font: 400 clamp(15px, 0.55vw + 13.4px, 17px)/1.65 system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  /*
    The serif is the system's own. Georgia and its relatives ship everywhere and are properly
    drawn; a font CDN would be one third-party request on a page whose argument is that it
    makes none.
  */
  .serif { font-family: ui-serif, Georgia, "Iowan Old Style", "Palatino Linotype", Palatino, serif; }
  .mono { font-family: ui-monospace, "JetBrains Mono", "Cascadia Mono", "SF Mono", Menlo, Consolas, monospace; }

  .shell { width: min(100% - 2.5rem, 54rem); margin-inline: auto; }

  a { color: var(--gold); text-underline-offset: 3px; text-decoration-thickness: 1px; }
  a:hover { color: var(--gold-lit); }
  :focus-visible { outline: 2px solid var(--gold); outline-offset: 3px; border-radius: 4px; }

  .skip { position: absolute; left: -9999px; }
  .skip:focus { left: .75rem; top: .75rem; z-index: 40; background: var(--gold); color: var(--on-gold); padding: .6rem 1rem; border-radius: 6px; font-weight: 600; }

  /* ── Nav ───────────────────────────────────────────────────────────────── */

  .nav {
    position: sticky; top: 0; z-index: 20;
    background: color-mix(in srgb, var(--ground) 86%, transparent);
    backdrop-filter: saturate(1.6) blur(14px);
    border-bottom: 1px solid transparent;
    transition: border-color .25s ease;
  }
  .nav.is-stuck { border-bottom-color: var(--line); }
  @supports not (backdrop-filter: blur(1px)) { .nav { background: var(--ground); } }

  .nav__in { display: flex; align-items: center; gap: 1rem; height: 60px; }
  .brand { display: inline-flex; align-items: center; gap: .55rem; text-decoration: none; color: var(--ink); }
  .brand__mark { width: 26px; height: 26px; border-radius: 7px; background: var(--ink); display: grid; place-items: center; flex: 0 0 auto; }
  .brand__mark svg { width: 15px; height: 15px; fill: var(--gold); }
  .brand__name { font-weight: 620; letter-spacing: -.015em; font-size: .96rem; }

  .nav__links { display: flex; gap: 1.15rem; margin-left: auto; align-items: center; }
  .nav__links a { color: var(--ink-2); text-decoration: none; font-size: .875rem; transition: color .15s ease; }
  .nav__links a:hover { color: var(--ink); }
  @media (max-width: 34rem) { .nav__links a { display: none; } }

  .theme-switch { display: inline-flex; gap: 1px; padding: 3px; background: var(--sink); border: 1px solid var(--line); border-radius: 999px; flex: 0 0 auto; }
  .theme-switch-btn {
    display: grid; place-items: center; width: 28px; height: 28px; padding: 0;
    background: none; border: 0; border-radius: 999px; cursor: pointer; color: var(--ink-3);
    transition: color .15s ease, background .15s ease;
  }
  .theme-switch-btn:hover { color: var(--ink); }
  .theme-switch-btn .theme-switch-icon { width: 15px; height: 15px; }
  /*
    The pressed pill has to lift off the switch ground. A black drop shadow does that on a
    light ground and is completely invisible on #0B0A0E, so dark gets a hairline inset
    instead — which is why this is a token and not a literal.
  */
  .theme-switch-btn[aria-pressed="true"] { background: var(--raise); color: var(--gold); box-shadow: var(--pill); }

  /* ── Hero: the question is the product ─────────────────────────────────── */

  .hero { position: relative; padding: clamp(2.75rem, 8vw, 5.5rem) 0 2rem; }

  /*
    One soft light source behind the question, keyed to the accent.

    Not decoration for its own sake: it puts the brightest point of the page exactly where
    the eye should start, which here is the input rather than a headline.
  */
  .hero::before {
    content: "";
    position: absolute; inset: -18% -30% auto -30%; height: 32rem;
    background: radial-gradient(46% 50% at 50% 30%, var(--glow), transparent 72%);
    pointer-events: none; z-index: -1;
  }

  .eyebrow {
    display: inline-flex; align-items: center; gap: .6rem;
    font-size: .72rem; letter-spacing: .14em; text-transform: uppercase;
    color: var(--ink-3); margin: 0 0 1.15rem;
  }
  .eyebrow::before { content: ""; width: 1.6rem; height: 1px; background: var(--gold); }

  h1 {
    margin: 0;
    font-size: clamp(2.1rem, 5.4vw, 3.4rem);
    line-height: 1.05;
    letter-spacing: -.028em;
    font-weight: 400;
    text-wrap: balance;
    max-width: 20ch;
  }
  h1 em { font-style: italic; color: var(--gold); }

  .hero__sub { margin: 1.05rem 0 0; color: var(--ink-2); max-width: 50ch; font-size: 1.02rem; }

  /* ── Ask ───────────────────────────────────────────────────────────────── */

  .ask { margin-top: 2.1rem; }
  .field {
    display: flex; align-items: center; gap: .55rem;
    background: var(--raise); border: 1px solid var(--line);
    border-radius: 14px; padding: .4rem .4rem .4rem 1rem;
    box-shadow: var(--lift);
    transition: border-color .18s ease, box-shadow .18s ease;
  }
  .field:focus-within { border-color: var(--gold); box-shadow: var(--lift), 0 0 0 4px var(--glow); }
  .field .search { width: 18px; height: 18px; flex: 0 0 auto; fill: none; stroke: var(--ink-3); stroke-width: 2; }
  .field input {
    flex: 1 1 auto; min-width: 0;
    border: 0; background: none; color: var(--ink);
    font: inherit; padding: .7rem .2rem;
  }
  .field input::placeholder { color: var(--ink-3); }
  .field input:focus { outline: none; }
  /*
    type="search" gives a free clear button and Chromium paints it with the UA accent,
    which came out blue on the light ground and white on the dark one — a stray browser
    colour on an otherwise designed page, visible in a screenshot and invisible to a test.

    Redrawn as a mask so the glyph takes --ink-3 like every other quiet control, with a
    real hit area. A mask is the only way to recolour a UA pseudo-element; the vendor
    prefix is required, and Firefox renders no button at all, which is fine.
  */
  .field input::-webkit-search-cancel-button {
    -webkit-appearance: none; appearance: none;
    width: 1.15rem; height: 1.15rem; margin-right: .2rem; cursor: pointer;
    background: var(--ink-3);
    -webkit-mask: var(--x-glyph) center / 62% no-repeat;
    mask: var(--x-glyph) center / 62% no-repeat;
    opacity: .75; transition: opacity .15s ease, background .15s ease;
  }
  .field input::-webkit-search-cancel-button:hover { opacity: 1; background: var(--ink); }
  .go {
    flex: 0 0 auto; border: 0; cursor: pointer;
    background: var(--gold); color: var(--on-gold);
    font: inherit; font-weight: 620; font-size: .92rem;
    padding: .64rem 1.15rem; border-radius: 10px;
    transition: background .15s ease, transform .08s ease;
  }
  .go:hover { background: var(--gold-lit); }
  .go:active { transform: translateY(1px); }
  .go[disabled] { opacity: .5; cursor: progress; }

  .chips { display: flex; flex-wrap: wrap; gap: .4rem; margin: .85rem 0 0; padding: 0; list-style: none; }
  .chips button {
    font: inherit; font-size: .8rem; cursor: pointer;
    background: none; color: var(--ink-2);
    border: 1px solid var(--line); border-radius: 999px; padding: .3rem .7rem;
    transition: border-color .15s ease, color .15s ease, background .15s ease;
  }
  .chips button:hover { color: var(--ink); border-color: var(--ink-3); background: var(--sink); }

  /* ── Answer: an editorial passage, not a chat bubble ───────────────────── */

  .answer-wrap { margin-top: 2.4rem; }

  .answer {
    font-size: clamp(1.05rem, .5vw + .95rem, 1.2rem);
    line-height: 1.62;
    white-space: pre-wrap;
    max-width: 62ch;
    border-left: 2px solid var(--gold);
    padding-left: clamp(1rem, 3vw, 1.6rem);
  }
  .answer.is-waiting { color: var(--ink-3); border-left-color: var(--line); font-style: italic; }

  /*
    Citations are links, not decoration.

    Hovering or focusing one lifts its source in the list below. That connection — a claim
    you can walk back to its evidence — is the entire argument of the project, so it is built
    as an interaction rather than left as a printing convention.
  */
  .cite {
    font-family: ui-monospace, "JetBrains Mono", "Cascadia Mono", Menlo, monospace;
    font-size: .62em; vertical-align: super; line-height: 0;
    color: var(--gold); text-decoration: none;
    padding: 0 .12em; border-radius: 3px;
  }
  .cite:hover, .cite:focus-visible { background: var(--glow); color: var(--gold-lit); }

  /* ── Sources: a bibliography ───────────────────────────────────────────── */

  .rule {
    display: flex; align-items: center; gap: .9rem;
    font-size: .72rem; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-3);
    margin: 0 0 1.05rem;
  }
  .rule::after { content: ""; flex: 1 1 auto; height: 1px; background: var(--line); }

  .srcs { margin-top: 2.4rem; }
  ol.srcs__list { list-style: none; margin: 0; padding: 0; display: grid; gap: .1rem; counter-reset: src; }
  /*
    Two grid items per row, not three.

    The first version placed ::before, the snippet and the metadata directly in a
    two-column grid — three items, so the metadata wrapped onto a second row INTO the
    1.9rem number column and the retrieval date broke one character per line: "2026-",
    "08-", "24". It looked like a text-wrapping bug and was a grid-counting one. The body
    is now a single wrapper, so the row is always number + body.
  */
  ol.srcs__list li {
    counter-increment: src;
    display: grid; grid-template-columns: 1.9rem minmax(0, 1fr); gap: .8rem;
    align-items: start;
    padding: .8rem .9rem .8rem .5rem; border-radius: 10px;
    transition: background .18s ease;
  }
  .srcs__body { min-width: 0; }
  ol.srcs__list li::before {
    content: counter(src);
    font-family: ui-monospace, "JetBrains Mono", "Cascadia Mono", Menlo, monospace;
    font-size: .78rem; color: var(--gold);
    text-align: right; padding-top: .1rem;
  }
  ol.srcs__list li.is-lit { background: var(--sink); }
  .srcs__text { margin: 0; font-size: .92rem; color: var(--ink-2); line-height: 1.55; }
  .srcs__meta { margin: .3rem 0 0; font-size: .75rem; color: var(--ink-3); display: flex; flex-wrap: wrap; align-items: baseline; }
  .srcs__meta .mono { white-space: nowrap; }
  .srcs__meta a { color: var(--ink-3); }
  .srcs__meta a:hover { color: var(--gold); }
  .srcs__meta .dot { opacity: .5; padding: 0 .35rem; }

  /* ── Evidence ──────────────────────────────────────────────────────────── */

  .evidence { margin: 3.25rem 0 0; padding-top: 1.35rem; border-top: 1px solid var(--line); }
  .evidence__grid { display: grid; gap: 1.35rem 2rem; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr)); }
  .stat b { display: block; font-size: 1.6rem; letter-spacing: -.03em; font-variant-numeric: tabular-nums; font-weight: 500; }
  .stat span { display: block; font-size: .78rem; color: var(--ink-3); margin-top: .15rem; line-height: 1.45; }
  .evidence__note { margin: 1.35rem 0 0; font-size: .85rem; color: var(--ink-3); max-width: 60ch; }

  .caution {
    margin-top: 1.9rem; padding: .85rem 1.05rem;
    background: var(--warn-bg); color: var(--warn);
    border-radius: 10px; font-size: .85rem; line-height: 1.55;
  }

  footer { margin-top: 2.75rem; padding: 1.35rem 0 4.5rem; border-top: 1px solid var(--line); font-size: .84rem; color: var(--ink-3); }
  footer a { color: var(--ink-3); }
  footer a:hover { color: var(--gold); }

  /* ── Back to top ───────────────────────────────────────────────────────── */

  .to-top {
    position: fixed; right: 1.1rem; bottom: 1.1rem; z-index: 20;
    display: grid; place-items: center; width: 42px; height: 42px; padding: 0;
    background: var(--raise); color: var(--gold);
    border: 1px solid var(--line); border-radius: 12px; box-shadow: var(--lift);
    cursor: pointer; opacity: 0; visibility: hidden; transform: translateY(10px) scale(.96);
    transition: opacity .2s ease, transform .2s ease, visibility .2s;
  }
  .to-top.is-visible { opacity: 1; visibility: visible; transform: none; }
  .to-top svg { width: 17px; height: 17px; fill: currentColor; }

  @keyframes rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  .rise { animation: rise .32s cubic-bezier(.22,.7,.3,1) both; }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
  }
</style>
</head>
<body>
<a class="skip" href="#q">Skip to the question</a>

<nav class="nav" id="nav" aria-label="Primary">
  <div class="shell nav__in">
    <a class="brand" href="/">
      <span class="brand__mark"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M18 44V20h6v18h11v6H18Z"/><circle cx="44" cy="24" r="5"/></svg></span>
      <span class="brand__name">llm-docs-lab</span>
    </a>
    <div class="nav__links">
      <a href="https://samsonpg.github.io/static/llm-docs-lab/">Results</a>
      <a href="https://github.com/acsavenhq/llm-docs-lab">Source</a>
      <a href="https://samsonpg.github.io">Portfolio</a>
    </div>
    <div class="theme-switch theme-switch--compact" role="group" aria-label="Theme">
      <button type="button" class="theme-switch-btn" data-theme-pref="light" title="Light" aria-label="Use light theme" aria-pressed="false"><svg class="theme-switch-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path stroke-linecap="round" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path></svg></button>
      <button type="button" class="theme-switch-btn" data-theme-pref="dark" title="Dark" aria-label="Use dark theme" aria-pressed="false"><svg class="theme-switch-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M21 14.5A8.5 8.5 0 1111.5 4a6.5 6.5 0 109.5 10.5z"></path></svg></button>
      <button type="button" class="theme-switch-btn" data-theme-pref="system" title="System" aria-label="Use system theme" aria-pressed="true"><svg class="theme-switch-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="12" rx="2"></rect><path stroke-linecap="round" d="M8 19h8M12 17v2"></path></svg></button>
    </div>
  </div>
</nav>

<main id="main">
  <section class="hero shell">
    <p class="eyebrow">Seven provider documents · one fixed snapshot</p>
    <h1 class="serif">What does it <em>actually</em> cost?</h1>
    <p class="hero__sub">
      Ask about LLM provider pricing or rate limits. Every answer comes from those documents
      and nowhere else — cited, dated, and willing to say when it does not know.
    </p>

    <form class="ask" id="f">
      <label class="field">
        <span class="skip" id="qlabel">Your question</span>
        <svg class="search" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" stroke-linecap="round"></circle><path d="M20 20l-3.5-3.5" stroke-linecap="round"></path></svg>
        <input id="q" name="q" type="search" autocomplete="off" required
               aria-labelledby="qlabel"
               placeholder="How many neurons per day are free on Workers AI?">
        <button type="submit" class="go" id="go">Ask</button>
      </label>
    </form>

    <ul class="chips" aria-label="Example questions">
      <li><button type="button" data-q="How many neurons per day are free on Cloudflare Workers AI?">free neurons per day</button></li>
      <li><button type="button" data-q="What does Gemini 3.7 Flash cost for input tokens on the paid tier?">Gemini input price</button></li>
      <li><button type="button" data-q="What are the rate limits on the Gemini free tier?">Gemini free limits</button></li>
      <li><button type="button" data-q="What is the base input token price for Claude Opus 5?">Claude Opus price</button></li>
      <li><button type="button" data-q="What does AWS Bedrock charge for Claude Sonnet?">something it cannot answer</button></li>
    </ul>
  </section>

  <section class="shell answer-wrap" id="answer-wrap" hidden>
    <div class="answer" id="a" role="region" aria-live="polite" aria-atomic="false" aria-label="Answer"></div>
  </section>

  <section class="shell srcs" id="srcs" hidden>
    <p class="rule">Sources</p>
    <ol class="srcs__list" id="src-list"></ol>
  </section>

  <section class="shell evidence">
    <p class="rule">Measured, not asserted</p>
    <div class="evidence__grid">
      <div class="stat"><b class="mono">100%</b><span>recall@6 across a twenty-question golden set</span></div>
      <div class="stat"><b class="mono">1.00</b><span>mean reciprocal rank — the right document ranked first every time</span></div>
      <div class="stat"><b class="mono">0/10</b><span>prompt-injection attacks that landed, across two channels</span></div>
      <div class="stat"><b class="mono">7/20</b><span>questions unanswerable on purpose, to catch confident invention</span></div>
    </div>
    <p class="evidence__note">
      Every figure is produced by a script in the repository and republished as a
      <a href="https://samsonpg.github.io/static/llm-docs-lab/">static results page</a> that
      outlives this demo. 0/10 is ten attacks against one model on one date — not immunity.
    </p>

    <p class="caution">
      Answers reflect the snapshot date shown beside each source, not today's live pages.
      Prices change. Check the provider before relying on a figure.
    </p>
  </section>
</main>

<footer class="shell">
  Built by <a href="https://samsonpg.github.io">Samson P G</a> ·
  <a href="https://github.com/acsavenhq/llm-docs-lab">source, evals and measured limits</a> ·
  <a href="https://samsonpg.github.io/static/llm-docs-lab/">results</a>
</footer>

<button type="button" class="to-top" id="totop" aria-label="Back to top" title="Back to top" hidden>
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4a1 1 0 0 1 .7.3l7 7a1 1 0 0 1-1.4 1.4L13 7.4V19a1 1 0 1 1-2 0V7.4l-5.3 5.3a1 1 0 1 1-1.4-1.4l7-7A1 1 0 0 1 12 4Z"/></svg>
</button>

<script>
(() => {
  /* ── Theme ──────────────────────────────────────────────────────────── */

  const KEY = 'samsonpg-theme';
  const root = document.documentElement;
  const media = window.matchMedia('(prefers-color-scheme: dark)');

  const resolve = (pref) => (pref === 'system' ? (media.matches ? 'dark' : 'light') : pref);

  function applyTheme(pref) {
    const theme = resolve(pref);
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-theme-pref', pref);
    root.style.colorScheme = theme;
    document.querySelectorAll('.theme-switch-btn[data-theme-pref]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.themePref === pref));
    });
  }

  let stored = 'system';
  try {
    const s = localStorage.getItem(KEY);
    if (s === 'light' || s === 'dark' || s === 'system') stored = s;
  } catch (e) { /* private mode; session-only */ }
  applyTheme(stored);

  document.querySelectorAll('.theme-switch-btn[data-theme-pref]').forEach((btn) => {
    btn.addEventListener('click', () => {
      applyTheme(btn.dataset.themePref);
      try { localStorage.setItem(KEY, btn.dataset.themePref); } catch (e) { /* session-only */ }
    });
  });
  media.addEventListener('change', () => {
    if (root.getAttribute('data-theme-pref') === 'system') applyTheme('system');
  });

  /* ── Scroll: nav border, and back to top ────────────────────────────── */

  const nav = document.getElementById('nav');
  const toTop = document.getElementById('totop');
  const MIN_SCROLLABLE = 240;
  const SHOW_AFTER = 320;
  let ticking = false;

  function onScrollFrame() {
    const y = window.scrollY;
    nav.classList.toggle('is-stuck', y > 4);

    /*
      The threshold adapts to how far the page can actually scroll. A fixed 320px was wrong
      once already: a short page scrolled exactly 320px, so the condition could never be true
      and the button was unreachable. A threshold equal to the maximum scroll is a feature
      that silently does not exist.
    */
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const show = scrollable > MIN_SCROLLABLE && y >= Math.min(SHOW_AFTER, scrollable * 0.6);
    toTop.hidden = !show;
    toTop.classList.toggle('is-visible', show);
    ticking = false;
  }
  addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(onScrollFrame); }
  }, { passive: true });
  onScrollFrame();

  toTop.addEventListener('click', () => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    document.getElementById('q').focus({ preventScroll: true });
  });

  /* ── Ask ────────────────────────────────────────────────────────────── */

  const form = document.getElementById('f');
  const input = document.getElementById('q');
  const out = document.getElementById('a');
  const outWrap = document.getElementById('answer-wrap');
  const go = document.getElementById('go');
  const srcs = document.getElementById('srcs');
  const srcList = document.getElementById('src-list');

  document.querySelectorAll('.chips button').forEach((b) => {
    b.addEventListener('click', () => { input.value = b.dataset.q; form.requestSubmit(); });
  });

  /*
    Everything below builds DOM with textContent and createElement, never innerHTML.

    Source snippets come from public documentation and the answer comes from a model reading
    it — both are attacker-influenced. Assigning either as markup would turn a retrieval
    system into a cross-site scripting vector.
  */
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function renderSources(sources) {
    srcList.textContent = '';
    sources.forEach((s, i) => {
      const li = document.createElement('li');
      li.id = 'src-' + (i + 1);
      if (!reduced()) {
        li.className = 'rise';
        li.style.animationDelay = (i * 45) + 'ms';
      }

      const text = document.createElement('p');
      text.className = 'srcs__text';
      const t = s.text || '';
      text.textContent = t.length > 260 ? t.slice(0, 260) + '…' : t;

      const meta = document.createElement('p');
      meta.className = 'srcs__meta';
      const link = document.createElement('a');
      link.rel = 'noopener noreferrer';
      link.target = '_blank';
      link.href = s.source || '#';
      try { link.textContent = s.source ? new URL(s.source).hostname : 'source'; }
      catch (e) { link.textContent = 'source'; }
      meta.append(link);
      if (s.fetchedAt) {
        const dot = document.createElement('span');
        dot.className = 'dot';
        dot.textContent = '·';
        const when = document.createElement('span');
        when.className = 'mono';
        when.textContent = 'retrieved ' + String(s.fetchedAt).slice(0, 10);
        meta.append(dot, when);
      }

      const body = document.createElement('div');
      body.className = 'srcs__body';
      body.append(text, meta);
      li.append(body);
      srcList.append(li);
    });
    srcs.hidden = sources.length === 0;
  }

  /*
    Turn [1] and [1,3] in the finished text into real superscript links.

    Done once at the end rather than per token: rewriting the DOM mid-stream fights the
    aria-live region, which would re-announce the whole answer on every chunk.
  */
  function linkCitations(text) {
    out.textContent = '';
    const pattern = /\\[(\\d+(?:\\s*,\\s*\\d+)*)\\]/g;
    let last = 0;
    let m;
    while ((m = pattern.exec(text)) !== null) {
      if (m.index > last) out.append(document.createTextNode(text.slice(last, m.index)));
      const nums = m[1].split(',').map((n) => n.trim());
      nums.forEach((n, k) => {
        const a = document.createElement('a');
        a.className = 'cite';
        a.href = '#src-' + n;
        a.textContent = n;
        a.setAttribute('aria-label', 'Source ' + n);
        const lift = (on) => {
          const li = document.getElementById('src-' + n);
          if (li) li.classList.toggle('is-lit', on);
        };
        a.addEventListener('mouseenter', () => lift(true));
        a.addEventListener('mouseleave', () => lift(false));
        a.addEventListener('focus', () => lift(true));
        a.addEventListener('blur', () => lift(false));
        out.append(a);
        if (k < nums.length - 1) out.append(document.createTextNode(','));
      });
      last = m.index + m[0].length;
    }
    if (last < text.length) out.append(document.createTextNode(text.slice(last)));
  }

  let inflight = null;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;

    if (inflight) inflight.abort();
    inflight = new AbortController();

    go.disabled = true;
    srcs.hidden = true;
    outWrap.hidden = false;
    out.classList.add('is-waiting');
    out.textContent = 'Searching seven documents…';

    try {
      const res = await fetch('/ask?q=' + encodeURIComponent(q), { signal: inflight.signal });

      /*
        A rate limit is a normal outcome on a free tier, not an error to hide behind
        "something went wrong". Saying which limit was hit is the difference between a
        visitor waiting a minute and a visitor deciding the demo is broken.
      */
      if (res.status === 429) {
        out.classList.remove('is-waiting');
        out.textContent = 'Rate limited. This runs on a free allowance shared by everyone who visits — wait about a minute and ask again.';
        return;
      }
      if (!res.ok) throw new Error('HTTP ' + res.status);

      let sources = [];
      try { sources = JSON.parse(decodeURIComponent(res.headers.get('x-sources') || '%5B%5D')); }
      catch (err) { /* the answer still renders without them */ }
      renderSources(sources);

      out.classList.remove('is-waiting');
      out.textContent = '';
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        out.textContent = buf;
      }
      if (!buf) out.textContent = 'The model returned nothing for that question.';
      else linkCitations(buf);
    } catch (err) {
      if (err.name === 'AbortError') return;
      out.classList.remove('is-waiting');
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
