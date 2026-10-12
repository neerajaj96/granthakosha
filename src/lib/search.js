/**
 * M4 — fast local search over mula + tikas.
 * - Diacritic-insensitive via searchFold (search plane only; stored text untouched).
 * - Prefix matching on folded tokens ("madhukai" → "madhukaiṭabha…").
 * - Scope: mula | tika | all; author filter; field-weighted ranking.
 * - Snippets return char offsets into the ORIGINAL text for <mark> highlight.
 *   Offset mapping: only exact raw-substring hits are highlighted; fold-plane
 *   matches without a raw anchor return null spans (result still listed).
 */
import { searchFold } from "./unicode.js";
import { devaToIast } from "./iast.js";

const DEVA = "\\u0900-\\u097F";
const TOK = new RegExp(`[${DEVA}a-zA-Zāīūṛṝḷḹṃḥṅñṭḍṇśṣḷ]+`, "gu");
const HAS_LETTER = /\p{L}/u;
const HAS_DEVA = /[\u0900-\u097F]/;

export function tokenize(text) {
  const out = [];
  for (const m of String(text).matchAll(TOK)) {
    const raw = m[0];
    const fold = searchFold(raw);
    if (fold && HAS_LETTER.test(fold)) out.push({ raw, fold, at: m.index });
  }
  return out;
}

/** Index keys for a token: native fold + (for Devanagari) transliterated fold. */
export function indexKeys(raw) {
  const keys = new Set([searchFold(raw)]);
  if (HAS_DEVA.test(raw)) {
    const t = searchFold(devaToIast(raw));
    if (t && HAS_LETTER.test(t)) keys.add(t);
  }
  return [...keys].filter(Boolean);
}

/**
 * Build an inverted index. postings: token -> [{pid, field, cid, author}]
 * docs: pid -> {passage, tikaCount}
 */
export function buildIndex(passages, commentaries) {
  const postings = new Map();
  const byPassage = new Map();
  // Raw-token → index-key cache: refrains repeat thousands of times,
  // so folding each unique token once dominates the build cost.
  const keyCache = new Map();
  const keysFor = (raw) => {
    let k = keyCache.get(raw);
    if (!k) {
      k = indexKeys(raw);
      keyCache.set(raw, k);
    }
    return k;
  };
  const rawToks = (text) => {
    const out = [];
    for (const m of String(text).matchAll(TOK)) out.push(m[0]);
    return out;
  };
  const add = (fold, post) => {
    if (!postings.has(fold)) postings.set(fold, []);
    postings.get(fold).push(post);
  };
  for (const p of passages) {
    byPassage.set(p.id, p);
    const seen = new Set();
    for (const raw of rawToks(`${p.mula || ""}\n${p.en || ""}\n${p.primaryEn || ""}\n${p.section || ""}`)) {
      for (const k of keysFor(raw)) {
        if (seen.has(k)) continue;
        seen.add(k);
        add(k, { pid: p.id, field: "mula", cid: null, author: null });
      }
    }
  }
  for (const c of commentaries) {
    const seen = new Set();
    const hay = `${c.author} ${c.title || ""} ${c.text} ${c.simpleEn || ""}`;
    for (const raw of rawToks(hay)) {
      for (const k of keysFor(raw)) {
        if (seen.has(k)) continue;
        seen.add(k);
        add(k, { pid: c.passageId, field: "tika", cid: c.id, author: c.author });
      }
    }
  }
  return { postings, byPassage };
}

/**
 * AND-search over prefix-matched query tokens.
 * Returns [{pid, score, hits: {mula: n, tika: n, authors: []}}] ranked.
 */
export function search(index, query, opts = {}) {
  const scope = opts.scope || "all"; // mula | tika | all
  const author = opts.author ? searchFold(opts.author) : null;
  const qtoks = tokenize(query).map((t) => t.fold).filter(Boolean);
  if (qtoks.length === 0) return [];

  // candidate keys per query token (prefix match over indexed tokens)
  const perTok = qtoks.map((q) => {
    const keys = [];
    for (const k of index.postings.keys()) if (k.startsWith(q)) keys.push(k);
    return keys;
  });
  if (perTok.some((k) => k.length === 0)) return [];

  // AND across tokens: pid must appear in every token's posting set
  const pidSets = perTok.map((keys) => {
    const s = new Set();
    for (const k of keys) for (const post of index.postings.get(k)) s.add(post.pid);
    return s;
  });
  let pids = pidSets[0];
  for (const s of pidSets.slice(1)) pids = new Set([...pids].filter((x) => s.has(x)));
  if (pids.size === 0) return [];

  const out = [];
  for (const pid of pids) {
    let score = 0;
    const hits = { mula: 0, tika: 0, authors: new Set() };
    for (let ti = 0; ti < qtoks.length; ti++) {
      for (const k of perTok[ti]) {
        for (const post of index.postings.get(k)) {
          if (post.pid !== pid) continue;
          if (scope !== "all" && post.field !== scope) continue;
          if (author && searchFold(post.author || "") !== author) continue;
          if (post.field === "mula") { hits.mula++; score += k === qtoks[ti] ? 3 : 2; }
          else { hits.tika++; hits.authors.add(post.author); score += k === qtoks[ti] ? 2 : 1; }
        }
      }
    }
    if (hits.mula + hits.tika === 0) continue;
    const p = index.byPassage.get(pid);
    out.push({ pid, score, hits: { ...hits, authors: [...hits.authors] }, ordinal: p ? p.ordinal : 0 });
  }
  out.sort((a, b) => b.score - a.score || a.ordinal - b.ordinal);
  return out;
}

/** Escape HTML for safe innerHTML highlight injection. */
export function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Highlight raw query tokens as case-insensitive substrings of original text.
 * Returns HTML string; unmatched tokens are skipped (no highlight, no error).
 */
export function highlight(text, query) {
  const toks = [...new Set(tokenize(query).map((t) => t.raw))].sort((a, b) => b.length - a.length);
  if (toks.length === 0) return escapeHtml(text);
  const pat = new RegExp(`(${toks.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "giu");
  const parts = String(text).split(pat);
  return parts.map((part, i) => (i % 2 === 1 ? `<mark>${escapeHtml(part)}</mark>` : escapeHtml(part))).join("");
}
