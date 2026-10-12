import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { GranthaStore } from "../src/lib/store.js";
import { MemoryAdapter } from "../src/lib/storage.js";
import { __resetIdCounter } from "../src/lib/ids.js";

describe("import/export robustness", () => {
  let store;
  beforeEach(() => {
    __resetIdCounter();
    store = new GranthaStore(new MemoryAdapter());
  });

  it("JSON export → import round-trips exactly", async () => {
    const s = await store.createScripture("Durgāsaptaśatī");
    const mula = "वृषवाहनविघ्नेशौ हंसवाहां सरस्वतीम् ।";
    const p = await store.addPassage(s.id, mula, "Upoddhātaḥ");
    await store.addCommentary(p.id, "Guptavatī", "टीका-पाठः ॥१॥");
    const doc = await store.exportDoc(s.id);
    const doc2 = JSON.parse(JSON.stringify(doc));
    const store2 = new GranthaStore(new MemoryAdapter());
    const rep = await store2.importAppend(doc2);
    assert.equal(rep.addedPassages, 1);
    assert.equal(rep.addedCommentaries, 1);
    const ss = await store2.listScriptures();
    const ps = await store2.listPassages(ss[0].id);
    assert.equal(ps[0].mula, mula);
  });

  it("append-only import detects duplicates, never overwrites", async () => {
    const s = await store.createScripture("T");
    await store.addPassage(s.id, "मूला-एक", "S");
    const doc = await store.exportDoc(s.id);
    const rep = await store.importAppend(JSON.parse(JSON.stringify(doc)), s.id);
    assert.equal(rep.addedPassages, 0);
    assert.equal(rep.skippedDuplicates, 1);
    const all = await store.listPassages(s.id);
    assert.equal(all.length, 1);
    const doc2 = await store.exportDoc(s.id);
    doc2.passages.push({ id: "x", scriptureId: s.id, ordinal: 99, section: "S", mula: "मूला-द्वि", createdAt: 0, updatedAt: 0 });
    const rep2 = await store.importAppend(JSON.parse(JSON.stringify(doc2)), s.id);
    assert.equal(rep2.addedPassages, 1);
    const all2 = await store.listPassages(s.id);
    assert.deepEqual(all2.map((p) => p.ordinal), [1, 2]);
    assert.equal(all2[0].mula, "मूला-एक");
  });

  it("within-doc duplicates remap their commentaries (no orphans)", async () => {
    const s = await store.createScripture("T");
    const doc = {
      version: 1,
      exportedAt: 0,
      scriptures: [{ id: "x", title: "T" }],
      passages: [
        { id: "p:1", scriptureId: "x", ordinal: 1, section: "A", mula: "समान-मूला", createdAt: 0, updatedAt: 0 },
        { id: "p:2", scriptureId: "x", ordinal: 2, section: "B", mula: "समान-मूला", createdAt: 0, updatedAt: 0 },
      ],
      commentaries: [
        { id: "c:1", passageId: "p:2", author: "Guptavatī", title: "", text: "टीका", createdAt: 0, updatedAt: 0 },
      ],
    };
    const rep = await store.importAppend(JSON.parse(JSON.stringify(doc)), s.id);
    assert.equal(rep.addedPassages, 1);
    assert.equal(rep.skippedDuplicates, 1);
    assert.equal(rep.addedCommentaries, 1);
    assert.deepEqual(rep.errors, []);
  });

  it("fresh import preserves source ordinals 1:1", async () => {
    const doc = {
      version: 1,
      exportedAt: 0,
      scriptures: [{ id: "x", title: "T" }],
      passages: [5, 6, 9].map((n) => ({
        id: `p:${n}`, scriptureId: "x", ordinal: n, section: "S",
        mula: `मूला-${n}`, createdAt: 0, updatedAt: 0,
      })),
      commentaries: [{ id: "c:1", passageId: "p:6", author: "A", title: "", text: "t", createdAt: 0, updatedAt: 0 }],
    };
    const s = await store.createScripture("T");
    const rep = await store.importAppend(JSON.parse(JSON.stringify(doc)), s.id);
    assert.equal(rep.addedPassages, 3);
    const all = await store.listPassages(s.id);
    assert.deepEqual(all.map((p) => p.ordinal), [5, 6, 9]);
    assert.equal(all[1].id, `${s.id}:p:6`);
    const cs = await store.listCommentaries(all[1].id);
    assert.equal(cs.length, 1); // remapped, no orphan
    assert.deepEqual(rep.errors, []);
  });

  it("corrupt import fails safely with rollback (nothing written)", async () => {
    const s = await store.createScripture("T");
    await store.addPassage(s.id, "मूला", "S");
    await assert.rejects(() => store.importAppend({ garbage: true }, s.id));
    await assert.rejects(() =>
      store.importAppend({ version: 2, scriptures: [], passages: [], commentaries: [] }, s.id)
    );
    const all = await store.listPassages(s.id);
    assert.equal(all.length, 1);
    assert.equal(all[0].mula, "मूला");
  });

  it("empty mula rejected, never stored", async () => {
    const s = await store.createScripture("T");
    await assert.rejects(() => store.addPassage(s.id, "", "S"));
    assert.equal((await store.listPassages(s.id)).length, 0);
  });
});
