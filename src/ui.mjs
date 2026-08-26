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
 *   - Atmosphere is local: mesh + soft orbs, glass on nav / ask / metric tiles only. Full-page
 *     frosting would muddy AA contrast; restrained glass (Apple-style) keeps the instrument
 *     readable in both themes. No third-party fonts or assets — CSP stays closed.
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

import { THEME_TOKENS, THEME_SWITCH_CSS, THEME_SWITCH_HTML, THEME_SWITCH_JS } from './theme.mjs';

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

<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%230C0B10'/%3E%3Cpath d='M20 18h16c5 0 9 4 9 9v19H29c-5 0-9-4-9-9V18z' fill='none' stroke='%23E8B44A' stroke-width='3' stroke-linejoin='round'/%3E%3Cpath d='M26 28h12M26 35h9' stroke='%23E8B44A' stroke-width='2.4' stroke-linecap='round'/%3E%3Ccircle cx='44' cy='22' r='6' fill='%23E8B44A'/%3E%3C/svg%3E">

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
      "url": "https://samsonpg.github.io/static/llm-docs-lab/results/",
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

${THEME_TOKENS}
  *, *::before, *::after { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; overflow-x: clip; }

  body {
    margin: 0;
    overflow-x: clip;
    background: var(--ground);
    color: var(--ink);
    font: 400 clamp(15px, 0.55vw + 13.4px, 17px)/1.65 system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
    -webkit-font-smoothing: antialiased;
    min-height: 100vh;
  }

  /* Richer mesh so glass has something to refract.
     z-index 0 (not negative): negative layers paint under body --ground and vanish. */
  .haven {
    position: fixed; inset: 0; z-index: 0; pointer-events: none;
    background:
      radial-gradient(ellipse 55% 45% at 70% 12%, var(--haven-a), transparent 65%),
      radial-gradient(ellipse 45% 40% at 18% 55%, var(--haven-b), transparent 60%),
      radial-gradient(ellipse 50% 35% at 55% 78%, var(--haven-c), transparent 62%),
      var(--ground);
  }
  .haven__orb {
    position: absolute; border-radius: 50%; filter: blur(48px);
    opacity: .85; will-change: transform;
  }
  :root[data-theme="dark"] .haven__orb,
  :root:not([data-theme="light"]) .haven__orb {
    opacity: .95;
    filter: blur(40px);
  }
  .haven__orb--a {
    width: min(48vw, 32rem); height: min(48vw, 32rem);
    top: -6%; right: -4%;
    background: radial-gradient(circle, var(--haven-a) 0%, transparent 70%);
    animation: orb-drift 18s ease-in-out infinite alternate;
  }
  .haven__orb--b {
    width: min(40vw, 26rem); height: min(40vw, 26rem);
    top: 42%; left: -8%;
    background: radial-gradient(circle, var(--haven-b) 0%, transparent 70%);
    animation: orb-drift 22s ease-in-out infinite alternate-reverse;
  }
  .haven__orb--c {
    width: min(36vw, 22rem); height: min(36vw, 22rem);
    bottom: 8%; right: 18%;
    background: radial-gradient(circle, var(--haven-c) 0%, transparent 70%);
    animation: orb-drift 26s ease-in-out infinite alternate;
  }
  @keyframes orb-drift {
    from { transform: translate3d(0, 0, 0) scale(1); }
    to { transform: translate3d(2.5%, 3.5%, 0) scale(1.08); }
  }

  .read-progress {
    position: fixed; left: 0; top: 0; right: 0; height: 3px; z-index: 40;
    pointer-events: none;
    background: color-mix(in srgb, var(--glass-line) 80%, transparent);
  }
  .read-progress__bar {
    display: block; width: 100%; height: 100%;
    transform: scaleX(0); transform-origin: left center;
    background: linear-gradient(90deg, var(--gold) 0%, var(--gold-lit) 55%, var(--gold) 100%);
    box-shadow: 0 0 14px var(--glow);
  }

  .serif { font-family: ui-serif, Georgia, "Iowan Old Style", "Palatino Linotype", Palatino, serif; }
  .mono { font-family: ui-monospace, "JetBrains Mono", "Cascadia Mono", "SF Mono", Menlo, Consolas, monospace; }

  /*
    One column, one gutter. width:min() + auto margins so nav / hero / evidence /
    footer share the same centered edges on wide viewports (width:100% + max-width
    alone was still reading left-heavy next to the centered hero title).
  */
  .shell {
    box-sizing: border-box;
    width: min(100%, var(--page-max));
    margin-inline: auto;
    padding-inline: var(--page-gutter);
  }
  main {
    position: relative;
    z-index: 1;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  main > .shell {
    flex: 0 0 auto;
  }

  a { color: var(--gold); text-underline-offset: 3px; text-decoration-thickness: 1px; }
  a:hover { color: var(--gold-lit); }
  :focus-visible { outline: 2px solid var(--gold); outline-offset: 3px; border-radius: 4px; }

  .skip { position: absolute; left: -9999px; }
  .skip:focus { left: .75rem; top: .75rem; z-index: 50; background: var(--gold); color: var(--on-gold); padding: .6rem 1rem; border-radius: 6px; font-weight: 600; }

  /* Shared Apple glass surface */
  .glass {
    background: var(--glass-bg);
    backdrop-filter: var(--glass);
    -webkit-backdrop-filter: var(--glass);
    border: 1px solid var(--glass-edge);
    box-shadow: var(--glass-inset), var(--glass-shadow);
  }
  @supports not (backdrop-filter: blur(1px)) {
    .glass { background: var(--raise-solid); }
  }

  /*
    Measured against the rest of the family before changing anything, because "match the
    other sites" is a claim about numbers:

      acsaven      63px   link 15.2px/700   hairline
      trytokka     87px   link 16px/400     hairline
      trydevsnip   79px   link 20px/400     hairline
      trycalcnow   79px   link 20px/400     hairline
      here, before 65px   link 14px/400     NO hairline

    So the bar was shorter than every sibling, its links were the smallest of the set, and
    it was the only one with no rule under it until you scrolled. Those three are fixed
    below. The glass is kept — acsaven is glass too, so it is in-family, and it is the part
    that makes this page look like itself.

    What is deliberately NOT copied is the width. The others run their nav out to
    1232-1280px because their pages are that wide; this page is an editorial column and its
    nav shares the same spine as the hero. Widening the bar alone would break that
    alignment to match a number that only makes sense on a wider layout.
  */
  .nav {
    position: sticky; top: 0; z-index: 20;
    background: var(--glass-bg);
    backdrop-filter: var(--glass);
    -webkit-backdrop-filter: var(--glass);
    border-bottom: 1px solid var(--glass-line);
    transition: border-color .25s ease, background .25s ease;
  }
  .nav.is-stuck { background: var(--glass-bg-strong); }
  @supports not (backdrop-filter: blur(1px)) {
    .nav { background: var(--ground); }
  }

  .nav__in {
    display: flex; align-items: center; gap: .85rem;
    min-height: 78px; height: 78px;   /* the utility sites sit at 79; acsaven 63, trytokka 87 */
  }
  .brand {
    display: inline-flex; align-items: center; gap: .65rem;
    text-decoration: none; color: var(--ink); min-width: 0;
  }
  .brand__mark {
    width: 32px; height: 32px; border-radius: 10px;
    background: var(--mark-hole); color: var(--gold);
    display: grid; place-items: center; flex: 0 0 auto;
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--gold) 22%, transparent),
      0 10px 24px -14px var(--glow);
  }
  .brand__mark svg { width: 18px; height: 18px; display: block; }
  .brand__name {
    font-weight: 650; letter-spacing: -.025em; font-size: .98rem;
    white-space: nowrap;
  }

  .nav__links {
    display: flex; gap: 1.35rem; margin-left: auto; align-items: center;
  }
  .nav__links a {
    color: var(--ink-2); text-decoration: none; font-size: .9375rem; font-weight: 500;
    line-height: 1; transition: color .15s ease;
  }
  .nav__links a:hover { color: var(--ink); }
  @media (max-width: 34rem) { .nav__links a { display: none; } }

${THEME_SWITCH_CSS}

  /* Hero — centered column so mass matches evidence below */
  .hero {
    position: relative;
    padding: clamp(2.5rem, 7vw, 4.75rem) 0 2rem;
    text-align: center;
  }
  .hero::before {
    content: "";
    position: absolute; inset: -12% -20% auto -20%; height: 28rem;
    background: radial-gradient(46% 50% at 50% 30%, var(--glow), transparent 72%);
    pointer-events: none; z-index: -1;
  }

  .eyebrow {
    display: inline-flex; align-items: center; justify-content: center; gap: .6rem;
    font-size: .72rem; letter-spacing: .14em; text-transform: uppercase;
    color: var(--ink-3); margin: 0 0 1.15rem;
  }
  .eyebrow::before { content: ""; width: 1.4rem; height: 1px; background: var(--gold); }

  h1 {
    margin: 0 auto;
    font-size: clamp(2.2rem, 5.8vw, 3.65rem);
    line-height: 1.04;
    letter-spacing: -.032em;
    font-weight: 400;
    text-wrap: balance;
    max-width: 16ch;
  }
  h1 em { font-style: italic; color: var(--gold); }

  .hero__sub {
    margin: 1.1rem auto 0;
    color: var(--ink-2);
    max-width: 42ch;
    font-size: 1.02rem;
    line-height: 1.55;
  }

  .ask {
    margin: 2rem auto 0;
    width: 100%;
    text-align: left;
  }
  .field {
    display: flex; align-items: center; gap: .55rem;
    background: var(--glass-bg-strong);
    border: 1px solid var(--glass-edge);
    border-radius: 18px;
    padding: .45rem .45rem .45rem 1.05rem;
    box-shadow: var(--glass-inset), var(--glass-shadow);
    backdrop-filter: var(--glass);
    -webkit-backdrop-filter: var(--glass);
    transition: border-color .18s ease, box-shadow .18s ease;
  }
  .field:focus-within {
    border-color: color-mix(in srgb, var(--gold) 45%, var(--glass-edge));
    box-shadow: var(--glass-inset), var(--glass-shadow), 0 0 0 4px var(--glow-2);
  }
  @supports not (backdrop-filter: blur(1px)) {
    .field { background: var(--raise-solid); }
  }
  .field .search { width: 18px; height: 18px; flex: 0 0 auto; fill: none; stroke: var(--ink-3); stroke-width: 2; }
  .field__grow {
    position: relative;
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    align-items: center;
  }
  .field__type {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    padding: .75rem .2rem;
    color: var(--ink-3);
    pointer-events: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    opacity: 1;
    transition: opacity .15s ease;
  }
  .field__type[hidden] { display: none; }
  .field__type::after {
    content: "";
    flex: 0 0 auto;
    width: 1.5px;
    height: 1.05em;
    margin-left: 2px;
    background: color-mix(in srgb, var(--gold) 70%, var(--ink-3));
    border-radius: 1px;
    animation: type-caret 1s step-end infinite;
  }
  @keyframes type-caret {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }
  .field input {
    flex: 1 1 auto; min-width: 0; width: 100%;
    border: 0; background: none; color: var(--ink);
    font: inherit; padding: .75rem .2rem;
    position: relative; z-index: 1;
  }
  .field input::placeholder { color: var(--ink-3); }
  .field input:focus { outline: none; }
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
    font: inherit; font-weight: 650; font-size: .92rem;
    padding: .7rem 1.25rem; border-radius: 12px; min-height: 44px;
    box-shadow: 0 10px 28px -14px color-mix(in srgb, var(--gold) 70%, transparent);
    transition: background .15s ease, transform .08s ease;
  }
  .go:hover { background: var(--gold-lit); }
  .go:active { transform: translateY(1px); }
  .go[disabled] { opacity: .5; cursor: progress; }

  .quota {
    margin: .85rem 0 0;
    font-size: .8125rem;
    color: var(--ink-3);
    display: flex; align-items: center; gap: .5rem; flex-wrap: wrap;
  }
  .quota__bar {
    width: 108px; height: 5px; border-radius: 999px;
    background: var(--sink); overflow: hidden; flex: 0 0 auto;
  }
  .quota__fill { display: block; height: 100%; background: var(--gold); border-radius: 999px; }
  .quota__fill.is-low { background: var(--warn); }

  .chips {
    display: flex; flex-wrap: wrap; gap: .45rem;
    margin: 1rem 0 0; padding: 0; list-style: none;
    justify-content: center;
  }
  .chips button {
    font: inherit; font-size: .8rem; cursor: pointer;
    background: var(--glass-bg); color: var(--ink-2);
    border: 1px solid var(--glass-edge-soft); border-radius: 999px; padding: .38rem .8rem;
    backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
    box-shadow: var(--glass-inset);
    transition: border-color .15s ease, color .15s ease, background .15s ease, transform .12s ease;
  }
  .chips button:hover {
    color: var(--ink);
    border-color: var(--glass-edge);
    background: var(--glass-bg-strong);
    transform: translateY(-1px);
  }

  .answer-wrap { margin-top: 2.5rem; }

  .answer {
    font-size: clamp(1.05rem, .5vw + .95rem, 1.22rem);
    line-height: 1.62;
    white-space: pre-wrap;
    max-width: 62ch;
    margin-inline: auto;
    border-left: 2px solid var(--gold);
    padding: .85rem 1.1rem;
    border-radius: 0 16px 16px 0;
    background: var(--glass-bg);
    backdrop-filter: var(--glass);
    -webkit-backdrop-filter: var(--glass);
    border-top: 1px solid var(--glass-edge-soft);
    border-right: 1px solid var(--glass-edge-soft);
    border-bottom: 1px solid var(--glass-edge-soft);
    box-shadow: var(--glass-inset), var(--glass-shadow);
    text-align: left;
  }
  .answer.is-waiting {
    color: var(--ink-3); border-left-color: var(--glass-line); font-style: italic;
  }

  .cite {
    font-family: ui-monospace, "JetBrains Mono", "Cascadia Mono", Menlo, monospace;
    font-size: .62em; vertical-align: super; line-height: 0;
    color: var(--gold); text-decoration: none;
    padding: 0 .12em; border-radius: 3px;
  }
  .cite:hover, .cite:focus-visible { background: var(--glow-2); color: var(--gold-lit); }

  .rule {
    display: flex; align-items: center; gap: .9rem;
    font-size: .72rem; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-3);
    margin: 0 0 1.15rem;
  }
  .rule::before,
  .rule::after { content: ""; flex: 1 1 auto; height: 1px; background: var(--glass-line); }
  .srcs .rule::before { display: none; }

  .srcs { margin-top: 2.4rem; }
  ol.srcs__list { list-style: none; margin: 0; padding: 0; display: grid; gap: .45rem; counter-reset: src; }
  ol.srcs__list li {
    counter-increment: src;
    display: grid; grid-template-columns: 1.9rem minmax(0, 1fr); gap: .8rem;
    align-items: start;
    padding: .85rem 1rem .85rem .55rem; border-radius: 14px;
    background: var(--glass-bg);
    border: 1px solid transparent;
    backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
    transition: background .18s ease, border-color .18s ease;
  }
  .srcs__body { min-width: 0; }
  ol.srcs__list li::before {
    content: counter(src);
    font-family: ui-monospace, "JetBrains Mono", "Cascadia Mono", Menlo, monospace;
    font-size: .78rem; color: var(--gold);
    text-align: right; padding-top: .1rem;
  }
  ol.srcs__list li.is-lit {
    background: var(--glass-bg-strong);
    border-color: var(--glass-edge);
    box-shadow: var(--glass-inset);
  }
  .srcs__text { margin: 0; font-size: .92rem; color: var(--ink-2); line-height: 1.55; }
  .srcs__meta { margin: .3rem 0 0; font-size: .75rem; color: var(--ink-3); display: flex; flex-wrap: wrap; align-items: baseline; }
  .srcs__meta .mono { white-space: nowrap; }
  .srcs__meta a { color: var(--ink-3); }
  .srcs__meta a:hover { color: var(--gold); }
  .srcs__meta .dot { opacity: .5; padding: 0 .35rem; }

  .evidence {
    margin: 3.25rem 0 0;
    padding-top: 1.75rem;
    border-top: 1px solid var(--glass-line);
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .evidence > .rule,
  .evidence > .evidence__grid {
    width: 100%;
    box-sizing: border-box;
  }
  .evidence__lead {
    margin: 0 0 1.25rem;
    font-size: clamp(1.3rem, 2.6vw, 1.75rem);
    letter-spacing: -.025em; font-weight: 400;
    width: 100%;
    max-width: 22em;
    text-align: center;
    text-wrap: balance;
  }
  .evidence__grid {
    display: grid; gap: .75rem;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    width: 100%;
    text-align: center;
  }
  @media (min-width: 48rem) {
    .evidence__grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: .85rem;
    }
  }
  .stat {
    padding: 1.1rem 1.05rem 1.15rem;
    border-radius: 18px;
    background: var(--glass-bg);
    border: 1px solid var(--glass-edge);
    box-shadow: var(--glass-inset), var(--glass-shadow);
    backdrop-filter: var(--glass);
    -webkit-backdrop-filter: var(--glass);
    min-height: 7.75rem;
    display: flex; flex-direction: column; justify-content: center;
    align-items: center;
    text-align: center;
    transition: transform .2s ease, border-color .2s ease, background .2s ease;
  }
  .stat:hover {
    border-color: color-mix(in srgb, var(--gold) 30%, var(--glass-edge));
    background: var(--glass-bg-strong);
    transform: translateY(-2px);
  }
  @supports not (backdrop-filter: blur(1px)) {
    .stat { background: var(--raise-solid); }
  }
  .stat b {
    display: block; font-size: clamp(1.5rem, 2.8vw, 1.9rem);
    letter-spacing: -.04em; font-variant-numeric: tabular-nums; font-weight: 550;
    color: var(--ink); line-height: 1.1;
  }
  .stat span { display: block; font-size: .74rem; color: var(--ink-3); margin-top: .45rem; line-height: 1.4; }
  .evidence__note {
    margin: 1.35rem auto 0;
    font-size: .85rem; color: var(--ink-3);
    max-width: 36rem;
    text-align: center;
  }

  .caution {
    margin: 1.75rem auto 0;
    padding: .95rem 1.15rem;
    max-width: 36rem;
    width: 100%;
    box-sizing: border-box;
    background: var(--warn-bg); color: var(--warn);
    border-radius: 16px; font-size: .85rem; line-height: 1.55;
    border: 1px solid color-mix(in srgb, var(--warn) 22%, transparent);
    backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
    text-align: center;
  }

  footer {
    margin-top: 2.75rem;
    padding: 1.35rem 0 4.5rem;
    border-top: 1px solid var(--glass-line);
    font-size: .84rem; color: var(--ink-3);
    text-align: center;
  }
  footer a { color: var(--ink-3); }
  footer a:hover { color: var(--gold); }

  .to-top {
    position: fixed; right: max(1rem, env(safe-area-inset-right)); bottom: 1.1rem; z-index: 20;
    display: grid; place-items: center; width: 44px; height: 44px; padding: 0;
    background: var(--glass-bg-strong); color: var(--gold);
    border: 1px solid var(--glass-edge); border-radius: 14px;
    box-shadow: var(--glass-inset), var(--glass-shadow);
    backdrop-filter: var(--glass); -webkit-backdrop-filter: var(--glass);
    cursor: pointer; opacity: 0; visibility: hidden; transform: translateY(10px) scale(.96);
    transition: opacity .2s ease, transform .2s ease, visibility .2s;
  }
  .to-top.is-visible { opacity: 1; visibility: visible; transform: none; }
  .to-top svg { width: 17px; height: 17px; fill: currentColor; }

  @keyframes rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  .rise { animation: rise .36s cubic-bezier(.22,.7,.3,1) both; }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
    .haven__orb { filter: none; opacity: .4; }
    .read-progress { display: none; }
    .field__type { display: none !important; }
  }

</style>
</head>
<body>
<a class="skip" href="#q">Skip to the question</a>

<div class="haven" aria-hidden="true">
  <span class="haven__orb haven__orb--a"></span>
  <span class="haven__orb haven__orb--b"></span>
  <span class="haven__orb haven__orb--c"></span>
</div>
<div class="read-progress" aria-hidden="true"><span class="read-progress__bar" id="read-bar"></span></div>

<nav class="nav" id="nav" aria-label="Primary">
  <div class="shell nav__in">
    <a class="brand" href="/">
      <span class="brand__mark" aria-hidden="true"><svg viewBox="0 0 64 64" aria-hidden="true"><path class="brand__folio" d="M20 18h16c5 0 9 4 9 9v19H29c-5 0-9-4-9-9V18z" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round"/><path d="M26 28h12M26 35h9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none"/><circle class="brand__node" cx="44" cy="22" r="6" fill="currentColor"/></svg></span>
      <span class="brand__name">llm-docs-lab</span>
    </a>
    <div class="nav__links">
      <a href="https://samsonpg.github.io/static/llm-docs-lab/results/">Results</a>
      <a href="https://github.com/acsavenhq/llm-docs-lab">Source</a>
      <a href="https://samsonpg.github.io">Portfolio</a>
    </div>
${THEME_SWITCH_HTML}
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
        <span class="field__grow">
          <span class="field__type" id="q-type" aria-hidden="true"></span>
          <input id="q" name="q" type="search" autocomplete="off" required
                 aria-labelledby="qlabel"
                 placeholder="Ask about pricing or rate limits…">
        </span>
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

    <!--
      The allowance, in the open. This demo runs on a free daily allowance and used to
      simply stop working when it ran out, which reads as a broken project rather than a
      deliberate constraint. Saying what is left, and when it returns, turns a failure
      into a fact a visitor can plan around. Hidden until the figure loads so the page
      never shows an empty frame, and it says "estimated" because it is.
    -->
    <p class="quota" id="quota" hidden></p>
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
    <h2 class="evidence__lead serif">Numbers from scripts — not a pitch deck.</h2>
    <div class="evidence__grid">
      <div class="stat"><b class="mono">100%</b><span>recall@6 across a twenty-question golden set</span></div>
      <div class="stat"><b class="mono">1.00</b><span>mean reciprocal rank — the right document ranked first every time</span></div>
      <div class="stat"><b class="mono">0/10</b><span>prompt-injection attacks that landed, across two channels</span></div>
      <div class="stat"><b class="mono">7/20</b><span>questions unanswerable on purpose, to catch confident invention</span></div>
    </div>
    <p class="evidence__note">
      Every figure is produced by a script in the repository and republished as a
      <a href="https://samsonpg.github.io/static/llm-docs-lab/results/">static results page</a> that
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
  <a href="https://samsonpg.github.io/static/llm-docs-lab/results/">results</a>
</footer>

<button type="button" class="to-top" id="totop" aria-label="Back to top" title="Back to top" hidden>
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4a1 1 0 0 1 .7.3l7 7a1 1 0 0 1-1.4 1.4L13 7.4V19a1 1 0 1 1-2 0V7.4l-5.3 5.3a1 1 0 1 1-1.4-1.4l7-7A1 1 0 0 1 12 4Z"/></svg>
</button>

<script>
(() => {
  /* ── Theme ──────────────────────────────────────────────────────────── */

${THEME_SWITCH_JS}  /* ── Scroll: nav border, and back to top ────────────────────────────── */

  /* -- Allowance, shown rather than discovered by hitting it -- */

  const quotaEl = document.getElementById('quota');

  function humanUntil(iso) {
    const ms = new Date(iso).getTime() - Date.now();
    if (!Number.isFinite(ms) || ms <= 0) return 'shortly';
    const h = Math.floor(ms / 3600000);
    const m = Math.round((ms % 3600000) / 60000);
    return h ? h + 'h ' + m + 'm' : m + 'm';
  }

  async function refreshQuota() {
    if (!quotaEl) return;
    try {
      const res = await fetch('/quota', { headers: { accept: 'application/json' } });
      if (!res.ok) return;
      const q = await res.json();
      if (q.estimatedRemaining === null || q.estimatedRemaining === undefined) return;
      const pct = Math.max(0, Math.min(100, Math.round((q.estimatedRemaining / q.dailyFreeNeurons) * 100)));
      const low = pct <= 15;
      quotaEl.textContent = '';
      const bar = document.createElement('span');
      bar.className = 'quota__bar';
      const fill = document.createElement('span');
      fill.className = 'quota__fill' + (low ? ' is-low' : '');
      fill.style.width = pct + '%';
      bar.appendChild(fill);
      const text = document.createElement('span');
      /*
        Percentage first because it is the part a visitor can act on, the raw neuron
        counts after it for anyone who wants them, and "estimated" said out loud: the
        streaming API returns no usage figures, so this is computed from token estimates.
      */
      text.textContent = 
        pct + '% of the free daily AI allowance left (estimated, ' + q.estimatedRemaining.toLocaleString()
        + ' of ' + q.dailyFreeNeurons.toLocaleString() + ' neurons) · resets in ' + humanUntil(q.resetsAt);
      quotaEl.appendChild(bar);
      quotaEl.appendChild(text);
      quotaEl.hidden = false;
      quotaEl.title = q.basis || '';
    } catch (e) {
      /* A missing figure is not worth an error message; the line simply stays hidden. */
    }
  }

  refreshQuota();

  const nav = document.getElementById('nav');
  const toTop = document.getElementById('totop');
  const MIN_SCROLLABLE = 240;
  const SHOW_AFTER = 320;
  let ticking = false;

  const readBar = document.getElementById('read-bar');

  function onScrollFrame() {
    const y = window.scrollY;
    nav.classList.toggle('is-stuck', y > 4);
    if (readBar) {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      readBar.style.transform = 'scaleX(' + Math.min(1, Math.max(0, y / max)) + ')';
    }

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
  const typeHint = document.getElementById('q-type');
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

  /* Live typewriter in the empty field — a static full-question placeholder reads as
     pre-typed user text. Cycle the chip examples; stop whenever the field has focus or value. */
  (function typewriterHint() {
    if (!typeHint || reduced()) {
      if (typeHint) typeHint.hidden = true;
      return;
    }
    const lines = Array.from(document.querySelectorAll('.chips button[data-q]'))
      .map((b) => b.dataset.q)
      .filter(Boolean);
    if (!lines.length) {
      typeHint.hidden = true;
      return;
    }

    let i = 0;
    let pos = 0;
    let deleting = false;
    let pauseUntil = 0;
    let timer = 0;
    const TYPE_MS = 38;
    const DELETE_MS = 22;
    const HOLD_MS = 1600;
    const GAP_MS = 420;

    function busy() {
      return document.activeElement === input || input.value.trim().length > 0;
    }

    function syncVisibility() {
      const hide = busy();
      typeHint.hidden = hide;
      input.placeholder = hide ? 'Ask about pricing or rate limits…' : '';
    }

    function tick(now) {
      syncVisibility();
      if (!busy() && now >= pauseUntil) {
        const line = lines[i];
        if (!deleting) {
          pos = Math.min(line.length, pos + 1);
          typeHint.textContent = line.slice(0, pos);
          if (pos === line.length) {
            deleting = true;
            pauseUntil = now + HOLD_MS;
          }
        } else {
          pos = Math.max(0, pos - 1);
          typeHint.textContent = line.slice(0, pos);
          if (pos === 0) {
            deleting = false;
            i = (i + 1) % lines.length;
            pauseUntil = now + GAP_MS;
          }
        }
      }
      const delay = busy() ? 200 : (deleting ? DELETE_MS : TYPE_MS);
      timer = window.setTimeout(() => tick(performance.now()), delay);
    }

    input.addEventListener('focus', syncVisibility);
    input.addEventListener('blur', syncVisibility);
    input.addEventListener('input', syncVisibility);
    syncVisibility();
    timer = window.setTimeout(() => tick(performance.now()), 500);
    addEventListener('beforeunload', () => clearTimeout(timer));
  })();

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
      /*
        Same reasoning as the 429 above, one step further along. When the free allowance
        for the day is gone the server says so in words; showing "HTTP 500" instead would
        describe a working system as a broken one, which is the single worst thing this
        page could do to someone evaluating it.
      */
      if (res.status === 503) {
        let said = '';
        try { said = (await res.clone().json()).error || ''; } catch (e) { /* fall through to the default */ }
        out.classList.remove('is-waiting');
        out.textContent = said || 'The daily free AI allowance for this demo is used up. It resets at 00:00 UTC.';
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
