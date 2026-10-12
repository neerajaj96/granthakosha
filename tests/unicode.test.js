import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { exactEqual, codePoints, fnv1a, searchFold, jsonRoundTrip } from "../src/lib/unicode.js";
import { UNICODE_PROBE } from "../src/lib/seed.js";

describe("unicode preservation", () => {
  it("stores complex Vedic/Sanskrit diacritics with zero corruption", () => {
    const samples = [
      "वृषवाहनविघ्नेशौ हंसवाहां सरस्वतीम् ।",
      "श्रीगणेशाय नमः",
      "ॐ ऐं ह्रीं क्लीं चामुण्डायै विच्चे ॥",
      UNICODE_PROBE,
      "भीषास्माद्वातः पवते भीषोदेति सूर्यः",
      "काव्यव्याकृतितार्किकौपनिषदेष्वेकैकविद्भिः",
      "stress marks: अ॑ग्निमी॒ळे DEP: क॒ + IAST: śrī ṣaṭ",
    ];
    for (const s of samples) {
      const rt = jsonRoundTrip(s);
      assert.equal(exactEqual(rt, s), true, `corrupted: ${s.slice(0, 20)}`);
      assert.equal(codePoints(rt).join(""), s);
      assert.equal(rt.length, s.length);
    }
  });

  it("never silently normalizes: NFC != NFD forms stay distinct", () => {
    const nfc = "é".normalize("NFC");
    const nfd = "é".normalize("NFD");
    assert.equal(exactEqual(nfc, nfd), false);
    assert.notEqual(fnv1a(nfc), fnv1a(nfd));
  });

  it("search fold is display-only and diacritic-insensitive", () => {
    assert.equal(searchFold("Durgā"), searchFold("durga"));
    assert.ok(searchFold("śakti").includes("s"));
    const orig = "चामुण्डायै";
    searchFold(orig);
    assert.equal(orig, "चामुण्डायै");
  });
});
