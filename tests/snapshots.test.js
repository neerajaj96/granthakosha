import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { GranthaStore } from "../src/lib/store.js";
import { MemoryAdapter } from "../src/lib/storage.js";
import { __resetIdCounter } from "../src/lib/ids.js";

describe("M5 snapshots + integrity", () => {
  let store;
  beforeEach(() => {
    __resetIdCounter();
    store = new GranthaStore(new MemoryAdapter());
  });

  async function seed() {
    const s = await store.createScripture("T");
    const p = await store.addPassage(s.id, "मूला-एक", "S");
    const c = await store.addCommentary(p.id, "Guptavatī", "टीका");
    return { s, p, c };
  }

  it("snapshot round-trips byte-identical IDs and text", async () => {
    const { s, p, c } = await seed();
    const rec = await store.saveSnapshot("test-snap");
    assert.equal(rec.counts.passages, 1);
    assert.equal(rec.counts.commentaries, 1);
    // mutate after snapshot
    await store.addPassage(s.id, "मूला-द्वि", "S");
    await store.deleteCommentary(c.id);
    // restore
    const rep = await store.restoreSnapshot(rec.snapId);
    assert.deepEqual(rep, { scriptures: 1, passages: 1, commentaries: 1 });
    const ps = await store.listPassages(s.id);
    assert.equal(ps.length, 1);
    assert.equal(ps[0].id, p.id); // stable id preserved (not re-idd)
    assert.equal(ps[0].mula, "मूला-एक");
    const cs = await store.listCommentaries(p.id);
    assert.equal(cs[0].id, c.id);
  });

  it("lists and deletes snapshots", async () => {
    await seed();
    const a = await store.saveSnapshot("a");
    const b = await store.saveSnapshot("b");
    let list = await store.listSnapshots();
    assert.equal(list.length, 2);
    await store.deleteSnapshot(a.snapId);
    list = await store.listSnapshots();
    assert.equal(list.length, 1);
    assert.equal(list[0].snapId, b.snapId);
    await assert.rejects(() => store.restoreSnapshot("nope"));
  });

  it("verify finds orphans/empties/dupes; repair removes orphans", async () => {
    const { s } = await seed();
    const adapter = store.adapter;
    await adapter.put("commentaries", { id: "c_orphan", passageId: "missing", author: "X", text: "t", createdAt: 0, updatedAt: 0 });
    await adapter.put("passages", { id: "p_orphan", scriptureId: "missing-s", ordinal: 1, mula: "m", createdAt: 0, updatedAt: 0 });
    const rep = await store.verifyIntegrity();
    assert.deepEqual(rep.orphanCommentaries, ["c_orphan"]);
    assert.deepEqual(rep.orphanPassages, ["p_orphan"]);
    assert.deepEqual(rep.emptyMula, []);
    const fixed = await store.repairIntegrity();
    assert.deepEqual(fixed, { removedCommentaries: 1, removedPassages: 1 });
    assert.deepEqual((await store.verifyIntegrity()).orphanCommentaries, []);
    // seed data untouched
    assert.equal((await store.listPassages(s.id)).length, 1);
  });

  it("batch tika fetch for a scripture", async () => {
    const { s, p } = await seed();
    await store.addCommentary(p.id, "Pradīpa", "टीका-२");
    const all = await store.listCommentariesForScripture(s.id);
    assert.equal(all.length, 2);
  });
});
