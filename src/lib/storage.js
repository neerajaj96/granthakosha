/**
 * Unified StorageAdapter — local IndexedDB + remote Supabase (stub) behind one interface.
 * M1 uses MemoryAdapter (tests) + IndexedDBAdapter (browser). Supabase deferred to M5.
 */

/** In-memory adapter: used in tests + fallback when IndexedDB unavailable. */
export class MemoryAdapter {
  constructor() {
    this.name = "memory";
    this.db = new Map();
  }

  table(store) {
    let t = this.db.get(store);
    if (!t) {
      t = new Map();
      this.db.set(store, t);
    }
    return t;
  }

  async put(store, record) {
    // structuredClone preserves exact strings (no normalization)
    this.table(store).set(record.id, structuredClone(record));
  }
  async get(store, id) {
    const r = this.table(store).get(id);
    return r ? structuredClone(r) : undefined;
  }
  async del(store, id) {
    this.table(store).delete(id);
  }
  async list(store) {
    return [...this.table(store).values()].map((r) => structuredClone(r));
  }
  async clear(store) {
    this.table(store).clear();
  }
}

/** IndexedDB adapter for the browser (offline-first persistence). */
export class IndexedDBAdapter {
  constructor(dbName = "granthakosha") {
    this.name = "indexeddb";
    this.dbName = dbName;
    this._db = null;
  }

  open() {
    if (this._db) return Promise.resolve(this._db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const s of ["scriptures", "passages", "commentaries", "kv"]) {
          if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: "id" });
        }
      };
      req.onsuccess = () => {
        this._db = req.result;
        resolve(req.result);
      };
      req.onerror = () => reject(req.error);
    });
  }

  tx(store, mode, fn) {
    return this.open().then(
      (db) =>
        new Promise((resolve, reject) => {
          const t = db.transaction(store, mode);
          const req = fn(t.objectStore(store));
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        })
    );
  }

  async put(store, record) {
    await this.tx(store, "readwrite", (s) => s.put(record));
  }
  async get(store, id) {
    const r = await this.tx(store, "readonly", (s) => s.get(id));
    return r ?? undefined;
  }
  async del(store, id) {
    await this.tx(store, "readwrite", (s) => s.delete(id));
  }
  async list(store) {
    const r = await this.tx(store, "readonly", (s) => s.getAll());
    return r ?? [];
  }
  async clear(store) {
    await this.tx(store, "readwrite", (s) => s.clear());
  }
}

/**
 * Supabase remote adapter (M6) — implements StorageAdapter over PostgREST.
 * Maps (store, id) rows into ONE table `granthakosha_records`:
 *   store text | id text | body jsonb | updated_at bigint, PK (store, id).
 * See supabase/schema.sql. Uses global fetch (browser + Node 18+).
 */
export class SupabaseAdapter {
  constructor({ url, key, table = "granthakosha_records" } = {}) {
    if (!url || !key) throw new Error("Supabase url + anon key required");
    this.name = "supabase";
    this.url = String(url).replace(/\/$/, "");
    this.key = key;
    this.table = table;
  }

  async request(path, opts = {}) {
    const res = await fetch(`${this.url}/rest/v1/${path}`, {
      ...opts,
      headers: {
        apikey: this.key,
        Authorization: `Bearer ${this.key}`,
        "Content-Type": "application/json",
        ...(opts.headers || {}),
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Supabase ${res.status}: ${body.slice(0, 200)}`);
    }
    return res;
  }

  rowFor(store, record) {
    return {
      store,
      id: record.id,
      body: record,
      updated_at: Number(record.updatedAt ?? record.createdAt ?? Date.now()) || 0,
    };
  }

  async put(store, record) {
    await this.request(this.table, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(this.rowFor(store, record)),
    });
  }

  async get(store, id) {
    const qs = `store=eq.${encodeURIComponent(store)}&id=eq.${encodeURIComponent(id)}&select=body`;
    const res = await this.request(`${this.table}?${qs}`);
    const rows = await res.json();
    return rows[0]?.body;
  }

  async del(store, id) {
    const qs = `store=eq.${encodeURIComponent(store)}&id=eq.${encodeURIComponent(id)}`;
    await this.request(`${this.table}?${qs}`, { method: "DELETE" });
  }

  async list(store) {
    const out = [];
    const page = 1000;
    let offset = 0;
    for (;;) {
      const qs = `store=eq.${encodeURIComponent(store)}&select=body&limit=${page}&offset=${offset}`;
      const res = await this.request(`${this.table}?${qs}`);
      const rows = await res.json();
      out.push(...rows.map((r) => r.body));
      if (rows.length < page) break;
      offset += page;
    }
    return out;
  }

  async clear(store) {
    const qs = `store=eq.${encodeURIComponent(store)}`;
    await this.request(`${this.table}?${qs}`, { method: "DELETE" });
  }
}

/** StorageAdapter implementations: MemoryAdapter, IndexedDBAdapter, SupabaseAdapter. */
