/**
 * GranthaStore — data model + persistence + append-only import.
 * Unicode rule: NEVER normalize mula/commentary text on write, read, or export.
 */
import { newScriptureId, passageId, newCommentaryId } from "./ids.js";

export class GranthaStore {
  constructor(adapter) {
    this.adapter = adapter;
    this._ordCache = new Map(); // scriptureId -> max ordinal (perf; verified on write)
  }

  // ---------- Scripture ----------
  async createScripture(title, subtitle = "", language = "sa-Deva") {
    if (!title.trim()) throw new Error("Scripture title is required");
    const now = Date.now();
    const s = { id: newScriptureId(), title, subtitle, language, createdAt: now, updatedAt: now };
    await this.adapter.put("scriptures", s);
    return s;
  }

  async getScripture(id) {
    return this.adapter.get("scriptures", id);
  }

  async listScriptures() {
    const rows = await this.adapter.list("scriptures");
    return rows.sort((a, b) => a.createdAt - b.createdAt);
  }

  // ---------- Passages (append-only, stable ordinal IDs) ----------
  async nextOrdinal(scriptureId) {
    const hit = this._ordCache.get(scriptureId);
    if (hit !== undefined) return hit + 1;
    const all = await this.listPassages(scriptureId);
    const max = all.length === 0 ? 0 : Math.max(...all.map((p) => p.ordinal));
    this._ordCache.set(scriptureId, max);
    return max + 1;
  }

  /** Full rescan (used on cache clash); refreshes the cache. */
  async rescanOrdinal(scriptureId) {
    const all = await this.listPassages(scriptureId);
    const max = all.length === 0 ? 0 : Math.max(...all.map((p) => p.ordinal));
    this._ordCache.set(scriptureId, max);
    return max + 1;
  }

  async addPassage(scriptureId, mula, section = "") {
    if (!mula) throw new Error("Mula text must not be empty (exact text required)");
    const s = await this.getScripture(scriptureId);
    if (!s) throw new Error(`Scripture not found: ${scriptureId}`);
    const ordinal = await this.nextOrdinal(scriptureId);
    // Guard the ordinal cache against concurrent writers: rescan if id taken.
    const clash = await this.adapter.get("passages", passageId(scriptureId, ordinal));
    const finalOrdinal = clash ? await this.rescanOrdinal(scriptureId) : ordinal;
    const now = Date.now();
    const p = {
      id: passageId(scriptureId, finalOrdinal),
      scriptureId,
      ordinal: finalOrdinal,
      section,
      mula, // stored EXACTLY, no normalization
      createdAt: now,
      updatedAt: now,
    };
    await this.adapter.put("passages", p);
    this._ordCache.set(scriptureId, finalOrdinal);
    s.updatedAt = now;
    await this.adapter.put("scriptures", s);
    return p;
  }

  async listPassages(scriptureId) {
    const rows = await this.adapter.list("passages");
    return rows.filter((p) => p.scriptureId === scriptureId).sort((a, b) => a.ordinal - b.ordinal);
  }

  async getPassage(id) {
    return this.adapter.get("passages", id);
  }

  // ---------- Commentaries (independent relationships) ----------
  async addCommentary(passageId_, author, text, title = "") {
    if (!author.trim()) throw new Error("Commentary author is required");
    if (!text) throw new Error("Commentary text must not be empty");
    const p = await this.getPassage(passageId_);
    if (!p) throw new Error(`Passage not found: ${passageId_}`);
    const now = Date.now();
    const c = {
      id: newCommentaryId(),
      passageId: passageId_,
      author,
      title,
      text,
      createdAt: now,
      updatedAt: now,
    };
    await this.adapter.put("commentaries", c);
    return c;
  }

  async listCommentaries(passageId_) {
    const rows = await this.adapter.list("commentaries");
    return rows.filter((c) => c.passageId === passageId_).sort((a, b) => a.createdAt - b.createdAt);
  }

  /** All commentaries of a scripture in one scan (reader + search indexing). */
  async listCommentariesForScripture(scriptureId) {
    const passages = await this.listPassages(scriptureId);
    const ids = new Set(passages.map((p) => p.id));
    const rows = await this.adapter.list("commentaries");
    return rows.filter((c) => ids.has(c.passageId)).sort((a, b) => a.createdAt - b.createdAt);
  }

  async updateCommentary(id, patch) {
    const c = await this.adapter.get("commentaries", id);
    if (!c) throw new Error(`Commentary not found: ${id}`);
    if (patch.text !== undefined) {
      if (!patch.text) throw new Error("Commentary text must not be empty");
      c.text = patch.text; // exact, no normalization
    }
    if (patch.author !== undefined) c.author = patch.author;
    if (patch.title !== undefined) c.title = patch.title;
    c.updatedAt = Date.now();
    await this.adapter.put("commentaries", c);
    return c;
  }

  async deleteCommentary(id) {
    // Deletes ONLY this commentary; siblings untouched (independence).
    await this.adapter.del("commentaries", id);
  }

  // ---------- Export / Import (append-only, duplicate-safe, rollback) ----------
  async exportDoc(scriptureId) {
    const scriptures = await this.adapter.list("scriptures");
    const passages = await this.adapter.list("passages");
    const commentaries = await this.adapter.list("commentaries");
    if (scriptureId) {
      const s = scriptures.filter((x) => x.id === scriptureId);
      const pIds = new Set(passages.filter((p) => p.scriptureId === scriptureId).map((p) => p.id));
      return {
        version: 1,
        exportedAt: Date.now(),
        scriptures: s,
        passages: passages.filter((p) => p.scriptureId === scriptureId),
        commentaries: commentaries.filter((c) => pIds.has(c.passageId)),
      };
    }
    return { version: 1, exportedAt: Date.now(), scriptures, passages, commentaries };
  }

  static validateExportDoc(doc) {
    if (typeof doc !== "object" || doc === null) throw new Error("Import failed: not an object");
    if (doc.version !== 1) throw new Error("Import failed: unsupported version");
    for (const k of ["scriptures", "passages", "commentaries"]) {
      if (!Array.isArray(doc[k])) throw new Error(`Import failed: '${k}' must be an array`);
    }
    return doc;
  }

  /**
   * Append-only import into an existing scripture (or new one if scriptureId omitted
   * and doc carries exactly one scripture). Exact-duplicate mula lines are skipped.
   * On any validation failure NOTHING is written (rollback via pre-validation).
   */
  async importAppend(doc, targetScriptureId) {
    const parsed = GranthaStore.validateExportDoc(doc);
    const report = {
      addedPassages: 0,
      skippedDuplicates: 0,
      addedCommentaries: 0,
      skippedCommentaryDuplicates: 0,
      errors: [],
    };

    // Resolve target scripture
    let targetId = targetScriptureId;
    if (!targetId) {
      if (parsed.scriptures.length === 1) {
        const existing = await this.getScripture(parsed.scriptures[0].id);
        if (existing) targetId = existing.id;
        else {
          const s = await this.createScripture(
            parsed.scriptures[0].title,
            parsed.scriptures[0].subtitle ?? "",
            parsed.scriptures[0].language ?? "sa-Deva"
          );
          targetId = s.id;
        }
      } else {
        throw new Error("Import failed: targetScriptureId required when doc has != 1 scripture");
      }
    }
    const target = await this.getScripture(targetId);
    if (!target) throw new Error(`Import failed: target scripture not found: ${targetId}`);

    // Pre-validate all rows BEFORE writing anything (rollback guarantee)
    for (const p of parsed.passages) {
      if (typeof p.mula !== "string" || !p.mula) {
        report.errors.push("Skipped passage with empty mula");
      }
      if (typeof p.section !== "string" && p.section !== undefined)
        throw new Error("Import failed: corrupt passage.section");
    }
    for (const c of parsed.commentaries) {
      if (typeof c.text !== "string" || !c.text) {
        report.errors.push(`Skipped empty commentary by ${c?.author ?? "?"}`);
      }
    }

    // Existing fingerprints for duplicate detection (exact match preferred;
    // NFC-equivalence also treated as duplicate to avoid double-import, but
    // stored text is NEVER rewritten). `known` tracks pre-existing AND
    // just-added passages so within-doc duplicates remap correctly.
    const existing = await this.listPassages(targetId);
    const known = existing.slice();
    const mulaExact = new Set(existing.map((p) => p.mula));
    const mulaNfc = new Set(existing.map((p) => p.mula.normalize("NFC")));

    const findKnown = (mula) =>
      known.find((p) => p.mula === mula || p.mula.normalize("NFC") === mula.normalize("NFC"));

    // Map source passage index -> target passage id (for commentary remap)
    const passageRemap = new Map();

    for (const src of parsed.passages) {
      if (typeof src.mula !== "string" || !src.mula) continue; // already reported
      if (mulaExact.has(src.mula) || mulaNfc.has(src.mula.normalize("NFC"))) {
        report.skippedDuplicates += 1;
        // remap to passage with same text for commentary attach
        const match = findKnown(src.mula);
        if (match && src.id) passageRemap.set(src.id, match.id);
        continue;
      }
      const added = await this.addPassage(
        targetId,
        src.mula,
        typeof src.section === "string" ? src.section : ""
      );
      if (src.id) passageRemap.set(src.id, added.id);
      known.push(added);
      mulaExact.add(src.mula);
      mulaNfc.add(src.mula.normalize("NFC"));
      report.addedPassages += 1;
    }

    // Commentaries: attach via remap; skip exact duplicates (same author+text on same passage).
    // Sibling lookup is batched once (not one scan per commentary).
    const sibMap = new Map();
    for (const c of await this.adapter.list("commentaries")) {
      const k = c.passageId;
      if (!sibMap.has(k)) sibMap.set(k, []);
      sibMap.get(k).push(c);
    }
    for (const src of parsed.commentaries) {
      if (typeof src.text !== "string" || !src.text) continue;
      const mapped =
        (src.passageId && passageRemap.get(src.passageId)) ??
        known.find((p) => p.id === src.passageId)?.id;
      if (!mapped) {
        report.errors.push(`Orphan commentary by ${src.author ?? "?"} — no target passage`);
        continue;
      }
      const sibs = sibMap.get(mapped) || [];
      const dup = sibs.some((x) => x.author === src.author && x.text === src.text);
      if (dup) {
        report.skippedCommentaryDuplicates += 1;
        continue;
      }
      const addedC = await this.addCommentary(mapped, src.author ?? "Unknown", src.text, src.title ?? "");
      sibs.push(addedC);
      sibMap.set(mapped, sibs);
      report.addedCommentaries += 1;
    }

    return report;
  }

  // ---------- Snapshots (M5: local backup + recovery) ----------
  static snapshotKey(id) {
    return `snap:${id}`;
  }

  /** Save a full exact-state snapshot under kv. Returns the snapshot record. */
  async saveSnapshot(name) {
    const doc = await this.exportDoc();
    const id = `snap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const rec = {
      id: GranthaStore.snapshotKey(id),
      snapId: id,
      name: name || `Snapshot ${new Date().toISOString()}`,
      createdAt: Date.now(),
      counts: {
        scriptures: doc.scriptures.length,
        passages: doc.passages.length,
        commentaries: doc.commentaries.length,
      },
      doc,
    };
    await this.adapter.put("kv", rec);
    return rec;
  }

  async listSnapshots() {
    const rows = await this.adapter.list("kv");
    return rows
      .filter((r) => typeof r.id === "string" && r.id.startsWith("snap:"))
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  async deleteSnapshot(snapId) {
    await this.adapter.del("kv", GranthaStore.snapshotKey(snapId));
  }

  /**
   * Exact restore: replaces ALL data with the snapshot, byte-identical IDs
   * and text (unlike importAppend, which re-ids). Validates first; on any
   * write failure the pre-restore state is rewritten (rollback).
   */
  async restoreSnapshot(snapId) {
    const rec = await this.adapter.get("kv", GranthaStore.snapshotKey(snapId));
    if (!rec) throw new Error(`Snapshot not found: ${snapId}`);
    const doc = GranthaStore.validateExportDoc(rec.doc);
    const backup = await this.exportDoc();
    const stores = ["scriptures", "passages", "commentaries"];
    try {
      for (const s of stores) await this.adapter.clear(s);
      for (const s of stores) {
        for (const r of doc[s]) await this.adapter.put(s, r);
      }
    } catch (err) {
      for (const s of stores) await this.adapter.clear(s);
      for (const s of stores) {
        for (const r of backup[s]) await this.adapter.put(s, r);
      }
      throw new Error(`Restore failed, previous state reinstated: ${err.message || err}`);
    }
    this._ordCache.clear();
    return { scriptures: doc.scriptures.length, passages: doc.passages.length, commentaries: doc.commentaries.length };
  }

  // ---------- Integrity (M5: verify + repair) ----------
  async verifyIntegrity() {
    const scriptures = await this.adapter.list("scriptures");
    const passages = await this.adapter.list("passages");
    const commentaries = await this.adapter.list("commentaries");
    const sIds = new Set(scriptures.map((s) => s.id));
    const pIds = new Set(passages.map((p) => p.id));
    const orphanCommentaries = commentaries.filter((c) => !pIds.has(c.passageId)).map((c) => c.id);
    const orphanPassages = passages.filter((p) => !sIds.has(p.scriptureId)).map((p) => p.id);
    const emptyMula = passages.filter((p) => !p.mula).map((p) => p.id);
    const seen = new Map();
    const duplicateOrdinals = [];
    for (const p of passages) {
      const k = `${p.scriptureId}:${p.ordinal}`;
      if (seen.has(k)) duplicateOrdinals.push(p.id);
      else seen.set(k, p.id);
    }
    return { orphanCommentaries, orphanPassages, emptyMula, duplicateOrdinals };
  }

  /** Repair: drop orphan rows (reported, never silent). Returns what was removed. */
  async repairIntegrity() {
    const rep = await this.verifyIntegrity();
    for (const id of rep.orphanCommentaries) await this.adapter.del("commentaries", id);
    for (const id of rep.orphanPassages) await this.adapter.del("passages", id);
    this._ordCache.clear();
    return { removedCommentaries: rep.orphanCommentaries.length, removedPassages: rep.orphanPassages.length };
  }
}
