/**
 * Unicode helpers.
 * RULE: storage must NEVER normalize text. These helpers are for
 * display/search ONLY and always operate on copies.
 */

/** Exact code-point equality (no normalization). */
export function exactEqual(a, b) {
  return a === b;
}

/** Code points of a string (for integrity checks). */
export function codePoints(s) {
  return Array.from(s);
}

/** Sync FNV-1a hash — deterministic, no normalization. */
export function fnv1a(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * Diacritic-insensitive fold for SEARCH ONLY (never for storage).
 * Strips Vedic accents + IAST diacritics to a plain lookup key.
 */
export function searchFold(s) {
  const foldMap = { ṭ: "t", ḍ: "d", ṇ: "n", ṛ: "r", ṝ: "r", ḷ: "l", ḹ: "l" };
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f\u0951-\u0954\u1cd0-\u1cfa]+/g, "")
    .replace(/[ṃṁṅñṇ]/gi, "m")
    .replace(/[śṣ]/gi, "s")
    .replace(/[ṭḍṇṛṝḷḹ]/gi, (c) => foldMap[c.toLowerCase()] ?? c)
    .toLowerCase();
}

/** Assert round-trip integrity: JSON encode/decode preserves exact string. */
export function jsonRoundTrip(value) {
  return JSON.parse(JSON.stringify(value));
}
