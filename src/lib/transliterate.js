/**
 * Multi-script transliterator (zero-dep).
 * Pivot architecture: everything routes through Devanagari.
 * - Brahmic scripts (Bengali/Telugu/Kannada/Malayalam) map by Unicode block
 *   offset — these blocks are 1:1 aligned by design (vowels, consonants,
 *   vowel signs, digits). Dandas, Vedic accents and ॐ pass through.
 * - IAST/ISO-15919 use explicit tables both directions.
 * - Grantha is NOT included: its block is not offset-aligned and codepoints
 *   cannot be verified offline — omitted rather than shipped wrong.
 */
import { devaToIast } from "./iast.js";

export const SCRIPTS = ["deva", "iast", "iso15919", "bengali", "telugu", "kannada", "malayalam"];

const BLOCK_OFFSET = { bengali: 0x80, telugu: 0x300, kannada: 0x380, malayalam: 0x400 };

function inMappedRange(cp) {
  return (cp >= 0x0901 && cp <= 0x093d) || (cp >= 0x093e && cp <= 0x094d) || (cp >= 0x0966 && cp <= 0x096f);
}

export function devaToBrahmic(input, script) {
  const off = BLOCK_OFFSET[script];
  if (off === undefined) throw new Error(`Unsupported Brahmic script: ${script}`);
  // Bengali quirk: Sanskrit va is ব (BA), not ঵ (VVA, foreign words only).
  let out = "";
  for (const ch of String(input)) {
    const cp = ch.codePointAt(0);
    if (script === "bengali" && cp === 0x0935) {
      out += "ব";
      continue;
    }
    out += inMappedRange(cp) ? String.fromCodePoint(cp + off) : ch;
  }
  return out;
}

export function brahmicToDeva(input, script) {
  const off = BLOCK_OFFSET[script];
  if (off === undefined) throw new Error(`Unsupported Brahmic script: ${script}`);
  // Malayalam-only fixups: RRA (റ) is ra, and chillu letters are
  // consonant + virama (the offset alone would yield ड़ / pass-through).
  const ML_CHILLU = { 0x0d7a: 0x0923, 0x0d7b: 0x0928, 0x0d7c: 0x0930, 0x0d7d: 0x0932, 0x0d7e: 0x0933, 0x0d7f: 0x0915 };
  let out = "";
  for (const ch of String(input)) {
    const cp = ch.codePointAt(0);
    if (script === "malayalam" && cp === 0x0d31) {
      out += "र";
      continue;
    }
    if (script === "malayalam" && ML_CHILLU[cp] !== undefined) {
      out += String.fromCodePoint(ML_CHILLU[cp]) + "्";
      continue;
    }
    if (script === "bengali" && cp === 0x09ac) {
      out += "व"; // ব is Sanskrit va
      continue;
    }
    const back = cp - off;
    out += inMappedRange(back) ? String.fromCodePoint(back) : ch;
  }
  return out;
}

/** ISO 15919 differs from IAST in a handful of vowels/nasals. */

export function iastToIso(input) {
  // ē/ō only where Devanagari has े/ो (long e/o); elsewhere e.g. Wear patterns
  // keep IAST. Heuristic: convert standalone/short e,o followed by consonant?
  // Honest approach: map ē = e + macron only for known long contexts is
  // unreliable — so ISO output uses ē/ō for ALL e/o (documented simplification).
  return String(input)
    .replace(/e/g, "ē")
    .replace(/o/g, "ō")
    .replace(/ṛ/g, "r̥")
    .replace(/ṝ/g, "r̥̄")
    .replace(/ḷ/g, "l̥")
    .replace(/ḹ/g, "l̥̄")
    .replace(/ṃ/g, "ṁ");
}

export function isoToIast(input) {
  return String(input)
    .replace(/ē/g, "e")
    .replace(/ō/g, "o")
    .replace(/r̥̄/g, "ṝ")
    .replace(/r̥/g, "ṛ")
    .replace(/l̥̄/g, "ḹ")
    .replace(/l̥/g, "ḷ")
    .replace(/ṁ/g, "ṃ");
}

// ---------- IAST → Devanagari (for the workbench reverse direction) ----------
const CONS = {
  k: "क", kh: "ख", g: "ग", gh: "घ", ṅ: "ङ",
  c: "च", ch: "छ", j: "ज", jh: "झ", ñ: "ञ",
  ṭ: "ट", ṭh: "ठ", ḍ: "ड", ḍh: "ढ", ṇ: "ण",
  t: "त", th: "थ", d: "द", dh: "ध", n: "न",
  p: "प", ph: "फ", b: "ब", bh: "भ", m: "म",
  y: "य", r: "र", l: "ल", v: "व",
  ś: "श", ṣ: "ष", s: "स", h: "ह", ḷa: "ळ",
};
const VOWEL_SIGN = {
  ā: "ा", i: "ि", ī: "ी", u: "ु", ū: "ू",
  ṛ: "ृ", ṝ: "ॄ", e: "े", ai: "ै", o: "ो", au: "ौ",
};
const VOWEL_IND = {
  a: "अ", ā: "आ", i: "इ", ī: "ई", u: "उ", ū: "ऊ",
  ṛ: "ऋ", ṝ: "ॠ", e: "ए", ai: "ऐ", o: "ओ", au: "औ",
};
const OTHER = { "ṃ": "ं", "ḥ": "ः", "m̐": "ँ", "'": "ऽ", ".": "।", "|": "।", "0": "०", "1": "१", "2": "२", "3": "३", "4": "४", "5": "५", "6": "६", "7": "७", "8": "८", "9": "९", " ": " ", "\n": "\n", "-": "-" };

function peekTok(s, i, table) {
  const two = s.slice(i, i + 2);
  if (table[two]) return [table[two], 2];
  const one = s[i];
  if (table[one]) return [table[one], 1];
  return [null, 0];
}

export function iastToDeva(input) {
  const s = String(input);
  let out = "";
  let i = 0;
  const IND2 = { ai: "ऐ", au: "औ" };
  while (i < s.length) {
    // independent vowels first (ai/au must win over stray signs)
    if (IND2[s.slice(i, i + 2)]) {
      out += IND2[s.slice(i, i + 2)];
      i += 2;
      continue;
    }
    // consonant?
    const [c, cn] = peekTok(s, i, CONS);
    if (c) {
      // look at what follows: vowel sign / vowel / nothing(consonant/end)
      const [vs, vn] = peekTok(s, i + cn, VOWEL_SIGN);
      if (vs) {
        out += c + vs;
        i += cn + vn;
        continue;
      }
      const [v, vlen] = peekTok(s, i + cn, VOWEL_IND);
      if (v === "अ" || (v && s[i + cn] === "a" && vlen === 1)) {
        out += c; // inherent a
        i += cn + 1;
        continue;
      }
      if (v) {
        // vowel letter after consonant without sign (e.g. "kai" handled via ai sign; "k i" separate)
        out += c + "्" + v;
        i += cn + vlen;
        continue;
      }
      // next is consonant/anusvara/visarga/end → halanta, unless word-final inherent a
      const nxt = s[i + cn];
      if (nxt === undefined || nxt === " " || nxt === "\n" || nxt === "-" || nxt === "." || nxt === "|") {
        out += c; // word-final/isolated: inherent a
      } else {
        out += c + "्";
      }
      i += cn;
      continue;
    }
    const [vs2, vn2] = peekTok(s, i, VOWEL_SIGN);
    if (vs2) {
      // stray sign — attach as-is
      out += vs2;
      i += vn2;
      continue;
    }
    const [v2, vl2] = peekTok(s, i, VOWEL_IND);
    if (v2) {
      out += v2;
      i += vl2;
      continue;
    }
    if (OTHER[s[i]] !== undefined) {
      out += OTHER[s[i]];
      i++;
      continue;
    }
    out += s[i]; // pass through unknown
    i++;
  }
  return out;
}

/** Main entry: transliterateText(text, fromScript, toScript). */
export function transliterateText(text, from, to) {
  const f = String(from || "deva").toLowerCase();
  const t = String(to || "iast").toLowerCase();
  if (!SCRIPTS.includes(f)) throw new Error(`Unknown source script: ${from}`);
  if (!SCRIPTS.includes(t)) throw new Error(`Unknown target script: ${to}`);
  if (f === t) return String(text);
  // → deva pivot
  let deva;
  if (f === "deva") deva = String(text);
  else if (f === "iast") deva = iastToDeva(text);
  else if (f === "iso15919") deva = iastToDeva(isoToIast(text));
  else deva = brahmicToDeva(text, f);
  // deva → target
  if (t === "deva") return deva;
  if (t === "iast") return devaToIast(deva);
  if (t === "iso15919") return iastToIso(devaToIast(deva));
  return devaToBrahmic(deva, t);
}
