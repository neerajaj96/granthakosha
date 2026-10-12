import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderText, tikaDisplayText, EN_FORTHCOMING } from "../src/lib/display.js";
import { GranthaStore } from "../src/lib/store.js";
import { MemoryAdapter } from "../src/lib/storage.js";

describe("EN display plane", () => {
  it("prefers en, falls back to Latin originals, flags missing Sanskrit", () => {
    assert.equal(renderText("मूला", "Root.", "en"), "Root.");
    assert.equal(renderText("Notes in English.", "", "en"), "Notes in English.");
    assert.equal(renderText("मूला", "", "en"), EN_FORTHCOMING);
    assert.equal(renderText("मूला", undefined, "en"), EN_FORTHCOMING);
    assert.equal(renderText("कृष्णः", "", "sa", "iast"), "kṛṣṇaḥ");
    assert.equal(renderText("कृष्णः", "", "sa", "deva"), "कृष्णः");
    assert.equal(renderText("देवी", "", "sa", "malayalam"), "ദേവീ");
    assert.equal(renderText("देवी", "", "sa", "bengali"), "দেবী");
    assert.equal(renderText("देवी", "", "sa", "iso15919"), "dēvī");
    assert.equal(renderText("देवी", "", "sa", "klingon"), "देवी"); // unknown falls back
  });

  it("tikaDisplayText prefers simpleEn, then Latin, then notice", () => {
    assert.equal(tikaDisplayText({ text: "टीका", simpleEn: "Simple." }, "en"), "Simple.");
    assert.equal(tikaDisplayText({ text: "English note.", simpleEn: "" }, "en"), "English note.");
    assert.equal(tikaDisplayText({ text: "टीका", simpleEn: "" }, "en"), EN_FORTHCOMING);
    assert.equal(tikaDisplayText({ text: "टीका", simpleEn: "" }, "sa"), "टीका");
  });
});

describe("EN fields through the store", () => {
  it("addPassage/addCommentary carry en/primaryEn/simpleEn; import preserves them", async () => {
    const store = new GranthaStore(new MemoryAdapter());
    const s = await store.createScripture("T");
    const p = await store.addPassage(s.id, "मूला", "S", { en: "Root.", primaryEn: "Combined." });
    assert.equal(p.en, "Root.");
    assert.equal(p.primaryEn, "Combined.");
    const c = await store.addCommentary(p.id, "A", "टीका", "", { simpleEn: "Simple." });
    assert.equal(c.simpleEn, "Simple.");
    const doc = await store.exportDoc(s.id);
    const store2 = new GranthaStore(new MemoryAdapter());
    await store2.importAppend(JSON.parse(JSON.stringify(doc)));
    const ss = await store2.listScriptures();
    const ps = await store2.listPassages(ss[0].id);
    assert.equal(ps[0].en, "Root.");
    assert.equal(ps[0].primaryEn, "Combined.");
    const cs = await store2.listCommentaries(ps[0].id);
    assert.equal(cs[0].simpleEn, "Simple.");
  });

  it("en-only passages import without orphans", async () => {
    const store = new GranthaStore(new MemoryAdapter());
    const s = await store.createScripture("T");
    const rep = await store.importAppend({
      version: 1, exportedAt: 0,
      scriptures: [{ id: "x", title: "T" }],
      passages: [{ id: "p:1", scriptureId: "x", ordinal: 1, section: "A", mula: "", en: "English only.", createdAt: 0, updatedAt: 0 }],
      commentaries: [{ id: "c:1", passageId: "p:1", author: "N", title: "", text: "Note.", createdAt: 0, updatedAt: 0 }],
    }, s.id);
    assert.equal(rep.addedPassages, 1);
    assert.equal(rep.addedCommentaries, 1);
    assert.deepEqual(rep.errors, []);
  });
});
