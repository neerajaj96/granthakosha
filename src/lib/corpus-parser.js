/**
 * Durgasaptashati corpus parser — heuristic, zero-dependency, shared by
 * the CLI importer (tools/parse-corpus.mjs) and the browser import wizard.
 *
 * Input: raw text lines of the Guptavati-adi-sapta-tika-samvalita edition.
 * Output: { scriptures, passages, commentaries } (ExportDoc shape, version 1).
 *
 * Heuristics (see MILESTONES M3):
 * - Drop: page-number-only lines, bracket running-headers (harvest section),
 *   blank lines.
 * - Mula verse block: consecutive verse-shaped lines (short, no Latin, no
 *   paren-tag, no footnote prefix); a STRICT verse-end line (ends with
 *   ॥N॥ / ।।N।।) flushes the block as one passage.
 * - Commentary: line-initial `(Author)` tags (7 tikas + Pradipa + fallback),
 *   `N.` footnotes (pathabheda), or untagged prose (inherits active author).
 * - TIKA→MULA switch needs a strict-end preceded by a clean verse line,
 *   so in-commentary verse citations don't split chunks.
 * - Text is NEVER normalized/trimmed internally (only \\r stripped + trailing
 *   whitespace per line for join stability is AVOIDED — lines joined raw).
 */

export const CANONICAL_AUTHORS = [
  "Guptavatī",
  "Caturdharī",
  "Śāntanavī",
  "Nāgojībhaṭṭī",
  "Jagaccandracandrikā",
  "Daṃśoddhāra",
  "Candraprabhā",
  "Pradīpa",
];

// OCR/spelling variants found in the source → canonical author.
// Matching is done on a halant-stripped key so conjuncts (प्त, र्ध, …)
// and their OCR variants all fold to the same form.
const VARIANT_TESTS = [
  [/गुपतवती|गुपततवी|गुपतवी|गुपतविती/, "Guptavatī"],
  [/चतुरधरी|चुतरधरी|चरतुधरी/, "Caturdharī"],
  [/शानतनवी|शानतवती/, "Śāntanavī"],
  [/नागोज[ीि]|नगोज[ीि]/, "Nāgojībhaṭṭī"],
  [/जग/, "Jagaccandracandrikā"],
  [/द[ं]?शो?द(व|ध)ार|दंश|दशो|देशोद/, "Daṃśoddhāra"],
  [/चनदरपरभा|चनदरगरभा/, "Candraprabhā"],
  [/परदीप/, "Pradīpa"],
];

export function normalizeAuthor(rawTag) {
  const t = String(rawTag).replace(/^[०-९0-9]+\.?\s*/, "").trim();
  const key = t.replace(/्/g, "");
  for (const [re, canon] of VARIANT_TESTS) {
    if (re.test(key)) return canon;
  }
  return t || "Bhāṣya (untagged)";
}

const RE_PAGE_NUM = /^[०-९0-9\s]+$/;
const RE_TAG = /^\(([^)]{1,45})\)/;
const RE_FOOTNOTE = /^[०-९0-9]+\.\s/;
// A danda MARK is ॥ (U+0965, double-danda as one char) or ।। (two U+0964).
// A single । is an ordinary phrase separator, NOT a marker.
const RE_MARK = /(?:॥|।।)/;
const RE_STRICT_END = /(?:॥|।।)\s*[०-९0-9]+\s*(?:॥|।।)\s*$/;
const RE_ATHA = /^अथ [\u0900-\u097F\s]{1,48}$/;
const RE_LATIN = /[a-zA-Z]/;

function isVerseShaped(line) {
  const s = line.trim();
  if (!s || s.length > 80) return false;
  if (RE_LATIN.test(s)) return false;
  if (s.startsWith("(")) return false;
  if (RE_FOOTNOTE.test(s)) return false;
  if (!RE_MARK.test(s)) return true; // no marker run: plain half-line
  if (RE_STRICT_END.test(s)) return true; // closes with ॥N॥
  if (!/[०-९0-9]/.test(s)) return true; // invocation/closer, no numbers
  return false; // in-text verse citation → commentary territory
}

function harvestSection(line) {
  // `५० दुर्गासप्तशती [ अर्गलास्तुतिः` → after `[`; `X ] ...` → before `]`.
  const after = line.split("[").pop();
  if (after !== line) {
    const sec = after.replace(/[०-९0-9]+$/, "").trim();
    if (sec) return sec;
  }
  const bi = line.indexOf("]");
  if (bi > 0) {
    const sec = line.slice(0, bi).replace(/^[०-९0-9\s]+/, "").trim();
    if (sec && sec.length <= 60) return sec;
  }
  return null;
}

export function parseCorpus(rawText, opts = {}) {
  const title = opts.title || "Durgāsaptaśatī";
  const subtitle = opts.subtitle || "Guptavatyādi-sapta-ṭīkā-saṃvalitā (corpus import)";
  const scriptures = [{ id: opts.scriptureId || "corpus", title, subtitle, language: "sa-Deva", createdAt: 0, updatedAt: 0 }];

  const passages = [];
  const commentaries = [];
  const stats = { droppedNoise: 0, sections: {}, authors: {}, warnings: [] };

  const lines = String(rawText).split("\n");
  let section = "";
  let mulaBuf = []; // pending verse lines
  let tika = null; // { author, lines[], target: 'current'|'pending' }
  let pendingTikas = []; // chunks seen before any passage
  let currentPassageIdx = -1;
  let activeAuthor = null;

  const note = (k, v) => {
    stats[k] = stats[k] || {};
    stats[k][v] = (stats[k][v] || 0) + 1;
  };

  function flushMula() {
    if (mulaBuf.length === 0) return;
    const idx = passages.length;
    passages.push({
      id: `p:${idx + 1}`,
      scriptureId: scriptures[0].id,
      ordinal: idx + 1,
      section,
      mula: mulaBuf.join("\n"),
      createdAt: 0,
      updatedAt: 0,
    });
    note("sections", section || "(none)");
    mulaBuf = [];
    currentPassageIdx = idx;
    activeAuthor = null;
    // attach buffered preface chunks to this passage
    for (const p of pendingTikas) {
      commentaries.push({ id: `c:${commentaries.length + 1}`, passageId: passages[idx].id, author: p.author, title: "", text: p.lines.join("\n"), createdAt: 0, updatedAt: 0 });
      note("authors", p.author);
    }
    pendingTikas = [];
  }

  function closeTika() {
    if (!tika || tika.lines.length === 0) {
      tika = null;
      return;
    }
    const text = tika.lines.join("\n");
    if (currentPassageIdx >= 0) {
      commentaries.push({ id: `c:${commentaries.length + 1}`, passageId: passages[currentPassageIdx].id, author: tika.author, title: "", text, createdAt: 0, updatedAt: 0 });
      note("authors", tika.author);
    } else {
      pendingTikas.push({ author: tika.author, lines: tika.lines.slice() });
    }
    tika = null;
  }

  function openTika(author) {
    closeTika();
    activeAuthor = author;
    tika = { author, lines: [] };
  }

  for (let li = 0; li < lines.length; li++) {
    const raw = lines[li].replace(/\r$/, "");
    const s = raw.trim();

    if (!s) continue;
    if (RE_PAGE_NUM.test(s)) { stats.droppedNoise++; continue; }
    if (s.includes("[") || s.includes("]")) {
      const sec = harvestSection(s);
      if (sec) section = sec;
      stats.droppedNoise++;
      continue;
    }
    if (RE_ATHA.test(s)) {
      closeTika();
      flushMula();
      section = s;
      continue;
    }

    const tagM = s.match(RE_TAG);
    if (tagM) {
      flushMula();
      const author = normalizeAuthor(tagM[1]);
      openTika(author);
      const rest = s.slice(tagM[0].length).trim();
      if (rest) tika.lines.push(rest);
      continue;
    }

    if (RE_FOOTNOTE.test(s)) {
      flushMula();
      if (!tika || tika.author !== "Pāṭhabheda-ṭippaṇī") openTika("Pāṭhabheda-ṭippaṇī");
      tika.lines.push(s);
      continue;
    }

    const shaped = isVerseShaped(s);
    const strict = RE_STRICT_END.test(s);

    if (tika) {
      // In commentary: switch back to mula only on a clean verse line
      // followed by a strict verse-end (pair rule).
      const next = (lines[li + 1] || "").replace(/\r$/, "").trim();
      const pairBreak =
        shaped && !strict && next && isVerseShaped(next) && RE_STRICT_END.test(next);
      if (pairBreak || (strict && mulaBuf.length > 0)) {
        closeTika();
        activeAuthor = null;
        mulaBuf.push(s);
        if (strict) flushMula();
        continue;
      }
      tika.lines.push(s);
      continue;
    }

    // No open tika chunk.
    if (shaped) {
      mulaBuf.push(s);
      if (strict) flushMula();
    } else {
      // Untagged prose: flush pending verse, attach to current (or pending).
      flushMula();
      const author = activeAuthor || "Bhāṣya (untagged)";
      if (!tika || tika.author !== author) openTika(author);
      tika.lines.push(s);
    }
  }

  closeTika();
  flushMula();

  // Renumber into final stable ordinal ids (parser-local; store re-ids on import).
  return { version: 1, exportedAt: Date.now(), scriptures, passages, commentaries, stats };
}

/** Minimal CSV parser for `section,mula,author,commentary` rows (wizard upload). */
export function parseCsv(text) {
  const rows = [];
  let cur = [""];
  let q = false;
  const src = String(text).replace(/\r/g, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cur[cur.length - 1] += '"'; i++; }
        else q = false;
      } else cur[cur.length - 1] += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") cur.push("");
    else if (ch === "\n") { rows.push(cur); cur = [""]; }
    else cur[cur.length - 1] += ch;
  }
  if (cur.length > 1 || cur[0] !== "") rows.push(cur);
  return rows;
}

export function csvToDoc(text, opts = {}) {
  const rows = parseCsv(text);
  const errors = [];
  if (rows.length === 0) throw new Error("CSV is empty");
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const hasHead = head.includes("mula");
  const body = hasHead ? rows.slice(1) : rows;
  const ci = (name) => (hasHead ? head.indexOf(name) : { section: 0, mula: 1, author: 2, commentary: 3 }[name]);
  const passages = [];
  const commentaries = [];
  body.forEach((r, i) => {
    const mula = (r[ci("mula")] || "").trim();
    if (!mula) { errors.push(`row ${i + 1}: empty mula skipped`); return; }
    const pid = `p:${passages.length + 1}`;
    passages.push({ id: pid, scriptureId: "csv", ordinal: passages.length + 1, section: (r[ci("section")] || "").trim(), mula, createdAt: 0, updatedAt: 0 });
    const author = (r[ci("author")] || "").trim();
    const comm = (r[ci("commentary")] || "").trim();
    if (comm) commentaries.push({ id: `c:${commentaries.length + 1}`, passageId: pid, author: author || "Bhāṣya (untagged)", title: "", text: comm, createdAt: 0, updatedAt: 0 });
  });
  return {
    version: 1,
    exportedAt: Date.now(),
    scriptures: [{ id: "csv", title: opts.title || "CSV import", subtitle: "", language: "sa-Deva", createdAt: 0, updatedAt: 0 }],
    passages,
    commentaries,
    stats: { errors },
  };
}
