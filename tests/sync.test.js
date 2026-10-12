import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { MemoryAdapter } from "../src/lib/storage.js";
import {
  snapshotStores, diffSnapshots, summarizeDiff,
  pushLocal, pullRemote, syncBidirectional,
} from "../src/lib/sync.js";

function rec(id, updatedAt, extra = {}) {
  return { id, updatedAt, createdAt: updatedAt, ...extra };
}

describe("M6 sync engine", () => {
  let local;
  let remote;
  beforeEach(() => {
    local = new MemoryAdapter();
    remote = new MemoryAdapter();
  });

  it("diffs only-local / only-remote / newer / conflicts", async () => {
    await local.put("passages", rec("a", 2, { mula: "x" }));
    await local.put("passages", rec("b", 5, { mula: "new-local" }));
    await remote.put("passages", rec("a", 2, { mula: "x" }));
    await remote.put("passages", rec("b", 3, { mula: "old-remote" }));
    await remote.put("passages", rec("c", 1, { mula: "remote-only" }));
    await local.put("passages", rec("d", 4, { mula: "L" }));
    await remote.put("passages", rec("d", 4, { mula: "R" })); // same ts, differs
    const d = diffSnapshots(await snapshotStores(local), await snapshotStores(remote));
    const p = d.passages;
    assert.deepEqual(p.onlyRemote, ["c"]);
    assert.deepEqual(p.push, ["b"]);
    assert.deepEqual(p.conflicts, ["d"]);
    assert.deepEqual(p.pull, []);
    const s = summarizeDiff(d);
    assert.equal(s.push, 1);
    assert.equal(s.conflicts, 1);
  });

  it("bidirectional sync converges with LWW, conflicts keep local", async () => {
    await local.put("passages", rec("a", 2, { mula: "x" }));
    await local.put("passages", rec("b", 5, { mula: "new-local" }));
    await remote.put("passages", rec("a", 2, { mula: "x" }));
    await remote.put("passages", rec("b", 3, { mula: "old-remote" }));
    await remote.put("passages", rec("c", 9, { mula: "new-remote" }));
    const rep = await syncBidirectional(local, remote);
    assert.equal(rep.pushed, 1);
    assert.equal(rep.pulled, 1);
    assert.equal((await remote.get("passages", "b")).mula, "new-local");
    assert.equal((await local.get("passages", "c")).mula, "new-remote");
    // second sync is a no-op
    const rep2 = await syncBidirectional(local, remote);
    assert.equal(rep2.pushed, 0);
    assert.equal(rep2.pulled, 0);
  });

  it("push then pull round-trip a full store", async () => {
    await local.put("scriptures", rec("s1", 1, { title: "T" }));
    await local.put("commentaries", rec("c1", 1, { text: "t" }));
    const push = await pushLocal(local, remote);
    assert.equal(push.pushed, 2);
    await local.clear("scriptures");
    const pull = await pullRemote(local, remote);
    assert.equal(pull.pulled, 1); // s1 restored; c1 was already local
    assert.equal((await local.get("scriptures", "s1")).title, "T");
  });
});

describe("SupabaseAdapter (mocked fetch)", () => {
  it("validates creds and maps CRUD to PostgREST", async () => {
    const { SupabaseAdapter } = await import("../src/lib/storage.js");
    assert.throws(() => new SupabaseAdapter({}), /url \+ anon key/);
    const calls = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts = {}) => {
      calls.push({ url, method: opts.method || "GET", body: opts.body });
      const u = String(url);
      if (u.includes("select=body&limit=")) return { ok: true, json: async () => [] };
      if (u.includes("select=body")) return { ok: true, json: async () => [{ body: { id: "x", v: 1 } }] };
      return { ok: true, json: async () => [] };
    };
    try {
      const a = new SupabaseAdapter({ url: "https://demo.supabase.co", key: "anon-key" });
      await a.put("passages", { id: "p1", mula: "m", updatedAt: 7 });
      assert.ok(calls[0].url.includes("/rest/v1/granthakosha_records"));
      assert.ok(calls[0].body.includes("merge-duplicates") === false); // header, not body
      const got = await a.get("passages", "x");
      assert.deepEqual(got, { id: "x", v: 1 });
      assert.equal((await a.list("passages")).length, 0);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("surfaces server errors", async () => {
    const { SupabaseAdapter } = await import("../src/lib/storage.js");
    const realFetch = globalThis.fetch;
    globalThis.fetch = async () => ({ ok: false, status: 401, text: async () => "invalid key" });
    try {
      const a = new SupabaseAdapter({ url: "https://demo.supabase.co", key: "bad" });
      await assert.rejects(() => a.list("passages"), /Supabase 401/);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
