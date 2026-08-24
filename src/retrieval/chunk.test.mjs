/**
 * src/retrieval/chunk.test.mjs
 *
 * WHAT: Tests the invariants chunking must never break, plus size behaviour.
 * WHY:  A broken chunker fails silently. Nothing throws, retrieval simply gets worse, and
 *       by the time the eval says so the cause is days behind you.
 * WHEN: node --test src/retrieval/chunk.test.mjs
 *
 * Every test here was watched failing before being trusted — a check nobody has seen go
 * red is not evidence.
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

/*
  How a block's text appears once it is inside a chunk.

  The chunker strips the section prefix from each line because the chunk header states it
  once. Keeping it on every line duplicated a large share of every chunk with boilerplate
  near identical across providers, which is what made a Cloudflare question return Anthropic
  rows. The invariants below still hold; they are just checked against the in-chunk form.
*/
function inChunkForm(block) {
  const prefix = block.section ? `${block.section} > ` : '';
  return prefix && block.text.startsWith(prefix) ? block.text.slice(prefix.length) : block.text;
}

/** Chunk body with the "Title — Section" header line removed. */
function bodyOf(chunk) {
  return chunk.text.split('\n').slice(1);
}

test('the corpus is actually present, so nothing below passes vacuously', () => {
  assert.ok(docs.length >= 7, `expected 7+ documents, found ${docs.length}`);
  assert.ok(allChunks.length > 50, `expected many chunks, got ${allChunks.length}`);
});

test('every chunk names its source document', () => {
  /*
    The failure that made day 2's retrieval useless: chunks carried no provider name, so
    "Cloudflare Workers AI" matched Anthropic rows as readily as Cloudflare ones. The
    provider sat in Vectorize metadata, which is never embedded and so cannot be searched.
  */
  for (const doc of docs) {
    const title = doc.title ?? doc.id;
    for (const chunk of chunkDocument(doc)) {
      assert.ok(chunk.text.startsWith(title), `chunk ${chunk.id} does not lead with its source title`);
    }
  }
});

test('a table row is never split across chunks', () => {
  /*
    Every row must appear whole inside a chunk whose header carries that row's own section.
    A half row is not a smaller fact, it is a wrong one — the number ends up attached to a
    different model.
  */
  let checked = 0;
  for (const doc of docs) {
    const chunks = chunkDocument(doc);
    for (const row of doc.blocks.filter((b) => b.type === 'row')) {
      const want = inChunkForm(row);
      const found = chunks.some((c) => c.section === row.section && c.text.includes(want));
      assert.ok(found, `row split or misfiled: ${want.slice(0, 90)}`);
      checked += 1;
    }
  }
  assert.ok(checked > 300, `expected hundreds of rows, checked ${checked}`);
});

test('a chunk never spans two sections', () => {
  /*
    A chunk about two things retrieves for queries about either and answers neither well.

    Asserted as "every line belongs to a block in THIS chunk's section". An earlier version
    looked lines up by text across the whole document and counted distinct owners; it failed
    on a correct chunk because two lines appear verbatim under both "Browser use tool" and
    "Computer use tool". The test was wrong, not the chunker.
  */
  for (const doc of docs) {
    for (const chunk of chunkDocument(doc)) {
      for (const line of bodyOf(chunk).filter(Boolean)) {
        const bare = line.startsWith('- ') ? line.slice(2) : line;
        const belongs = doc.blocks.some((b) => b.section === chunk.section && inChunkForm(b) === bare);
        assert.ok(
          belongs,
          `chunk ${chunk.id} (section "${chunk.section}") holds a line from elsewhere: ${bare.slice(0, 70)}`,
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

test('rows carry no overlap', () => {
  /*
    Overlap earns its cost in prose, where a sentence depends on the one before it, and
    costs without earning on a row that already restates its model, tier and columns.
  */
  const synth = {
    id: 't', title: 'T', url: 'u', fetchedAt: 'now',
    blocks: Array.from({ length: 40 }, (_, i) => ({
      type: 'row',
      section: 'S',
      text: `S > Model ${i} | Input: $${i}.00 | Output: $${i * 2}.00 | Notes: ${'x'.repeat(60)}`,
    })),
  };
  const rowChunks = chunkDocument(synth);
  assert.ok(rowChunks.length > 1, 'test needs multiple chunks to check overlap');

  const seen = new Set();
  for (const c of rowChunks) {
    for (const line of bodyOf(c)) {
      assert.ok(!seen.has(line), `row duplicated across chunks (overlap leaked in): ${line.slice(0, 50)}`);
      seen.add(line);
    }
  }
});

test('prose does keep an overlap block', () => {
  const synth = {
    id: 't', title: 'T', url: 'u', fetchedAt: 'now',
    blocks: Array.from({ length: 30 }, (_, i) => ({
      type: 'prose', section: 'S', text: `Sentence number ${i}. ${'y'.repeat(120)}`,
    })),
  };
  const chunks = chunkDocument(synth);
  assert.ok(chunks.length > 1, 'test needs multiple chunks');
  const lines = chunks.flatMap(bodyOf);
  assert.ok(lines.length > new Set(lines).size, 'prose chunks should share an overlapping block');
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
    against a 480 ceiling. That gap is why this test exists — mutation-testing showed that
    disabling the keep-rows-whole branch broke nothing, because the branch never runs on
    this corpus. An untested path is one provider redesigning a table away from a silent bug.

    Emitting an over-long row whole is deliberate. The embedding model truncates it, so the
    tail is not searchable — but the alternative is a half row that retrieves confidently
    and answers with a number belonging to something else. A lost tail is recoverable; a
    wrong price is not. `kind` records it so the eval can count them.
  */
  const long = `Pricing > Huge > Row | ${'Column: value | '.repeat(200)}end`;
  const doc = {
    id: 't', title: 'T', url: 'u', fetchedAt: 'now',
    blocks: [{ type: 'row', section: 'Pricing > Huge', text: long }],
  };
  const chunks = chunkDocument(doc);

  assert.equal(chunks.length, 1, 'the row should produce exactly one chunk, not several');
  assert.ok(
    chunks[0].text.includes(long.slice('Pricing > Huge > '.length)),
    'the row was split — it must be emitted whole',
  );
  assert.equal(chunks[0].kind, 'row-oversized', 'an oversized row must be flagged so the eval can count it');
});
