/**
 * Minimal Devanagari → IAST transliteration for the script-switch toggle.
 * Display-only; never touches stored text. Covers common cases; pass-through otherwise.
 */
const MAP = {
  अ: "a", आ: "ā", इ: "i", ई: "ī", उ: "u", ऊ: "ū", ऋ: "ṛ", ॠ: "ṝ",
  ऌ: "ḷ", ए: "e", ऐ: "ai", ओ: "o", औ: "au", अं: "aṃ", अः: "aḥ",
  क: "ka", ख: "kha", ग: "ga", घ: "gha", ङ: "ṅa",
  च: "ca", छ: "cha", ज: "ja", झ: "jha", ञ: "ña",
  ट: "ṭa", ठ: "ṭha", ड: "ḍa", ढ: "ḍha", ण: "ṇa",
  त: "ta", थ: "tha", द: "da", ध: "dha", न: "na",
  प: "pa", फ: "pha", ब: "ba", भ: "bha", म: "ma",
  य: "ya", र: "ra", ल: "la", व: "va",
  श: "śa", ष: "ṣa", स: "sa", ह: "ha",
  "ं": "ṃ", "ः": "ḥ", "ँ": "m̐", "्": "", "ऽ": "'", "।": ".", "॥": "||",
  "०": "0", "१": "1", "२": "2", "३": "3", "४": "4",
  "५": "5", "६": "6", "७": "7", "८": "8", "९": "9",
  " ": " ", "\n": "\n",
};

const VOWEL_SIGNS = {
  "ा": "ā", "ि": "i", "ी": "ī", "ु": "u", "ू": "ū",
  "ृ": "ṛ", "ॄ": "ṝ", "े": "e", "ै": "ai", "ो": "o", "ौ": "au",
  "ं": "ṃ", "ः": "ḥ", "ँ": "m̐", "्": "",
};

export function devaToIast(input) {
  const chars = Array.from(input);
  let out = "";
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const next = chars[i + 1];
    if (ch in MAP) {
      let v = MAP[ch];
      // Inherent-'a' lookahead: a consonant loses its 'a' before a halanta
      // or a dependent vowel sign (ा–ौ). Anusvara/visarga (ंःँ) follow the
      // inherent vowel, so गः → gaḥ, not gḥ.
      // e.g. दुर्गा → durgā, कृष्णः → kṛṣṇaḥ.
      const joins = next === "्" || (next >= "ा" && next <= "ौ");
      if (joins && v.endsWith("a") && v.length > 1) v = v.slice(0, -1);
      out += v;
    } else if (ch >= "ऀ" && ch <= "ॿ") {
      out += VOWEL_SIGNS[ch] ?? "";
    } else {
      out += ch;
    }
  }
  return out;
}
