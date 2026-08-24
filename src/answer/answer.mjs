/**
 * src/answer/answer.mjs
 *
 * WHAT: Retrieve, then generate a grounded answer with citations.
 * WHY:  This is section 3 of the architecture, and the module the eval and the security
 *       tests both import — they measure this exact code path, not a copy of it.
 * WHEN: Called by the /ask endpoint, by eval/, and by security/.
 *
 * LAYER: Answer.
 */
import { buildMessages } from './prompt.mjs';

/** The default generation model. The eval swaps this to compare. */
export const DEFAULT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

export const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';

/**
 * Pull the assistant's text out of a Workers AI reply.
 *
 * Workers AI returns an OpenAI-shaped object — choices[0].message.content — not the
 * `response` string the older docs and most examples show. Reading `.response` yields
 * undefined, and `String(undefined)` is the string "undefined", so the failure does not
 * throw: the agent loop simply saw "[object Object]", failed to parse it five times, and
 * hit its step ceiling. It looked exactly like a model that cannot follow instructions,
 * when the model had produced correct JSON every time.
 *
 * Both shapes are accepted, because a platform that changed this once can change it again.
 */
export function replyText(res) {
  return res?.choices?.[0]?.message?.content ?? res?.response ?? '';
}

/**
 * Retrieve the chunks most similar to a question.
 *
 * Exported separately because the agent calls it as a tool and the eval scores retrieval on
 * its own, before generation is involved. Two different questions — "did it find the right
 * text" and "did it write a good answer" — need to be measurable independently, or a bad
 * score cannot be attributed to either.
 */
export async function retrieve(env, question, { topK = 6 } = {}) {
  const { data } = await env.AI.run(EMBEDDING_MODEL, { text: [question] });
  const found = await env.VECTORIZE.query(data[0], { topK, returnMetadata: 'all' });

  return found.matches.map((m) => ({
    id: m.id,
    score: m.score,
    text: m.metadata?.text ?? '',
    section: m.metadata?.section ?? '',
    source: m.metadata?.url ?? '',
    docId: m.metadata?.docId ?? '',
    fetchedAt: m.metadata?.fetchedAt ?? '',
  }));
}

/**
 * Answer a question from the corpus.
 *
 * @returns {{answer:string, sources:Array, model:string, usage:object|null}}
 */
export async function answerQuestion(env, question, { model = DEFAULT_MODEL, topK = 6 } = {}) {
  const sources = await retrieve(env, question, { topK });

  /*
    An empty index is reported, not answered around.

    If retrieval returns nothing the model would happily answer from its own knowledge of
    provider pricing, which is exactly the failure this project exists to avoid: a confident
    figure with no source, indistinguishable from a grounded one.
  */
  if (!sources.length) {
    return {
      answer: 'No sources were retrieved for that question, so there is nothing to answer from.',
      sources: [],
      model,
      usage: null,
      grounded: false,
    };
  }

  const messages = buildMessages(question, sources);
  const res = await env.AI.run(model, {
    messages,
    /*
      Low temperature, and a cap.

      This is a factual lookup: creativity is a defect. The cap bounds cost per request —
      the free allowance is a daily budget shared with embeddings, and an unbounded
      generation on a public endpoint is a way to burn it in an afternoon.
    */
    temperature: 0.1,
    max_tokens: 600,
  });

  return {
    answer: String(replyText(res)).trim(),
    sources,
    model,
    usage: res.usage ?? null,
    grounded: true,
  };
}

/**
 * Streaming variant, for the UI.
 *
 * Streaming matters here beyond feel: a 70B model takes seconds to a first token, and a
 * page that shows nothing for that long reads as broken.
 */
export async function answerQuestionStream(env, question, { model = DEFAULT_MODEL, topK = 6 } = {}) {
  const sources = await retrieve(env, question, { topK });
  if (!sources.length) return { stream: null, sources: [] };

  const stream = await env.AI.run(model, {
    messages: buildMessages(question, sources),
    temperature: 0.1,
    max_tokens: 600,
    stream: true,
  });

  return { stream, sources };
}
