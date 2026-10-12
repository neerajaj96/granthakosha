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

## Search (`src/lib/search.js`)

`buildIndex(passages, commentaries)` (fold-key cache; dual native+transliterated
keys for cross-script queries) → `search(index, query, {scope, author})` →
`[{pid, score, hits, ordinal}]` ranked. `highlight(text, query)` → safe HTML
with `<mark>` on raw-substring hits. `tokenize`, `indexKeys`, `escapeHtml`.

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

## Roles (`src/lib/rbac.js`, M7)

`can(role, action)` — reader < editor < admin (see matrix in source).
Local gating is UX-level; enforcement is Supabase RLS
(`supabase/schema.sql`: public read, editor+ write, admin-only delete).

## Conventions

1. Never `.normalize()`/`.trim()` mula or ṭīkā text on any path.
2. Passage ids are ordinal-derived and never reused; commentary ids random+stable.
3. Imports append; restores replace (snapshot first).
4. UI state (theme/script/sizes/expanded) → `localStorage gk:ui:v1`; domain
   data → IndexedDB. Supabase deferred to M6.
