/**
 * Pada helpers (pure, tested). Heuristic whitespace/punctuation token split —
 * NO sandhi analysis, NO grammar tags, NO meanings (never faked).
 * Anvaya = tokens re-joined in prose flow (labeled heuristic in the UI).
 */

/** Heuristic pada tokens from mula text. */
export function padaTokens(mula) {
  return String(mula || "")
    .split(/[\s।॥|]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Prose-order (anvaya) line: tokens joined for reading flow. */
export function anvayaLine(mula) {
  return padaTokens(mula).join(" ");
}
