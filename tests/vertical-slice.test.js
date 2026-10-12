import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { GranthaStore } from "../src/lib/store.js";
import { MemoryAdapter } from "../src/lib/storage.js";
import { SEED_PASSAGES } from "../src/lib/seed.js";
import { __resetIdCounter } from "../src/lib/ids.js";

describe("M1 vertical slice (end-to-end)", () => {
  let store;
  beforeEach(() => {
    __resetIdCounter();
    store = new GranthaStore(new MemoryAdapter());
  });

  it("create scripture → paste exact mula → attach 2 commentaries → toggle → reload → append", async () => {
    // 1. Create Scripture entity
    const s = await store.createScripture("Durgāsaptaśatī", "test");
    assert.match(s.id, /^s_/);

    // 2. Paste + persist EXACT mula text
    const mula = "वृषवाहनविघ्नेशौ हंसवाहां सरस्वतीम् ।\nस्वेष्टं श्रीबटुकं नत्वा पितरं व्यङ्कटं ततः ॥१॥";
    const p1 = await store.addPassage(s.id, mula, "Upoddhātaḥ");
    assert.equal(p1.mula, mula); // exact, char-for-char
    assert.equal(p1.ordinal, 1);
    assert.equal(p1.id, `${s.id}:p:1`);

    // 3. Attach multiple independent commentaries
    const c1 = await store.addCommentary(p1.id, "Guptavatī", "विधिविष्णुमुखामरोदयस्थितिनाशेषु शिवोऽप्यनीश्वरः ।");
    const c2 = await store.addCommentary(p1.id, "Harikṛṣṇa", "स्वेष्टदेवतानमस्कारपूर्वकं ग्रन्थारम्भः ।");
    assert.notEqual(c1.id, c2.id);
    const list = await store.listCommentaries(p1.id);
    assert.equal(list.length, 2);

    // 4. Expand/collapse each separately (UI-state simulation: ids stable)
    const uiExpanded = { [c1.id]: true, [c2.id]: false };
    uiExpanded[c2.id] = true;
    assert.equal(uiExpanded[c1.id], true);
    assert.equal(uiExpanded[c2.id], true);
    uiExpanded[c1.id] = false;
    assert.equal(uiExpanded[c1.id], false);
    assert.equal(uiExpanded[c2.id], true);

    // 5. Reload: new store over SAME adapter restores seamlessly
    const reloaded = new GranthaStore(store.adapter);
    const passages = await reloaded.listPassages(s.id);
    assert.equal(passages.length, 1);
    assert.equal(passages[0].mula, mula);
    const tikas = await reloaded.listCommentaries(p1.id);
    assert.deepEqual(tikas.map((c) => c.id).sort(), [c1.id, c2.id].sort());

    // 6. Append new material without losing data / corrupting mappings / dupes
    const p2 = await store.addPassage(s.id, "श्रीगौतमकुलोत्पन्नो ज्योतिर्विद्व्यङ्कटात्मजः ।", "Upoddhātaḥ");
    assert.equal(p2.ordinal, 2);
    assert.equal(p2.id, `${s.id}:p:2`);
    const all = await store.listPassages(s.id);
    assert.deepEqual(all.map((p) => p.ordinal), [1, 2]);
    assert.equal(all[0].id, p1.id); // old mapping intact
  });

  it("stable identifiers survive re-renders and edits", async () => {
    const s = await store.createScripture("X");
    const p = await store.addPassage(s.id, "मूला", "S1");
    const c = await store.addCommentary(p.id, "A", "text-one");
    const idBefore = c.id;
    const updated = await store.updateCommentary(c.id, { text: "text-two" });
    assert.equal(updated.id, idBefore);
    assert.equal(updated.text, "text-two");
    const again = await store.listCommentaries(p.id);
    assert.equal(again[0].id, idBefore);
  });

  it("commentary relationships are independent", async () => {
    const s = await store.createScripture("X");
    const p = await store.addPassage(s.id, "मूला", "S1");
    const c1 = await store.addCommentary(p.id, "A1", "t1");
    const c2 = await store.addCommentary(p.id, "A2", "t2");
    await store.updateCommentary(c1.id, { text: "t1-edited" });
    const list = await store.listCommentaries(p.id);
    assert.equal(list.find((c) => c.id === c2.id).text, "t2");
    await store.deleteCommentary(c1.id);
    const rest = await store.listCommentaries(p.id);
    assert.equal(rest.length, 1);
    assert.equal(rest[0].id, c2.id);
  });

  it("seed passages load verbatim", async () => {
    const s = await store.createScripture("Seed");
    for (const seed of SEED_PASSAGES) {
      const p = await store.addPassage(s.id, seed.mula, seed.section);
      assert.equal(p.mula, seed.mula);
    }
    const all = await store.listPassages(s.id);
    assert.equal(all.length, SEED_PASSAGES.length);
  });
});
