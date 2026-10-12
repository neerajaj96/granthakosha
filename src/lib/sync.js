/**
 * M6 — sync engine: diff/push/pull between any two StorageAdapters.
 * Strategy: per-record last-write-wins on updatedAt (fallback createdAt, then 0).
 * Equal timestamps + different content = conflict (reported, local kept).
 * Deletes do NOT propagate (corpus is append-mostly; documented in API.md).
 */

export function recordTime(r) {
  return Number(r?.updatedAt ?? r?.createdAt ?? 0) || 0;
}

export function sameContent(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export async function snapshotStores(adapter) {
  const out = {};
  for (const s of ["scriptures", "passages", "commentaries", "kv"]) {
    const rows = await adapter.list(s);
    out[s] = new Map(rows.map((r) => [r.id, r]));
  }
  return out;
}

export function diffSnapshots(local, remote) {
  const diff = {};
  for (const store of Object.keys(local)) {
    const L = local[store];
    const R = remote[store] || new Map();
    const d = { onlyLocal: [], onlyRemote: [], push: [], pull: [], conflicts: [] };
    for (const [id, l] of L) {
      const r = R.get(id);
      if (!r) {
        d.onlyLocal.push(id);
        continue;
      }
      if (sameContent(l, r)) continue;
      const lt = recordTime(l);
      const rt = recordTime(r);
      if (lt > rt) d.push.push(id);
      else if (rt > lt) d.pull.push(id);
      else d.conflicts.push(id);
    }
    for (const id of R.keys()) {
      if (!L.has(id)) d.onlyRemote.push(id);
    }
    diff[store] = d;
  }
  return diff;
}

export function summarizeDiff(diff) {
  const s = { push: 0, pull: 0, conflicts: 0, onlyLocal: 0, onlyRemote: 0 };
  for (const d of Object.values(diff)) {
    s.push += d.push.length + d.onlyLocal.length;
    s.pull += d.pull.length + d.onlyRemote.length;
    s.conflicts += d.conflicts.length;
    s.onlyLocal += d.onlyLocal.length;
    s.onlyRemote += d.onlyRemote.length;
  }
  return s;
}

export async function pushLocal(local, remote, diff = null) {
  const snap = await snapshotStores(local);
  const d = diff || diffSnapshots(snap, await snapshotStores(remote));
  let n = 0;
  for (const store of Object.keys(d)) {
    const ids = [...d[store].onlyLocal, ...d[store].push, ...d[store].conflicts];
    for (const id of ids) {
      const r = snap[store].get(id);
      if (r) {
        await remote.put(store, r);
        n++;
      }
    }
  }
  return { pushed: n, conflictsKeptLocal: Object.values(d).reduce((a, x) => a + x.conflicts.length, 0) };
}

export async function pullRemote(local, remote, diff = null) {
  const d = diff || diffSnapshots(await snapshotStores(local), await snapshotStores(remote));
  let n = 0;
  const snap = await snapshotStores(remote);
  for (const store of Object.keys(d)) {
    for (const id of [...d[store].onlyRemote, ...d[store].pull]) {
      const r = snap[store].get(id);
      if (r) {
        await local.put(store, r);
        n++;
      }
    }
  }
  return { pulled: n };
}

/** Full bidirectional sync: push local-newer (+conflicts kept local), pull remote-newer. */
export async function syncBidirectional(local, remote) {
  const d = diffSnapshots(await snapshotStores(local), await snapshotStores(remote));
  const summary = summarizeDiff(d);
  const pushRep = await pushLocal(local, remote, d);
  const pullRep = await pullRemote(local, remote, d);
  return { ...summary, ...pushRep, ...pullRep };
}
