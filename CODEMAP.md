# SongLab Code Map

Auto-generated overview of all TypeScript files.
Re-generate: `./scripts/generate-codemap.sh > CODEMAP.md`

---

## src/types

### index.ts (137 lines)
- 3:export type SectionType =
- 14:export interface SectionMarker
- 23:export interface SongData
- 45:export interface LoopRange
- 51:export type TabSheetType = 'Guitar' | 'Bass' | 'Keys' | 'Vocals' | 'Drums' | 'Other';
- 53:export interface TabSheet
- 61:export interface SectionTab
- 70:export interface SetlistPause
- 77:export interface SetlistSong
- 82:export type SetlistItem = SetlistSong | SetlistPause;
- 85:export type ImportConflictResolution = 'replace' | 'keepBoth' | 'skip';
- 87:export interface Setlist
- 95:export interface SyncPoint
- 102:export interface TempoSegment
- 111:export interface TimelineBar
- 133:export interface BeatPosition

## src/stores

### markerScoping.test.ts (80 lines)
- **deps**: ../types,../utils/songNavigation

### useCountInStore.ts (44 lines)
- 20:export const useCountInStore = create<CountInStore>((set)

### useLoopStore.ts (50 lines)
- 27:export const useLoopStore = create<LoopStore>((set)
- **deps**: ../types

### useMetronomeStore.ts (41 lines)
- 27:export const useMetronomeStore = create<MetronomeStore>((set)

### useMidiStore.ts (89 lines)
- 34:export const useMidiStore = create<MidiStore>((set, get)
- **deps**: ../services/db,../services/midiService

### useModeStore.ts (22 lines)
- 3:export type AppMode = 'edit' | 'session';
- 14:export const useModeStore = create<ModeStore>((set)

### useSetlistStore.test.ts (116 lines)
- **deps**: ../types

### useSetlistStore.ts (397 lines)
- 91:export const useSetlistStore = create<SetlistStore>((set, get) =>
- **deps**: ../services/db,../types

### useSongStore.test.ts (37 lines)
- **deps**: ../types

### useSongStore.ts (303 lines)
- 52:export const useSongStore = create<SongStore>((set, get)
- **deps**: ../services/db,../services/syncEmitter,../types

### useSyncStore.ts (94 lines)
- 4:export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';
- 64:export const useSyncStore = create<SyncStore>((set)
- **deps**: ../../shared/syncProtocol

### useTabStore.ts (298 lines)
- 60:export const useTabStore = create<TabStore>((set, get)
- **deps**: ../services/db,../services/syncEmitter,../types,../utils/tabScope

### useTempoStore.ts (16 lines)
- 11:export const useTempoStore = create<TempoStore>((set)

### useToastStore.ts (38 lines)
- 3:export type ToastType = 'success' | 'error' | 'info';
- 17:export const useToastStore = create<ToastStore>((set)

## src/services

### audioAnalysis.ts (28 lines)
- 4:export async function analyzeRmsGain(file: File): Promise<number>

### clickSoundGenerator.ts (132 lines)
- 18:export function ensureAudioReady(): void
- 28:export function getAudioContext(): AudioContext
- 39:export function scheduleClick(
- 64:export interface ScheduledBar
- 81:export function scheduleBar(

### db.ts (238 lines)
- 86:export async function saveSong(song: SongData): Promise<void>
- 95:export async function getSong(id: string): Promise<SongData | undefined>
- 100:export async function getAllSongs(): Promise<SongData[]>
- 105:export async function deleteSong(id: string): Promise<void>
- 112:export async function saveMarker(marker: SectionMarker): Promise<void>
- 117:export async function getMarkersForSong(songId: string): Promise<SectionMarker[]>
- 122:export async function deleteMarker(id: string): Promise<void>
- 129:export async function saveTab(tab: SectionTab): Promise<void>
- 134:export async function getTabsForSong(songId: string): Promise<SectionTab[]>
- 139:export async function deleteTab(id: string): Promise<void>
- 144:export async function saveTabSheet(sheet: TabSheet): Promise<void>
- 149:export async function getTabSheetsForSong(songId: string): Promise<TabSheet[]>
- 154:export async function deleteTabSheet(id: string): Promise<void>
- 161:export async function getConfig<T>(key: string): Promise<T | undefined>
- 167:export async function setConfig<T>(key: string, value: T): Promise<void>
- 174:export async function saveAudioFile(
- 183:export async function getAudioFile(
- 190:export async function deleteAudioFile(songId: string): Promise<void>
- 197:export async function saveGpFile(
- 206:export async function getGpFile(
- 214:export async function deleteGpFile(songId: string): Promise<void>
- 221:export async function saveSetlist(setlist: Setlist): Promise<void>
- 226:export async function getSetlist(id: string): Promise<Setlist | undefined>
- 231:export async function getAllSetlists(): Promise<Setlist[]>
- 236:export async function deleteSetlist(id: string): Promise<void>
- **deps**: ../types

### exportService.test.ts (126 lines)
- **deps**: ../types

### exportService.ts (298 lines)
- 17:export interface SongBundle
- 46:export interface ImportedSetlist
- 52:export type ParsedImport =
- 158:export async function exportSong(song: SongData): Promise<void>
- 166:export async function exportSetlist(
- 184:export async function exportGig(
- 242:export async function parseImportFile(file: File): Promise<ParsedImport>
- 252:export async function parseSetlistFromUrl(
- 275:export async function commitBundles(bundles: SongBundle[]): Promise<SongData[]>
- 288:export function selectBundlesToCommit(
- **deps**: ../types,../utils/encoding

### metronomeScheduler.test.ts (241 lines)

### metronomeScheduler.ts (254 lines)
- 27:export interface MetronomeHandle
- 74:export function startMetronome(opts: MetronomeOptions): MetronomeHandle
- **deps**: ../types

### midiService.ts (270 lines)
- 9:export type MidiMessageType = 'note_on' | 'note_off' | 'cc' | 'program_change';
- 11:export interface MidiMessage
- 19:export type MidiCommand =
- 33:export interface MidiMapping
- 40:export interface MidiDeviceInfo
- 46:export type MidiMessageListener = (message: MidiMessage)
- 50:export const DEFAULT_MAPPINGS: MidiMapping[] = [
- 73:export function isMidiSupported(): boolean
- 77:export async function requestMidiAccess(): Promise<boolean>
- 101:export function getMidiAccess(): MIDIAccess | null
- 105:export function getInputDevices(): MidiDeviceInfo[]
- 118:export function listenToAllInputs(): void
- 126:export function listenToInput(inputId: string): void
- 147:export function stopListening(): void
- 158:export function addMessageListener(listener: MidiMessageListener): void
- 162:export function removeMessageListener(listener: MidiMessageListener): void
- 166:export function disconnect(): void
- 177:export function matchMapping(
- **deps**: ../stores/useToastStore

### syncEmitter.test.ts (47 lines)

### syncEmitter.ts (138 lines)
- 30:export function setSyncSocket(socket: SyncSocket | null): void
- 36:export function isRemoteUpdate(): boolean
- 45:export async function runAsRemote(fn: ()
- 70:export function emitPlaybackUpdate(state: PlaybackState): void
- 75:export function emitSongSelect(songId: string): void
- 80:export function emitSongData(payload: SongDataPayload): void
- 85:export function emitMarkerSave(marker: MarkerSyncPayload): void
- 90:export function emitMarkerDelete(markerId: string, songId: string): void
- 95:export function emitTabSave(tab: TabSyncPayload): void
- 100:export function emitTabDelete(tabId: string, songId: string): void
- 105:export function emitSheetSave(sheet: SheetSyncPayload): void
- 110:export function emitSheetDelete(sheetId: string, songId: string): void
- 115:export function emitSetlistSync(payload: SetlistSyncPayload): void
- 122:export function emitControllerRequest(): void
- 127:export function emitControllerRelease(): void
- 134:export function emitControlCommand(command: ControlCommand): void
- **deps**: ../../shared/syncProtocol,../stores/useSyncStore

### tempoMap.test.ts (226 lines)
- **deps**: ../types

### tempoMap.ts (313 lines)
- 19:export function buildTempoSegments(score: alphaTab.model.Score | null | undefined): TempoSegment[]
- 40:export function elapsedMsToTick(elapsedMs: number, tempoMap: TempoSegment[]): number
- 70:export function tickToElapsedMs(tick: number, tempoMap: TempoSegment[]): number
- 96:export function tickToSeconds(tick: number, tempoMap: TempoSegment[]): number
- 139:export function buildTimeline(score: alphaTab.model.Score | null | undefined): TimelineBar[]
- 180:export function buildFixedTimeline(
- 208:export function withBpmAdjust(timeline: TimelineBar[], adjust: number): TimelineBar[]
- 220:export function barAt(timeline: TimelineBar[], barIndex: number): TimelineBar
- 241:export function beatTime(timeline: TimelineBar[], pos: BeatPosition): number
- 247:export function beatAccentIndex(timeline: TimelineBar[], pos: BeatPosition): number
- 253:export function nextBeatPosition(timeline: TimelineBar[], pos: BeatPosition): BeatPosition
- 285:export function beatPositionAtOrAfter(
- **deps**: ../types

## src/utils

### chordLookup.test.ts (109 lines)

### chordLookup.ts (289 lines)
- 21:export interface ChordVoicing
- 48:export interface ChordDb
- 60:export function loadGuitarChordDb(): Promise<ChordDb>
- 137:export function findVoicings(db: ChordDb, chordName: string): ChordVoicing[]
- 162:export interface ResolveOptions
- 176:export function resolveVoicings(
- 202:export function definitionToVoicing(def: ChordDefinition): ChordVoicing
- 230:export function definitionForShape(
- 246:export interface DiagramData
- 257:export function toDiagramData(voicing: Omit<ChordVoicing, 'source'>): DiagramData

### chordProEdit.test.ts (183 lines)

### chordProEdit.ts (329 lines)
- 9:export interface TextEdit
- 19:export function applyEdit(text: string, edit: TextEdit): string
- 60:export const SECTION_KINDS = [
- 80:export function nextSectionLabel(text: string, base: string): string
- 98:export function wrapInSection(
- 138:export function insertDirectiveLine(
- 151:export function insertComment(text: string, selectionStart: number, selectionEnd: number): TextEdit
- 160:export type MetaDirective = 'title' | 'artist' | 'key' | 'capo';
- 219:export function setMetaDirective(
- 257:export function insertChord(
- 270:export interface DefineVoicing
- 281:export function formatDefineDirective(name: string, voicing: DefineVoicing): string
- 293:export function setChordDefinition(

### chordSheetParser.test.ts (322 lines)

### chordSheetParser.ts (538 lines)
- 7:export interface ChordSegment
- 13:export type SheetLine =
- 19:export interface SheetSection
- 29:export interface ChordDefinition
- 39:export interface ParsedChordSheet
- 63:export function normalizeChord(token: string): string
- 68:export function isChord(token: string): boolean
- 197:export function parseChordPro(text: string): ParsedChordSheet
- 320:export function isChordLine(line: string): boolean
- 365:export function looksLikeChordsOverWords(text: string): boolean
- 371:export function chordsOverWordsToChordPro(text: string): string
- 437:export function looksLikeStackedChords(text: string): boolean
- 459:export function stackedChordsToChordPro(text: string): string
- 519:export type PastedSheetFormat = 'stacked' | 'chordsOverWords';
- 521:export const PASTED_SHEET_FORMAT_LABELS: Record<PastedSheetFormat, string> =
- 527:export function detectPastedSheetFormat(text: string): PastedSheetFormat | null
- 534:export function convertPastedSheet(text: string): { text: string; format: PastedSheetFormat | null }

### encoding.ts (25 lines)
- 6:export function arrayBufferToBase64(buffer: ArrayBuffer): string
- 18:export function base64ToArrayBuffer(base64: string): ArrayBuffer

### formatTime.ts (5 lines)
- 2:export function formatTime(seconds: number): string

### fretboard.test.ts (79 lines)

### fretboard.ts (102 lines)
- 7:export type Tuning = readonly string[];
- 9:export const STANDARD_TUNING: Tuning = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];
- 15:export interface FretPositions
- 21:export function absoluteFret(fret: number, baseFret: number): number
- 26:export function tuningToMidi(tuning: Tuning): number[]
- 35:export function isSameTuning(a: Tuning, b: Tuning): boolean
- 46:export function voicingToNotes(voicing: FretPositions, tuning: Tuning = STANDARD_TUNING): string[]
- 62:export function identifyChord(voicing: FretPositions, tuning: Tuning = STANDARD_TUNING): string[]
- 72:export function positionsFromAbsolute(frets: (number | null)[]): FretPositions
- 85:export function isSameVoicing(a: FretPositions, b: FretPositions): boolean
- 99:export function formatChordName(name: string): string

### gpMarkerImport.ts (43 lines)
- 7:export type GpRehearsalMark = ImportedMark;
- 17:export function extractGpMarkers(
- **deps**: ../services/tempoMap

### iconSizes.ts (10 lines)
- 2:export const ICON_SIZE =

### mergeDefined.ts (12 lines)
- 7:export function mergeDefined<T extends object>(base: T, update: T): T

### scrollLookahead.test.ts (28 lines)

### scrollLookahead.ts (62 lines)
- 6:export interface VerticalRange
- 20:export function computeScrollDelta(
- 49:export function scrollWithLookahead(active: HTMLElement, lookahead: HTMLElement): void

### sectionColors.ts (12 lines)
- 3:export const SECTION_COLORS: Record<SectionType, string> =
- **deps**: ../types

### sectionImport.ts (67 lines)
- 29:export function mapSectionType(name: string): SectionType
- 44:export interface ImportedMark
- 55:export function importedMarksToSectionMarkers(
- **deps**: ../types

### songbookmarkerimport.test.ts (73 lines)

### songbookMarkerImport.ts (87 lines)
- 70:export function songbookSectionsToMarks(sections: SheetSection[], duration: number): ImportedMark[]

### songbookSectionMatch.test.ts (58 lines)
- **deps**: ../types

### songbookSectionMatch.ts (47 lines)
- 28:export function findSectionForMarker(sections: SheetSection[], marker: SectionMarker | null): number
- **deps**: ../types

### songLoop.ts (28 lines)
- 8:export type SongLoopFinishAction = 'stop' | 'restart';
- 17:export function resolveSongLoopFinish(): SongLoopFinishAction
- **deps**: ../stores/useLoopStore

### songNavigation.ts (37 lines)
- 8:export async function navigateSong(
- 33:export async function navigateToSong(songId: string): Promise<void>
- **deps**: ../stores/useSetlistStore,../stores/useSongStore,../stores/useTabStore

### tabScope.test.ts (52 lines)
- **deps**: ../types

### tabScope.ts (57 lines)
- 10:export function songScopeId(songId: string): string
- 15:export function isSongScope(scopeId: string): boolean
- 20:export function tabKey(scopeId: string, sheetId: string): string
- 24:export interface ResolvedTab
- 38:export function resolveTab(
- **deps**: ../types

### tuningPresets.ts (99 lines)
- 4:export function midiToNoteName(midi: number): string
- 10:export function midiToNoteNameShort(midi: number): string
- 54:export interface TuningInfo
- 67:export function analyzeTuning(stringTuning: number[]): TuningInfo
- 93:export function formatTuning(info: TuningInfo): string

### Voicinggenerator.test.ts (75 lines)

### voicingGenerator.ts (171 lines)
- 131:export function generateVoicings(

## src/hooks

### useActiveMarkerTracker.ts (39 lines)
- 14:export function useActiveMarkerTracker(
- **deps**: ../stores/useSongStore,../stores/useTabStore,../types

### useAlphaSynthPlayback.ts (240 lines)
- 45:export function useAlphaSynthPlayback({
- **deps**: ../stores/useLoopStore,../stores/useTempoStore

### useAudioFile.ts (189 lines)
- 17:export function useAudioFile({ onFileLoaded, onUpgraded }: UseAudioFileOptions = {})
- **deps**: ../services/audioAnalysis,../services/db,../stores/useSetlistStore,../stores/useSongStore,../stores/useToastStore,../types,../utils/songNavigation

### useClickOutside.test.ts (38 lines)

### useClickOutside.ts (28 lines)
- 8:export function useClickOutside<T extends HTMLElement>(

### useControlCommandHandler.ts (65 lines)
- 17:export function useControlCommandHandler({
- **deps**: ../../shared/syncProtocol,../stores/useSetlistStore,../stores/useTempoStore,../utils/songNavigation

### useCountIn.ts (71 lines)
- 18:export function useCountIn({
- **deps**: ../services/clickSoundGenerator,../stores/useCountInStore

### useDummyPlayback.ts (142 lines)
- 18:export function useDummyPlayback({ duration, onTimeUpdate, onFinish, onLoopRestart }: UseDummyPlaybackOptions)
- **deps**: ../stores/useLoopStore

### useExternalMediaSync.ts (112 lines)
- 7:export { tickToElapsedMs };
- 8:export type { TempoSegment };
- 29:export function buildTempoMap(api: alphaTab.AlphaTabApi | null): TempoSegment[]
- 44:export function useExternalMediaSync({
- **deps**: ../services/tempoMap,../types

### useGpFile.ts (130 lines)
- 11:export function isGpFile(fileName: string): boolean
- 16:export function useGpFile()
- **deps**: ../services/db,../stores/useSetlistStore,../stores/useSongStore,../stores/useToastStore,../types,../utils/songNavigation

### useImportFlow.test.ts (127 lines)
- **deps**: ../services/db,../services/exportService,../stores/useSetlistStore,../stores/useSongStore,../types

### useImportFlow.ts (171 lines)
- 103:export function useImportFlow()
- **deps**: ../services/exportService,../stores/useSetlistStore,../stores/useSongStore,../stores/useTabStore,../stores/useToastStore,../types

### useKeyboardShortcuts.ts (87 lines)
- 15:export function useKeyboardShortcuts({
- **deps**: ../stores/useLoopStore

### useMetronome.ts (195 lines)
- 32:export function useMetronome({
- **deps**: ../services/metronomeScheduler,../services/tempoMap,../stores/useCountInStore,../stores/useMetronomeStore,../types

### useMidiInput.ts (223 lines)
- 33:export function useMidiInput({
- **deps**: ../services/midiService,../stores/useLoopStore,../stores/useMidiStore,../stores/useSetlistStore,../stores/useSongStore,../stores/useTempoStore,../utils/songNavigation

### useOrderedSetlist.ts (47 lines)
- 14:export function useOrderedSetlist(): { orderedSongs: SongData[]; totalDuration: number }
- **deps**: ../stores/useSetlistStore,../stores/useSongStore,../types

### usePersistedScale.test.ts (46 lines)
- **deps**: ../services/db

### usePersistedScale.ts (77 lines)
- 27:export function usePersistedScale({
- **deps**: ../services/db

### usePlayback.ts (98 lines)
- 14:export function usePlayback({ onTimeUpdate, onFinish, onLoopRestart }: UsePlaybackOptions = {})
- **deps**: ../stores/useLoopStore

### useResizablePanelHeight.test.ts (40 lines)
- **deps**: ../services/db

### useResizablePanelHeight.ts (128 lines)
- 34:export function useResizablePanelHeight({
- **deps**: ../services/db

### useSectionLoop.test.ts (84 lines)
- **deps**: ../stores/useLoopStore

### useSectionLoop.ts (46 lines)
- 25:export function useSectionLoop({
- **deps**: ../stores/useLoopStore,../utils/songLoop

### useSetlistAdvance.ts (131 lines)
- 27:export function useSetlistAdvance({ onPlay }: UseSetlistAdvanceOptions): SetlistAdvanceResult
- **deps**: ../stores/useModeStore,../stores/useSetlistStore,../stores/useSongStore,../stores/useTabStore

### useSyncBroadcast.ts (118 lines)
- 23:export function useSyncBroadcast({ isPlaying, currentTime, countdownRemaining, tickPosition, countInBeat }: UseSync...
- **deps**: ../services/syncEmitter,../../shared/syncProtocol,../stores/useModeStore,../stores/useSyncStore,../stores/useTempoStore

### useSyncSession.ts (290 lines)
- 34:export function useSyncSession({
- **deps**: ../services/syncEmitter,../../shared/syncProtocol,../stores/useSetlistStore,../stores/useSongStore,../stores/useSyncStore,../stores/useTabStore,../stores/useTempoStore,../types

### useWaveformInteraction.test.ts (185 lines)
- **deps**: ../stores/useLoopStore,../stores/useSongStore,../types

### useWaveformInteraction.ts (167 lines)
- 9:export interface WaveformDragState
- 39:export function useWaveformInteraction({
- **deps**: ../stores/useLoopStore,../stores/useSongStore,../types

## src/components/Layout

### AppShell.tsx (1392 lines)
- 68:export default function AppShell()
- **deps**: ../Controller/RemoteControlView,../../hooks/useActiveMarkerTracker,../../hooks/useAlphaSynthPlayback,../../hooks/useAudioFile,../../hooks/useControlCommandHandler,../../hooks/useCountIn,../../hooks/useDummyPlayback,../../hooks/useGpFile,../../hooks/useKeyboardShortcuts,../../hooks/useMetronome,../../hooks/useMidiInput,../../hooks/usePlayback,../../hooks/useSectionLoop,../../hooks/useSetlistAdvance,../../hooks/useSyncBroadcast,../../hooks/useSyncSession,../Markers/MarkerForm,../Markers/MarkerImportDialog,../Player/CountInIndicator,../Player/CountInToggle,../Player/DummyWaveform,../Player/Looppopoverbutton,../Player/MetronomeSplitButton,../Player/MetronomeToggle,../Player/TempoControls,../Player/TempoIndicator,../Player/TransportControls,../Player/VolumeControl,../Player/WaveformPlayer,../../services/syncEmitter,../../services/tempoMap,../../../shared/syncProtocol,../Songbook/SongbookEditor,../Songbook/SongbookView,../../stores/useCountInStore,../../stores/useModeStore,../../stores/useSetlistStore,../../stores/useSongStore,../../stores/useSyncStore,../../stores/useTabStore,../../stores/useTempoStore,../../stores/useToastStore,../Tabs/NotationPanel,../Tabs/TabEditor,../Tabs/TabViewer,../Tools/FretboardEditor,../Tools/StandaloneMetronome,../../types,../../utils/chordSheetParser,../../utils/gpMarkerImport,../../utils/iconSizes,../../utils/sectionImport,../../utils/songbookMarkerImport

### CreateDummySongDialog.tsx (265 lines)
- 13:export function CreateDummySongDialog({ onClose }: CreateDummySongDialogProps)
- **deps**: ../../stores/useSetlistStore,../../stores/useSongStore,../../stores/useTabStore,../../stores/useToastStore

### ImportConflictDialog.test.tsx (44 lines)

### ImportConflictDialog.tsx (113 lines)
- 24:export function ImportConflictDialog({
- **deps**: ../../types

### ImportExportPanel.tsx (217 lines)
- 20:export function ImportExportPanel()
- **deps**: ../../hooks/useClickOutside,../../hooks/useImportFlow,../../hooks/useOrderedSetlist,../../services/exportService,../../stores/useModeStore,../../stores/useSetlistStore,../../stores/useSongStore,../../stores/useToastStore,../../utils/iconSizes

### JoinPromptDialog.tsx (80 lines)
- 16:export function JoinPromptDialog({ role, onJoin, onClose }: JoinPromptDialogProps)
- **deps**: ../../../shared/syncProtocol

### MidiSettingsDialog.tsx (261 lines)
- 37:export function MidiSettingsDialog({ onClose }: MidiSettingsDialogProps)
- **deps**: ../../services/midiService,../../stores/useMidiStore,../../stores/useToastStore

### ModeMenu.tsx (30 lines)
- 3:export function ModeMenu()
- **deps**: ../../stores/useModeStore

### QrJoinDialog.tsx (131 lines)
- 15:export function QrJoinDialog({ serverUrl, onClose }: QrJoinDialogProps)
- **deps**: ../../stores/useToastStore

### SetlistItemList.tsx (592 lines)
- 28:export function SetlistItemList({ isViewer, canEdit, onAddSong, onCreateDummy }: SetlistItemListProps)
- **deps**: ../../hooks/useClickOutside,../../stores/useSetlistStore,../../stores/useSongStore,../../stores/useTabStore,../../stores/useToastStore,../../utils/iconSizes

### SetlistSelector.tsx (241 lines)
- 19:export function SetlistSelector({ canEdit }: SetlistSelectorProps)
- **deps**: ../../hooks/useClickOutside,../../hooks/useOrderedSetlist,../../stores/useSetlistStore,../../utils/formatTime,../../utils/iconSizes

### Sidebar.tsx (181 lines)
- 26:export function Sidebar({ onSeekTo, duration, currentTime, isViewer = false, collapsed = false, onToggleCollapse, o...
- **deps**: ../Markers/MarkerList,../../stores/useModeStore,../../stores/useSetlistStore,../../stores/useSongStore,../../stores/useTabStore,../../utils/iconSizes

### SongTabs.tsx (250 lines)
- 16:export function SongTabs({ onAddSong, onCreateDummy, isViewer = false }: SongTabsProps)
- **deps**: ../../hooks/useOrderedSetlist,../../stores/useSetlistStore,../../stores/useSongStore,../../stores/useTabStore,../../stores/useToastStore,../../utils/iconSizes

### SyncStatus.tsx (284 lines)
- 14:export function SyncStatus({ onConnect, onDisconnect }: SyncStatusProps)
- **deps**: ../../services/midiService,../../../shared/syncProtocol,../../stores/useMidiStore,../../stores/useSyncStore

### Toast.tsx (40 lines)
- 11:export function ToastContainer()
- **deps**: ../../stores/useToastStore,../../utils/iconSizes

### ToolsMenu.tsx (61 lines)
- 8:export function ToolsMenu({ onOpenMetronome, onOpenFretboard }: ToolsMenuProps)

### UrlImportDialog.tsx (162 lines)
- 15:export function UrlImportDialog({ onClose, onImported }: UrlImportDialogProps)
- **deps**: ../../services/db,../../services/exportService,../../stores/useSyncStore

## src/components/Player

### CountInIndicator.tsx (39 lines)
- 8:export function CountInIndicator()
- **deps**: ../../stores/useCountInStore

### CountInToggle.tsx (119 lines)
- 11:export function CountInToggle({ compact = false }: CountInToggleProps = {})
- **deps**: ../../services/clickSoundGenerator,../../stores/useCountInStore,../../stores/useMetronomeStore,../../stores/useSongStore

### DummyWaveform.tsx (124 lines)
- 28:export function DummyWaveform({ duration, currentTime, height = 96, onSeek }: DummyWaveformProps)
- **deps**: ../../hooks/useWaveformInteraction,../../stores/useLoopStore,../../stores/useSongStore

### LoopControls.tsx (136 lines)
- 15:export function LoopControls({ songLoop }: LoopControlsProps)
- **deps**: ../../stores/useLoopStore,../../utils/formatTime,../../utils/iconSizes

### LoopOverlay.tsx (127 lines)
- 66:export function LoopOverlay({
- **deps**: ../../hooks/useWaveformInteraction,../../types

### Looppopoverbutton.tsx (31 lines)
- 13:export function LoopPopoverButton({ songLoop }: LoopPopoverButtonProps)
- **deps**: ../Common/Popover

### MarkerOverlay.tsx (93 lines)
- 21:export function MarkerOverlay({
- **deps**: ../../hooks/useWaveformInteraction,../../types

### MetronomeSplitButton.tsx (198 lines)
- 25:export function MetronomeSplitButton({
- **deps**: ../Common/Popover,../../services/clickSoundGenerator,../../stores/useMetronomeStore,../../stores/useSongStore

### MetronomeToggle.tsx (133 lines)
- 17:export function MetronomeToggle({
- **deps**: ../../services/clickSoundGenerator,../../stores/useMetronomeStore,../../utils/iconSizes

### TempoControls.tsx (105 lines)
- 10:export function TempoControls()
- **deps**: ../../stores/useTempoStore

### TempoIndicator.tsx (32 lines)
- 10:export function TempoIndicator()
- **deps**: ../Common/Popover,../../stores/useTempoStore

### TransportControls.tsx (176 lines)
- 42:export function TransportControls({
- **deps**: ../../utils/iconSizes

### VolumeControl.tsx (69 lines)
- 6:export function VolumeControl()
- **deps**: ../../stores/useSongStore,../../utils/iconSizes

### WaveformPlayer.tsx (193 lines)
- 20:export function WaveformPlayer({
- **deps**: ../../hooks/useWaveformInteraction,../../stores/useLoopStore,../../stores/useSongStore,../../stores/useTempoStore

### WaveformTimeline.tsx (70 lines)
- 12:export function WaveformTimeline({ duration, currentTime }: WaveformTimelineProps)

## src/components/Markers

### MarkerEditForm.tsx (97 lines)
- 16:export function MarkerEditForm({ marker, onSave, onCancel }: MarkerEditFormProps)
- **deps**: ../../types,../../utils/sectionColors

### MarkerForm.tsx (131 lines)
- 21:export function MarkerForm({ currentTime, songId, onAdd, onCancel }: MarkerFormProps)
- **deps**: ../../types,../../utils/sectionColors

### MarkerImportDialog.test.tsx (48 lines)
- **deps**: ../../utils/sectionImport

### MarkerImportDialog.tsx (122 lines)
- 19:export function MarkerImportDialog({
- **deps**: ../../utils/formatTime,../../utils/sectionImport

### MarkerList.tsx (191 lines)
- 16:export function MarkerList({ onSeekTo, duration, currentTime, onMarkerSelect }: MarkerListProps)
- **deps**: ../../stores/useLoopStore,../../stores/useSongStore,../../utils/formatTime,../../utils/iconSizes

## src/components/Tabs

### NotationPanel.tsx (560 lines)
- 58:export function NotationPanel({
- **deps**: ../Common/PanelResizeHandle,../Common/ZoomControls,../../hooks/useExternalMediaSync,../../hooks/usePersistedScale,../../hooks/useResizablePanelHeight,../../services/tempoMap,../../types,../../utils/iconSizes,../../utils/tuningPresets

### SheetBar.tsx (177 lines)
- 19:export function SheetBar({ songId, isViewer = false }: SheetBarProps)
- **deps**: ../../stores/useModeStore,../../stores/useTabStore,../../types,../../utils/iconSizes

### SyncOffsetEditor.tsx (229 lines)
- 26:export function SyncOffsetEditor({
- **deps**: ../../utils/iconSizes

### TabEditor.tsx (195 lines)
- 22:export function TabEditor({ marker, songId }: TabEditorProps)
- **deps**: ../../stores/useTabStore,../../types,../../utils/iconSizes,../../utils/tabScope

### TabViewer.tsx (78 lines)
- 20:export function TabViewer({
- **deps**: ../../stores/useTabStore,../../types,../../utils/tabScope

## src/components/Controller

### RemoteControlView.tsx (418 lines)
- 19:export function RemoteControlView()
- **deps**: ../../services/syncEmitter,../../stores/useSetlistStore,../../stores/useSongStore,../../stores/useSyncStore,../../stores/useTabStore,../../stores/useTempoStore,../../types,../../utils/formatTime,../../utils/iconSizes

## shared

### syncProtocol.ts (220 lines)
- 7:export type SyncRole = 'host' | 'viewer';
- 11:export type ControlCommandType =
- 21:export interface ControlCommand
- 29:export interface PlaybackState
- 43:export interface ClientToServerEvents
- 81:export interface ServerToClientEvents
- 125:export interface MarkerSyncPayload
- 134:export interface TabSyncPayload
- 143:export interface SheetSyncPayload
- 153:export interface SongSyncPayload
- 173:export interface SongDataPayload
- 186:export interface SetlistInfoPayload
- 192:export interface SetlistSyncPayload
- 205:export interface PeerInfo
- 212:export interface SessionSnapshot

## server

### index.ts (478 lines)
- **deps**: ../shared/syncProtocol.js

## src/

### App.tsx (6 lines)
- 7:export default App;

## src/

### main.tsx (9 lines)
