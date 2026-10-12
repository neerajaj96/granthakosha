# GranthaKosha — ग्रन्थकोश

Offline-first Sanskrit scripture + multi-commentary reader.
Seed corpus: **Durgāsaptaśatī, Guptavatyādi-sapta-ṭīkā-saṃvalitā** (extracted verbatim from the project Google Doc).

Zero dependencies. Plain Node + browser-native ES modules.

## Run

```sh
npm run dev      # → http://localhost:4173/  (node server.mjs, no install needed)
npm test         # 11 tests, node --test
```

## M1 vertical slice (done)

Create Scripture → paste exact Mūla → attach N independent commentaries →
expand/collapse each separately → reload restores state (IndexedDB + localStorage) →
append new material without losing data or corrupting line mappings.

## M2/M3 (done)

- Reader: ṭīkā focus drawer, line-height + font-size + theme + script controls.
- Corpus pipeline: `node tools/parse-corpus.mjs` parses the 23k-line source into
  2944 passages + 4550 ṭīkās (`corpus/durgasaptashati.json`); browser import
  wizard does Source → Preview (diff, nothing written) → Confirm (append-only).
  CSV import supported. Full import verified at ~0.6s with exact-Unicode round-trip.

## M4/M5 (done)

- Search: `durga` finds `दुर्गायै` (cross-script, diacritic-insensitive, prefix,
  ranked, scope/author filters, `<mark>` highlight). Index builds once in
  background (~1.5s full corpus), queries ~10–30ms.
- Safety: named + auto snapshots (pre-import/pre-repair/pre-restore, pruned to 5),
  byte-exact restore with rollback, integrity verify + recovery banner.
- API spec: `docs/API.md`.

## M6/M7 (done, pending live backends)

- Cloud: `SupabaseAdapter` + `supabase/schema.sql` (RLS) + LWW sync engine with
  dry-run; UI panel (Test/Dry-run/Push/Pull/Sync), all writes pre-snapshotted.
- Access: reader/editor/admin roles (`src/lib/rbac.js`), UI gating with admin-only
  restore/repair, RLS as server enforcement.
- A11y: skip link, live status regions, focus management, high-contrast marks,
  reduced-motion, touch targets.

## Architecture

- `src/lib/store.js` — domain logic (scriptures, passages, commentaries, append-only import)
- `src/lib/storage.js` — `StorageAdapter` interface: `MemoryAdapter` (tests/fallback),
  `IndexedDBAdapter` (browser, offline-first), `SupabaseStubAdapter` ([Blocked] → M5)
- `src/lib/ids.js` — stable IDs: `scriptureId:p:ordinal` passages (never reused),
  random `c_*` commentaries (stable across edits)
- `src/lib/unicode.js` — storage NEVER normalizes; `searchFold` is search-only
- `src/lib/seed.js` — verbatim seed verses + commentary excerpts from the Google Doc
- `src/main.js` — reader UI (themes, script toggle, swipe, shortcuts, view transitions)
- `sw.js` — offline app shell; data lives in IndexedDB

## Integrity rules

1. Text is stored, exported, and imported **exactly** — no `.normalize()`, no `.trim()` on mūla/ṭīkā.
2. Duplicate detection compares exact strings (+ NFC-equivalence as skip-signal only, never rewriting).
3. Imports are **append-only** with pre-validation → corrupt imports write nothing (rollback).
4. Editing/deleting one commentary never touches siblings.
