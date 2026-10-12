/**
 * Reactive settings store (zero-dep) + tiny event bus.
 * Persists to localStorage (or an injected memory backend for tests).
 * Migrates legacy `gk:ui:v1` keys on first load.
 */

export const SETTINGS_KEY = "gk:settings:v1";
export const LEGACY_KEY = "gk:ui:v1";

export const DEFAULTS = {
  expanded: {},
  theme: "dark", // dark|light|sepia|parchment
  script: "deva",
  dual: null, // second script subtitle, e.g. "iast"
  lang: "sa",
  fontSize: 19,
  lineHeight: 2,
  sanskritScale: 1.15,
  bodyScale: 1,
  showPadas: false,
  showAnvaya: false,
  tikaMode: "accordion", // accordion|split
  ttsRate: 1,
  ttsVoice: "",
  karaoke: true,
  selectedId: null,
};

export function loadSettings(backend) {
  const store = backend || defaultBackend();
  let data = { ...DEFAULTS };
  try {
    const raw = store.getItem(SETTINGS_KEY);
    if (raw) data = { ...data, ...JSON.parse(raw) };
    else {
      // one-time legacy migration
      const leg = store.getItem(LEGACY_KEY);
      if (leg) data = { ...data, ...JSON.parse(leg) };
    }
  } catch {
    /* ignore corrupt state */
  }
  if (!data.expanded || typeof data.expanded !== "object") data.expanded = {};
  return data;
}

export function defaultBackend() {
  if (typeof localStorage !== "undefined") return localStorage;
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

/** Reset preferences to factory defaults (never touches study/bookmarks). */
export function factoryDefaults() {
  return { ...DEFAULTS, expanded: {} };
}

/** Validate an imported bookmarks/notes backup doc. Returns normalized study map. */
export function validateBackup(doc) {
  if (typeof doc !== "object" || doc === null) throw new Error("Backup must be an object");
  const study = doc.study;
  if (typeof study !== "object" || study === null || Array.isArray(study)) {
    throw new Error("Backup needs a 'study' object");
  }
  const out = {};
  for (const [pid, v] of Object.entries(study)) {
    if (typeof pid !== "string" || !pid || typeof v !== "object" || v === null) {
      throw new Error(`Bad entry for ${String(pid).slice(0, 60)}`);
    }
    const entry = {};
    if (v.mark) entry.mark = true;
    if (typeof v.note === "string" && v.note) entry.note = v.note.slice(0, 5000);
    if (typeof v.label === "string" && v.label) entry.label = v.label.slice(0, 200);
    if (v.ref && typeof v.ref.title === "string" && Number.isInteger(v.ref.ordinal)) {
      entry.ref = { title: v.ref.title.slice(0, 200), ordinal: v.ref.ordinal };
    }
    if (entry.mark || entry.note) out[pid] = entry;
  }
  return out;
}

export function buildBackup(study) {
  return { app: "granthakosha", version: 1, exportedAt: Date.now(), study: study || {} };
}

/** Minimal Custom-Event bus (documents + tests share it). */
export function createBus(target) {
  const el = target || (typeof document !== "undefined" ? document : null);
  const fallback = new Map();
  return {
    on(name, fn) {
      if (el) el.addEventListener(name, fn);
      else {
        if (!fallback.has(name)) fallback.set(name, new Set());
        fallback.get(name).add(fn);
      }
    },
    emit(name, detail) {
      if (el) el.dispatchEvent(new CustomEvent(name, { detail }));
      else for (const fn of fallback.get(name) || []) fn({ detail });
    },
  };
}

/** Reactive proxy: mutating state saves + emits `gk:settings`. */
export function createStore(initial, backend, bus) {
  const store = backend || defaultBackend();
  const events = bus || createBus();
  const save = () => {
    try {
      store.setItem(SETTINGS_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
    events.emit("gk:settings", { ...state });
  };
  const state = new Proxy({ ...initial }, {
    set(t, k, v) {
      t[k] = v;
      save();
      return true;
    },
  });
  return { state, save, on: events.on, emit: events.emit };
}
