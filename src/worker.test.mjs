/**
 * src/worker.test.mjs
 *
 * WHAT: Checks the error boundary that separates "the free allowance ran out" from
 *       "something is broken".
 * WHY:  On 2026-08-25 the live demo answered every question with
 *       "Something went wrong: HTTP 500". Nothing was broken. Workers AI had raised
 *       AiError 4006 — the daily 10,000 neurons were spent — and with no boundary the
 *       exception propagated, Cloudflare turned it into error 1101, and a working system
 *       described itself to visitors as a broken one.
 * WHEN: node --test src/worker.test.mjs — no network, no API calls, no quota spent.
 *
 * The endpoints are driven through the real exported fetch handler with a stubbed env, so
 * these tests exercise the boundary that actually ships rather than a copy of its logic.
 *
 * LAYER: Test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.mjs';

/** The shape Workers AI actually throws; the message is the real one, verbatim. */
function aiQuotaError() {
  const err = new Error(
    '4006: you have used up your daily free allocation of 10,000 neurons, please upgrade '
    + "to Cloudflare's Workers Paid plan if you would like to continue usage.",
  );
  err.name = 'AiError';
  return err;
}

/** A minimal env whose first AI call fails the way the live one did. */
function envThatThrows(err) {
  return {
    AI: { run: async () => { throw err; } },
    VECTORIZE: { query: async () => ({ matches: [] }) },
  };
}

const req = (path) => new Request(`https://llmdocs.acsaven.com${path}`, {
  // a fresh IP per request, so the per-isolate rate limiter never masks the result
  headers: { 'cf-connecting-ip': `10.0.0.${Math.floor(Math.random() * 250) + 1}` },
});

test('an exhausted AI allowance answers 503 and explains itself', async () => {
  const res = await worker.fetch(req('/search?q=neurons'), envThatThrows(aiQuotaError()));

  assert.equal(res.status, 503, 'quota exhaustion must not surface as 500');
  const body = await res.json();
  assert.equal(body.reason, 'quota');
  assert.match(body.error, /allowance/i, 'the message has to say what happened');
  assert.match(body.error, /resets/i, 'and when it will work again');
  // It must not paste the provider's upsell at the visitor.
  assert.ok(!/upgrade to/i.test(body.error), 'do not forward the vendor upsell');
});

test('a genuine fault still answers 500, and says nothing revealing', async () => {
  const boom = new TypeError("Cannot read properties of undefined (reading 'matches')");
  const res = await worker.fetch(req('/search?q=neurons'), envThatThrows(boom));

  assert.equal(res.status, 500, 'a real bug must not be dressed up as a quota pause');
  const body = await res.json();
  assert.notEqual(body.reason, 'quota');
  assert.ok(!/Cannot read properties|undefined/.test(body.error), 'internal detail must not reach the response');
});

test('the quota check reads the code and the wording, and survives a wrapped cause', async () => {
  /*
    Three ways the same condition can arrive. If any of them slipped through, the visitor
    would be told the demo is broken on a day when it simply ran out of allowance.
  */
  const codeOnly = Object.assign(new Error('4006: allocation exceeded'), { name: 'AiError' });
  const wordsOnly = Object.assign(new Error('you have used up your daily free allocation'), { name: 'AiError' });
  const wrapped = new Error('retrieval failed', { cause: aiQuotaError() });

  for (const [label, err] of [['code only', codeOnly], ['wording only', wordsOnly], ['wrapped in a cause', wrapped]]) {
    const res = await worker.fetch(req('/search?q=x'), envThatThrows(err));
    assert.equal(res.status, 503, `${label} should be recognised as quota`);
  }
});

test('the boundary can actually fail', async () => {
  /*
    Every assertion above is about a handler returning the right status, which is exactly
    the kind of check that can be written wrong and pass forever. An error that is plainly
    NOT a quota problem must come back 500 — if this ever returns 503, the classifier has
    grown so broad that it would hide real faults, and the tests above would still be green.
  */
  const ordinary = new RangeError('index out of range');
  const res = await worker.fetch(req('/search?q=x'), envThatThrows(ordinary));
  assert.equal(res.status, 500, 'classifier is too broad — it is swallowing real errors as quota');
});

test('routes that need no model still work while the allowance is gone', async () => {
  /*
    The page, robots.txt and the sitemap cost nothing to serve. If the boundary or the
    outage took those down too, the demo would look dead rather than paused, and the
    published results — the part that matters to a reader — would be unreachable.
  */
  for (const path of ['/', '/robots.txt', '/llms.txt']) {
    const res = await worker.fetch(req(path), envThatThrows(aiQuotaError()));
    assert.equal(res.status, 200, `${path} must still serve with no AI allowance left`);
  }
});
