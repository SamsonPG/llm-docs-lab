/**
 * src/worker.mjs
 *
 * WHAT: The HTTP surface — health, dimension probe, authenticated ingest, and search.
 * WHY:  Embeddings run through a Workers AI binding rather than an API key, so this public
 *       repo has no secret to leak and nothing to rotate.
 * WHEN: `wrangler dev --remote` locally, `wrangler deploy` for the live URL.
 *
 * LAYER: Delivery (HTTP).
 */

/** The embedding model for the whole project. Changing it invalidates the index. */
export const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';

/**
 * Embed a batch of strings.
 *
 * bge-base takes an array and returns vectors in the same order. Batching matters for
 * quota: the free allowance is 10,000 neurons a day, and one request per chunk would spend
 * more of it on request overhead than on the work.
 */
async function embed(env, texts) {
  const res = await env.AI.run(EMBEDDING_MODEL, { text: texts });
  return res.data;
}

/** Compared without early exit, so a wrong token cannot be found one character at a time. */
function tokenMatches(given, expected) {
  if (typeof given !== 'string' || typeof expected !== 'string') return false;
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i += 1) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return Response.json({ ok: true, model: EMBEDDING_MODEL });
    }

    /*
      Reports the true dimensionality of the embedding model.
      A Vectorize index cannot change dimensions after creation, so this was measured once
      (768) rather than taken from documentation, and the index created to match.
    */
    if (url.pathname === '/probe') {
      const [vector] = await embed(env, [url.searchParams.get('q') ?? 'dimension probe']);
      return Response.json({ model: EMBEDDING_MODEL, dimensions: vector.length });
    }

    /*
      INGEST IS AUTHENTICATED, and that is not optional.

      An unauthenticated ingest endpoint on a public URL is a public index-poisoning API:
      anyone could upsert a vector claiming a model costs $0.01, and every later answer
      would repeat it with a citation attached. It would also be a strange thing to ship in
      a project whose stage 05 measures resistance to injected content.

      The token is a Workers secret, compared without early exit. Failure returns 401 with
      no detail — "wrong token" and "no token" look identical from outside.
    */
    if (url.pathname === '/ingest') {
      if (request.method !== 'POST') return new Response('POST only', { status: 405 });

      const given = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
      if (!tokenMatches(given, env.INGEST_TOKEN ?? '')) {
        return new Response('unauthorized', { status: 401 });
      }

      const chunks = await request.json();
      if (!Array.isArray(chunks) || !chunks.length) {
        return Response.json({ error: 'expected a non-empty array of chunks' }, { status: 400 });
      }

      const vectors = (await embed(env, chunks.map((c) => c.text))).map((values, i) => ({
        id: chunks[i].id,
        values,
        /*
          The chunk text is stored as metadata so a result can be read and cited without a
          second round trip to the source. Vectorize caps metadata per vector; these chunks
          average ~530 characters, well inside it.
        */
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
      return Response.json({ upserted: vectors.length, mutationId: result.mutationId });
    }

    if (url.pathname === '/search') {
      const q = url.searchParams.get('q');
      if (!q) return Response.json({ error: 'missing q' }, { status: 400 });
      const topK = Math.min(Number(url.searchParams.get('k') ?? 5), 20);

      const [vector] = await embed(env, [q]);
      const found = await env.VECTORIZE.query(vector, { topK, returnMetadata: 'all' });

      return Response.json({
        query: q,
        matches: found.matches.map((m) => ({
          score: m.score,
          text: m.metadata?.text,
          section: m.metadata?.section,
          source: m.metadata?.url,
          fetchedAt: m.metadata?.fetchedAt,
        })),
      });
    }

    return new Response('llm-docs-lab', { status: 404 });
  },
};
