/**
 * src/retrieval/chunk.test.mjs
 *
 * WHAT: Tests the two invariants chunking must never break, plus size behaviour.
 * WHY:  A broken chunker fails silently. Nothing throws, retrieval simply gets worse, and
 *       by the time the eval says so in stage 04 the cause is three days behind you.
 * WHEN: node --test src/retrieval/chunk.test.mjs
 *
 * Each test here was watched failing before being trusted — a check nobody has seen go red
 * is not evidence.
 *
 * LAYER: Test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { chunkDocument, estimateTokens, MAX_TOKENS } from './chunk.mjs';

const CLEAN = new URL('../../corpus/clean/', import.meta.url);

function loadDocs() {
  return readdirSync(CLEAN)
    .filter((f) => f.endsWith('.blocks.json'))
    .map((f) => JSON.parse(readFileSync(new URL(f, CLEAN), 'utf8')));
}

const docs = loadDocs();
const allChunks = docs.flatMap((d) => chunkDocument(d));

test('the corpus is actually present, so nothing below passes vacuously', () => {
  assert.ok(docs.length >= 7, `expected 7+ documents, found ${docs.length}`);
  assert.ok(allChunks.length > 50, `expected many chunks, got ${allChunks.length}`);
});

test('a table row is never split across chunks', () => {
  /*
    Every row in the corpus must appear complete inside some chunk. A half row is not a
    smaller fact, it is a wrong one — the number can end up attached to the next model.
  */
  const rows = docs.flatMap((d) => d.blocks.filter((b) => b.type === 'row').map((b) => b.text));
  const haystack = allChunks.map((c) => c.text).join('\n');
  const missing = rows.filter((r) => !haystack.includes(r));
  assert.equal(missing.length, 0, `${missing.length} rows were split; first: ${missing[0]?.slice(0, 80)}`);
});

test('a chunk never spans two sections', () => {
  /*
    A chunk about two things retrieves for queries about either and answers neither well.

    Asserted as "every line belongs to a block in THIS chunk's section", not as "the lines
    resolve to one section".

    The first version looked each line up by text across the whole document and counted the
    distinct sections it found. It failed on anthropic-pricing#44, which is a correct
    chunk: two of its lines ("Additional token consumption:" and a screenshot bullet)
    appear verbatim under both "Browser use tool" and "Computer use tool", so a global text
    lookup reported two owners for a chunk that spans one. The test was wrong, not the
    chunker — and a duplicate-text lookup would have kept being wrong on any corpus with
    boilerplate.
  */
  for (const doc of docs) {
    for (const chunk of chunkDocument(doc)) {
      const body = chunk.section ? chunk.text.slice(chunk.section.length + 1) : chunk.text;
      for (const line of body.split('\n').filter(Boolean)) {
        const bare = line.startsWith('- ') ? line.slice(2) : line;
        const belongs = doc.blocks.some((b) => b.text === bare && b.section === chunk.section);
        assert.ok(
          belongs,
          `chunk ${chunk.id} (section "${chunk.section}") contains a line from elsewhere: ${bare.slice(0, 70)}`,
        );
      }
    }
  }
});

test('no chunk exceeds the embedding ceiling, except a row too long to split', () => {
  const over = allChunks.filter((c) => c.tokens > MAX_TOKENS);
  const notRows = over.filter((c) => c.kind !== 'row-oversized');
  assert.equal(notRows.length, 0, `${notRows.length} oversized non-row chunks; first ${notRows[0]?.id}`);
});

test('rows carry no overlap and prose does', () => {
  /*
    Overlap earns its cost in prose, where a sentence depends on the one before it, and
    costs without earning on a row that already restates its model, tier and columns.
  */
  const synth = {
    id: 't', url: 'u', fetchedAt: 'now',
    blocks: Array.from({ length: 40 }, (_, i) => ({
      type: 'row', section: 'S', text: `S > Model ${i} | Input: $${i}.00 | Output: $${i * 2}.00 | Notes: ${'x'.repeat(60)}`,
    })),
  };
  const rowChunks = chunkDocument(synth);
  assert.ok(rowChunks.length > 1, 'test needs multiple chunks to check overlap');
  const seen = new Set();
  for (const c of rowChunks) {
    for (const line of c.text.split('\n').slice(1)) {
      assert.ok(!seen.has(line), `row duplicated across chunks (overlap leaked in): ${line.slice(0, 50)}`);
      seen.add(line);
    }
  }
});

test('estimateTokens is conservative rather than optimistic', () => {
  // Under-estimating is the dangerous direction: it lets a chunk past the ceiling and the
  // embedding model truncates it silently.
  assert.equal(estimateTokens('abcd'), 1);
  assert.equal(estimateTokens('abcde'), 2);
});

test('an oversized row is emitted whole rather than cut', () => {
  /*
    Synthetic, because no real row comes close: the longest in the corpus is 119 tokens
    against a 480 ceiling. That gap is exactly why this test exists — mutation-testing the
    chunker showed that disabling the keep-rows-whole branch broke nothing, because the
    branch never runs on this corpus. An untested path is one provider redesigning a
    pricing table away from being a silent bug.

    Emitting an over-long row whole is deliberate. It will be truncated by the embedding
    model, so the tail is not searchable — but the alternative is a half row, which
    retrieves confidently and answers with a number belonging to something else. Losing the
    tail is recoverable; a wrong price is not. `kind` records it so the eval can count them.
  */
  const long = `Pricing > Huge > Row | ${'Column: value | '.repeat(200)}end`;
  const doc = { id: 't', url: 'u', fetchedAt: 'now', blocks: [{ type: 'row', section: 'Pricing > Huge', text: long }] };
  const chunks = chunkDocument(doc);

  assert.equal(chunks.length, 1, 'the row should produce exactly one chunk, not several');
  assert.ok(chunks[0].text.includes(long), 'the row was split — it must be emitted whole');
  assert.equal(chunks[0].kind, 'row-oversized', 'an oversized row must be flagged so the eval can count it');
});
