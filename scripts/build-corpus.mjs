/**
 * scripts/build-corpus.mjs
 *
 * WHAT: Turns corpus/raw/*.html into clean, retrievable text in corpus/clean/*.md.
 * WHY:  Retrieval can only be as good as what gets embedded. This file is where most of
 *       the eventual answer quality is decided — before a single vector exists.
 * WHEN: After fetch-corpus.mjs, and whenever the extraction rules change.
 *
 * THE TABLE PROBLEM, WHICH IS THE WHOLE PROBLEM HERE
 * ──────────────────────────────────────────────────
 * This corpus is provider pricing and rate limits, and that information lives almost
 * entirely in tables: 86 tables and 506 rows on the Gemini pricing page alone.
 *
 * A tag-stripping extractor destroys exactly the thing being asked about. Given
 *
 *     <tr><td>gemini-2.5-flash</td><td>$0.30</td><td>$2.50</td></tr>
 *
 * it emits "gemini-2.5-flash $0.30 $2.50", and once that is chunked and embedded, nothing
 * records which number was input and which was output — or that $0.30 belongs to Flash
 * rather than to the row above. Every pricing question then fails, and it fails
 * *plausibly*, which is worse: the model will confidently pair the wrong number with the
 * right model.
 *
 * So rows are denormalised into self-describing lines that carry their headers:
 *
 *     Model: gemini-2.5-flash | Input (per 1M tokens): $0.30 | Output (per 1M tokens): $2.50
 *
 * The header text is repeated on every row, which is redundant for a human reader and
 * exactly right for retrieval: a chunk boundary can now fall anywhere without orphaning a
 * row from the meaning of its columns, and the embedded text contains the words a question
 * will actually use ("input price for gemini flash").
 *
 * KNOWN LIMITS — stated because they will show up in the stage 02 eval
 * ────────────────────────────────────────────────────────────────────
 *   - Regex parsing, no DOM. These seven pages are well-formed enough for it; a nested
 *     table or a <td> containing markup with angle brackets would confuse it. A real
 *     parser is the right call at a larger corpus size, and the eval is what should
 *     trigger that decision rather than a hunch.
 *   - Cells spanning columns (colspan) are not modelled and will misalign a row.
 *   - Tables with no <th> fall back to positional labels (Column 1, Column 2), which
 *     retrieves worse. The count of these is reported so it is a known quantity.
 *
 * LAYER: Corpus tooling (manual, local only).
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rawDir = join(root, 'corpus', 'raw');
const outDir = join(root, 'corpus', 'clean');

/** Decode the handful of entities these pages actually use. */
function decode(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&[a-z]+;/gi, ' ');
}

/** Strip tags from a fragment and normalise whitespace to a single line. */
function text(fragment) {
  return decode(fragment.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/**
 * Convert one <table> into denormalised, self-describing rows.
 * Returns null when the table holds nothing useful, so empty layout tables are dropped.
 */
function tableToRows(tableHtml, section) {
  const rows = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => m[1]);
  if (!rows.length) return null;

  const cellsOf = (row) =>
    [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => text(m[1]));

  // Headers: the first row containing <th>, else the first row if it looks like labels.
  const headerRow = rows.find((r) => /<th[\s>]/i.test(r));
  let headers = headerRow ? cellsOf(headerRow) : [];
  let headerless = false;
  if (!headers.length) {
    headerless = true;
    headers = cellsOf(rows[0]).map((_, i) => `Column ${i + 1}`);
  }

  const bodyRows = rows.filter((r) => r !== headerRow);
  const lines = [];
  for (const row of bodyRows) {
    const cells = cellsOf(row);
    if (!cells.length || cells.every((c) => !c)) continue;
    const pairs = cells
      .map((c, i) => {
        if (!c) return null;
        const h = headers[i];
        /*
          An empty header cell is normal, not a defect: the top-left corner of a table
          whose first column holds row labels is usually blank. Emitting ": Input price"
          for it looks broken and embeds a stray colon, so the label stands alone.
        */
        return h ? `${h}: ${c}` : c;
      })
      .filter(Boolean);
    if (!pairs.length) continue;

    /*
      The heading is prepended to every row, and this is the fix that matters.

      Gemini's pricing page uses one table per model with the model name in a heading
      ABOVE the table, so the row itself never contains the thing the question is about.
      "Input price: $0.75" is useless — $0.75 for what? Once chunked, the row can be
      separated from its heading entirely, and even inside the same chunk the association
      is far weaker than having the words in the same line.

      Carrying the section into the row makes it answerable on its own:
        Gemini 2.5 Pro > Input price | Paid Tier, per 1M tokens in USD: $0.75
    */
    lines.push(section ? `${section} > ${pairs.join(' | ')}` : pairs.join(' | '));
  }
  return lines.length ? { lines, headerless } : null;
}

/** Extract headings, paragraphs, list items and tables, in document order. */
function extract(html) {
  // Remove everything that is chrome or code-noise rather than content.
  let doc = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  const out = [];
  let headerlessTables = 0;
  let tableCount = 0;
  /*
    A heading STACK, not the nearest heading.

    The first attempt kept only the closest preceding heading and produced

        Standard > Input price | Paid Tier, per 1M tokens in USD: $0.75

    which is still unanswerable: "Standard" is the tier, and the model name — the thing
    the question is actually about — sits in an h2 further up the page. Keeping one
    heading captures the wrong one whenever a page nests, which pricing pages always do
    (model, then tier, then row).

    So headings are held per level and deeper levels are dropped when a shallower one
    arrives, giving the full path:

        Gemini 2.5 Pro > Standard > Input price | Paid Tier, per 1M tokens in USD: $0.75
  */
  const headings = [];
  const sectionPath = () => headings.filter(Boolean).join(' > ');

  /*
    One pass in document order.

    Matching each block type separately and concatenating would scramble the order and
    detach every table from the heading that explains it — which for a pricing page is
    most of the meaning ("Paid tier" versus "Free tier" is a heading, not a column).
  */
  const block = /<(h[1-6]|p|li|table)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = block.exec(doc)) !== null) {
    const tag = m[1].toLowerCase();
    const inner = m[2];

    if (tag === 'table') {
      tableCount += 1;
      const res = tableToRows(m[0], sectionPath());
      if (res) {
        if (res.headerless) headerlessTables += 1;
        out.push(...res.lines);
        out.push('');
      }
      continue;
    }

    const t = text(inner);
    if (!t || t.length < 2) continue;

    if (tag.startsWith('h')) {
      const level = +tag[1];
      headings[level] = t;
      // Anything deeper than this heading is now out of scope.
      headings.length = level + 1;
      out.push('', `${'#'.repeat(level)} ${t}`, '');
    }
    else if (tag === 'li') out.push(`- ${t}`);
    else out.push(t);
  }

  return { body: out.join('\n').replace(/\n{3,}/g, '\n\n').trim(), tableCount, headerlessTables };
}

mkdirSync(outDir, { recursive: true });

const files = readdirSync(rawDir).filter((f) => f.endsWith('.html'));
let totalHeaderless = 0;

for (const file of files) {
  const id = file.replace(/\.html$/, '');
  const html = readFileSync(join(rawDir, file), 'utf8');
  const meta = JSON.parse(readFileSync(join(rawDir, `${id}.meta.json`), 'utf8'));
  const { body, tableCount, headerlessTables } = extract(html);
  totalHeaderless += headerlessTables;

  /*
    Frontmatter travels with the text so a citation can name its source and its date.
    An answer that cannot say where it came from is not much better than a guess, and the
    snapshot date is the honest caveat this corpus owes the reader.
  */
  const doc = [
    '---',
    `id: ${meta.id}`,
    `url: ${meta.url}`,
    `fetched_at: ${meta.fetchedAt}`,
    '---',
    '',
    body,
    '',
  ].join('\n');

  writeFileSync(join(outDir, `${id}.md`), doc, 'utf8');

  const kb = (doc.length / 1024).toFixed(0);
  const flag = headerlessTables ? `  ${headerlessTables} headerless` : '';
  console.log(`  ${id.padEnd(32)} ${String(kb).padStart(4)} KB  ${tableCount} tables${flag}`);
}

console.log(`\n  ${files.length} documents written to corpus/clean`);
if (totalHeaderless) {
  console.log(`  ${totalHeaderless} tables had no <th> and use positional labels — these retrieve`);
  console.log('  worse, and are the first place to look if a pricing question fails the eval.');
}
