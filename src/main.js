import { GranthaStore } from "./lib/store.js";
import { IndexedDBAdapter, MemoryAdapter, SupabaseAdapter } from "./lib/storage.js";
import { SEED_TITLE, SEED_SUBTITLE, SEED_PASSAGES } from "./lib/seed.js";
import { devaToIast } from "./lib/iast.js";
import { searchFold } from "./lib/unicode.js";
import { parseCorpus, csvToDoc } from "./lib/corpus-parser.js";
import { buildIndex, search, highlight, tokenize } from "./lib/search.js";
import { snapshotStores, diffSnapshots, summarizeDiff, pushLocal, pullRemote, syncBidirectional } from "./lib/sync.js";
import { can, validRole } from "./lib/rbac.js";

const $ = (id) => document.getElementById(id);

function hasIndexedDB() {
  try {
    return typeof indexedDB !== "undefined";
  } catch {
    return false;
  }
}

function makeAdapter() {
  return hasIndexedDB() ? new IndexedDBAdapter() : new MemoryAdapter();
}

const store = new GranthaStore(makeAdapter());

// ---------- persisted UI state ----------
const UI_KEY = "gk:ui:v1";
function loadUI() {
  try {
    const raw = localStorage.getItem(UI_KEY);
    if (raw) return { expanded: {}, theme: "dark", script: "deva", fontSize: 19, lineHeight: 2, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { expanded: {}, theme: "dark", script: "deva", fontSize: 19, lineHeight: 2 };
}
const ui = loadUI();
function saveUI() {
  try {
    localStorage.setItem(UI_KEY, JSON.stringify(ui));
  } catch {
    /* ignore */
  }
}

// ---------- roles (M7: UX-level gating; enforcement via Supabase RLS) ----------
const ROLE_KEY = "gk:role";
let role = "admin";
try {
  role = validRole(localStorage.getItem(ROLE_KEY) || "admin");
} catch {
  /* ignore */
}
const canDo = (action) => can(role, action);

function applyRole() {
  document.body.dataset.role = role;
  $("role").value = role;
  $("newScriptureRow").hidden = !canDo("create");
  $("appendPanel").hidden = !canDo("append");
  $("wizardBtn").hidden = !canDo("import");
  $("quickImportLabel").hidden = !canDo("import");
  $("snapBtn").hidden = !canDo("snapshot");
  $("cloudPanel").hidden = !canDo("sync");
}

function renderText(s) {
  return ui.script === "iast" ? devaToIast(s) : s;
}

function withTransition(fn) {
  if (document.startViewTransition) document.startViewTransition(fn);
  else fn();
}

function say(msg) {
  $("status").textContent = msg;
}

// ---------- seed ----------
async function ensureSeed() {
  const all = await store.listScriptures();
  const found = all.find((s) => s.title === SEED_TITLE);
  if (found) return found;
  const s = await store.createScripture(SEED_TITLE, SEED_SUBTITLE);
  for (const p of SEED_PASSAGES) {
    const added = await store.addPassage(s.id, p.mula, p.section);
    for (const c of p.commentaries) {
      await store.addCommentary(added.id, c.author, c.text, c.title);
    }
  }
  return s;
}

// ---------- rendering ----------
let current;
let focusIdx = 0;

async function refreshSidebar() {
  const list = await store.listScriptures();
  const box = $("scriptureList");
  box.innerHTML = "";
  for (const s of list) {
    const b = document.createElement("button");
    b.className = "btn s-item";
    b.textContent = s.title;
    b.setAttribute("aria-current", s.id === (current && current.id) ? "true" : "false");
    b.onclick = () => selectScripture(s.id);
    box.appendChild(b);
  }
}

async function selectScripture(id) {
  current = await store.getScripture(id);
  ui.selectedId = id;
  saveUI();
  focusIdx = 0;
  await refreshSidebar();
  await renderReader();
}

async function renderReader() {
  if (!current) return;
  const head = document.createElement("div");
  head.className = "panel";
  const h = document.createElement("h1");
  h.style.margin = "0";
  h.textContent = current.title;
  const sub = document.createElement("div");
  sub.className = "meta";
  sub.textContent = current.subtitle || "";
  head.append(h, sub);
  $("readerHead").innerHTML = "";
  $("readerHead").appendChild(head);

  const passages = await store.listPassages(current.id);
  const allTikas = await store.listCommentariesForScripture(current.id);
  const tikasByPid = new Map();
  for (const c of allTikas) {
    if (!tikasByPid.has(c.passageId)) tikasByPid.set(c.passageId, []);
    tikasByPid.get(c.passageId).push(c);
  }

  const q = $("search").value.trim();
  const scope = $("scope").value;
  const author = $("author").value.trim();
  let ordered = passages.map((p) => ({ p, hits: null }));
  if (q) {
    const idx = getSearchIndex(current.id, passages, allTikas);
    const results = search(idx, q, { scope, author });
    const byPid = new Map(results.map((r) => [r.pid, r]));
    ordered = results
      .map((r) => ({ p: passages.find((x) => x.id === r.pid), hits: r.hits }))
      .filter((o) => o.p);
    const info = document.createElement("div");
    info.className = "meta";
    info.textContent = `${results.length} result${results.length === 1 ? "" : "s"} · scope ${scope}${author ? ` · author ${author}` : ""}`;
    head.appendChild(info);
  }
  const box = $("passages");
  box.innerHTML = "";

  ordered.forEach(({ p, hits }, idx) => {
    const card = document.createElement("article");
    card.className = "passage";
    card.tabIndex = 0;
    card.dataset.idx = String(idx);

    const meta = document.createElement("div");
    meta.className = "meta";
    let metaText = `${p.section || "Mūla"} · ${p.ordinal} · ${p.id}`;
    if (hits) {
      const au = hits.authors.length ? ` · ${hits.authors.join(", ")}` : "";
      metaText += ` · ✓ mūla ×${hits.mula} · ṭīkā ×${hits.tika}${au}`;
    }
    meta.textContent = metaText;
    const mula = document.createElement("div");
    mula.className = "mula";
    if (q) mula.innerHTML = highlight(renderText(p.mula), q);
    else mula.textContent = renderText(p.mula);

    const tikas = document.createElement("div");
    tikas.className = "tikas";

    renderTikas(p, tikas, q, tikasByPid.get(p.id) || []);

    const actions = document.createElement("div");
    actions.className = "row";
    actions.style.marginTop = ".5rem";
    const focus = document.createElement("button");
    focus.className = "btn";
    focus.textContent = "⤢ Focus ṭīkā";
    focus.setAttribute("aria-label", `Open commentary drawer for passage ${p.ordinal}`);
    focus.onclick = () => openDrawer(p.id);
    actions.appendChild(focus);

    card.append(meta, mula, tikas, actions);
    box.appendChild(card);
  });
}

/** Memoized per-render search index (keyed by content counts). */
let searchCache = { key: "", idx: null };
function getSearchIndex(scriptureId, passages, tikas) {
  const key = `${scriptureId}:${passages.length}:${tikas.length}`;
  if (searchCache.key !== key) {
    searchCache = { key, idx: buildIndex(passages, tikas) };
  }
  return searchCache.idx;
}

async function warmSearch() {
  try {
    if (!current) return;
    const passages = await store.listPassages(current.id);
    const tikas = await store.listCommentariesForScripture(current.id);
    getSearchIndex(current.id, passages, tikas);
  } catch {
    /* background best-effort */
  }
}

/** AND-semantics fold match of one tika against query tokens (for auto-expand). */
function tikaMatches(c, qFoldToks) {
  if (qFoldToks.length === 0) return false;
  const hay = tokenize(`${c.author} ${c.title || ""} ${c.text}`).map((t) => t.fold);
  // cross-script: also fold transliterated keys via indexKeys? keep native+latin both:
  return qFoldToks.every((qt) => hay.some((t) => t.startsWith(qt)));
}

async function renderTikas(p, tikas, q, list) {
  const qFoldToks = q ? tokenize(q).map((t) => t.fold) : [];
  for (const c of list) {
    const matched = q ? tikaMatches(c, qFoldToks) : false;
    const open = q ? matched : (ui.expanded[c.id] ?? true);
    const t = document.createElement("div");
    t.className = "tika";
    t.dataset.open = String(open);
    const hb = document.createElement("button");
    hb.className = "head";
    hb.setAttribute("aria-expanded", String(open));
    const label = document.createElement("span");
    label.textContent = `${c.author}${c.title ? " — " + c.title : ""}`;
    const chev = document.createElement("span");
    chev.className = "chev";
    chev.textContent = open ? "▾ collapse" : "▸ expand";
    hb.append(label, chev);
    hb.onclick = () =>
      withTransition(() => {
        ui.expanded[c.id] = !(ui.expanded[c.id] ?? true);
        saveUI();
        t.dataset.open = String(ui.expanded[c.id]);
        hb.setAttribute("aria-expanded", String(ui.expanded[c.id]));
        chev.textContent = ui.expanded[c.id] ? "▾ collapse" : "▸ expand";
      });
    const body = document.createElement("div");
    body.className = "body";
    const span = document.createElement("div");
    if (q) span.innerHTML = highlight(renderText(c.text), q);
    else span.textContent = renderText(c.text);
    body.appendChild(span);
    if (canDo("edit")) {
      const tools = document.createElement("div");
      tools.className = "row";
    const edit = document.createElement("button");
    edit.className = "btn";
    edit.textContent = "Edit";
    edit.onclick = async () => {
      const next = prompt(`Edit commentary — ${c.author} (stored verbatim):`, c.text);
      if (next === null) return;
      if (!next) {
        say("Commentary text must not be empty — not saved.");
        return;
      }
      await store.updateCommentary(c.id, { text: next });
      await renderReader();
      say("Commentary updated; siblings untouched.");
    };
    const del = document.createElement("button");
    del.className = "btn";
    del.textContent = "Delete";
    del.onclick = async () => {
      if (!confirm(`Delete ONLY this commentary by ${c.author}? Others are unaffected.`)) return;
      await store.deleteCommentary(c.id);
      delete ui.expanded[c.id];
      saveUI();
      await renderReader();
      say("Commentary deleted independently.");
    };
    tools.append(edit, del);
    body.appendChild(tools);
    }
    t.append(hb, body);
    // swipe: left collapses, right expands (mobile ergonomics)
    let tx0 = 0;
    t.addEventListener("touchstart", (e) => { tx0 = e.touches[0].clientX; }, { passive: true });
    t.addEventListener("touchend", (e) => {
      const dx = e.changedTouches[0].clientX - tx0;
      if (dx < -40 && ui.expanded[c.id]) hb.click();
      else if (dx > 40 && !ui.expanded[c.id]) hb.click();
    });
    tikas.appendChild(t);
  }

  // add-commentary form (independent per passage; editors+)
  if (canDo("comment")) {
    const form = document.createElement("div");
    form.className = "row";
    const author = document.createElement("input");
    author.type = "text";
    author.placeholder = "Commentator — e.g. Guptavatī";
    author.setAttribute("aria-label", `Commentator for passage ${p.ordinal}`);
    const text = document.createElement("input");
    text.type = "text";
    text.placeholder = "Commentary text (exact)";
    text.style.flex = "1";
    text.setAttribute("aria-label", `Commentary text for passage ${p.ordinal}`);
    const add = document.createElement("button");
    add.className = "btn";
    add.textContent = "+ Commentary";
    add.onclick = async () => {
      try {
        if (!author.value.trim() || !text.value) {
          say("Author + text required.");
          return;
        }
        await store.addCommentary(p.id, author.value.trim(), text.value);
        await renderReader();
        say(`Commentary attached to passage ${p.ordinal}; others unchanged.`);
      } catch (e) {
        say(String(e.message || e));
      }
    };
    form.append(author, text, add);
    tikas.appendChild(form);
  }
}

// ---------- commentary drawer (mobile + desktop slide-over) ----------
let drawerPassageId = null;
let drawerReturnFocus = null;

async function openDrawer(passageId) {
  drawerPassageId = passageId;
  drawerReturnFocus = document.activeElement;
  const list = await store.listCommentaries(passageId);
  const passages = current ? await store.listPassages(current.id) : [];
  const p = passages.find((x) => x.id === passageId);
  $("drawerMeta").textContent = p ? `${p.section || "Mūla"} · ${p.ordinal}` : passageId;
  const sel = $("drawerSelect");
  sel.innerHTML = "";
  if (list.length === 0) {
    const o = document.createElement("option");
    o.textContent = "(no commentaries yet)";
    sel.appendChild(o);
    $("drawerBody").textContent = "Attach a ṭīkā from the reader card first.";
  } else {
    for (const c of list) {
      const o = document.createElement("option");
      o.value = c.id;
      o.textContent = `${c.author}${c.title ? " — " + c.title : ""}`;
      sel.appendChild(o);
    }
    showDrawerTika(list[0].id, list);
  }
  $("overlay").hidden = false;
  $("drawer").hidden = false;
  $("drawerClose").focus();
  sel.onchange = async () => {
    const all = await store.listCommentaries(drawerPassageId);
    showDrawerTika(sel.value, all);
  };
}

function showDrawerTika(id, list) {
  const c = (list || []).find((x) => x.id === id);
  $("drawerBody").textContent = c ? renderText(c.text) : "";
}

function closeDrawer() {
  drawerPassageId = null;
  $("overlay").hidden = true;
  $("drawer").hidden = true;
  if (drawerReturnFocus && drawerReturnFocus.focus) drawerReturnFocus.focus();
  drawerReturnFocus = null;
}

// ---------- import wizard (paste → preview diff → confirm) ----------
let wizardDoc = null;

function detectFormat(text, forced) {
  if (forced && forced !== "auto") return forced;
  const t = text.trim();
  if (t.startsWith("{")) return "json";
  const first = t.split("\n")[0] || "";
  if (/mula/i.test(first) && first.includes(",")) return "csv";
  return "corpus";
}

function parseWizardInput(text, forced) {
  const fmt = detectFormat(text, forced);
  if (fmt === "json") {
    const doc = JSON.parse(text);
    return { doc: GranthaStore.validateExportDoc(doc), format: "json" };
  }
  if (fmt === "csv") return { doc: csvToDoc(text), format: "csv" };
  return { doc: parseCorpus(text), format: "corpus" };
}

function wizardStep(n) {
  for (const s of document.querySelectorAll("#wizard .step")) {
    if (s.dataset.s === String(n)) s.setAttribute("aria-current", "step");
    else s.removeAttribute("aria-current");
  }
  $("wStep1").hidden = n !== 1;
  $("wStep2").hidden = n !== 2;
  $("wStep3").hidden = n !== 3;
}

async function wizardPreview() {
  const text = $("wInput").value;
  if (!text.trim()) {
    $("wPreview").textContent = "Paste or upload source text first.";
    return;
  }
  const forced = (document.querySelector('input[name="wfmt"]:checked') || {}).value || "auto";
  try {
    const { doc, format } = parseWizardInput(text, forced);
    wizardDoc = doc;
    const existing = current ? await store.listPassages(current.id) : [];
    const have = new Set(existing.map((p) => p.mula));
    const haveNfc = new Set(existing.map((p) => p.mula.normalize("NFC")));
    let dup = 0;
    for (const p of doc.passages) {
      if (have.has(p.mula) || haveNfc.has(p.mula.normalize("NFC"))) dup++;
    }
    const authors = {};
    for (const c of doc.commentaries) authors[c.author] = (authors[c.author] || 0) + 1;
    const topAuthors = Object.entries(authors).sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([a, n]) => `  ${a}: ${n}`).join("\n");
    const samples = doc.passages.slice(0, 3)
      .map((p) => `  §${p.section || "—"} #${p.ordinal}: ${p.mula.slice(0, 60).replace(/\n/g, " / ")}…`).join("\n");
    const errs = (doc.stats && doc.stats.errors) ? doc.stats.errors.slice(0, 5).join("\n") : "";
    $("wPreview").textContent =
      `Format: ${format} → target: ${current ? current.title : "(none)"}\n` +
      `Passages: ${doc.passages.length} (${doc.passages.length - dup} new, ${dup} duplicates skipped)\n` +
      `Commentaries: ${doc.commentaries.length}\nTop authors:\n${topAuthors || "  (none)"}\n` +
      `Samples:\n${samples || "  (none)"}` +
      (errs ? `\nNotes:\n${errs}` : "") +
      `\nNothing has been written yet — Confirm to append.`;
    wizardStep(2);
  } catch (e) {
    $("wPreview").textContent = `Parse failed safely (nothing written): ${e.message || e}`;
    wizardStep(2);
    wizardDoc = null;
  }
}

async function wizardConfirm() {
  if (!wizardDoc || !current) return;
  try {
    await autoSnapshot("pre-wizard-import");
    const rep = await store.importAppend(wizardDoc, current.id);
    $("wReport").textContent =
      `Import complete into “${current.title}”:\n` +
      `  +${rep.addedPassages} passages (${rep.skippedDuplicates} duplicates skipped)\n` +
      `  +${rep.addedCommentaries} commentaries (${rep.skippedCommentaryDuplicates} dup-skipped)` +
      (rep.errors.length ? `\n  Notes: ${rep.errors.slice(0, 8).join("; ")}` : "");
    wizardStep(3);
    await renderReader();
  } catch (e) {
    $("wReport").textContent = `Import failed safely (nothing written): ${e.message || e}`;
    wizardStep(3);
  }
}

// ---------- snapshots + recovery (M5) ----------
async function autoSnapshot(reason) {
  const rec = await store.saveSnapshot(`auto: ${reason}`);
  // prune auto snapshots to the 5 newest
  const autos = (await store.listSnapshots()).filter((s) => s.name.startsWith("auto: "));
  for (const old of autos.slice(5)) await store.deleteSnapshot(old.snapId);
  await refreshSnapshots();
  return rec;
}

async function refreshSnapshots() {
  const box = $("snapshotList");
  box.innerHTML = "";
  const list = await store.listSnapshots();
  if (list.length === 0) {
    box.innerHTML = '<div class="status">No snapshots yet.</div>';
    return;
  }
  for (const s of list.slice(0, 8)) {
    const row = document.createElement("div");
    row.className = "row";
    row.style.margin = ".3rem 0";
    const label = document.createElement("span");
    label.className = "status";
    label.textContent = `${s.name} (${s.counts.passages}p/${s.counts.commentaries}t)`;
    label.style.flex = "1";
    const rs = document.createElement("button");
    rs.className = "btn";
    rs.textContent = "Restore";
    rs.disabled = !canDo("restore");
    rs.title = canDo("restore") ? "Replace all data with this snapshot" : "Admin only";
    rs.onclick = async () => {
      if (!confirm(`Restore “${s.name}”? Current state is snapshotted first.`)) return;
      await autoSnapshot("pre-restore");
      const rep = await store.restoreSnapshot(s.snapId);
      say(`Restored: ${rep.passages} passages, ${rep.commentaries} commentaries.`);
      await refreshSidebar();
      await renderReader();
      await refreshSnapshots();
    };
    const del = document.createElement("button");
    del.className = "btn";
    del.textContent = "✕";
    del.disabled = !canDo("deleteSnapshot");
    del.setAttribute("aria-label", `Delete snapshot ${s.name}`);
    del.onclick = async () => {
      await store.deleteSnapshot(s.snapId);
      await refreshSnapshots();
    };
    row.append(label, rs, del);
    box.appendChild(row);
  }
}

async function maybeRecoveryBanner() {
  const rep = await store.verifyIntegrity();
  const n = rep.orphanCommentaries.length + rep.orphanPassages.length + rep.emptyMula.length + rep.duplicateOrdinals.length;
  if (n === 0) return;
  const banner = document.createElement("div");
  banner.className = "panel";
  banner.style.borderColor = "var(--accent)";
  banner.innerHTML = "";
  const t = document.createElement("strong");
  t.textContent = `Data recovery: ${n} issue(s) found `;
  const d = document.createElement("span");
  d.className = "status";
  d.textContent = `(orphan ṭīkās ${rep.orphanCommentaries.length}, orphan passages ${rep.orphanPassages.length}, empty mūla ${rep.emptyMula.length}, dup ordinals ${rep.duplicateOrdinals.length})`;
  const row = document.createElement("div");
  row.className = "row";
  const fix = document.createElement("button");
  fix.className = "btn primary";
  fix.textContent = "Snapshot + repair";
  fix.disabled = !canDo("repair");
  fix.title = canDo("repair") ? "Remove orphan rows (pre-repair snapshot kept)" : "Admin only";
  fix.onclick = async () => {
    await autoSnapshot("pre-repair");
    const r = await store.repairIntegrity();
    say(`Repaired: removed ${r.removedCommentaries} orphan ṭīkās, ${r.removedPassages} orphan passages (pre-repair snapshot kept).`);
    banner.remove();
    await renderReader();
  };
  const dismiss = document.createElement("button");
  dismiss.className = "btn";
  dismiss.textContent = "Dismiss";
  dismiss.onclick = () => banner.remove();
  row.append(fix, dismiss);
  banner.append(t, d, row);
  $("reader").prepend(banner);
}

// ---------- events ----------
function applyPrefs() {
  document.documentElement.dataset.theme = ui.theme;
  $("theme").value = ui.theme;
  $("script").value = ui.script;
  $("fontsize").value = String(ui.fontSize);
  $("lineheight").value = String(ui.lineHeight);
  document.documentElement.style.setProperty("--font-size", `${ui.fontSize}px`);
  document.documentElement.style.setProperty("--line-height", String(ui.lineHeight));
}

async function boot() {
  applyPrefs();
  const seed = await ensureSeed();
  if (ui.selectedId) current = (await store.getScripture(ui.selectedId)) || seed;
  else current = seed;
  ui.selectedId = current.id;
  saveUI();
  await refreshSidebar();
  await renderReader();

  $("createBtn").onclick = async () => {
    const t = $("newTitle").value.trim();
    if (!t) {
      say("Title required.");
      return;
    }
    const s = await store.createScripture(t);
    $("newTitle").value = "";
    await selectScripture(s.id);
    say(`Scripture created: ${s.title}`);
  };

  $("addPassageBtn").onclick = async () => {
    if (!current) return;
    const mula = $("newMula").value;
    const section = $("newSection").value.trim();
    // NOTE: no trim/normalize of mula — exact paste persisted
    if (!mula) {
      say("Paste exact mūla text first — empty text rejected.");
      return;
    }
    try {
      const p = await store.addPassage(current.id, mula, section);
      $("newMula").value = "";
      await renderReader();
      say(`Appended passage ${p.ordinal} — line mappings intact, no duplicates created.`);
    } catch (e) {
      say(String(e.message || e));
    }
  };

  $("theme").onchange = (e) => {
    ui.theme = e.target.value;
    saveUI();
    withTransition(applyPrefs);
  };
  $("script").onchange = (e) => {
    ui.script = e.target.value;
    saveUI();
    withTransition(() => {
      applyPrefs();
      renderReader();
    });
  };
  $("fontsize").oninput = (e) => {
    ui.fontSize = Number(e.target.value);
    saveUI();
    applyPrefs();
  };
  $("lineheight").oninput = (e) => {
    ui.lineHeight = Number(e.target.value);
    saveUI();
    applyPrefs();
  };
  $("search").oninput = () => renderReader();
  $("scope").onchange = () => renderReader();
  $("author").oninput = () => renderReader();
  $("role").onchange = (e) => {
    role = validRole(e.target.value);
    try {
      localStorage.setItem(ROLE_KEY, role);
    } catch {
      /* ignore */
    }
    applyRole();
    say(`Role: ${role}.`);
    void renderReader();
    void refreshSnapshots();
  };

  // wizard + drawer wiring
  $("wizardBtn").onclick = () => {
    if (!canDo("import")) return;
    wizardDoc = null;
    wizardStep(1);
    $("wizard").showModal();
    $("wInput").focus();
  };
  $("wToPreview").onclick = () => void wizardPreview();
  $("wBack").onclick = () => wizardStep(1);
  $("wConfirm").onclick = () => void wizardConfirm();
  $("wClose").onclick = () => $("wizard").close();
  $("wFile").onchange = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) $("wInput").value = await f.text();
  };
  $("drawerClose").onclick = () => closeDrawer();
  $("overlay").onclick = () => closeDrawer();
  let dy0 = 0;
  $("drawer").addEventListener("touchstart", (e) => { dy0 = e.touches[0].clientY; }, { passive: true });
  $("drawer").addEventListener("touchend", (e) => {
    if (e.changedTouches[0].clientY - dy0 > 90) closeDrawer();
  });

  $("exportBtn").onclick = async () => {
    if (!current) return;
    const doc = await store.exportDoc(current.id);
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `granthakosha-${current.title.replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  $("importFile").onchange = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f || !current) return;
    try {
      const doc = JSON.parse(await f.text());
      await autoSnapshot(`pre-import ${f.name}`);
      const rep = await store.importAppend(doc, current.id);
      $("importStatus").textContent =
        `Import: +${rep.addedPassages} passages, ${rep.skippedDuplicates} dup-skipped, +${rep.addedCommentaries} ṭīkās. ${rep.errors.join("; ")}`;
      await renderReader();
    } catch (err) {
      $("importStatus").textContent = `Import failed safely (nothing written): ${String(err.message || err)}`;
    }
  };

  // snapshots (M5) + recovery banner
  $("snapBtn").onclick = async () => {
    const rec = await store.saveSnapshot(`manual ${new Date().toLocaleString()}`);
    say(`Snapshot saved: ${rec.name} (${rec.counts.passages} passages).`);
    await refreshSnapshots();
  };
  await refreshSnapshots();
  await maybeRecoveryBanner();
  applyRole();
  // warm the search index in the background (full corpus ~1.5s, memoized after)
  setTimeout(() => void warmSearch(), 100);

  // ---------- cloud sync (M6) ----------
  const CLOUD_KEY = "gk:cloud";
  const cloudCreds = () => {
    try {
      return JSON.parse(localStorage.getItem(CLOUD_KEY) || "{}");
    } catch {
      return {};
    }
  };
  const saySync = (m) => {
    $("syncStatus").textContent = m;
  };
  const makeRemote = () => {
    const url = $("cloudUrl").value.trim();
    const key = $("cloudKey").value;
    if (!url || !key) throw new Error("Enter Supabase URL + anon key first.");
    try {
      localStorage.setItem(CLOUD_KEY, JSON.stringify({ url }));
    } catch {
      /* ignore */
    }
    return new SupabaseAdapter({ url, key });
  };
  const savedCloud = cloudCreds();
  if (savedCloud.url) $("cloudUrl").value = savedCloud.url;
  $("cloudTest").onclick = async () => {
    try {
      const remote = makeRemote();
      const n = (await remote.list("scriptures")).length;
      saySync(`Connected. Remote holds ${n} scripture(s). Local is authoritative until you Push.`);
    } catch (e) {
      saySync(`Connection failed: ${String(e.message || e)}`);
    }
  };
  $("cloudDry").onclick = async () => {
    try {
      const remote = makeRemote();
      const d = diffSnapshots(await snapshotStores(store.adapter), await snapshotStores(remote));
      const s = summarizeDiff(d);
      saySync(`Dry-run (nothing written): push ${s.push} (incl. ${s.onlyLocal} new), pull ${s.pull} (incl. ${s.onlyRemote} new), conflicts ${s.conflicts} (kept local).`);
    } catch (e) {
      saySync(`Dry-run failed: ${String(e.message || e)}`);
    }
  };
  $("cloudPush").onclick = async () => {
    try {
      const remote = makeRemote();
      await autoSnapshot("pre-push");
      const r = await pushLocal(store.adapter, remote);
      saySync(`Pushed ${r.pushed} record(s); ${r.conflictsKeptLocal} conflict(s) kept local.`);
    } catch (e) {
      saySync(`Push failed: ${String(e.message || e)}`);
    }
  };
  $("cloudPull").onclick = async () => {
    try {
      const remote = makeRemote();
      await autoSnapshot("pre-pull");
      const r = await pullRemote(store.adapter, remote);
      saySync(`Pulled ${r.pulled} record(s) into local.`);
      searchCache.key = "";
      await refreshSidebar();
      await renderReader();
    } catch (e) {
      saySync(`Pull failed: ${String(e.message || e)}`);
    }
  };
  $("cloudSync").onclick = async () => {
    try {
      const remote = makeRemote();
      await autoSnapshot("pre-sync");
      const r = await syncBidirectional(store.adapter, remote);
      saySync(`Sync: ↑${r.pushed} ↓${r.pulled}, ${r.conflicts} conflict(s) kept local.`);
      searchCache.key = "";
      await refreshSidebar();
      await renderReader();
    } catch (e) {
      saySync(`Sync failed: ${String(e.message || e)}`);
    }
  };

  // keyboard shortcuts (desktop rapid browsing)
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("drawer").hidden) {
      closeDrawer();
      return;
    }
    const tag = e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
      if (e.key === "Escape") e.target.blur();
      return;
    }
    const cards = [...document.querySelectorAll(".passage")];
    if (e.key === "j" || e.key === "k") {
      focusIdx = e.key === "j" ? Math.min(focusIdx + 1, cards.length - 1) : Math.max(focusIdx - 1, 0);
      if (cards[focusIdx]) {
        cards[focusIdx].focus();
        cards[focusIdx].scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    } else if (e.key === "o") {
      const btn = cards[focusIdx] && cards[focusIdx].querySelector(".tika > button.head");
      if (btn) btn.click();
    } else if (e.key === "/") {
      e.preventDefault();
      $("search").focus();
    } else if (e.key === "t") {
      ui.theme = ui.theme === "dark" ? "light" : ui.theme === "light" ? "sepia" : "dark";
      saveUI();
      withTransition(applyPrefs);
    }
  });

  // PWA service worker (offline-first app shell; data lives in IndexedDB)
  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register("sw.js");
    } catch {
      /* offline dev — ignore */
    }
  }
}

boot();
