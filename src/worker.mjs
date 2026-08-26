/**
 * src/worker.mjs
 *
 * WHAT: The HTTP surface — the UI page, /ask, /search, authenticated /ingest, /health.
 * WHY:  Embeddings and generation run through Workers AI bindings rather than API keys, so
 *       this public repo holds no secret and there is nothing to rotate.
 * WHEN: `wrangler dev --remote` locally, `wrangler deploy` for the live URL.
 *
 * WHAT A PUBLIC AI ENDPOINT HAS TO DEFEND AGAINST
 * ───────────────────────────────────────────────
 * Every request here can spend the daily Workers AI allowance, which is shared, finite, and
 * resets once a day. Three things follow, and none of them are optional on a URL that is
 * printed on a CV:
 *
 *   - RATE LIMITING per IP, so one script cannot exhaust the day's quota in a minute and
 *     leave the demo dead for everyone who looks at it afterwards.
 *   - INPUT BOUNDS. A question is capped in length before it reaches a model; an unbounded
 *     prompt is an unbounded bill.
 *   - AUTHENTICATION on ingest. An open ingest endpoint is a public index-poisoning API.
 *
 * LAYER: Delivery (HTTP).
 */
import { PAGE } from './ui.mjs';
import { retrieve, answerQuestionStream, DEFAULT_MODEL, EMBEDDING_MODEL } from './answer/answer.mjs';
import { runAgent, LIMITS as AGENT_LIMITS } from './agent/agent.mjs';

/** Questions longer than this are refused. Real questions are far shorter. */
const MAX_QUESTION_CHARS = 500;

/**
 * Models the /ask endpoint will run. Anything else falls back to the default.
 *
 * The list exists so the eval can compare models through the endpoint that actually ships,
 * without turning a public URL into "run any model you like on someone else's quota".
 */
const ALLOWED_MODELS = [
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  '@cf/meta/llama-3.1-8b-instruct-fp8',
  '@cf/meta/llama-3.2-3b-instruct',
];

/*
  A small in-memory rate limiter.

  Deliberately simple and deliberately documented as imperfect: Workers are per-isolate, so
  this is per-isolate rather than global, and a distributed attacker gets one bucket per
  edge location. It stops the honest accident — a loop in someone's terminal, a crawler —
  which is what actually drains a free tier. A global limit needs Durable Objects or KV, and
  the README says so rather than implying this is airtight.
*/
const BUCKETS = new Map();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 12;

/**
 * An authenticated operator is not rate limited.
 *
 * The eval must run dozens of questions through the same endpoints the UI uses — that is
 * the whole point of measuring the deployed system rather than a copy — and the first full
 * run was throttled by this Worker's own limiter after twelve requests. Loosening the limit
 * would have been the wrong fix: it exists so one script cannot drain the day's shared AI
 * allowance and leave the demo dead.
 *
 * So the limiter distinguishes an anonymous visitor from someone holding the ingest token,
 * which only I have. The eval still paces itself; this only removes the hard wall.
 */
function isOperator(request, env) {
  const given = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  return tokenMatches(given, env.INGEST_TOKEN ?? '');
}

function rateLimited(ip) {
  const now = Date.now();
  const hits = (BUCKETS.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  BUCKETS.set(ip, hits);
  // Keep the map from growing without bound in a long-lived isolate.
  if (BUCKETS.size > 5000) {
    for (const [k, v] of BUCKETS) if (!v.some((t) => now - t < WINDOW_MS)) BUCKETS.delete(k);
  }
  return hits.length > MAX_PER_WINDOW;
}

/**
 * Compared without early exit, so a wrong token cannot be found one character at a time.
 *
 * THE EMPTY CHECK IS THE IMPORTANT LINE. Every call site passes `env.INGEST_TOKEN ?? ''`,
 * and a request with no Authorization header produces `given = ''` the same way. Without
 * the guard below those two match, so an unset secret authenticated ANY anonymous request:
 * /ingest became an open index-poisoning API, /ingest/delete became an open delete, and the
 * rate limiter — which exists so one script cannot drain the day's AI allowance — waved
 * everyone through as an operator.
 *
 * It was not reachable in production because the secret is set. That is exactly what makes
 * it worth fixing: nothing would have failed visibly, and a bad rotation or a fresh
 * environment would have opened the whole surface silently.
 *
 * The length comparison is also folded into the XOR rather than returning early, so the
 * token's length no longer leaks through timing either.
 */
function tokenMatches(given, expected) {
  if (typeof given !== 'string' || typeof expected !== 'string') return false;
  if (expected.length === 0) return false;
  let diff = given.length ^ expected.length;
  const max = Math.max(given.length, expected.length);
  for (let i = 0; i < max; i += 1) {
    diff |= (given.charCodeAt(i) || 0) ^ (expected.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export const SECURITY_HEADERS = {
  /*
    The page inlines its own CSS and script and loads nothing from anywhere else, so the
    policy can be strict rather than permissive. 'unsafe-inline' is required because the
    style and script are inline; a nonce would be better and is noted in the README as the
    honest next step rather than claimed as done.
    img-src data: is NOT a loosening. default-src 'none' with no img-src blocked every
    image on the page, including two that are part of it: the favicon and the CSS mask that
    draws the search field's clear button. Both are data: URIs — bytes already inside the
    HTML — so they were refused as if they came from somewhere else. The favicon had never
    once rendered in production and nothing said so, because a blocked image logs to the
    console and changes nothing else on the page.

    'data:' permits inline bytes and no host at all, so the promise that nothing
    third-party loads still holds exactly. Note what is deliberately still refused:
    Cloudflare injects a Web Analytics beacon from static.cloudflareinsights.com and
    script-src turns it away. That refusal is the policy working, not a bug to fix.
  */
  'content-security-policy':
    "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; "
    + "img-src data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
};

const json = (data, status = 200) =>
  Response.json(data, { status, headers: { ...SECURITY_HEADERS, 'cache-control': 'no-store' } });

/*
  Is this the daily Workers AI allowance running out, rather than a fault?

  Workers AI raises AiError 4006 once the free 10,000 neurons for the day are spent. With
  no boundary that propagates as an unhandled exception, Cloudflare turns it into error
  1101, and the page tells a visitor "Something went wrong: HTTP 500" — which reads as a
  broken demo when in fact the system is working exactly as its README describes.

  Matched on the code AND on the wording, because a message can be reworded and a code can
  be joined by a sibling. Getting this wrong in the generous direction is the safer error:
  the worst case is a real fault being described as a quota pause, which the logs still
  record in full.
*/
function isQuotaError(err) {
  for (let e = err, hops = 0; e && hops < 4; e = e.cause, hops += 1) {
    const text = `${e.name ?? ''} ${e.message ?? ''}`;
    if (/\b(4006|3040)\b/.test(text)) return true;
    if (/daily free allocation|free allocation of|out of neurons|neurons/i.test(text)) return true;
  }
  return false;
}

/*
  Answer cache.

  The daily Workers AI allowance is 10,000 neurons and this model costs 204,805 neurons per
  million OUTPUT tokens, so a 600-token answer is roughly 123 neurons before the input side
  is counted — about sixty answers a day, total. Logs for the week to 2026-08-26 recorded 241
  questions and the allowance running out 35 times.

  Most of those questions are not distinct. The page offers suggested questions as buttons,
  so the same handful arrive over and over: one appeared five times in the failures alone.
  Answering an identical question against an unchanged corpus a second time spends neurons to
  produce a byte-identical result.

  So the answer is stored under a key that includes the corpus stamp. A re-ingest changes the
  stamp, every previous key becomes unreachable at once, and no stale price can be served
  after the corpus behind it moved — which matters more here than the saving does.
*/
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;
const CORPUS_STAMP_KEY = 'llmqa:corpus-stamp';

/** Cache is optional: without the binding the site behaves exactly as it did before. */
function cacheAvailable(env) {
  return Boolean(env.ANSWERS);
}

async function corpusStamp(env) {
  if (!cacheAvailable(env)) return null;
  try {
    return (await env.ANSWERS.get(CORPUS_STAMP_KEY)) ?? '0';
  } catch {
    return null;   // A cache that cannot be read must never break an answer.
  }
}

async function answerCacheKey(env, question, model) {
  const stamp = await corpusStamp(env);
  if (stamp === null) return null;
  // Normalised so trivial differences in spacing or case do not each cost a generation.
  const norm = question.trim().toLowerCase().replace(/\s+/g, ' ');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(model + '|' + norm));
  const hex = [...new Uint8Array(digest)].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
  return 'llmqa:a:' + stamp + ':' + hex;
}

/*
  Spend tracking, so the page can say how much of the day is left instead of simply
  failing one afternoon with no explanation.

  Cloudflare exposes no "neurons remaining" API to a Worker, and the streaming call
  returns no usage block, so this is an ESTIMATE and is labelled as one everywhere it
  surfaces. It counts characters, divides by four for tokens, and applies the published
  neuron rates. On a site whose whole argument is that its numbers are measured,
  presenting a guess as a reading would be the one unforgivable thing — so /quota ships
  the basis alongside the figure and the page repeats it.

  Two known limits, neither hidden: KV is not atomic, so two answers finishing together
  can lose an increment, and chars/4 is approximate. Both push the estimate LOW, which
  means the page under-promises headroom rather than over-promising it.
*/
const DAILY_FREE_NEURONS = 10000;

/*
  One agent run is five model calls. Starting one with almost nothing left spends the
  remainder and still fails partway, which costs a visitor a half-finished trace and the
  next visitor everything. This is the floor below which it declines instead.
*/
const AGENT_MIN_NEURONS = 1500;

/** Neurons per million tokens, from developers.cloudflare.com/workers-ai/platform/pricing */
const NEURON_RATES = {
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast': { input: 26668, output: 204805 },
  '@cf/meta/llama-3.1-8b-instruct-fp8': { input: 13636, output: 26364 },
  '@cf/meta/llama-3.2-3b-instruct': { input: 4625, output: 30475 },
};
const EMBEDDING_NEURONS_PER_M = 1841;

/** UTC day. The allowance resets at 00:00 UTC, so the counter follows that clock. */
function spendKey(now = new Date()) {
  return 'llmqa:spend:' + now.toISOString().slice(0, 10);
}

/** When the allowance comes back. */
function nextResetISO(now = new Date()) {
  const d = new Date(now);
  d.setUTCHours(24, 0, 0, 0);
  return d.toISOString();
}

/** Crude on purpose; every caller presents the result as an estimate. */
const estTokens = (text) => Math.ceil(String(text ?? '').length / 4);

function estimateNeurons(model, inputText, outputText) {
  const rate = NEURON_RATES[model] ?? NEURON_RATES[DEFAULT_MODEL];
  const inTok = estTokens(inputText);
  const outTok = estTokens(outputText);
  const embed = (inTok / 1e6) * EMBEDDING_NEURONS_PER_M;
  return Math.ceil((inTok / 1e6) * rate.input + (outTok / 1e6) * rate.output + embed);
}

async function readSpend(env) {
  if (!cacheAvailable(env)) return null;
  try {
    const stored = await env.ANSWERS.get(spendKey());
    const n = Number(stored);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return null;
  }
}

async function addSpend(env, neurons) {
  if (!cacheAvailable(env) || !(neurons > 0)) return;
  try {
    const cur = (await readSpend(env)) ?? 0;
    // 48h: outlives the day it describes, then cleans itself up.
    await env.ANSWERS.put(spendKey(), String(cur + neurons), { expirationTtl: 60 * 60 * 48 });
  } catch {
    /* A counter that cannot be written must never affect an answer. */
  }
}

/*
  Server-sent events, for the pipeline view.

  The plain-text /ask is untouched and remains the default: the eval scores the endpoint
  the UI uses, and quietly changing its wire format would invalidate every number on the
  results page. Events are opt-in with ?events=1.

  Every frame carries measured data. A step appears when it has actually happened and
  reports the milliseconds it actually took, because a progress display that animates
  through invented stages would undercut the one thing this project is arguing.
*/
function sseHeaders() {
  return {
    ...SECURITY_HEADERS,
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-store',
    'x-accel-buffering': 'no',
  };
}

/** One frame. Named events so a client can switch on them without parsing payloads. */
function sseFrame(event, data) {
  return 'event: ' + event + '\ndata: ' + JSON.stringify(data) + '\n\n';
}

const routes = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';

    if (url.pathname === '/' || url.pathname === '/index.html') {
      return new Response(PAGE, {
        headers: { ...SECURITY_HEADERS, 'content-type': 'text/html; charset=utf-8' },
      });
    }

    /*
      Discovery files, served from the Worker rather than as static assets.

      There is no build step and no bucket — the whole site is this one script — so these
      are strings. Small enough that a file each would be more machinery than content.

      llms.txt is included knowingly: it is a convention some assistants read and Google's
      crawler ignores entirely. It costs nine lines and helps in the case where an assistant
      is deciding whether this page is worth citing, which is the traffic this project can
      realistically get. It is not claimed to do more than that.
    */
    if (url.pathname === '/robots.txt') {
      return new Response([
        'User-agent: *',
        'Allow: /',
        '',
        '# The endpoints below spend a shared, finite AI allowance on every request.',
        '# Crawling them costs real quota and returns nothing useful to an index.',
        'Disallow: /ask',
        'Disallow: /search',
        'Disallow: /agent',
        'Disallow: /probe',
        'Disallow: /ingest',
        '',
        'Sitemap: https://llmdocs.acsaven.com/sitemap.xml',
      ].join('\n'), { headers: { ...SECURITY_HEADERS, 'content-type': 'text/plain; charset=utf-8' } });
    }

    if (url.pathname === '/sitemap.xml') {
      const body = '<?xml version="1.0" encoding="UTF-8"?>'
        + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        + '<url><loc>https://llmdocs.acsaven.com/</loc><changefreq>monthly</changefreq><priority>1.0</priority></url>'
        + '</urlset>';
      return new Response(body, { headers: { ...SECURITY_HEADERS, 'content-type': 'application/xml; charset=utf-8' } });
    }

    if (url.pathname === '/llms.txt') {
      return new Response([
        '# llm-docs-lab',
        '',
        '> Answers questions about LLM provider pricing and rate limits from a fixed snapshot',
        '> of seven provider documentation pages. Every claim carries a numbered citation and',
        '> the retrieval date of its source.',
        '',
        '## What it is',
        '',
        'A retrieval system built to be measured rather than demonstrated. Retrieval scores',
        '100% recall@6 on a 20-question golden set (MRR 1.00). Answer quality is compared',
        'across three models, and ten prompt-injection attacks across two channels were run',
        'against the live index — 0 of 10 succeeded. Every figure is reproducible from the',
        'repository.',
        '',
        '## Honest limits',
        '',
        '- Answers reflect the snapshot date shown on each source, not live pages. Prices change.',
        '- The corpus is seven pages, chosen so every answer could be verified by hand.',
        '- 0/10 on injection is ten attacks against one model on one date, not immunity.',
        '- The agent does not ground its final answer to the standard /ask enforces.',
        '',
        '## Links',
        '',
        '- Source, evaluation harness and measured limits: https://github.com/acsavenhq/llm-docs-lab',
        '- Author: https://samsonpg.github.io',
      ].join('\n'), { headers: { ...SECURITY_HEADERS, 'content-type': 'text/plain; charset=utf-8' } });
    }

    /*
      What is left of today, in terms a visitor can act on. Estimated, and says so —
      see the note above the helpers.
    */
    if (url.pathname === '/quota') {
      const used = await readSpend(env);
      return json({
        estimated: true,
        basis: 'counted from token estimates against the neuron rates Cloudflare publishes, not an authoritative balance',
        dailyFreeNeurons: DAILY_FREE_NEURONS,
        estimatedUsed: used,
        estimatedRemaining: used === null ? null : Math.max(0, DAILY_FREE_NEURONS - used),
        resetsAt: nextResetISO(),
      });
    }

    if (url.pathname === '/health') {
      return json({ ok: true, embedding: EMBEDDING_MODEL, generation: DEFAULT_MODEL });
    }

    if (url.pathname === '/probe') {
      const { data } = await env.AI.run(EMBEDDING_MODEL, { text: [url.searchParams.get('q') ?? 'probe'] });
      return json({ model: EMBEDDING_MODEL, dimensions: data[0].length });
    }

    /* ── Ingest: authenticated, because an open one is an index-poisoning API ── */
    if (url.pathname === '/ingest') {
      if (request.method !== 'POST') return new Response('POST only', { status: 405 });

      const given = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
      if (!tokenMatches(given, env.INGEST_TOKEN ?? '')) {
        return new Response('unauthorized', { status: 401, headers: SECURITY_HEADERS });
      }

      const chunks = await request.json();
      if (!Array.isArray(chunks) || !chunks.length) {
        return json({ error: 'expected a non-empty array of chunks' }, 400);
      }

      /*
        The corpus is about to change, so every cached answer describes a corpus that no
        longer exists. Moving the stamp orphans all of them in a single write — cheaper and
        far safer than enumerating keys, and it leaves no window in which a price from the
        previous corpus can still be served.
      */
      if (cacheAvailable(env)) {
        try { await env.ANSWERS.put(CORPUS_STAMP_KEY, String(Date.now())); } catch { /* cache is optional */ }
      }

      const { data } = await env.AI.run(EMBEDDING_MODEL, { text: chunks.map((c) => c.text) });
      const vectors = data.map((values, i) => ({
        id: chunks[i].id,
        values,
        metadata: {
          text: chunks[i].text,
          docId: chunks[i].docId,
          url: chunks[i].url,
          section: chunks[i].section ?? '',
          fetchedAt: chunks[i].fetchedAt ?? '',
          kind: chunks[i].kind ?? '',
        },
      }));

      const result = await env.VECTORIZE.upsert(vectors);
      return json({ upserted: vectors.length, mutationId: result.mutationId });
    }

    /*
      Delete by id. Authenticated, and it exists specifically for the injection tests.

      Those tests poison the live index on purpose, so there must be an exact way to remove
      what they inserted. Without it, a failed run leaves a public demo answering strangers
      with attacker-controlled text — which is a considerably worse outcome than not having
      measured the attack rate at all.
    */
    if (url.pathname === '/ingest/delete') {
      if (request.method !== 'POST') return new Response('POST only', { status: 405 });
      if (!isOperator(request, env)) {
        return new Response('unauthorized', { status: 401, headers: SECURITY_HEADERS });
      }
      const { ids } = await request.json();
      if (!Array.isArray(ids) || !ids.length) return json({ error: 'expected { ids: [...] }' }, 400);

      const result = await env.VECTORIZE.deleteByIds(ids);
      return json({ deleted: ids.length, mutationId: result.mutationId });
    }

    /* ── Retrieval only, no generation. Used by the eval to score retrieval alone. ── */
    if (url.pathname === '/search') {
      const q = (url.searchParams.get('q') ?? '').slice(0, MAX_QUESTION_CHARS);
      if (!q) return json({ error: 'missing q' }, 400);
      if (!isOperator(request, env) && rateLimited(ip)) return json({ error: 'rate limited, try again shortly' }, 429);

      const topK = Math.min(Math.max(Number(url.searchParams.get('k') ?? 5), 1), 20);
      return json({ query: q, matches: await retrieve(env, q, { topK }) });
    }

    /*
      The same answer, narrated. The response is returned before any work starts so the
      first step can be shown while the model is still being called — the whole point is
      that a visitor sees retrieval finish before generation begins.
    */
    if (url.pathname === '/ask' && url.searchParams.get('events') === '1') {
      const raw = url.searchParams.get('q') ?? '';
      if (!raw.trim()) return json({ error: 'missing q' }, 400);
      if (raw.length > MAX_QUESTION_CHARS) {
        return json({ error: 'question too long (max ' + MAX_QUESTION_CHARS + ' characters)' }, 413);
      }
      if (!isOperator(request, env) && rateLimited(ip)) {
        return json({ error: 'rate limited, try again shortly' }, 429);
      }

      const requested = url.searchParams.get('model');
      const model = ALLOWED_MODELS.includes(requested) ? requested : DEFAULT_MODEL;

      const out = new TransformStream();
      const writer = out.writable.getWriter();
      const enc = new TextEncoder();
      const send = (event, data) => writer.write(enc.encode(sseFrame(event, data)));

      (async () => {
        const startedAt = Date.now();
        try {
          /* Operators always generate — see the note on the plain /ask path below. */
          const operator = isOperator(request, env);
          const cacheKey = await answerCacheKey(env, raw.trim(), model);
          if (cacheKey && !operator) {
            let hit = null;
            try { hit = await env.ANSWERS.get(cacheKey, 'json'); } catch { /* generate instead */ }
            if (hit && typeof hit.answer === 'string' && hit.answer) {
              /*
                A hit is reported as its own step rather than hidden. It explains an answer
                arriving instantly, and it is the honest reason no neurons were spent.
              */
              await send('step', { name: 'cache', ms: Date.now() - startedAt, detail: 'answered earlier, no model call' });
              await send('sources', hit.sources ?? []);
              await send('token', { text: hit.answer });
              await send('done', { ms: Date.now() - startedAt, cached: true });
              return;
            }
          }

          const steps = [];
          const { stream, sources } = await answerQuestionStream(env, raw.trim(), {
            model,
            onStep: (st) => { steps.push(st); },
          });
          for (const st of steps) await send('step', st);

          if (!stream) {
            await send('sources', []);
            await send('token', { text: 'No sources were retrieved for that question, so there is nothing to answer from.' });
            await send('done', { ms: Date.now() - startedAt, grounded: false });
            return;
          }

          const compact = sources.map((x) => ({
            text: x.text.slice(0, 400), source: x.source, fetchedAt: x.fetchedAt, score: x.score,
          }));
          await send('sources', compact);

          const genStart = Date.now();
          let buffer = '';
          let full = '';
          const dec = new TextDecoder();
          for await (const part of stream) {
            buffer += typeof part === 'string' ? part : dec.decode(part, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';
            for (const line of lines) {
              if (!line.startsWith('data:')) continue;
              const payload = line.slice(5).trim();
              if (!payload || payload === '[DONE]') continue;
              try {
                const token = JSON.parse(payload).response;
                if (token) { full += token; await send('token', { text: token }); }
              } catch { /* a partial frame; the next chunk completes it */ }
            }
          }

          await send('step', { name: 'generate', ms: Date.now() - genStart, detail: model });
          await send('done', { ms: Date.now() - startedAt, chars: full.length });

          if (full.trim() && ctx?.waitUntil) {
            const promptChars = sources.map((x) => x.text).join(' ') + raw;
            ctx.waitUntil(addSpend(env, estimateNeurons(model, promptChars, full)));
            if (cacheKey) {
              ctx.waitUntil(
                env.ANSWERS.put(
                  cacheKey,
                  JSON.stringify({ answer: full, sources: compact, model, at: new Date().toISOString() }),
                  { expirationTtl: CACHE_TTL_SECONDS },
                ).catch(() => {}),
              );
            }
          }
        } catch (err) {
          /*
            The log always happens; telling the visitor might not.

            One way to arrive here is that the reader disconnected — and in that case this
            frame rejects too. An unguarded second throw from inside a catch escapes the
            detached task with it. So: record it first, where it is useful, then make a
            best-effort attempt to say something to whoever may still be listening.
          */
          const quota = isQuotaError(err);
          if (quota) console.warn(`quota exhausted (events): ${err?.message ?? err}`);
          else console.error('events stream failed', err?.stack ?? String(err));
          try {
            await send('error', quota
              ? {
                reason: 'quota',
                message: 'The daily free AI allowance for this demo is used up. It resets at 00:00 UTC.',
                resetsAt: nextResetISO(),
              }
              : { reason: 'fault', message: 'Something failed inside the worker. It has been logged.' });
          } catch {
            /* Reader gone. The log above is the record that matters. */
          }
        } finally {
          try {
            await writer.close();
          } catch {
            /* Already closed or errored; there is nothing left to flush. */
          }
        }
      })();

      return new Response(out.readable, { headers: sseHeaders() });
    }

    /* ── The answer endpoint the UI calls. Streams tokens as they arrive. ── */
    if (url.pathname === '/ask') {
      const raw = url.searchParams.get('q') ?? '';
      if (!raw.trim()) return json({ error: 'missing q' }, 400);
      if (raw.length > MAX_QUESTION_CHARS) {
        return json({ error: `question too long (max ${MAX_QUESTION_CHARS} characters)` }, 413);
      }
      if (!isOperator(request, env) && rateLimited(ip)) return json({ error: 'rate limited, try again shortly' }, 429);

      /*
        The model is selectable, from an ALLOWLIST and never from the query string directly.

        The eval needs to compare models through the same endpoint the UI uses, otherwise it
        measures a different code path than the one that ships. But passing an arbitrary
        model name to env.AI.run on a public URL hands a stranger the choice of what to spend
        the daily allowance on — including the largest and slowest model available, on repeat.
        An unknown value falls back to the default rather than erroring, so a typo in a
        script degrades instead of breaking.
      */
      const requested = url.searchParams.get('model');
      const model = ALLOWED_MODELS.includes(requested) ? requested : DEFAULT_MODEL;

      /*
        A repeat of a question already answered against this corpus costs nothing. The
        reply is identical to what the model would produce, because it IS what the model
        produced; x-cache lets the eval and anyone curious tell the two apart.
      */
      /*
        THE MEASURING TOOLS MUST NOT BE MEASURED AGAINST THE CACHE.

        The eval and the injection suite both call this endpoint holding the operator token,
        and both exist to find out what the MODEL does. A cache hit answers them with text
        the model produced at some earlier moment, so the eval scores a recording and the
        security suite declares an attack repelled without the attack ever reaching a model.

        Four of the twenty golden-set questions are the same strings as the suggested
        questions on the page, which are deliberately kept warm — so this was not a corner
        case, it was a fifth of the eval. The question-channel injections are worse: nothing
        in them moves the corpus stamp, so a second run of the suite would have been served
        entirely from its own first run.

        Operators therefore always generate. They still populate the cache on the way out,
        because a visitor asking the same thing afterwards should not pay for it again.
      */
      const operator = isOperator(request, env);
      const cacheKey = await answerCacheKey(env, raw.trim(), model);
      if (cacheKey && !operator) {
        let hit = null;
        try { hit = await env.ANSWERS.get(cacheKey, 'json'); } catch { /* miss, generate */ }
        if (hit && typeof hit.answer === 'string' && hit.answer) {
          return new Response(hit.answer, {
            headers: {
              ...SECURITY_HEADERS,
              'content-type': 'text/plain; charset=utf-8',
              'cache-control': 'no-store',
              'x-cache': 'hit',
              'x-sources': encodeURIComponent(JSON.stringify(hit.sources ?? [])),
            },
          });
        }
      }

      const { stream, sources } = await answerQuestionStream(env, raw.trim(), { model });

      if (!stream) {
        return new Response(
          'No sources were retrieved for that question, so there is nothing to answer from.',
          { headers: { ...SECURITY_HEADERS, 'content-type': 'text/plain; charset=utf-8', 'x-sources': '%5B%5D' } },
        );
      }

      /*
        Sources travel in a header so the page can render citations before the first token
        arrives — the reader can see what is being answered from while it is being written.
        URI-encoded because header values are latin-1 and the corpus contains ·, — and ₹.
      */
      const compact = sources.map((s) => ({
        text: s.text.slice(0, 400), source: s.source, fetchedAt: s.fetchedAt, score: s.score,
      }));

      /*
        Workers AI streams Server-Sent Events. The UI wants plain text, so the SSE framing is
        unwrapped here rather than in the browser: parsing a wire format is the server's job,
        and it keeps the page free of a protocol it should not need to know about.
      */
      const out = new TransformStream();
      const writer = out.writable.getWriter();
      const enc = new TextEncoder();
      const dec = new TextDecoder();

      (async () => {
        let buffer = '';
        let full = '';        // what to store, assembled as it is sent
        let clean = true;     // a failed or interrupted answer must never be cached
        try {
          for await (const part of stream) {
            buffer += typeof part === 'string' ? part : dec.decode(part, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';
            for (const line of lines) {
              if (!line.startsWith('data:')) continue;
              const payload = line.slice(5).trim();
              if (!payload || payload === '[DONE]') continue;
              try {
                const token = JSON.parse(payload).response;
                if (token) { full += token; await writer.write(enc.encode(token)); }
              } catch {
                /* A partial JSON frame; the next chunk completes it. */
              }
            }
          }
        } catch (err) {
          /*
            The top-level quota handler cannot reach this. Once the stream is running the Response
            and its headers have already gone out, so there is no status left to turn into a 503 —
            this catch is the only thing between a visitor and whatever Workers AI threw.

            It used to write err.message verbatim, so someone evaluating the demo could be shown
            Cloudflare's raw text, upgrade advert included. Logs for the week to 2026-08-26 recorded
            27 quota failures on /ask and only 14 reaching the graceful path; the other 13 arrived
            here and were printed as-is.

            Non-quota faults now say nothing specific either. The stack still goes to the log,
            where it is useful and not on display.
          */
          clean = false;   // a partial or failed answer must never be stored

          /*
            A disconnected reader is one of the ways to land here, and in that case the write
            below rejects as well. A second throw from inside a catch escapes this detached
            task entirely, so the log comes first and the message to the visitor is
            best-effort: if anyone is still reading they get an explanation, and if not, the
            failure is already recorded where it is useful.
          */
          const quota = isQuotaError(err);
          if (quota) console.warn(`quota exhausted mid-stream: ${err?.message ?? err}`);
          else console.error('stream failed', err?.stack ?? String(err));

          const note = quota
            ? '\n\n[The daily free AI allowance for this demo is used up. It resets at 00:00 UTC — '
              + 'the measured results linked from this page were taken earlier and still stand.]'
            : '\n\n[The answer stream stopped early. It has been logged.]';
          try {
            await writer.write(enc.encode(note));
          } catch {
            /* Reader gone. The log above is the record that matters. */
          }
        } finally {
          /*
            THE BOOKKEEPING RUNS BEFORE THE CLOSE, AND THE CLOSE CANNOT THROW PAST IT.

            writer.close() rejects when the reader has already gone — a visitor navigating
            away mid-answer, which is common against a model that takes seconds to a first
            token. It used to be the first statement here, so that rejection skipped
            everything below it: the neurons were spent and never counted, leaving the
            allowance display reading high, and a complete answer was thrown away instead
            of cached. The request that costs the most is the one most likely to be
            abandoned, so this was not a rare path.

            The work is ordered by what survives a hang-up. Counting and caching depend only
            on `full`, which is already complete; closing the pipe is last and wrapped,
            because by then there is nobody left to tell.
          */
          if (full.trim() && ctx?.waitUntil) {
            const promptChars = sources.map((x) => x.text).join(' ') + raw;
            ctx.waitUntil(addSpend(env, estimateNeurons(model, promptChars, full)));
          }

          /*
            Cached only after a clean finish. A partial answer stored is worse than none,
            which is why `clean` gates it rather than merely checking that some text arrived.
          */
          if (clean && cacheKey && full.trim() && ctx?.waitUntil) {
            ctx.waitUntil(
              env.ANSWERS.put(
                cacheKey,
                JSON.stringify({ answer: full, sources: compact, model, at: new Date().toISOString() }),
                { expirationTtl: CACHE_TTL_SECONDS },
              ).catch(() => { /* a cache that cannot be written is not an outage */ }),
            );
          }

          try {
            await writer.close();
          } catch {
            /* The reader hung up. Nothing to report and nobody to report it to. */
          }
        }
      })();

      return new Response(out.readable, {
        headers: {
          ...SECURITY_HEADERS,
          'content-type': 'text/plain; charset=utf-8',
          'cache-control': 'no-store',
          'x-sources': encodeURIComponent(JSON.stringify(compact)),
        },
      });
    }

    /*
      One agent run is five model calls, so starting it on a nearly-spent day burns what
      is left and still fails partway. Declining up front costs nothing and says why.
    */
    {
      const usedNow = await readSpend(env);
      const leftNow = usedNow === null ? null : DAILY_FREE_NEURONS - usedNow;
      if (leftNow !== null && leftNow < AGENT_MIN_NEURONS) {
        return json({
          error: "An agent run makes five model calls, and the estimated free allowance left today is too small to finish one. It resets at 00:00 UTC.",
          reason: "quota-guard",
          estimatedRemaining: leftNow,
          resetsAt: nextResetISO(),
        }, 503);
      }
    }

    /*
      The agent. Rate limited harder than /ask, because one run is several model calls.

      A single agent question can cost five generations plus four searches, so the ordinary
      per-minute allowance would let a handful of visitors drain the day. Anonymous callers
      get one run per window; the operator is exempt, as elsewhere.
    */
    if (url.pathname === '/agent') {
      const raw = url.searchParams.get('q') ?? '';
      if (!raw.trim()) return json({ error: 'missing q' }, 400);
      if (raw.length > MAX_QUESTION_CHARS) return json({ error: 'question too long' }, 413);

      if (!isOperator(request, env)) {
        // Deliberately harsh: five model calls per run against a shared daily allowance.
        for (let i = 0; i < 6; i += 1) {
          if (rateLimited(`agent:${ip}`)) return json({ error: 'agent runs are rate limited; try /ask' }, 429);
        }
      }

      const result = await runAgent(env, raw.trim());
      return json({ question: raw.trim(), limits: AGENT_LIMITS, ...result });
    }

    return new Response('Not found', { status: 404, headers: SECURITY_HEADERS });
  },
};

export default {
  async fetch(request, env, ctx) {
    try {
      return await routes.fetch(request, env, ctx);
    } catch (err) {
      /*
        503 with an explanation, not 500 with a shrug. The allowance resets daily, so this
        is a "come back later", and Retry-After says when in a form a machine can read.
      */
      if (isQuotaError(err)) {
        console.warn(`quota exhausted: ${err?.message ?? err}`);
        return json({
          error: "The daily free AI allowance for this demo is used up. It resets at 00:00 UTC — the retrieval and evaluation numbers on this page were measured earlier and still stand.",
          reason: 'quota',
        }, 503);
      }
      /*
        Anything else is a real fault. The visitor gets nothing specific — an internal
        message can leak structure — but the full stack goes to the log where it is useful.
      */
      console.error('unhandled', err?.stack ?? String(err));
      return json({ error: 'Something failed inside the worker. It has been logged.' }, 500);
    }
  },
};
