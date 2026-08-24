/**
 * src/retrieval/chunk.mjs
 *
 * WHAT: Turns the typed blocks from corpus/clean/*.blocks.json into embeddable chunks.
 * WHY:  Chunking decides what retrieval can possibly find. Everything downstream — the
 *       eval score, the attack rate, the agent's answers — is capped by this file.
 * WHEN: Before embedding. Pure and dependency-free, so it is testable without any API.
 *
 * WHY NOT FIXED-SIZE CHUNKS
 * ─────────────────────────
 * The standard recipe is "split every N tokens with M tokens of overlap". It is a
 * reasonable default for prose, and it is wrong for this corpus.
 *
 * 719 of the 1,876 blocks here are denormalised table rows, each already carrying its full
 * heading path and every column label:
 *
 *     Gemini Developer API pricing > Gemini 3.7 Flash > Standard > Input price
 *       | Free Tier: Free of charge | Paid Tier, per 1M tokens in USD: $0.75
 *
 * A fixed-size splitter cuts through the middle of lines like that one. Half a row is not
 * a smaller fact, it is a wrong one — a chunk ending at "Paid Tier, per 1M tokens in USD:"
 * retrieves for a pricing question and answers it with nothing, or worse, with the number
 * from the following row. So the row is atomic here: never split, always whole.
 *
 * WHY NO OVERLAP ON ROWS
 * ──────────────────────
 * Overlap exists to stop a fact being destroyed by an unlucky boundary. That is a real
 * problem for prose, where a sentence's meaning depends on the one before it. It is not a
 * problem for a row that already restates its model, tier and column names — the row is
 * self-contained by construction, which was the whole point of building the corpus that
 * way. Overlapping them would duplicate embeddings, inflate the index, spend quota, and buy
 * nothing. Prose keeps a one-block overlap, where it still earns its cost.
 *
 * Two rules follow from the same idea, and both are enforced by tests:
 *   - a chunk never splits a row
 *   - a chunk never spans two different sections, so a retrieved chunk is about one thing
 *
 * SIZE
 * ────
 * Target 350 tokens, hard ceiling 480. Cloudflare's bge-base-en-v1.5 embeds at most 512
 * tokens and silently truncates beyond that — silently being the problem, since the tail of
 * an over-long chunk would simply never be searchable and nothing would say so. The ceiling
 * leaves room for the section prefix.
 *
 * Tokens are estimated at 4 characters each rather than tokenised properly. That is an
 * approximation, deliberately conservative, and it is why the ceiling sits at 480 rather
 * than 512. If the eval later shows truncation, a real tokeniser is the fix.
 *
 * LAYER: Retrieval (pure; no I/O, no network).
 */

/** Rough token estimate. ~4 chars/token for English; conservative on purpose. */
export function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

export const TARGET_TOKENS = 350;
export const MAX_TOKENS = 480;

/**
 * Split a long prose block on sentence boundaries.
 * Only used when a single paragraph exceeds the ceiling on its own.
 */
function splitProse(text, maxTokens) {
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [text];
  const parts = [];
  let buf = '';
  for (const s of sentences) {
    if (buf && estimateTokens(buf + s) > maxTokens) {
      parts.push(buf.trim());
      buf = '';
    }
    buf += s;
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
}

/**
 * Group typed blocks into chunks.
 *
 * @param {{id:string,url:string,fetchedAt:string,blocks:Array}} doc
 * @returns {Array<{id:string,docId:string,url:string,fetchedAt:string,section:string,text:string,tokens:number,kind:string}>}
 */
export function chunkDocument(doc, { target = TARGET_TOKENS, max = MAX_TOKENS } = {}) {
  const chunks = [];
  let n = 0;

  const push = (section, parts, kind) => {
    if (!parts.length) return;
    // The section is stated once at the top of the chunk, not per line.
    const body = parts.join('\n');
    const text = section ? `${section}\n${body}` : body;
    chunks.push({
      id: `${doc.id}#${n++}`,
      docId: doc.id,
      url: doc.url,
      fetchedAt: doc.fetchedAt,
      section,
      text,
      tokens: estimateTokens(text),
      kind,
    });
  };

  /*
    Headings are not chunked on their own.

    A chunk containing only "Gemini 3.7 Flash" embeds well against the query "gemini 3.7
    flash" and then contributes nothing to the answer — it crowds out a row that carries an
    actual number. Headings already travel inside every row and every prose chunk as the
    section prefix, which is where they are useful.
  */
  const content = doc.blocks.filter((b) => b.type !== 'heading');

  let buf = [];
  let bufSection = null;
  let bufKind = null;

  for (const block of content) {
    const kind = block.type === 'row' ? 'row' : 'prose';
    const line = block.type === 'list' ? `- ${block.text}` : block.text;
    const sectionChanged = bufSection !== null && block.section !== bufSection;
    const kindChanged = bufKind !== null && kind !== bufKind;

    /*
      Flush on a section or kind change, before considering size.

      A chunk spanning two sections is a chunk about two things, and it retrieves for
      queries about either while answering neither well. Mixing rows and prose has the same
      effect at smaller scale.
    */
    if (sectionChanged || kindChanged) {
      push(bufSection, buf, bufKind);
      buf = [];
    }

    // A single block over the ceiling: rows stay whole, prose is split on sentences.
    if (estimateTokens(line) > max) {
      push(block.section, buf, kind);
      buf = [];
      if (kind === 'row') {
        // Deliberately emitted oversized rather than cut in half. Reported by the caller.
        push(block.section, [line], 'row-oversized');
      } else {
        for (const part of splitProse(line, max)) push(block.section, [part], 'prose');
      }
      bufSection = block.section;
      bufKind = kind;
      continue;
    }

    const wouldBe = estimateTokens([...buf, line].join('\n'));
    if (buf.length && wouldBe > target) {
      push(bufSection, buf, bufKind);
      /*
        One block of overlap for prose, none for rows.

        Prose loses meaning at a boundary; a self-describing row does not. See the header.
      */
      buf = bufKind === 'prose' ? [buf[buf.length - 1]] : [];
    }

    buf.push(line);
    bufSection = block.section;
    bufKind = kind;
  }

  push(bufSection, buf, bufKind);
  return chunks;
}
