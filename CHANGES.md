# SongLab — Changes

## v0.14.5 — 2026-09-26

All changes verified with: `tsc -b` (clean), `vitest run` (228 tests, all
passing), `eslint` (no errors), and `npm run build` (production build succeeds).

### Features
- Songbook: third sheet mode next to Notation and ASCII. Lyrics with chords
  above, stored as ChordPro text (`SongData.chordSheet`). Pasted
  chords-over-words sheets are converted automatically; import/export as `.cho`.
  Songs without GP file open in songbook mode when they have one.
- Chord overview with guitar diagrams (SVGuitar). Voicings come from a bundled
  chord database (chords-db), `{define}` directives, or a voicing generator for
  chords the database lacks (e.g. `G5/F#`, `Cmaj7/G`; marked "auto").
  Unicode accidentals (`C♯m`, `A♭`) are recognized.
- Active section highlighting: the songbook section matching the active marker
  (by label, numbered labels like "Chorus 2" map to repeated sections) is
  highlighted; auto-scroll keeps the start of the next section in view.
- Songbook sections can be imported as markers (Replace/Merge). Repeated
  sections and `{chorus}` references are numbered; start times are estimated
  from the text length.
- Whole-song ASCII tab: tabs can be edited without markers. Markers without
  their own tab fall back to it; "Create section tab" copies it to the marker.

### Fixes
- Seeking before the first marker kept the last marker selected; the selection
  is now cleared. The remote control shows the first marker as next.

### Internals
- `SongData.chordSheet` (optional, no DB migration); passes through export,
  import and Band Sync unchanged. `SongSyncPayload` extended.
- New utils: `chordSheetParser`, `chordLookup`, `voicingGenerator`,
  `fretboard` (tuning model, notes, chord identification — groundwork for
  issue #5), `songbookSectionMatch`, `songbookMarkerImport`, `sectionImport`,
  `tabScope`, `scrollLookahead`.
- `GpMarkerImportDialog` generalized to `Markers/MarkerImportDialog`.
- New dependencies: `tonal`, `svguitar`.

## v0.14.3 — 2026-09-25

All changes verified with: `tsc -b` (clean), `vitest run` (all passing),
`eslint` (no errors), and `npm run build` (production build succeeds).

### Features
- Import conflict handling: importing a setlist or gig whose name matches an
  existing setlist (trimmed, case-insensitive) opens a dialog with Replace /
  Keep both / Skip. Keep both imports as "Name (2)", "Name (3)", ... Multiple
  conflicts are resolved one by one or via "Apply to all remaining". Applies to
  file and URL import.
- Touch support: controls that were only revealed on hover (setlist items,
  pauses, markers, tab sheets) are now always visible on touch devices
  (`pointer-fine:` variant) and on keyboard focus.

### Internals
- Import pipeline split into parse (pure) and commit (IndexedDB) steps
  (`parseImportFile`, `parseSetlistFromUrl`, `commitBundles`); nothing is
  persisted before all conflicts are resolved. Songs referenced only by skipped
  setlists are not imported.
- New `useImportFlow` hook orchestrates import and conflict dialog.
- `useSetlistStore`: `findSetlistByName`, `getUniqueSetlistName`,
  `replaceSetlistItems`.
- Tests for store helpers, import parsing, the conflict flow and the dialog.

## v0.14.0 — 2026-07-16

All changes verified with: `tsc -b` (clean), `vitest run` (30 tests, 7 files, all
passing), `eslint` (no errors), and `npm run build` (production build succeeds). and `npm run build` (production build succeeds).

### Upgrade notes
- Sync protocol extended (backward-compatible optional fields). Host and viewers
  should run the same version.
- Rebuild (`npm run build`), restart the sync server, hard-reload all devices
  (PWA may serve the cached bundle until the service worker updates).

### Features
- Remote Controller: browse all host setlists and switch the active setlist.
  The host now transmits its full setlist collection (`SetlistSyncPayload.setlists`
  + `activeSetlistId`); controllers switch via the new `setlistSelect` control
  command. Synced setlists are kept ephemeral in `useSyncStore` and never touch
  the viewer's local library.

### Fixes
- Viewers with an empty local library silently dropped synced setlists —
  `setActiveItems` now lazy-creates a setlist (named after the host's).
- Metronome applied the playback rate twice after live tempo updates
  (`metronomeScheduler.setTempo`).
- v2 setlist exports were rejected by the URL import proxy (server now accepts
  both legacy and v2 formats).
- Section loop now resets the loop counter when the target is reached
  (consistent with the song-loop paths).
- Stale non-reactive getter subscriptions replaced with state selectors
  (marker tracker, remote control view, metronome/count-in toggles, app shell).
- Ref mutation during render moved into an effect (concurrent-rendering safe).

### Security
- SSRF hardening on the URL import proxy: redirects are followed manually and
  every hop is re-validated (HTTPS + private-range checks); private-URL
  detection extended (127/8, 0.0.0.0, 169.254.x, `.internal`, IPv6 loopback,
  link-local, unique-local, IPv4-mapped).
- Server clears the session snapshot (playback, song, setlist) when the host
  disconnects, so late joiners no longer receive orphaned state.

### Performance
- Chunked Base64 conversion (~5x faster on multi-MB GP/audio files in
  export and Band Sync).
- Sequential per-item persistence replaced with `Promise.all` (remote sync
  application, import/restore, GP marker import, marker color sync).
- Full song-data push (incl. GP binary) now only on song switch, GP change,
  or host connect — no longer on every tab/sheet/metadata edit.
- Keydown listener registered once (latest-values ref) instead of being
  re-attached on every playback tick.
- Notation cursor-follow scroll polls at ~7 Hz instead of forcing layout
  reads on every animation frame.
- Redundant per-render marker sorting removed (store keeps markers sorted;
  consumers use `findLast`); `removeMarker` updates only the owning song's
  array; memoized derivations in the remote control view; map-based setlist
  order sort.

### Robustness
- All async file flows (audio load, dummy upgrade, GP attach/remove/create,
  persisted loads) now surface errors via toast instead of silent unhandled
  rejections.
- Object-URL leaks fixed: URLs are revoked when replaced and when songs are
  removed; URL creation moved after successful processing.
- `React.MutableRefObject` → `React.RefObject` (React 19).
- `preferredSheetType` migrated from localStorage to the IndexedDB config
  store (one-time automatic migration).
- Song activation unified on `navigateToSong` everywhere.

### Tests
- New regression tests: marker scoping across song switches and Band Sync
  event application (incl. races and late events), setlist lazy-create.

---

# Refactor pass (pre-v0.14)

All changes verified with: `tsc -b` (clean), `vitest run` (25 tests, 6 files, all
passing), `eslint` (clean on every changed file), and `npm run build` (production
build succeeds).

## Setup required after pulling
Run `npm install` (new devDependencies were added) then `npm test` / `npm run test:run`.

## New dev tooling (Phase 0)
- Vitest + React Testing Library + jsdom test harness.
- `vite.config.ts`: now imports `defineConfig` from `vitest/config` and adds a
  `test` block (`globals`, `environment: 'jsdom'`, `setupFiles`).
- `package.json`: `test` (watch) and `test:run` (single run) scripts; new devDeps
  (vitest, @testing-library/{react,jest-dom,dom}, jsdom, fake-indexeddb).
- New: `src/test/setup.ts`, `src/test/smoke.test.tsx`.

## Phase 1 — Reentrant remote guard (sync echo-loop fix)
- `src/services/syncEmitter.ts`: replaced the `_isRemote` boolean with a
  `_remoteDepth` counter so nested/overlapping `runAsRemote` calls keep the remote
  state until the outermost settles. Fixes a potential echo loop under concurrent
  async handlers.
- New test: `src/services/syncEmitter.test.ts`.

## Phase 2a — Tempo domain consolidation
- New `src/services/tempoMap.ts`: single owner of `buildTempoSegments`,
  `elapsedMsToTick`, `tickToElapsedMs`, `tickToSeconds`.
- `src/types/index.ts`: `TempoSegment` and `TempoMapEntry` moved here (fixes a
  layer inversion where a service/hook imported a type from a component).
- `useExternalMediaSync.ts` and `gpMarkerImport.ts` now delegate to the service
  (removed the confessed copy-paste duplicate). `metronomeScheduler.ts`,
  `useMetronome.ts`, `NotationPanel.tsx`, `AppShell.tsx` import the type from
  `types` instead of the component.
- New test: `src/services/tempoMap.test.ts`.

## Phase 2b — Remote sync application moved into stores
- `useSongStore.ts`: `applyRemoteSongs`, `applyRemoteSongData`, `applyRemoteMarker`,
  `applyRemoteMarkerDelete`.
- `useTabStore.ts`: `applyRemoteTabsAndSheets`, `applyRemoteTab`,
  `applyRemoteTabDelete`, `applyRemoteSheet`, `applyRemoteSheetDelete`.
- `useSyncSession.ts`: reduced to wiring — incoming events delegate to the store
  actions inside `runAsRemote`; removed ~120 lines that duplicated store
  merge/sort/persist logic and the now-unused direct db imports. Added try/catch +
  toast error handling to the apply paths (previously absent).
- New test: `src/stores/useSongStore.test.ts` (upsert semantics).

## Phase 3 — Setlist store
- 3.1 Reactivity: new `src/hooks/useOrderedSetlist.ts` reactively joins the active
  setlist with the song library; removed the non-reactive cross-store getters
  `getOrderedSongs` / `getTotalDuration` from `useSetlistStore`. Rewired
  `SongTabs.tsx` and `Sidebar.tsx` (the latter no longer reads `getTotalDuration()`
  via `getState()` at render time — the source of stale totals).
- 3.2 DRY: introduced `updateSetlistById` / `mutateActiveSetlist` helpers,
  collapsing ~10 repeated "replace setlist in array + persist" blocks. Behavior
  preserved (guarded by tests).
- New test: `src/stores/useSetlistStore.test.ts` (8 characterization tests).

## Phase 4 (partial) — useClickOutside
- New `src/hooks/useClickOutside.ts` replaces four duplicated outside-click
  effects in `Sidebar.tsx`.
- New test: `src/hooks/useClickOutside.test.ts`.

## Not done (recommended as a focused follow-up)
- Full decomposition of `Sidebar.tsx` (~1120 lines) into subcomponents. This is a
  large UI refactor that cannot be verified headlessly (only at runtime in the
  app), so it is intentionally left out of this tested batch.
- Optional: extracting `AppShell.tsx` glue effects into hooks.
- Documentation drift cleanup (CODEMAP / PROJECT.md / CONVENTIONS).