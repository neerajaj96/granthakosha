/**
 * Display-plane helpers (pure, tested). Storage is never touched here.
 * EN mode: prefer `en`; fall back to the original when it is already
 * Latin-script (e.g. English notes); else show the forthcoming notice.
 */
import { transliterateText } from "./transliterate.js";

export const EN_FORTHCOMING = "Simple English rendering is being prepared — check back soon.";
export const HAS_DEVA = /[\u0900-\u097F]/;

function toScript(s, script) {
  if (!script || script === "deva") return s || "";
  try {
    return transliterateText(s || "", "deva", script);
  } catch {
    return s || "";
  }
}

export function renderText(s, en, lang = "sa", script = "deva") {
  if (lang === "en") {
    if (en) return en;
    if (!HAS_DEVA.test(s || "")) return s || "";
    return EN_FORTHCOMING;
  }
  return toScript(s, script);
}

export function tikaDisplayText(c, lang = "sa", script = "deva") {
  const t = c.text || "";
  if (lang === "en") {
    if (c.simpleEn) return c.simpleEn;
    if (!HAS_DEVA.test(t)) return t;
    return EN_FORTHCOMING;
  }
  return toScript(t, script);
}
