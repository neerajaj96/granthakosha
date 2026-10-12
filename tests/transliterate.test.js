import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  transliterateText, devaToBrahmic, brahmicToDeva,
  iastToDeva, iastToIso, isoToIast, SCRIPTS,
} from "../src/lib/transliterate.js";

describe("transliterator", () => {
  it("lists supported scripts (no Grantha — unverifiable offline)", () => {
    assert.deepEqual(SCRIPTS, ["deva", "iast", "iso15919", "bengali", "telugu", "kannada", "malayalam"]);
  });

  it("converts Devanagari to Brahmic scripts by block offset", () => {
    assert.equal(devaToBrahmic("देवी", "bengali"), "দেবী"); // va → ব, not ঵
    assert.equal(devaToBrahmic("देवी", "telugu"), "దేవీ");
    assert.equal(devaToBrahmic("देवी", "kannada"), "ದೇವೀ");
    assert.equal(devaToBrahmic("देवी", "malayalam"), "ദേവീ");
    assert.equal(devaToBrahmic("॥१॥", "bengali"), "॥১॥"); // digits map, dandas pass
    assert.equal(devaToBrahmic("ॐ", "telugu"), "ॐ"); // unmapped passes through
  });

  it("round-trips Brahmic → Deva exactly", () => {
    for (const s of ["bengali", "telugu", "kannada", "malayalam"]) {
      assert.equal(brahmicToDeva(devaToBrahmic("कृष्णः चामुण्डायै ॥२॥", s), s), "कृष्णः चामुण्डायै ॥२॥");
    }
  });

  it("parses IAST back to Devanagari", () => {
    assert.equal(iastToDeva("durgā"), "दुर्गा");
    assert.equal(iastToDeva("kṛṣṇaḥ"), "कृष्णः");
    assert.equal(iastToDeva("tataḥ"), "ततः");
    assert.equal(iastToDeva("aiṃ hrīṃ klīṃ"), "ऐं ह्रीं क्लीं");
    assert.equal(iastToDeva("śrī"), "श्री");
  });

  it("round-trips deva → iast → deva on real verses", () => {
    for (const w of ["दुर्गायै नमः", "वृषवाहनविघ्नेशौ", "चामुण्डायै विच्चे", "श्रीगणेशाय नमः"]) {
      const via = transliterateText(w, "deva", "iast");
      assert.equal(iastToDeva(via), w, via);
    }
  });

  it("maps ISO 15919 ē/ō/r̥/l̥/ṁ both ways", () => {
    assert.equal(iastToIso("kṛṣṇa"), "kr̥ṣṇa");
    assert.equal(iastToIso("e"), "ē");
    assert.equal(isoToIast("ē"), "e");
    assert.equal(isoToIast("r̥"), "ṛ");
    assert.equal(transliterateText("देवी", "deva", "iso15919"), "dēvī");
  });

  it("transliterateText routes every pair through Deva", () => {
    assert.equal(transliterateText("दुर्गा", "deva", "malayalam"), "ദുര്ഗാ");
    assert.equal(transliterateText("ദുര്ഗാ", "malayalam", "iast"), "durgā");
    assert.equal(transliterateText("ദുർഗാ", "malayalam", "iast"), "durgā"); // RRA form
    assert.equal(transliterateText("durga", "iast", "bengali"), "দুর্গ");
    assert.equal(transliterateText("x", "deva", "deva"), "x");
    assert.throws(() => transliterateText("x", "grantha", "deva"), /Unknown source/);
    assert.throws(() => transliterateText("x", "deva", "tamil"), /Unknown target/);
  });
});
