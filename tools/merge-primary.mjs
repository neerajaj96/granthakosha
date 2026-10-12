// CLI: merge hand-written primary/simplified content (content/*.json) into corpus JSONs.
// Match: primaries by (scriptureId, ordinal); tikas by (scriptureId, ordinal, author, text-prefix).
// Usage: node tools/merge-primary.mjs
import { readFile, writeFile, readdir } from "node:fs/promises";

const CORPUS = {
  tantraloka: "corpus/tantraloka-ch1.json",
  corpus: "corpus/durgasaptashati.json",
};

const docs = {};
for (const [sid, path] of Object.entries(CORPUS)) {
  docs[sid] = JSON.parse(await readFile(path, "utf-8"));
}

const files = (await readdir("content")).filter((f) => f.endsWith(".json")).sort();
let appliedP = 0;
let appliedT = 0;
const missing = [];

for (const f of files) {
  const batch = JSON.parse(await readFile(`content/${f}`, "utf-8"));
  for (const p of batch.primaries || []) {
    const doc = docs[p.scripture];
    const pass = doc?.passages.find((x) => x.ordinal === p.ordinal);
    if (!pass) {
      missing.push(`${f}: primary ${p.scripture}#${p.ordinal}`);
      continue;
    }
    pass.primaryEn = p.primaryEn;
    appliedP++;
  }
  for (const t of batch.tikas || []) {
    const doc = docs[t.scripture];
    const pass = doc?.passages.find((x) => x.ordinal === t.ordinal);
    const c = pass && doc.commentaries.find(
      (x) => x.passageId === pass.id && x.author === t.author && x.text.startsWith(t.textPrefix || "")
    );
    if (!c) {
      missing.push(`${f}: tika ${t.scripture}#${t.ordinal} ${t.author}`);
      continue;
    }
    c.simpleEn = t.simpleEn;
    appliedT++;
  }
}

for (const [sid, path] of Object.entries(CORPUS)) {
  await writeFile(path, JSON.stringify(docs[sid]));
}
console.log(`primaries applied: ${appliedP}, tikas simplified: ${appliedT}`);
if (missing.length) {
  console.log("UNMATCHED:");
  for (const m of missing) console.log("  " + m);
  process.exitCode = 1;
}
// coverage report
for (const [sid, path] of Object.entries(CORPUS)) {
  const doc = docs[sid];
  const np = doc.passages.filter((p) => p.primaryEn).length;
  const nt = doc.commentaries.filter((c) => c.simpleEn).length;
  console.log(`${sid}: primary ${np}/${doc.passages.length}, simplified tikas ${nt}/${doc.commentaries.length}`);
}
