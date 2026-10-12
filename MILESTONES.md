# GranthaKosha — Revised Execution Checklist

Source scriptures:
- Google Doc `Durgasaptashati / Guptavati-adi-sapta-tika-samvalita`
  (~23.5k lines: Upoddhāta, Kavaca, Argalā, Kīlaka, 13 Adhyāyas,
  3 Rahasyas, Sūktas + 7 ṭīkās). Seed excerpts in `src/lib/seed.js`.
- Drive file `Tantrāloka Ch.1` (Dyczkowski translation, ~20.7k lines):
  `corpus/tantraloka-ch1-source.txt` → 220 verse units + 1571 notes/Viveka.

Viewing-only app (no roles, no editing UI). Content grows through
maintainer batches: `content/primary-batch-N.json` merged by
`tools/merge-primary.mjs` into the corpus JSONs (matched by
scripture+ordinal / author), then seeded into the app.

## M1 — Vertical slice [Implemented] [Tested]
- [x] Scripture entity, exact Mūla persistence, independent commentaries,
      per-card expand/collapse, reload restore, append-only growth, unicode +
      import/export integrity tests, full reader chrome (themes, Deva/IAST,
      responsive, gestures, shortcuts, PWA)

## Content model — Simple English everywhere [Implemented] [Tested]
- [x] `Passage.en` (literal translation) + `Passage.primaryEn` (ONE combined
      layman explanation per verse, verse + all commentaries synthesized);
      `Commentary.simpleEn` (layman rendering, never verbatim-scholarly)
- [x] Primary card pinned right below every verse (`GranthaKosha explains`);
      SA/EN language toggle; EN fallback = Latin originals shown, Sanskrit-only
      content shows an honest "being prepared" notice + coverage counters
- [x] Batch 1: 6/6 seed verses (literal EN + primaries + 9 simplified ṭīkās);
      Tantrāloka units 1–8 primaries via versioned sidecar + merge CLI
- [x] Batch 2 (translator's own): full Argalā Stotra — 32/32 verses with
      working EN + combined primaries, 23/23 attached ṭīkās simplified
      (`content/primary-batch-2.json`); `***` separator artifacts now dropped
      by the parser (51 noise lines)
- [x] Batch 3 (translator's own): Devīkavaca (72) + Devīkīlaka incl.
      Guru-kīlaka (52) — 124/124 working EN + combined primaries, 105/105
      attached ṭīkās simplified (`content/primary-batch-3.json`)
- [x] `src/lib/display.js` pure display plane + 4 tests; store carry-through
      (add/import/export round-trip) tested; search indexes EN planes too
- [ ] Batches 2+: remaining 212 Tantraloka primaries, 2944 Saptashati primaries
      + 4550 simplified ṭīkās — added iteratively through the maintainer

## M2 — Reader View hardening [Implemented]
- [x] Split-screen passages + commentary cards, mobile single-column
- [x] Commentary drawer (⤢ Focus ṭīkā slide-over, author switcher, Esc/overlay/swipe-down close)
- [x] Line-height control (persisted), halanta-aware IAST toggle
- [x] Diacritic-insensitive instant filter (searchFold)

## M3 — Data Import Wizard + Validation [Implemented] [Tested]
- [x] `src/lib/corpus-parser.js` (shared browser + CLI): noise-drop (875 lines:
      page numbers, running headers w/ section harvest), verse-pair grouping,
      7-ṭīkā author normalization (OCR-variant tolerant), footnotes, pair-rule
      TIKA→MULA switch so in-ṭīkā verse citations don't split chunks
- [x] Full-corpus parse: **2944 passages + 4550 ṭīkās in ~0.1s**
      (`corpus/durgasaptashati-source.txt` → `corpus/durgasaptashati.json`
      via `node tools/parse-corpus.mjs`); author split ≈ 520–645 per ṭīkā;
      sections resolve to 13 adhyāyas + Kavaca/Kīlaka/Rahasyas/Upoddhāta
- [x] Full import through `store.importAppend`: **2941 + 4550 in ~0.6s**
      (ordinal cache + batched sibling check; was 65s), 3 within-doc dupes
      skipped, 0 orphans, exact-Unicode round-trip verified
- [x] Browser wizard: Source (paste/upload, auto/corpus/JSON/CSV) →
      Preview (counts, new-vs-duplicate diff, top authors, samples, notes;
      nothing written) → Confirm (append-only + report)
- [x] CSV support (`section,mula,author,commentary`, quoted commas, empty-mula skip)
- [x] Parser unit tests (6) + within-doc-duplicate remap regression test
- [ ] Known heuristic limits (documented, user-visible in preview): multi-verse
      ṭīkā chunks attach to the most recent verse only (e.g. Argala v2–v4 ṭīkā
      sits under v4; citation text preserved); numberless closers may merge with
      the next verse; rare untagged Hindi fragments fall back to verbatim authors

## M4 — Search [Implemented] [Tested]
- [x] `src/lib/search.js`: inverted index (fold-key cache), diacritic-insensitive
      (`durgā`→`durga`, Vedic accents stripped), cross-script Latin↔Devanāgarī
      via transliterated dual keys (`durga` finds `दुर्गायै`), prefix matching,
      AND multi-token, field-weighted ranking, scope (mūla/ṭīkā/all) + author filter
- [x] Full-corpus: index ~1.5s once (background-warmed, memoized), queries ~10–30ms
- [x] UI: scope select + author box, ranked cards, result counts + per-hit
      summary, `<mark>` highlight (HTML-escaped), matching ṭīkās auto-expanded
- [x] 7 search tests + 2 IAST tests (inherent-a lookahead: `दुर्गा`→`durgā`,
      `कृष्णः`→`kṛṣṇaḥ`; anusvara/visarga keep the vowel: `गः`→`gaḥ`)
- [ ] Highlight falls back to none for fold-only matches (no raw anchor) — listed, unmarked

## M5 — Backup / Export / Recovery [Implemented] [Tested]
- [x] Full JSON export (per-scripture), quick file import (now with pre-import auto-snapshot)
- [x] Named snapshots in IndexedDB (`save/list/delete/restore`); restore is
      byte-exact (ids + text) with rollback; auto-snapshots pruned to newest 5
- [x] Integrity verify (orphan ṭīkās/passages, empty mūla, dup ordinals) +
      recovery banner (snapshot-first repair, dismissible)
- [x] 4 snapshot/integrity tests
- [ ] Scheduled (time-based) snapshots — manual + pre-write autos cover M5 for now

## M6 — Cloud Auth + Supabase Sync [Implemented] [Tested]
- [x] `SupabaseAdapter` (PostgREST, single `granthakosha_records(store,id,body,
      updated_at)` table, paged list, upsert puts) + `supabase/schema.sql`
      (RLS: public read, editor/admin write, admin-only delete)
- [x] `src/lib/sync.js`: snapshot/diff (LWW per record), push/pull/bidirectional
      with conflict report (kept local); deletes never propagate (documented)
- [x] UI cloud panel: Test / Dry-run (nothing written) / Push / Pull / Sync,
      all pre-write auto-snapshotted; creds: URL persisted, key session-only
- [x] 5 sync tests (diff classes, LWW convergence + no-op re-sync, round-trip,
      mocked-fetch CRUD mapping + error surfacing)
- [ ] Live end-to-end against a real project (no backend available in this env)

## M7 — Viewing mode (roles/admin UI removed) [Implemented]
- [x] No roles, no create/append/edit/delete/import/snapshot/cloud/repair UI —
      plain reading + search + themes only; content is maintainer-managed
      (versioned batches, committed + redeployed). `src/lib/rbac.js` removed;
      sync/storage/snapshot library code retained + tested for maintainer use.
- [x] A11y kept: skip link, live status regions, labeled controls, drawer
      focus-in/return-focus, Esc handling, high-contrast `<mark>` per theme,
      focus-visible rings, reduced-motion, touch targets + swipe gestures

## M8 — Docs & API [Implemented]
- [x] README + integrity rules + `docs/API.md` (adapter contract, ExportDoc v1,
      parser/search/snapshot conventions)

## Risks
1. **npm registry/cache unusable in this env** (cacache ENOENT) → mitigated with
   zero-dependency stack (no install step at all). Revisit if framework needed later.
2. ~~Full 23k-line corpus import~~ RESOLVED — parsed + imported + verified (see M3).
   Remaining: browser-side import of the 4.4 MB JSON (upload path tested for
   small files; large-file wizard run still needs a real-browser check).
3. **IAST transliteration is approximate** (display-only, halanta lookahead added) —
   needs akṣara-cluster handling (conjuncts, final-a) before M2 sign-off.
4. **IndexedDBAdapter + drawer/wizard/cloud DOM paths untested in a real browser**
   here — logic mirrors tested modules 1:1, but needs a browser smoke test.
   Live Supabase end-to-end likewise pending a real project.
