# SongLab refactor — changes

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
