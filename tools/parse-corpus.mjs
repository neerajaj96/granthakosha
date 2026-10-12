// CLI: parse the full Durgasaptashati source into GranthaKosha ExportDoc JSON.
// Usage: node tools/parse-corpus.mjs [source.txt] [out.json]
import { readFile, writeFile } from "node:fs/promises";
import { parseCorpus } from "../src/lib/corpus-parser.js";

const src = process.argv[2] || "corpus/durgasaptashati-source.txt";
const out = process.argv[3] || "corpus/durgasaptashati.json";

const raw = await readFile(src, "utf-8");
const t0 = Date.now();
const doc = parseCorpus(raw);
const ms = Date.now() - t0;
delete doc.stats.warnings;
await writeFile(out, JSON.stringify(doc));

const { passages, commentaries, stats } = doc;
console.log(`parsed ${passages.length} passages, ${commentaries.length} commentaries in ${ms}ms → ${out}`);
console.log("noise dropped:", stats.droppedNoise);
console.log("--- authors ---");
for (const [a, n] of Object.entries(stats.authors || {}).sort((x, y) => y[1] - x[1])) console.log(`${n}\t${a}`);
console.log("--- top sections ---");
for (const [s, n] of Object.entries(stats.sections || {}).sort((x, y) => y[1] - x[1]).slice(0, 20)) console.log(`${n}\t${s.slice(0, 60)}`);
