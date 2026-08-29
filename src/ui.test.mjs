/**
 * src/ui.test.mjs
 *
 * WHAT: Checks the generated page — tag balance, theming, accessibility, and the rules that
 *       keep untrusted text out of the DOM as markup.
 * WHY:  The page is a template literal. Nothing type-checks it, nothing lints it, and a
 *       missing </div> ships silently and renders wrong only in some browsers.
 * WHEN: node --test src/ui.test.mjs — no network, no API calls.
 *
 * A NOTE ON THE TAG CHECK, WHICH WAS WRONG THREE TIMES BEFORE IT WAS RIGHT
 * ────────────────────────────────────────────────────────────────────────
 * The first three versions of this check reported mismatches on perfectly valid markup:
 *
 *   1. It counted `<li>` literally, so `<li class="…">` never matched.
 *   2. Written through a shell heredoc, the `\\b` in the pattern collapsed to `\b`, which
 *      JavaScript reads inside a template literal as a BACKSPACE character rather than a
 *      word boundary. Every opening tag counted zero.
 *   3. Fixed to a `[ >/]` class, it then missed tags whose attributes begin on the next
 *      line — which this page has.
 *
 * Each time the checker accused good code, which is worse than having no checker: it sends
 * you hunting a bug that does not exist, and the third false alarm is the one that teaches
 * you to ignore the second real one. The pattern below uses a whitespace class and this
 * file is written directly rather than through a shell, so neither failure can recur.
 *
 * LAYER: Test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PAGE, PAGE_SOURCE } from './ui.mjs';
import { SECURITY_HEADERS } from './worker.mjs';

/** Elements that must be explicitly closed. Void elements are excluded by construction. */
const PAIRED = [
  'html', 'head', 'body', 'main', 'header', 'footer', 'nav', 'section', 'article',
  'div', 'ul', 'ol', 'li', 'a', 'p', 'span', 'form', 'label', 'button', 'svg', 'style', 'script',
];

test('every paired tag is balanced', () => {
  for (const tag of PAIRED) {
    const open = (PAGE.match(new RegExp('<' + tag + '[\\s>/]', 'gi')) || []).length;
    const close = (PAGE.match(new RegExp('</' + tag + '>', 'gi')) || []).length;
    assert.equal(open, close, `<${tag}>: ${open} open, ${close} close`);
  }
});

test('the tag check can actually fail', () => {
  /*
    Mutation testing, inline.

    Three earlier versions of the check above were incapable of failing, and each looked
    like it worked. This proves the current one is not a fourth.
  */
  const broken = PAGE.replace('</footer>', '');
  const open = (broken.match(/<footer[\s>/]/gi) || []).length;
  const close = (broken.match(/<\/footer>/gi) || []).length;
  assert.notEqual(open, close, 'removing a closing tag must be detectable');
});

test('the theme is defined for all three states', () => {
  /*
    A viewer has three states, not two: an explicit light choice, an explicit dark choice,
    and no choice at all — where only the system preference decides. A colour defined only
    inside a media query never applies once data-theme is set, which is how a themed page
    renders one theme's text on the other theme's background.

    Asserted without assuming which theme is the base. This page is dark-first, matching
    TryTokka, and an earlier version of this test hard-coded the light-first selectors and
    failed the moment the palette was inverted — reporting a bug in a page whose theming was
    entirely correct. The requirement is that all three states resolve, not that they are
    written in a particular order.
  */
  assert.ok(PAGE.includes(':root {'), 'a base palette must exist');
  assert.match(PAGE, /prefers-color-scheme:\s*(dark|light)/, 'the system preference must be honoured');

  // Both explicit choices must be able to override the system, whichever way round.
  assert.ok(PAGE.includes(':root[data-theme="light"]') || PAGE.includes(':root[data-theme="dark"]'),
    'an explicit choice must have its own block');
  assert.match(PAGE, /:root:not\(\[data-theme="(light|dark)"\]\)/,
    'the media query must be guarded so an explicit choice beats the system preference');

  // The guard must name the OPPOSITE theme to the one the media query is for, or it does nothing.
  const media = PAGE.match(/prefers-color-scheme:\s*(dark|light)\s*\)\s*\{\s*:root:not\(\[data-theme="(light|dark)"\]\)/);
  assert.ok(media, 'the guarded media query must be findable');
  assert.notEqual(media[1], media[2],
    'guarding a dark media query with :not([data-theme="dark"]) would be a no-op');
});

test('the theme is applied before first paint', () => {
  // A preference read after paint gives a dark-mode visitor a white flash on every load.
  const headEnd = PAGE.indexOf('</head>');
  const bootAt = PAGE.indexOf("localStorage.getItem(k)");
  assert.ok(bootAt !== -1, 'the boot script must read the stored preference');
  assert.ok(bootAt < headEnd, 'the boot script must run inside <head>, before the body renders');
});

test('the theme key matches the other sites', () => {
  // One choice should follow a visitor across the portfolio, the QR hub and this page.
  assert.ok(PAGE.includes('samsonpg-theme'), 'the shared storage key must be used');
});

test('the ask field uses a typing hint instead of a pre-typed question placeholder', () => {
  /*
    A full example question as placeholder looks like the visitor already typed it.
    The live typewriter (field__type) cycles chip examples; the native placeholder stays
    a short instruction for reduced-motion / no-JS.
  */
  assert.ok(PAGE.includes('id="q-type"') || PAGE.includes("id='q-type'"), 'typewriter target must exist');
  assert.ok(PAGE.includes('typewriterHint') || PAGE.includes('field__type'), 'typewriter styles or script must ship');
  assert.match(PAGE, /placeholder="Ask about pricing or rate limits[…]"/, 'placeholder must be instructional, not a sample question');
  assert.doesNotMatch(
    PAGE,
    /placeholder="How many neurons per day are free on Workers AI\?"/,
    'the old full-question placeholder must not return',
  );
});

test('localStorage access is guarded', () => {
  /*
    Reading localStorage throws outright in some privacy modes rather than returning null.
    An unguarded read in the boot script takes the whole page down before it paints.
  */
  /*
    Located by its content, not by being the first script on the page.

    This originally sliced from the first <script> tag, which worked until a JSON-LD block
    was added above it for search and assistant discovery. The test then examined the
    structured data, found no try/catch in it, and reported the boot script as unguarded —
    a failure in a file that had not changed. Positional assumptions about markup break the
    moment the markup grows.
  */
  const bootStart = PAGE.indexOf('localStorage.getItem(k)');
  const boot = PAGE.slice(PAGE.lastIndexOf('<script>', bootStart), PAGE.indexOf('</script>', bootStart));
  assert.ok(boot.includes('try'), 'the boot script must tolerate localStorage throwing');
  assert.ok(boot.includes('catch'), 'and must still set a readable theme when it does');
});

test('back to top is a real, labelled button', () => {
  assert.ok(PAGE.includes('id="totop"'), 'the control must exist');
  assert.match(PAGE, /<button[^>]*class="to-top"[^>]*aria-label="Back to top"/, 'it must be a button with a label, not a styled div');
  assert.ok(PAGE.includes('scroll-behavior: auto !important') || PAGE.includes('prefers-reduced-motion'),
    'reduced motion must be respected');
  assert.ok(PAGE.includes('requestAnimationFrame'), 'the scroll handler must not do layout work per event');
});

/**
 * The page with comments removed.
 *
 * The first version of the test below searched the raw page and failed — on a comment that
 * says "Text, never innerHTML". The only occurrence of the forbidden thing was the note
 * explaining not to do it.
 *
 * That is not a curiosity, it is a recurring bug in this codebase's tooling: a page-width
 * check once passed on the very layout it was written to catch, because it matched its own
 * explanatory comment. Any check that greps source for a forbidden string has to strip
 * comments first, or it reports on the documentation rather than the code.
 */
function code(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1 ');
}

test('untrusted text never becomes markup', () => {
  /*
    Source snippets and model output are attacker-influenced: the corpus is public
    documentation, and the question box sits on a public endpoint. Assigning either to
    innerHTML turns a retrieval system into a cross-site scripting vector.
  */
  assert.ok(!code(PAGE).includes('innerHTML'), 'innerHTML must not be used in page code');
  assert.ok(PAGE.includes('textContent'), 'text must be assigned as text');
});

test('the innerHTML check reads code, not comments', () => {
  // Proves the strip works in both directions: a comment is ignored, real code is caught.
  assert.ok(!code('/* never use innerHTML */').includes('innerHTML'), 'a comment must not trip the check');
  assert.ok(code('el.innerHTML = x;').includes('innerHTML'), 'real usage must still be caught');
});

test('a rate limit is explained rather than shown as a generic error', () => {
  // 429 is a normal outcome on a free tier. "Something went wrong" reads as a broken demo.
  assert.ok(PAGE.includes('429'), 'the rate-limited case must be handled explicitly');
  assert.match(PAGE, /Rate limited/i, 'and must say so in words a visitor understands');
});

test('the page declares its own accessibility basics', () => {
  assert.ok(PAGE.includes('lang="en"'), 'a language must be declared');
  assert.ok(PAGE.includes('aria-live="polite"'), 'streamed answers must be announced');
  assert.ok(PAGE.includes('class="skip"'), 'a skip link must exist');
  assert.ok(PAGE.includes(':focus-visible'), 'focus must be visible');
});

/*
  Every image on this page is a data: URI — the favicon, and the CSS mask that draws the
  search field's clear button. The Worker sent default-src 'none' with no img-src, which
  refuses data: along with everything else, so the favicon never rendered in production.
  For its entire life.

  Nothing caught it. A blocked image writes one console line and changes nothing a test was
  looking at, and the page looked correct in local preview because a local file server
  sends no CSP at all — so the only environment where the bug existed was the only one
  nobody was measuring.

  This reads the real header object rather than grepping the source for a policy string. A
  grepped CSP is a description of a CSP, and the two drift.
*/
test("the CSP permits the page's own data: images and no host", () => {
  const csp = SECURITY_HEADERS['content-security-policy'];
  const directive = (name) => {
    const found = csp.split(';').map((d) => d.trim())
      .find((d) => d === name || d.startsWith(name + ' '));
    return found === undefined ? null : found.slice(name.length).trim();
  };

  const usesDataImages = /src="data:image|href="data:image|url\("data:image/.test(PAGE);
  assert.ok(usesDataImages, 'this test is pointless if the page stopped using data: images');

  const img = directive('img-src');
  assert.ok(img !== null, 'img-src is absent, so default-src applies and data: images are blocked');
  assert.ok(/(^|\s)data:/.test(img), `img-src does not allow data: — got "${img}"`);

  // Allowing data: must not have quietly allowed the network along with it.
  assert.ok(!/https?:|\*/.test(img), `img-src should permit inline bytes only — got "${img}"`);
  assert.equal(directive('default-src'), "'none'");
});

test("the CSP still refuses third-party script, including Cloudflare's own beacon", () => {
  /*
    Cloudflare injects a Web Analytics beacon from static.cloudflareinsights.com. This page
    promises that nothing third-party loads, so script-src has to keep turning it away. The
    test exists so that a future "clean up the console errors" cannot quietly allow the host
    and silently break the promise the README makes.
  */
  const script = SECURITY_HEADERS['content-security-policy']
    .split(';').map((d) => d.trim()).find((d) => d.startsWith('script-src'));
  assert.ok(script, 'script-src is missing');
  assert.ok(!/cloudflareinsights|https?:|\*/.test(script), `script-src must name no host — got "${script}"`);
});

test('the CSP tests can actually fail', () => {
  /*
    The two checks above are string assertions against a constant, which is exactly the kind
    of check that can be written wrong and pass forever. Run their logic against policies
    known to be broken and require it to reject each one.
  */
  const allows = (csp) => {
    const d = csp.split(';').map((x) => x.trim()).find((x) => x.startsWith('img-src'));
    if (!d) return false;
    const v = d.slice('img-src'.length).trim();
    return /(^|\s)data:/.test(v) && !/https?:|\*/.test(v);
  };
  assert.equal(allows("default-src 'none'"), false, 'a policy with no img-src must be rejected');
  assert.equal(allows("default-src 'none'; img-src 'self'"), false, 'img-src without data: must be rejected');
  assert.equal(allows("default-src 'none'; img-src data: https://cdn.example.com"), false, 'a remote host must be rejected');
  assert.equal(allows("default-src 'none'; img-src data:"), true, 'the policy actually shipped must be accepted');
});

/*
  THE SERVED PAGE IS NOT THE AUTHORED PAGE
  ────────────────────────────────────────
  ui.mjs is heavily commented for someone learning the code. Those comments are
  32% of the gzipped page, and the person they are written for reads the file on
  GitHub, not by pressing "view source" on a pricing tool. So the source keeps
  them and the response does not.

  Stripping text out of a page that is one large template literal is the kind of
  change that breaks something silently — a swallowed rule, a corrupted URL, a
  missing element the script needs. These tests exist so it cannot.
*/

test('the served page carries no authoring comments', () => {
  assert.equal((PAGE.match(/<!--/g) ?? []).length, 0, 'HTML comment left in the response');
  assert.equal((PAGE.match(/\/\*/g) ?? []).length, 0, 'block comment left in the response');
});

test('the source keeps its comments, so the teaching is not lost', () => {
  assert.ok(PAGE_SOURCE.includes('READING THE CSS BELOW'), 'the CSS primer must survive in source');
  assert.ok(PAGE_SOURCE.length > PAGE.length, 'stripping must actually remove something');
  // If this ever stops being worth doing, delete the strip rather than keep a
  // build step that saves nothing.
  assert.ok(PAGE_SOURCE.length - PAGE.length > 5000, 'stripping should save real bytes');
});

test('stripping does not swallow anything the page needs', () => {
  for (const marker of [
    '<!doctype html>', '</html>', '<title>', '</style>', '</script>',
    'application/ld+json', '"@context"', '<form', 'aria-live',
    'data-theme-pref', 'samsonpg-theme',
  ]) {
    assert.ok(PAGE.includes(marker), `stripping removed ${marker}`);
  }
});

test('every element the client script looks up still exists in the response', () => {
  // The commonest way a strip breaks a page: the script survives, the element
  // it addresses does not, and nothing fails until a visitor clicks.
  const ids = [...new Set([...PAGE_SOURCE.matchAll(/getElementById\('([^']+)'\)/g)].map((m) => m[1]))];
  assert.ok(ids.length >= 5, 'expected the script to address several elements');
  for (const id of ids) {
    assert.ok(PAGE.includes(`id="${id}"`), `element #${id} is addressed by the script but missing from the page`);
  }
});

test('URLs survive, because // is the hazard a naive stripper hits', () => {
  // Line comments are deliberately NOT stripped: a rule for // also eats the
  // one in https:// and corrupts every link on the page.
  const urls = PAGE.match(/https:\/\/[^"'\s)]+/g) ?? [];
  assert.ok(urls.length > 10, 'expected many absolute URLs to survive');
  for (const u of urls) assert.ok(u.startsWith('https://'), `corrupted URL: ${u}`);
  assert.ok(PAGE.includes('https://llmdocs.acsaven.com/'));
});
