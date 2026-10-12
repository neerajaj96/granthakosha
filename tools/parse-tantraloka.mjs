// CLI: parse Tantraloka Ch.1 source into GranthaKosha ExportDoc JSON.
// Usage: node tools/parse-tantraloka.mjs [source.txt] [out.json]
import { readFile, writeFile } from "node:fs/promises";
import { parseTantraloka } from "../src/lib/tantraloka-parser.js";

const src = process.argv[2] || "corpus/tantraloka-ch1-source.txt";
const out = process.argv[3] || "corpus/tantraloka-ch1.json";

const raw = await readFile(src, "utf-8");
const t0 = Date.now();
const doc = parseTantraloka(raw);
console.log(`parsed ${doc.passages.length} passages, ${doc.commentaries.length} commentaries in ${Date.now() - t0}ms → ${out}`);
delete doc.stats.warnings;
await writeFile(out, JSON.stringify(doc));
const { stats } = doc;
console.log("noise dropped:", stats.droppedNoise);
console.log("--- authors ---");
for (const [a, n] of Object.entries(stats.authors || {}).sort((x, y) => y[1] - x[1])) console.log(`${n}\t${a}`);
console.log("--- sections ---");
for (const [s, n] of Object.entries(stats.sections || {}).sort((x, y) => y[1] - x[1]).slice(0, 30)) console.log(`${n}\t${s.slice(0, 70)}`);
