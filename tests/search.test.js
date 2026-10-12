import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { tokenize, buildIndex, search, highlight, escapeHtml } from "../src/lib/search.js";

const P = [
  { id: "s:p:1", scriptureId: "s", ordinal: 1, section: "Upoddhātaḥ", mula: "वृषवाहनविघ्नेशौ हंसवाहां सरस्वतीम् ।", createdAt: 0, updatedAt: 0 },
  { id: "s:p:2", scriptureId: "s", ordinal: 2, section: "Argala", mula: "मधुकैटभविद्राविविधातृवरदे नमः ।", createdAt: 0, updatedAt: 0 },
  { id: "s:p:3", scriptureId: "s", ordinal: 3, section: "Argala", mula: "दुर्गायै नमः ।", createdAt: 0, updatedAt: 0 },
];
const C = [
  { id: "c1", passageId: "s:p:2", author: "Guptavatī", title: "", text: "मध्विति । विद्राविणी च सा विधातृवरदा ।", createdAt: 0, updatedAt: 0 },
  { id: "c2", passageId: "s:p:2", author: "Pradīpa", title: "", text: "मधुकैटभयोर्विंद्राविणी नाशिनी च सा ।", createdAt: 0, updatedAt: 0 },
];

describe("M4 search", () => {
  it("tokenizes Devanagari + IAST, folds diacritics", () => {
    const toks = tokenize("Durgā śakti ॥१॥");
    assert.deepEqual(toks.map((t) => t.fold), ["durga", "sakti"]);
  });

  it("finds mula by exact + prefix + diacritic-insensitive queries", () => {
    const idx = buildIndex(P, C);
    assert.equal(search(idx, "मधुकैटभ")[0].pid, "s:p:2");
    assert.equal(search(idx, "मधुकैट")[0].pid, "s:p:2"); // prefix
    assert.equal(search(idx, "sarasva")[0].pid, "s:p:1"); // latin→deva cross-script
  });

  it("searches across scripts (durga ↔ दुर्गा)", () => {
    const idx = buildIndex(P, C);
    assert.equal(search(idx, "durga")[0].pid, "s:p:3");
    assert.equal(search(idx, "दुर्गा")[0].pid, "s:p:3");
    assert.equal(search(idx, "durgā")[0].pid, "s:p:3"); // diacritic-insensitive
  });

  it("scopes to mula/tika and filters by author", () => {
    const idx = buildIndex(P, C);
    const m = search(idx, "मधु", { scope: "mula" });
    assert.ok(m.length > 0 && m.every((r) => r.hits.mula > 0));
    const t = search(idx, "मधु", { scope: "tika" });
    assert.ok(t.length > 0 && t.every((r) => r.hits.tika > 0));
    const a = search(idx, "मधु", { author: "Pradīpa" });
    assert.ok(a.length > 0);
    assert.deepEqual(a[0].hits.authors, ["Pradīpa"]);
    assert.equal(search(idx, "मधु", { author: "Nobody" }).length, 0);
  });

  it("ANDs multiple tokens and ranks mula hits first", () => {
    const idx = buildIndex(P, C);
    const r = search(idx, "मधुकैटभ विधातृ");
    assert.equal(r.length, 1);
    assert.equal(r[0].pid, "s:p:2");
    assert.equal(search(idx, "मधुकैटभ xyzzy").length, 0);
  });

  it("highlights raw matches safely (escapes HTML)", () => {
    const h = highlight("a <b> मधु & co", "मधु");
    assert.ok(h.includes("<mark>मधु</mark>"));
    assert.ok(h.includes("&lt;b&gt;") && h.includes("&amp;"));
    assert.equal(escapeHtml("<x>"), "&lt;x&gt;");
    // fold-only match → no crash, no mark
    assert.ok(!highlight("मधुकैटभ", "madhukaitabha").includes("<mark>"));
  });

  it("empty query returns nothing", () => {
    const idx = buildIndex(P, C);
    assert.deepEqual(search(idx, "  ॥ "), []);
  });
});
