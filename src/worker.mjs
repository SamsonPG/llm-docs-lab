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

/** Compared without early exit, so a wrong token cannot be found one character at a time. */
function tokenMatches(given, expected) {
  if (typeof given !== 'string' || typeof expected !== 'string') return false;
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i += 1) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

const SECURITY_HEADERS = {
  /*
    The page inlines its own CSS and script and loads nothing from anywhere else, so the
    policy can be strict rather than permissive. 'unsafe-inline' is required because the
    style and script are inline; a nonce would be better and is noted in the README as the
    honest next step rather than claimed as done.
  */
  'content-security-policy':
    "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; "
    + "connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
};

const json = (data, status = 200) =>
  Response.json(data, { status, headers: { ...SECURITY_HEADERS, 'cache-control': 'no-store' } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';

    if (url.pathname === '/' || url.pathname === '/index.html') {
      return new Response(PAGE, {
        headers: { ...SECURITY_HEADERS, 'content-type': 'text/html; charset=utf-8' },
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
                if (token) await writer.write(enc.encode(token));
              } catch {
                /* A partial JSON frame; the next chunk completes it. */
              }
            }
          }
        } catch (err) {
          await writer.write(enc.encode(`\n\n[stream interrupted: ${err.message}]`));
        } finally {
          await writer.close();
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

    return new Response('Not found', { status: 404, headers: SECURITY_HEADERS });
  },
};
