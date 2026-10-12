import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseTantraloka } from "../src/lib/tantraloka-parser.js";

const SAMPLE = [
  "TANTRĀLOKA 5",
  "The Types of Liberating Knowledge (vijñānabhid)",
  "The Introductory Verses",
  "The Initial Invocation",
  "Here, indeed, at the beginning of this treatise, the author reflects.",
  "विमलकलाश्रयाभिनवसृष्टिमहा जननी",
  "हृदयमनुत्तरामृतकुलं मम संस्फुरतात् ।। १",
  "vimalakalāśrayābhinavasṛṣṭimahā jananī",
  "hṛdayam anuttarāmṛtakulam mama saṃsphuratāt || 1 |",
  "(My) mother, Vimalā, is joyous with the glory of my birth,",
  "pulsate radiantly! (1)",
  "7 Sanderson sees an allusion to Bhairava here.",
  "Liberated in the body, by drops of compassion,",
  "I take refuge in him.4 (2)",
  "Appendix A",
  "Some appendix prose line one.",
  "Some appendix prose line two.",
].join("\n");

describe("tantraloka parser", () => {
  it("builds verse units with mula + en + notes, skips IAST/headers", () => {
    const doc = parseTantraloka(SAMPLE);
    assert.equal(doc.scriptures[0].title, "Tantrāloka, Ch. 1");
    assert.ok(doc.passages.length >= 2);
    const v1 = doc.passages[0];
    assert.equal(v1.section, "The Initial Invocation");
    assert.ok(v1.mula.includes("विमलकला"));
    assert.ok(!v1.mula.includes("vimalakalā")); // IAST skipped
    assert.ok(v1.en.includes("pulsate radiantly! (1)"));
    const authors = doc.commentaries.filter((c) => c.passageId === v1.id).map((c) => c.author);
    assert.ok(authors.includes("Viveka (Jayaratha)")); // intro prose attached
    assert.ok(authors.includes("Notes")); // footnote attached
    const v2 = doc.passages[1];
    assert.ok(v2.en.includes("(2)"));
  });

  it("groups appendix prose without verse numbers", () => {
    const doc = parseTantraloka(SAMPLE);
    const ap = doc.passages.find((p) => p.section === "Appendix A");
    assert.ok(ap);
    assert.equal(ap.mula, "");
    assert.ok(ap.en.includes("appendix prose"));
  });

  it("never normalizes stored text", () => {
    const doc = parseTantraloka("The Types of Liberating Knowledge (x)\nThe Introductory Verses\nमूला ।\ntranslation here (9)\n");
    assert.equal(doc.passages[0].mula, "मूला ।");
    assert.equal(doc.passages[0].en, "translation here (9)");
  });
});
