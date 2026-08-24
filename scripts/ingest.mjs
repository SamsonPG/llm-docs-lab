/**
 * scripts/ingest.mjs
 *
 * WHAT: Chunks the corpus and pushes it through the Worker's /ingest endpoint into Vectorize.
 * WHY:  Embedding happens inside the Worker, through the AI binding, so no Cloudflare API
 *       key exists on this machine or in this public repo. This script only carries text
 *       and the ingest token, which is local and gitignored.
 * WHEN: After `npm run corpus:build`, and whenever chunking changes.
 *
 * RUN:  node scripts/ingest.mjs [--url https://...] [--dry]
 *
 * LAYER: Corpus tooling (manual, local only).
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chunkDocument } from '../src/retrieval/chunk.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cleanDir = join(root, 'corpus', 'clean');

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const urlArg = args.indexOf('--url');
const base = urlArg !== -1 ? args[urlArg + 1] : 'https://llm-docs-lab.samsonpg077.workers.dev';

/*
  Batches of 40.

  One request per chunk would spend most of the free 10,000-neuron daily allowance on
  request overhead rather than on embedding, and 370 separate round trips is slow enough to
  discourage re-running the ingest — which is exactly the thing that should stay cheap while
  chunking is still being tuned.
*/
const BATCH = 40;

const docs = readdirSync(cleanDir)
  .filter((f) => f.endsWith('.blocks.json'))
  .map((f) => JSON.parse(readFileSync(join(cleanDir, f), 'utf8')));

const chunks = docs.flatMap((d) => chunkDocument(d));

const oversized = chunks.filter((c) => c.kind === 'row-oversized');
console.log(`  ${docs.length} documents -> ${chunks.length} chunks`);
console.log(`  avg ${Math.round(chunks.reduce((a, c) => a + c.tokens, 0) / chunks.length)} tokens`
  + `, largest ${Math.max(...chunks.map((c) => c.tokens))}`);
if (oversized.length) {
  console.log(`  ${oversized.length} oversized rows kept whole — their tails will be truncated`);
  console.log('    by the embedding model and are not searchable. Counted here so it is known.');
}

if (dry) {
  console.log('\n  --dry: nothing sent.');
  process.exit(0);
}

const tokenPath = join(root, '.ingest-token');
if (!existsSync(tokenPath)) {
  console.error('\n  No .ingest-token found. Recreate it and re-upload:');
  console.error('    node -e "process.stdout.write(require(\'crypto\').randomBytes(32).toString(\'hex\'))" > .ingest-token');
  console.error('    npx wrangler secret put INGEST_TOKEN < .ingest-token');
  process.exit(1);
}
const token = readFileSync(tokenPath, 'utf8').trim();

let sent = 0;
let failed = 0;

for (let i = 0; i < chunks.length; i += BATCH) {
  const batch = chunks.slice(i, i + BATCH);
  const res = await fetch(`${base}/ingest`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(batch),
  });

  if (!res.ok) {
    failed += batch.length;
    console.error(`  FAIL  batch ${i / BATCH + 1}: HTTP ${res.status} ${(await res.text()).slice(0, 120)}`);
    continue;
  }
  const body = await res.json();
  sent += body.upserted;
  console.log(`  ok    batch ${String(i / BATCH + 1).padStart(2)}  ${String(body.upserted).padStart(3)} vectors`);
}

console.log(`\n  ${sent}/${chunks.length} vectors upserted${failed ? `, ${failed} failed` : ''}`);

/*
  Vectorize applies upserts asynchronously. A query immediately after this returns fewer
  results than expected, which reads exactly like broken retrieval — so say so here rather
  than let it be debugged as a bug.
*/
console.log('  Upserts are applied asynchronously; allow a few seconds before querying.');

process.exit(failed ? 1 : 0);
