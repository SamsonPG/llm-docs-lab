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

/*
  Characters that must not reach the corpus.

  PRIVATE USE AREA (U+E000–U+F8FF and the two supplementary planes). Documentation sites
  render icon fonts by mapping glyphs into this range, so an anchor icon or a chevron
  arrives as a code point with no meaning outside that site's stylesheet. Anthropic's pages
  contributed 161 of them, and they surfaced in the UI as tofu boxes inside otherwise
  correct answers: "Pricing > ▯ Claude Managed Agents pricing". They also waste embedding
  tokens and can only hurt similarity.

  ZERO-WIDTH characters and the BOM. Invisible, so nothing looks wrong, and they silently
  break exact matching — a golden-set assertion can fail on a string that appears identical
  in every way a person can check.

  Emoji are deliberately NOT stripped: Gemini ships a model called Nano Banana and the
  corpus contains 52 bananas that are genuinely part of the content.
*/
/*
  Written as escapes, not literal characters.

  The first version pasted the actual code points into the class. They are invisible by
  definition, so the source showed an empty-looking range that no reviewer could verify
  and no diff could usefully display. Escapes are longer and can be read.
*/
const JUNK = new RegExp(
  '[\u{E000}-\u{F8FF}]'         // private use area - icon-font glyphs
  + '|[\u{F0000}-\u{FFFFD}]'    // supplementary private use area A
  + '|[\u{100000}-\u{10FFFD}]'  // supplementary private use area B
  + '|[\u200B-\u200D]'          // zero-width space, non-joiner, joiner
  + '|\uFEFF'                    // byte order mark
  + '|\u00AD',                   // soft hyphen
  'gu',
);

/** Strip tags from a fragment, drop meaningless glyphs, and normalise whitespace. */
function text(fragment) {
  return decode(fragment.replace(/<[^>]*>/g, ' '))
    .replace(JUNK, '')
    .replace(/\s+/g, ' ')
    .trim();
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

  let headerRow = rows.find((r) => /<th[\s>]/i.test(r));
  let headers = headerRow ? cellsOf(headerRow) : [];
  let headerless = false;

  /*
    A table with no <th> is not necessarily a table with no headers.

    Groq marks its rate-limit header row with <td>, so the first version fell back to
    positional labels and produced

        Column 1: groq/compound | Column 2: 30 | Column 3: 250 | Column 4: 70K

    Every number present, none of them answerable: "Column 3" does not tell a reader, or an
    embedding, that 250 is requests per day. Asking "Groq free tier requests per day"
    returned OpenRouter. The build had already warned that one table was headerless and
    would be the first suspect if a rate-limit question failed — it was.

    So with no <th>, the first row is promoted to headers when it looks like labels: more
    than one cell, each non-empty, short, and not a bare number or currency amount. A row of
    real data fails that test and the positional fallback still applies, still counted.
  */
  if (!headers.length) {
    const first = cellsOf(rows[0]);
    const looksLikeLabels =
      first.length > 1 &&
      first.every((c) => c && c.length <= 40 && !/^[$€£]?[\d,.]+\s*[kKmM%]?$/.test(c));

    if (looksLikeLabels) {
      headers = first;
      [headerRow] = rows;
    } else {
      headerless = true;
      headers = first.map((_, i) => `Column ${i + 1}`);
    }
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
  /*
    Typed blocks, emitted alongside the markdown.

    The chunker needs to know which lines are denormalised table rows, because those must
    never be split. It could infer that from the markdown by pattern-matching for " > " and
    " | " — but that means re-parsing my own output with a heuristic, and a heuristic that
    is wrong on one line in fifty puts a broken chunk into the index silently. The structure
    is known here, for free, so it is recorded here.
  */
  const blocks = [];
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
        for (const line of res.lines) {
          blocks.push({ type: 'row', section: sectionPath(), text: line });
        }
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
      blocks.push({ type: 'heading', level, section: sectionPath(), text: t });
    } else if (tag === 'li') {
      out.push(`- ${t}`);
      blocks.push({ type: 'list', section: sectionPath(), text: t });
    } else {
      out.push(t);
      blocks.push({ type: 'prose', section: sectionPath(), text: t });
    }
  }

  return { body: out.join('\n').replace(/\n{3,}/g, '\n\n').trim(), blocks, tableCount, headerlessTables };
}

mkdirSync(outDir, { recursive: true });

const files = readdirSync(rawDir).filter((f) => f.endsWith('.html'));
let totalHeaderless = 0;

for (const file of files) {
  const id = file.replace(/\.html$/, '');
  const html = readFileSync(join(rawDir, file), 'utf8');
  const meta = JSON.parse(readFileSync(join(rawDir, `${id}.meta.json`), 'utf8'));
  const { body, blocks, tableCount, headerlessTables } = extract(html);
  /*
    The page title names the provider, and without it a chunk is unattributable.
    Retrieval failed on day 2 because "Model: Claude Opus 4.5 | Base Input Tokens: $5"
    never says "Anthropic" anywhere, so a query naming a provider had nothing to match.
  */
  const title = text(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? meta.id).slice(0, 90);
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

  /*
    TWO OUTPUTS, FOR TWO DIFFERENT READERS
    ──────────────────────────────────────
    The .md file is for a person: open it and read the page as text, to check
    by eye that the extraction did not mangle anything.

    The .blocks.json file is for the machine. It keeps each piece separate and
    labelled — this is a heading, this is a table row — which is what the next
    step needs to decide where a chunk may be split. Flattening to prose would
    throw that structure away and it cannot be recovered afterwards.

    Both are written from the same extraction, so they cannot disagree.
  */
  writeFileSync(join(outDir, `${id}.md`), doc, 'utf8');
  writeFileSync(
    join(outDir, `${id}.blocks.json`),
    JSON.stringify({ id: meta.id, title, url: meta.url, fetchedAt: meta.fetchedAt, blocks }, null, 1),
    'utf8',
  );

  const kb = (doc.length / 1024).toFixed(0);
  const flag = headerlessTables ? `  ${headerlessTables} headerless` : '';
  console.log(`  ${id.padEnd(32)} ${String(kb).padStart(4)} KB  ${tableCount} tables${flag}`);
}

console.log(`\n  ${files.length} documents written to corpus/clean`);
if (totalHeaderless) {
  console.log(`  ${totalHeaderless} table(s) have no header row INSIDE the table, so columns fall back to`);
  console.log('  positional labels ("Column 3: 250" rather than "RPD: 250").');
  console.log('');
  console.log('  Known instance: the Groq rate-limit table. Its column labels sit in the page');
  console.log('  markup outside the <table>, so the first row is already data and cannot be');
  console.log('  promoted. The numbers are indexed but unlabelled, which means a question like');
  console.log('  "Groq requests per day" will not match them. Measured in the eval rather than');
  console.log('  guessed at — reading labels from outside a table is a heuristic that would');
  console.log('  mislabel other tables to fix this one.');
}
