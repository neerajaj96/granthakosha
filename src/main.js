import { GranthaStore } from "./lib/store.js";
import { IndexedDBAdapter, MemoryAdapter } from "./lib/storage.js";
import { SEED_TITLE, SEED_SUBTITLE, SEED_PASSAGES } from "./lib/seed.js";
import { devaToIast } from "./lib/iast.js";
import { searchFold } from "./lib/unicode.js";
import { buildIndex, search, highlight, tokenize } from "./lib/search.js";
import { renderText as renderTextLib, tikaDisplayText as tikaDisplayLib } from "./lib/display.js";
import { transliterateText, SCRIPTS } from "./lib/transliterate.js";
import { CONCEPTS } from "./lib/concepts.js";

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
  const def = { expanded: {}, theme: "dark", script: "deva", lang: "sa", fontSize: 19, lineHeight: 2, ttsRate: 1 };
  try {
    const raw = localStorage.getItem(UI_KEY);
    if (raw) return { ...def, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return def;
}
const ui = loadUI();
function saveUI() {
  try {
    localStorage.setItem(UI_KEY, JSON.stringify(ui));
  } catch {
    /* ignore */
  }
}

// ---------- plain viewing mode: no roles, no editing UI.
// Content is managed by the maintainer (agent); readers only read/search.

function renderText(s, en) {
  return renderTextLib(s, en, ui.lang, ui.script);
}

function tikaDisplayText(c) {
  return tikaDisplayLib(c, ui.lang, ui.script);
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
    const added = await store.addPassage(s.id, p.mula, p.section, { en: p.en || "", primaryEn: p.primaryEn || "" });
    for (const c of p.commentaries) {
      await store.addCommentary(added.id, c.author, c.text, c.title, { simpleEn: c.simpleEn || "" });
    }
  }
  return s;
}

// Seed the Tantrāloka volume from the bundled parsed JSON (first run only).
async function ensureTantraloka() {
  const all = await store.listScriptures();
  if (all.some((s) => s.title === "Tantrāloka, Ch. 1")) return;
  try {
    const res = await fetch("corpus/tantraloka-ch1.json");
    if (!res.ok) return;
    const doc = await res.json();
    // single-scripture doc → importAppend creates it
    await store.importAppend(doc);
    say("Tantrāloka Ch. 1 loaded.");
  } catch {
    /* offline/file mode — reader works with bundled seed */
  }
}

// Migrate very old seed installs titled exactly "Durgāsaptaśatī".
async function migrateSeedTitle() {
  const all = await store.listScriptures();
  for (const s of all) {
    if (s.title !== "Durgāsaptaśatī") continue;
    const ps = await store.listPassages(s.id);
    if (ps.length <= 10) {
      s.title = "Durgāsaptaśatī · Seed Verses";
      s.subtitle = "Six-verse starter selection (the complete text loads separately)";
      s.updatedAt = Date.now();
      await store.adapter.put("scriptures", s);
    }
  }
}

// Load the complete Durgāsaptaśatī (4 MB) on demand — user-initiated.
async function loadCompleteCorpus(btn) {
  const all = await store.listScriptures();
  const existing = all.find((s) => s.title === "Durgāsaptaśatī" && s.id);
  if (existing) {
    const n = (await store.listPassages(existing.id)).length;
    if (n > 100) {
      await selectScripture(existing.id);
      say("Complete text already loaded.");
      return;
    }
  }
  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Loading…";
    }
    say("Loading complete Durgāsaptaśatī (one-time, ~4 MB)…");
    const res = await fetch("corpus/durgasaptashati.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const doc = await res.json();
    const rep = await store.importAppend(doc);
    searchCache.key = "";
    await refreshSidebar();
    const now = await store.listScriptures();
    const full = now.find((s) => s.title === "Durgāsaptaśatī");
    if (full) await selectScripture(full.id);
    say(`Complete text loaded: +${rep.addedPassages} passages, +${rep.addedCommentaries} ṭīkās.`);
  } catch (e) {
    say(`Load failed: ${String(e.message || e)}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Load complete Durgāsaptaśatī";
    }
  }
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
  const nPrimary = passages.filter((p) => p.primaryEn).length;
  const cov = document.createElement("div");
  cov.className = "meta";
  cov.textContent = `GranthaKosha explains: ${nPrimary}/${passages.length} verses · ${ui.lang === "en" ? "Simple English" : "संस्कृतम्"}`;
  head.appendChild(cov);

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
    const mulaShown = renderText(p.mula, p.en);
    if (q) mula.innerHTML = highlight(mulaShown, q);
    else mula.textContent = mulaShown;

    // PRIMARY: our combined explanation, right below the verse
    let primary = null;
    if (p.primaryEn) {
      primary = document.createElement("div");
      primary.className = "tika primary";
      primary.dataset.open = "true";
      const hb = document.createElement("button");
      hb.className = "head";
      hb.setAttribute("aria-expanded", "true");
      const label = document.createElement("span");
      label.textContent = "GranthaKosha explains · combined";
      const chev = document.createElement("span");
      chev.className = "chev";
      chev.textContent = "▾";
      hb.append(label, chev);
      hb.onclick = () => {
        const open = primary.dataset.open !== "false";
        primary.dataset.open = String(!open);
        hb.setAttribute("aria-expanded", String(!open));
        chev.textContent = !open ? "▾" : "▸";
      };
      const pbody = document.createElement("div");
      pbody.className = "body";
      if (q) pbody.innerHTML = highlight(p.primaryEn, q);
      else pbody.textContent = p.primaryEn;
      primary.append(hb, pbody);
    }

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

    const mark = document.createElement("button");
    mark.className = "btn";
    const paintMark = () => { mark.textContent = isMarked(p.id) ? "★ Saved" : "☆ Save"; };
    paintMark();
    mark.setAttribute("aria-label", `Bookmark passage ${p.ordinal}`);
    mark.onclick = () => {
      toggleMark(p.id);
      if (study[p.id]) {
        study[p.id].label = `${current ? current.title : ""} §${p.section || "—"} #${p.ordinal}`;
        study[p.id].ref = { title: current ? current.title : "", ordinal: p.ordinal };
      }
      saveStudy();
      paintMark();
      void refreshStudy();
    };
    actions.appendChild(mark);

    const speak = document.createElement("button");
    speak.className = "btn";
    speak.textContent = "🔊 Listen";
    speak.setAttribute("aria-label", `Listen to passage ${p.ordinal}`);
    speak.onclick = () => speakPassage(p, mula);
    actions.appendChild(speak);

    const copy = document.createElement("button");
    copy.className = "btn";
    copy.textContent = "⧉ Copy";
    copy.setAttribute("aria-label", `Copy passage ${p.ordinal} with translation and citation`);
    copy.onclick = () => copyPassage(p);
    actions.appendChild(copy);

    const padas = document.createElement("button");
    padas.className = "btn";
    padas.textContent = "Padas";
    padas.setAttribute("aria-expanded", "false");
    padas.setAttribute("aria-label", `Show word tokens for passage ${p.ordinal}`);
    const padaBox = document.createElement("div");
    padas.onclick = () => {
      const open = padaBox.childElementCount === 0;
      padas.setAttribute("aria-expanded", String(open));
      if (open) padaBox.appendChild(padaTable(p));
      else padaBox.innerHTML = "";
    };
    actions.appendChild(padas);

    card.append(meta, mula);
    if (primary) card.appendChild(primary);
    card.append(tikas, actions, padaBox);
    card.dataset.ordinal = String(p.ordinal);
    if (p.id) card.dataset.pid = p.id;
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
  const hay = tokenize(`${c.author} ${c.title || ""} ${c.text} ${c.simpleEn || ""}`).map((t) => t.fold);
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
    const shown = tikaDisplayText(c);
    if (q) span.innerHTML = highlight(shown, q);
    else span.textContent = shown;
    body.appendChild(span);
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
    $("drawerBody").textContent = "No commentaries on this verse yet.";
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
  $("drawerBody").textContent = c ? tikaDisplayText(c) : "";
}

function closeDrawer() {
  drawerPassageId = null;
  $("overlay").hidden = true;
  $("drawer").hidden = true;
  if (drawerReturnFocus && drawerReturnFocus.focus) drawerReturnFocus.focus();
  drawerReturnFocus = null;
}

// ---------- study aids: bookmarks, notes, pada tokens, copy, speech ----------
const STUDY_KEY = "gk:study:v1";
function loadStudy() {
  try {
    return JSON.parse(localStorage.getItem(STUDY_KEY) || "{}");
  } catch {
    return {};
  }
}
let study = loadStudy();
function saveStudy() {
  try {
    localStorage.setItem(STUDY_KEY, JSON.stringify(study));
  } catch {
    /* ignore */
  }
}
const isMarked = (pid) => !!(study[pid] && study[pid].mark);
function toggleMark(pid) {
  study[pid] = study[pid] || {};
  study[pid].mark = !study[pid].mark;
  if (!study[pid].mark && !study[pid].note) delete study[pid];
  saveStudy();
}
function setNote(pid, note) {
  study[pid] = study[pid] || {};
  if (note) study[pid].note = note;
  else delete study[pid].note;
  if (!study[pid].mark && !study[pid].note) delete study[pid];
  saveStudy();
}

async function refreshStudy() {
  const box = $("studyList");
  if (!box) return;
  box.innerHTML = "";
  const ids = Object.keys(study).filter((id) => study[id].mark || study[id].note);
  if (ids.length === 0) {
    box.innerHTML = '<div class="status">No bookmarks yet — ☆ any verse.</div>';
    return;
  }
  for (const pid of ids) {
    const row = document.createElement("div");
    row.className = "panel";
    row.style.margin = ".4rem 0";
    row.style.padding = ".5rem .7rem";
    const go = document.createElement("button");
    go.className = "btn s-item";
    go.textContent = `${study[pid].mark ? "★ " : ""}${study[pid].label || pid}`;
    go.onclick = () => {
      const ref = study[pid].ref;
      if (ref) gotoPassage(ref.title, ref.ordinal);
    };
    const note = document.createElement("textarea");
    note.rows = 2;
    note.placeholder = "My note…";
    note.value = study[pid].note || "";
    note.setAttribute("aria-label", `Note for ${study[pid].label || pid}`);
    note.onchange = () => {
      setNote(pid, note.value.trim());
      void refreshStudy();
    };
    const del = document.createElement("button");
    del.className = "btn";
    del.textContent = "✕";
    del.setAttribute("aria-label", "Remove bookmark");
    del.onclick = () => {
      delete study[pid];
      saveStudy();
      void refreshStudy();
      void renderReader();
    };
    row.append(go, note, del);
    box.appendChild(row);
  }
}

async function gotoPassage(title, ordinal) {
  // Resolve by (title, ordinal): stable across installs (ids are random).
  // On duplicate titles prefer the scripture holding most passages.
  const all = await store.listScriptures();
  const cands = all.filter((s) => s.title === title);
  if (cands.length === 0) {
    say(`Scripture not loaded: ${title}.`);
    return;
  }
  let best = null;
  let bestN = -1;
  for (const s of cands) {
    const ps = await store.listPassages(s.id);
    const hit = ps.some((p) => p.ordinal === ordinal);
    if (hit && ps.length > bestN) {
      best = s;
      bestN = ps.length;
    }
  }
  const target = best || cands[0];
  if (!current || current.id !== target.id) await selectScripture(target.id);
  requestAnimationFrame(() => {
    const el = document.querySelector(`.passage[data-ordinal="${ordinal}"]`);
    if (el) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      el.focus({ preventScroll: true });
    }
  });
}

/** Heuristic pada tokens: whitespace/punctuation split (no sandhi analysis — labeled as such). */
export function padaTokens(mula) {
  return String(mula || "")
    .split(/[\s।॥|]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function padaTable(p) {
  const wrap = document.createElement("div");
  const cap = document.createElement("div");
  cap.className = "meta";
  cap.textContent = "Word tokens (heuristic split — no sandhi analysis, no grammar tags)";
  const table = document.createElement("table");
  table.className = "padas";
  const head = document.createElement("tr");
  for (const h of ["Pada", "IAST"]) {
    const th = document.createElement("th");
    th.textContent = h;
    head.appendChild(th);
  }
  table.appendChild(head);
  for (const tok of padaTokens(p.mula)) {
    const tr = document.createElement("tr");
    const a = document.createElement("td");
    a.textContent = tok;
    const b = document.createElement("td");
    try {
      b.textContent = transliterateText(tok, "deva", "iast");
    } catch {
      b.textContent = tok;
    }
    tr.append(a, b);
    table.appendChild(tr);
  }
  wrap.append(cap, table);
  return wrap;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      /* ignore */
    }
    ta.remove();
    return ok;
  }
}

async function copyPassage(p) {
  const mulaShown = ui.lang === "en" && p.en ? p.en : p.mula;
  const parts = [
    mulaShown,
    p.primaryEn ? `\nGranthaKosha explains: ${p.primaryEn}` : "",
    `\n— GranthaKosha · ${current ? current.title : ""} · §${p.section || "—"} #${p.ordinal}`,
  ].join("\n");
  say((await copyText(parts)) ? "Verse + translation + citation copied." : "Copy failed in this browser.");
}

let speakingFor = null;
function speakPassage(p, mulaEl) {
  try {
    if (!("speechSynthesis" in window)) {
      say("Speech not supported in this browser.");
      return;
    }
    speechSynthesis.cancel();
    if (speakingFor === p.id) {
      speakingFor = null;
      return;
    }
    speakingFor = p.id;
    const text = ui.lang === "en" && p.en ? p.en : p.mula.replace(/[।॥|]/g, " ");
    const u = new SpeechSynthesisUtterance(text);
    u.lang = ui.lang === "en" ? "en-IN" : "sa-IN";
    u.rate = Number(ui.ttsRate || 1);
    // best-effort word highlight (Chromium boundary events)
    const words = text.split(/\s+/).filter(Boolean);
    let plain = null;
    if (mulaEl && !($("search").value.trim())) {
      plain = mulaEl.innerHTML;
      mulaEl.innerHTML = words.map((w) => `<span class="w">${w.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</span>`).join(" ");
    }
    const spans = mulaEl ? [...mulaEl.querySelectorAll(".w")] : [];
    let ci = 0;
    const offs = [];
    for (const w of words) {
      ci = text.indexOf(w, ci);
      offs.push(ci);
      ci += w.length;
    }
    u.onboundary = (e) => {
      if (typeof e.charIndex !== "number") return;
      let k = 0;
      for (let j = 0; j < offs.length; j++) if (offs[j] <= e.charIndex) k = j;
      spans.forEach((s, j) => s.classList.toggle("speaking", j === k));
    };
    const done = () => {
      if (plain !== null && mulaEl) mulaEl.innerHTML = plain;
      speakingFor = null;
    };
    u.onend = done;
    u.onerror = done;
    speechSynthesis.speak(u);
    say(`Speaking verse ${p.ordinal} (${u.rate}x). Tap 🔊 again to stop.`);
  } catch {
    say("Speech failed in this browser.");
  }
}

// ---------- events ----------
function applyPrefs() {
  document.documentElement.dataset.theme = ui.theme;
  document.documentElement.dataset.lang = ui.lang;
  $("theme").value = ui.theme;
  $("script").value = ui.script;
  $("lang").value = ui.lang;
  $("fontsize").value = String(ui.fontSize);
  $("lineheight").value = String(ui.lineHeight);
  $("ttsrate").value = String(ui.ttsRate || 1);
  document.documentElement.style.setProperty("--font-size", `${ui.fontSize}px`);
  document.documentElement.style.setProperty("--line-height", String(ui.lineHeight));
}

async function boot() {
  applyPrefs();
  const seed = await ensureSeed();
  await ensureTantraloka();
  if (ui.selectedId) current = (await store.getScripture(ui.selectedId)) || seed;
  else current = seed;
  ui.selectedId = current.id;
  saveUI();
  await refreshSidebar();
  await renderReader();

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
  $("ttsrate").onchange = (e) => {
    ui.ttsRate = Number(e.target.value);
    saveUI();
    applyPrefs();
  };
  $("lang").onchange = (e) => {
    ui.lang = e.target.value;
    saveUI();
    withTransition(() => {
      applyPrefs();
      renderReader();
    });
  };

  // workbench wiring
  const SCRIPT_LABEL = { deva: "Devanagari", iast: "IAST", iso15919: "ISO 15919", bengali: "Bengali", telugu: "Telugu", kannada: "Kannada", malayalam: "Malayalam" };
  for (const id of ["wbFrom", "wbTo"]) {
    const sel = $(id);
    sel.innerHTML = "";
    for (const s of SCRIPTS) {
      const o = document.createElement("option");
      o.value = s;
      o.textContent = SCRIPT_LABEL[s] || s;
      sel.appendChild(o);
    }
  }
  $("wbFrom").value = "deva";
  $("wbTo").value = "iast";
  $("wbGo").onclick = () => {
    try {
      $("wbOut").textContent = transliterateText($("wbIn").value, $("wbFrom").value, $("wbTo").value) || "(empty)";
    } catch (e) {
      $("wbOut").textContent = `Error: ${e.message || e}`;
    }
  };
  $("wbCopy").onclick = async () => {
    say((await copyText($("wbOut").textContent)) ? "Workbench output copied." : "Copy failed.");
  };

  // concepts dialog
  const renderConcepts = (filter = "") => {
    const grid = $("conceptGrid");
    grid.innerHTML = "";
    const qf = filter.trim().toLowerCase();
    for (const c of CONCEPTS) {
      if (qf && !(c.term + " " + c.iast + " " + c.def).toLowerCase().includes(qf)) continue;
      const card = document.createElement("div");
      card.className = "panel";
      const h = document.createElement("strong");
      h.textContent = `${c.term} · ${c.iast}`;
      const d = document.createElement("div");
      d.className = "status";
      d.textContent = c.def;
      card.append(h, d);
      for (const l of c.links.slice(0, 5)) {
        const b = document.createElement("button");
        b.className = "btn s-item";
        b.textContent = `${l.scripture} §${l.section} #${l.ordinal}`;
        b.onclick = () => {
          $("concepts").close();
          gotoPassage(l.scripture, l.ordinal);
        };
        card.appendChild(b);
      }
      grid.appendChild(card);
    }
    if (!grid.childElementCount) grid.innerHTML = '<div class="status">No concepts match.</div>';
  };
  $("conceptBtn").onclick = () => {
    renderConcepts();
    $("conceptFilter").value = "";
    $("concepts").showModal();
    $("conceptFilter").focus();
  };
  $("conceptFilter").oninput = (e) => renderConcepts(e.target.value);
  $("conceptClose").onclick = () => $("concepts").close();

  $("loadFullBtn").onclick = (e) => void loadCompleteCorpus(e.target);

  await migrateSeedTitle();
  await refreshStudy();
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
  // (viewing mode: no imports — content is maintainer-managed)

  // warm the search index in the background (full corpus ~1.5s, memoized after)
  setTimeout(() => void warmSearch(), 100);

  // ---------- removed in viewing mode: cloud sync UI (M6 lib retained) ----------

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
