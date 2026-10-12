import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CONCEPTS } from "../src/lib/concepts.js";
import { buildIndex, search } from "../src/lib/search.js";

describe("concept explorer", () => {
  it("ships 24 curated concepts, all linked", () => {
    assert.equal(CONCEPTS.length, 24);
    for (const c of CONCEPTS) {
      assert.ok(c.term && c.iast && c.def, c.term);
      assert.ok(c.links.length > 0, `unlinked: ${c.term}`);
      for (const l of c.links.slice(0, 5)) {
        assert.ok(typeof l.scripture === "string" && l.scripture.length > 0);
        assert.ok(Number.isInteger(l.ordinal) && l.ordinal > 0);
        assert.ok(typeof l.section === "string");
        assert.ok(!("passageId" in l), "links must be title+ordinal (ids are install-local)");
      }
    }
  });

  it("linker resolves deva + iast queries through the real index", () => {
    const passages = [
      { id: "s:p:1", scriptureId: "s", ordinal: 1, section: "S", mula: "मायया मोहितं जगत्", en: "", primaryEn: "" },
    ];
    const idx = buildIndex(passages, []);
    assert.ok(search(idx, "मायया", {}).length > 0); // exact inflected form
    assert.ok(search(idx, "māyayā", {}).length > 0); // cross-script same form
    assert.ok(search(idx, "mohita", {}).length > 0); // latin prefix
    assert.ok(search(idx, "xyzzy", {}).length === 0);
  });
});
