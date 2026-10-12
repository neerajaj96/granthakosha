# GranthaKosha API (M8 — developer spec, v0.3)

Zero-dependency ES modules. Browser + Node share `src/lib/*`.

## StorageAdapter (`src/lib/storage.js`)

```js
put(store, record{id, ...})  // upsert, exact strings via structuredClone/IDB
get(store, id) -> record|undefined
del(store, id)
list(store) -> record[]
clear(store)
```
Stores: `scriptures | passages | commentaries | kv`.
Implementations: `MemoryAdapter` (tests/fallback), `IndexedDBAdapter` (browser,
DB `granthakosha` v1, keyPath `id`), `SupabaseAdapter` (M6, PostgREST over
`granthakosha_records`; see `supabase/schema.sql`).

## GranthaStore (`src/lib/store.js`)

- `createScripture(title, subtitle?, language?)`, `getScripture`, `listScriptures`
- `addPassage(scriptureId, mula, section?)` — mula stored **verbatim** (no
  trim/normalize); id `${scriptureId}:p:${ordinal}`, ordinals append-only with a
  per-instance max-cache + clash rescan.
- `addCommentary(passageId, author, text, title?)`, `listCommentaries`,
  `listCommentariesForScripture`, `updateCommentary` (id stable),
  `deleteCommentary` (siblings untouched).
- `exportDoc(scriptureId?)` → `ExportDoc`; `validateExportDoc` (throws);
  `importAppend(doc, targetId?)` → `ImportReport` — append-only, exact+NFC
  duplicate skip with remap (no orphans), pre-validation rollback.
- Snapshots (M5): `saveSnapshot(name)`, `listSnapshots`, `deleteSnapshot`,
  `restoreSnapshot` (exact, byte-identical ids, rollback on failure).
- Integrity (M5): `verifyIntegrity()` → `{orphanCommentaries, orphanPassages,
  emptyMula, duplicateOrdinals}`; `repairIntegrity()` (snapshot-first in UI).

## ExportDoc v1

```json
{ "version": 1, "exportedAt": 0,
  "scriptures": [{id,title,subtitle,language,createdAt,updatedAt}],
  "passages": [{id,scriptureId,ordinal,section,mula,createdAt,updatedAt}],
  "commentaries": [{id,passageId,author,title,text,createdAt,updatedAt}] }
```

## Corpus parser (`src/lib/corpus-parser.js`)

`parseCorpus(text, {title,subtitle,scriptureId?})` → ExportDoc + `stats`
(noise dropped, per-author/section counts). `csvToDoc(text)` for
`section,mula,author,commentary` rows. See MILESTONES M3 for heuristics.

## Tantraloka parser (`src/lib/tantraloka-parser.js`)

`parseTantraloka(text)` → ExportDoc with `Passage{mula, en}` +
`Commentary(Viveka|Notes)`: verse-closer run classification, IAST skipping,
page-break-aware note tracking, appendix grouping. Batches:
`content/primary-batch-N.json` merged by `tools/merge-primary.mjs`
(match: scripture+ordinal / author), committed into `corpus/*.json`.

## Search (`src/lib/search.js`)

`buildIndex(passages, commentaries)` (fold-key cache; dual native+transliterated
keys for cross-script queries) → `search(index, query, {scope, author})` →
`[{pid, score, hits, ordinal}]` ranked. `highlight(text, query)` → safe HTML
with `<mark>` on raw-substring hits. `tokenize`, `indexKeys`, `escapeHtml`.

## Transliteration (`src/lib/transliterate.js`)

`transliterateText(text, from, to)` over Devanāgarī, IAST, ISO-15919,
Bengali, Telugu, Kannada, Malayalam (Deva pivot; Brahmic by block offset;
IAST↔Deva parser both ways). Malayalam RRA/chillu + Bengali va quirks
handled + tested. Grantha omitted (unverifiable offline).

## Display plane (`src/lib/display.js`)

`renderText(s, en, lang, script)` / `tikaDisplayText(c, lang, script)` —
EN prefers `en`/`simpleEn`, falls back to Latin-script originals, else the
forthcoming notice. Pure + tested. Primary cards (`primaryEn`) render in both
languages, pinned under each verse. Script-aware via `transliterateText`.

## Concepts (`tools/concepts-src.json` + `tools/build-concepts.mjs`)

24 curated term definitions; verse links computed from shipped corpora via
the real search index into `src/lib/concepts.js`. Links are
(title, ordinal) — stable across installs (record ids are random per install).
Fresh imports preserve source ordinals 1:1 so links never rot.

## IAST (`src/lib/iast.js`)

`devaToIast` — display-only, approximate (inherent-a lookahead for halanta +
vowel signs). Never applied to stored text.

## Sync (`src/lib/sync.js`, M6)

`snapshotStores(a)` → per-store id-maps; `diffSnapshots(L,R)` →
`{onlyLocal, onlyRemote, push, pull, conflicts}` per store (LWW on
`updatedAt`); `summarizeDiff`; `pushLocal` / `pullRemote` / `syncBidirectional`
(local-newer ↑, remote-newer ↓, equal-timestamp conflicts reported + kept
local). Deletes never propagate. UI: Test / Dry-run / Push / Pull / Sync with
pre-write auto-snapshots; creds (URL only) in localStorage.

## Roles — removed (viewing-only app)

Earlier RBAC work was retired per direction: no admin mode, plain viewing.
Content changes go through the maintainer (versioned `content/*.json` batches).
Library code (storage/sync/snapshots) is retained + tested for maintainer tooling.

## Conventions

1. Never `.normalize()`/`.trim()` mula or ṭīkā text on any path.
2. Passage ids are ordinal-derived and never reused; commentary ids random+stable.
3. Imports append; restores replace (snapshot first).
4. UI state (theme/script/sizes/expanded) → `localStorage gk:ui:v1`; domain
   data → IndexedDB. Supabase deferred to M6.
