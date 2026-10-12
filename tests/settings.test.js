import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  loadSettings, factoryDefaults, validateBackup, buildBackup,
  createStore, createBus, DEFAULTS,
} from "../src/lib/settings.js";
import { padaTokens, anvayaLine } from "../src/lib/pada.js";

function memBackend(seed = {}) {
  const m = new Map(Object.entries(seed));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

describe("settings store", () => {
  it("loads defaults on empty backend", () => {
    const s = loadSettings(memBackend());
    assert.equal(s.theme, DEFAULTS.theme);
    assert.equal(s.sanskritScale, 1.15);
    assert.deepEqual(s.expanded, {});
  });

  it("migrates legacy gk:ui:v1 keys once", () => {
    const s = loadSettings(memBackend({ "gk:ui:v1": JSON.stringify({ theme: "sepia", fontSize: 22 }) }));
    assert.equal(s.theme, "sepia");
    assert.equal(s.fontSize, 22);
    assert.equal(s.tikaMode, "accordion"); // new keys defaulted
  });

  it("ignores corrupt state", () => {
    assert.equal(loadSettings(memBackend({ "gk:settings:v1": "%%%" })).theme, "dark");
  });

  it("reactive proxy saves + emits on mutation", () => {
    const backend = memBackend();
    const seen = [];
    const bus = createBus(null);
    bus.on("gk:settings", (e) => seen.push(e.detail.theme));
    const { state } = createStore(loadSettings(backend), backend, bus);
    state.theme = "sepia";
    assert.equal(JSON.parse(backend.getItem("gk:settings:v1")).theme, "sepia");
    assert.deepEqual(seen, ["sepia"]);
  });

  it("factoryDefaults never carries user data", () => {
    const f = factoryDefaults();
    assert.equal(f.theme, "dark");
    assert.deepEqual(f.expanded, {});
  });
});

describe("backup validation", () => {
  it("accepts a well-formed study backup, strips junk", () => {
    const out = validateBackup({
      study: {
        "s:p:1": { mark: true, note: "x", label: "L", ref: { title: "T", ordinal: 1 }, evil: 1 },
        empty: {},
      },
    });
    assert.deepEqual(Object.keys(out), ["s:p:1"]);
    assert.equal(out["s:p:1"].evil, undefined);
  });

  it("rejects malformed backups", () => {
    assert.throws(() => validateBackup(null), /object/);
    assert.throws(() => validateBackup({}), /study/);
    assert.throws(() => validateBackup({ study: [] }), /study/);
    assert.throws(() => validateBackup({ study: { "x": 5 } }), /Bad entry/);
  });

  it("buildBackup wraps study with app marker", () => {
    const b = buildBackup({ "s:p:1": { mark: true } });
    assert.equal(b.app, "granthakosha");
    assert.ok(typeof b.exportedAt === "number");
  });
});

describe("pada helpers (honest: split only, no tags)", () => {
  it("tokenizes on whitespace/dandas", () => {
    assert.deepEqual(padaTokens("रूपं देहि ॥२॥"), ["रूपं", "देहि", "२"]);
    assert.deepEqual(padaTokens(""), []);
  });

  it("anvaya joins tokens for prose flow", () => {
    assert.equal(anvayaLine("रूपं देहि ॥२॥"), "रूपं देहि २");
  });
});
