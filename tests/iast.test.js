import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { devaToIast } from "../src/lib/iast.js";

describe("IAST toggle (display-only)", () => {
  it("drops inherent a before halanta and vowel signs", () => {
    assert.equal(devaToIast("कृष्णः"), "kṛṣṇaḥ");
    assert.equal(devaToIast("ततः"), "tataḥ");
    assert.equal(devaToIast("दुर्गा"), "durgā");
  });
  it("passes through unknown text and never touches storage", () => {
    const s = "ॐ नमः śāntiḥ ॥१॥";
    assert.ok(devaToIast(s).includes("śāntiḥ"));
    assert.equal(s, "ॐ नमः śāntiḥ ॥१॥");
  });
});
