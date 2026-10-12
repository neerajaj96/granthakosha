import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseCorpus, normalizeAuthor, parseCsv, csvToDoc } from "../src/lib/corpus-parser.js";

const SAMPLE = [
  "दुर्गासप्तशती [ अर्गलास्तुतिः",
  "५०",
  "मधुकैटभविद्राविविधातृवरदे नमः ।",
  "रूपं देहि जयं देहि यशो देहि द्विषो जहि ॥२॥",
  "(गुप्तवती) मध्विति । विद्राविणी च सा विधातृवरदा चेति विग्रहः ।",
  "स्वीयानां मोहनं द्विषां भीषणं लावण्यं वा ॥ २॥ महिषेति।",
  "(प्रदीपः) मधुकैटभयोर्विंद्राविणी नाशिनी च सा ।",
  "रक्तबीजवधे देवि चण्डमुण्डविनाशिनि ।",
  "रूपं देहि जयं देहि यशो देहि द्विषो जहि ॥५॥",
  "(७ चन्द्रप्रभा) रक्तबीज का वध करने वाली हे देवि! ॥ ५॥",
  "१. 'महिषासुरनिर्णाशि' इति क्वचित्पाठः।",
  "अर्गलास्तुतिः ] गुप्तवत्यादिसप्तटीकासंवलिता ५१",
].join("\n");

describe("corpus parser", () => {
  it("groups verse pairs, drops noise, harvests section", () => {
    const doc = parseCorpus(SAMPLE);
    assert.equal(doc.passages.length, 2);
    assert.equal(doc.passages[0].mula, "मधुकैटभविद्राविविधातृवरदे नमः ।\nरूपं देहि जयं देहि यशो देहि द्विषो जहि ॥२॥");
    assert.equal(doc.passages[0].section, "अर्गलास्तुतिः");
    assert.equal(doc.passages[1].ordinal, 2);
    assert.ok(!doc.passages.some((p) => p.mula.includes("दुर्गासप्तशती")));
  });

  it("attributes tika chunks incl. variants, keeps in-tika citations intact", () => {
    const doc = parseCorpus(SAMPLE);
    const byAuthor = {};
    for (const c of doc.commentaries) byAuthor[c.author] = (byAuthor[c.author] || 0) + 1;
    assert.equal(byAuthor["Guptavatī"], 1);
    assert.equal(byAuthor["Pradīpa"], 1);
    assert.equal(byAuthor["Candraprabhā"], 1);
    assert.equal(byAuthor["Pāṭhabheda-ṭippaṇī"], 1);
    const g = doc.commentaries.find((c) => c.author === "Guptavatī");
    assert.ok(g.text.includes("॥ २॥")); // citation stayed inside chunk
    assert.equal(g.passageId, doc.passages[0].id);
    const cp = doc.commentaries.find((c) => c.author === "Candraprabhā");
    assert.equal(cp.passageId, doc.passages[1].id); // pair-break re-attached
  });

  it("normalizes OCR author variants", () => {
    for (const [raw, canon] of [
      ["१ गुप्तवती", "Guptavatī"], ["२ चतुर्धरी", "Caturdharī"],
      ["३ शान्तनवी", "Śāntanavī"], ["४ नागोजी भट्टी", "Nāgojībhaṭṭī"],
      ["४ नागोजीभट्टी", "Nāgojībhaṭṭī"], ["५ जगच्चन्द्रचन्द्रिका", "Jagaccandracandrikā"],
      ["६ दंशोद्धारः", "Daṃśoddhāra"], ["६ दशोद्धारः", "Daṃśoddhāra"],
      ["७ चन्द्रप्रभा", "Candraprabhā"], ["प्रदीपः", "Pradīpa"],
      ["२ चुतर्धरी", "Caturdharī"], ["५. जगच्चन्द्रचन्द्रिका", "Jagaccandracandrikā"],
    ]) assert.equal(normalizeAuthor(raw), canon, raw);
    assert.equal(normalizeAuthor("हमलोगों का"), "हमलोगों का"); // unknown → verbatim
  });

  it("never normalizes stored text", () => {
    const mula = "वृषवाहनविघ्नेशौ हंसवाहां सरस्वतीम् ।";
    const doc = parseCorpus(`X [ S\n${mula}\nस्वेष्टं नत्वा ततः ॥१॥\n`);
    assert.equal(doc.passages[0].mula, `${mula}\nस्वेष्टं नत्वा ततः ॥१॥`);
  });

  it("CSV import builds passages + commentaries, skips empty mula", () => {
    const csv = 'section,mula,author,commentary\nUpoddhātaḥ,श्रीगणेशाय नमः,,\nS2,मूला-द्वि,Guptavatī,टीका-पाठः\nS3,,,';
    const doc = csvToDoc(csv);
    assert.equal(doc.passages.length, 2);
    assert.equal(doc.passages[0].mula, "श्रीगणेशाय नमः");
    assert.equal(doc.commentaries.length, 1);
    assert.equal(doc.commentaries[0].author, "Guptavatī");
    assert.equal(doc.stats.errors.length, 1);
  });

  it("CSV handles quotes and commas", () => {
    const rows = parseCsv('a,"b, c",d\n');
    assert.deepEqual(rows, [["a", "b, c", "d"]]);
  });
});
