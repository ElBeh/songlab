# SongLab Code Map

Auto-generated overview of all TypeScript files.
Re-generate: `./scripts/generate-codemap.sh > CODEMAP.md`

---

## src/types

### index.ts (92 lines)
- 3:export type SectionType =
- 14:export interface SectionMarker
- 23:export interface SongData
- 42:export interface LoopRange
- 48:export type TabSheetType = 'Guitar' | 'Bass' | 'Keys' | 'Vocals' | 'Drums' | 'Other';
- 50:export interface TabSheet
- 58:export interface SectionTab
- 67:export interface SetlistPause
- 74:export interface SetlistSong
- 79:export type SetlistItem = SetlistSong | SetlistPause;
- 81:export interface Setlist
- 89:export interface SyncPoint

## src/stores

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

### useSetlistStore.ts (434 lines)
- 79:export const useSetlistStore = create<SetlistStore>((set, get)
- **deps**: ../services/db,../types

### useSongStore.ts (216 lines)
- 39:export const useSongStore = create<SongStore>((set, get)
- **deps**: ../services/db,../services/syncEmitter,../types

### useSyncStore.ts (83 lines)
- 4:export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';
- 57:export const useSyncStore = create<SyncStore>((set)
- **deps**: ../../shared/syncProtocol

### useTabStore.ts (173 lines)
- 44:export const useTabStore = create<TabStore>((set, get)
- **deps**: ../services/db,../services/syncEmitter,../types

### useTempoStore.ts (16 lines)
- 11:export const useTempoStore = create<TempoStore>((set)

### useToastStore.ts (38 lines)
- 3:export type ToastType = 'success' | 'error' | 'info';
- 17:export const useToastStore = create<ToastStore>((set)

## src/services

### audioAnalysis.ts (28 lines)
- 4:export async function analyzeRmsGain(file: File): Promise<number>

### clickSoundGenerator.ts (128 lines)
- 18:export function ensureAudioReady(): void
- 28:export function getAudioContext(): AudioContext
- 39:export function scheduleClick(
- 64:export interface ScheduledBar
- 79:export function scheduleBar(

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

### exportService.ts (320 lines)
- 46:export type ImportResult =
- 51:export interface SetlistImportResult
- 154:export async function exportSong(song: SongData): Promise<void>
- 162:export async function exportSetlist(
- 180:export async function exportGig(
- 253:export async function importFile(file: File): Promise<ImportResult>
- 304:export async function importSetlistFromUrl(
- **deps**: ../types,../utils/encoding

### metronomeScheduler.ts (179 lines)
- 13:export interface MetronomeHandle
- 59:export function startMetronome(opts: MetronomeOptions): MetronomeHandle
- **deps**: ../components/Tabs/NotationPanel

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

### syncEmitter.ts (134 lines)
- 27:export function setSyncSocket(socket: SyncSocket | null): void
- 33:export function isRemoteUpdate(): boolean
- 41:export async function runAsRemote(fn: ()
- 66:export function emitPlaybackUpdate(state: PlaybackState): void
- 71:export function emitSongSelect(songId: string): void
- 76:export function emitSongData(payload: SongDataPayload): void
- 81:export function emitMarkerSave(marker: MarkerSyncPayload): void
- 86:export function emitMarkerDelete(markerId: string, songId: string): void
- 91:export function emitTabSave(tab: TabSyncPayload): void
- 96:export function emitTabDelete(tabId: string, songId: string): void
- 101:export function emitSheetSave(sheet: SheetSyncPayload): void
- 106:export function emitSheetDelete(sheetId: string, songId: string): void
- 111:export function emitSetlistSync(payload: SetlistSyncPayload): void
- 118:export function emitControllerRequest(): void
- 123:export function emitControllerRelease(): void
- 130:export function emitControlCommand(command: ControlCommand): void
- **deps**: ../../shared/syncProtocol,../stores/useSyncStore

## src/utils

### encoding.ts (18 lines)
- 2:export function arrayBufferToBase64(buffer: ArrayBuffer): string
- 12:export function base64ToArrayBuffer(base64: string): ArrayBuffer

### formatTime.ts (5 lines)
- 2:export function formatTime(seconds: number): string

### gpMarkerImport.ts (160 lines)
- 102:export interface GpRehearsalMark
- 117:export function extractGpMarkers(
- 149:export function gpMarksToSectionMarkers(
- **deps**: ../types

### iconSizes.ts (10 lines)
- 2:export const ICON_SIZE =

### sectionColors.ts (12 lines)
- 3:export const SECTION_COLORS: Record<SectionType, string> =
- **deps**: ../types

### songNavigation.ts (37 lines)
- 8:export async function navigateSong(
- 33:export async function navigateToSong(songId: string): Promise<void>
- **deps**: ../stores/useSetlistStore,../stores/useSongStore,../stores/useTabStore

### tuningPresets.ts (99 lines)
- 4:export function midiToNoteName(midi: number): string
- 10:export function midiToNoteNameShort(midi: number): string
- 54:export interface TuningInfo
- 67:export function analyzeTuning(stringTuning: number[]): TuningInfo
- 93:export function formatTuning(info: TuningInfo): string

## src/hooks

### useActiveMarkerTracker.ts (37 lines)
- 14:export function useActiveMarkerTracker(
- **deps**: ../stores/useSongStore,../stores/useTabStore,../types

### useAlphaSynthPlayback.ts (218 lines)
- 24:export function useAlphaSynthPlayback({
- **deps**: ../stores/useLoopStore,../stores/useTempoStore

### useAudioFile.ts (151 lines)
- 16:export function useAudioFile({ onFileLoaded, onUpgraded }: UseAudioFileOptions = {})
- **deps**: ../services/audioAnalysis,../services/db,../stores/useSetlistStore,../stores/useSongStore,../stores/useTabStore,../types

### useControlCommandHandler.ts (58 lines)
- 16:export function useControlCommandHandler({
- **deps**: ../../shared/syncProtocol,../stores/useTempoStore,../utils/songNavigation

### useCountIn.ts (62 lines)
- 16:export function useCountIn({ bpm, timeSignature, onComplete, audible = true }: UseCountInOptions)
- **deps**: ../services/clickSoundGenerator,../stores/useCountInStore

### useDummyPlayback.ts (142 lines)
- 18:export function useDummyPlayback({ duration, onTimeUpdate, onFinish, onLoopRestart }: UseDummyPlaybackOptions)
- **deps**: ../stores/useLoopStore

### useExternalMediaSync.ts (197 lines)
- 5:export interface TempoSegment
- 33:export function buildTempoMap(api: alphaTab.AlphaTabApi | null): TempoSegment[]
- 93:export function tickToElapsedMs(tick: number, tempoMap: TempoSegment[]): number
- 129:export function useExternalMediaSync({

### useGpFile.ts (106 lines)
- 9:export function isGpFile(fileName: string): boolean
- 14:export function useGpFile()
- **deps**: ../services/db,../stores/useSongStore,../stores/useTabStore,../types

### useKeyboardShortcuts.ts (75 lines)
- 15:export function useKeyboardShortcuts({
- **deps**: ../stores/useLoopStore

### useMetronome.ts (192 lines)
- 56:export function useMetronome({
- **deps**: ../components/Tabs/NotationPanel,../services/metronomeScheduler,../stores/useCountInStore,../stores/useMetronomeStore

### useMidiInput.ts (223 lines)
- 33:export function useMidiInput({
- **deps**: ../services/midiService,../stores/useLoopStore,../stores/useMidiStore,../stores/useSetlistStore,../stores/useSongStore,../stores/useTempoStore,../utils/songNavigation

### usePlayback.ts (98 lines)
- 14:export function usePlayback({ onTimeUpdate, onFinish, onLoopRestart }: UsePlaybackOptions = {})
- **deps**: ../stores/useLoopStore

### useSetlistAdvance.ts (134 lines)
- 27:export function useSetlistAdvance({ onPlay }: UseSetlistAdvanceOptions): SetlistAdvanceResult
- **deps**: ../stores/useModeStore,../stores/useSetlistStore,../stores/useSongStore,../stores/useTabStore

### useSyncBroadcast.ts (118 lines)
- 23:export function useSyncBroadcast({ isPlaying, currentTime, countdownRemaining, tickPosition, countInBeat }: UseSync...
- **deps**: ../services/syncEmitter,../../shared/syncProtocol,../stores/useModeStore,../stores/useSyncStore,../stores/useTempoStore

### useSyncSession.ts (381 lines)
- 45:export function useSyncSession({
- **deps**: ../services/db,../services/syncEmitter,../../shared/syncProtocol,../stores/useSetlistStore,../stores/useSongStore,../stores/useSyncStore,../stores/useTabStore,../stores/useTempoStore,../types

## src/components/Layout

### AppShell.tsx (1207 lines)
- 55:export default function AppShell()
- **deps**: ../Controller/RemoteControlView,../../hooks/useActiveMarkerTracker,../../hooks/useAlphaSynthPlayback,../../hooks/useAudioFile,../../hooks/useControlCommandHandler,../../hooks/useCountIn,../../hooks/useDummyPlayback,../../hooks/useGpFile,../../hooks/useKeyboardShortcuts,../../hooks/useMetronome,../../hooks/useMidiInput,../../hooks/usePlayback,../../hooks/useSetlistAdvance,../../hooks/useSyncBroadcast,../../hooks/useSyncSession,../Markers/MarkerForm,../Player/CountInIndicator,../Player/CountInToggle,../Player/DummyWaveform,../Player/Looppopoverbutton,../Player/MetronomeSplitButton,../Player/MetronomeToggle,../Player/TempoControls,../Player/TempoIndicator,../Player/TransportControls,../Player/VolumeControl,../Player/WaveformPlayer,../../services/syncEmitter,../../../shared/syncProtocol,../../stores/useCountInStore,../../stores/useModeStore,../../stores/useSetlistStore,../../stores/useSongStore,../../stores/useSyncStore,../../stores/useTabStore,../../stores/useTempoStore,../../stores/useToastStore,../Tabs/GpMarkerImportDialog,../Tabs/NotationPanel,../Tabs/TabEditor,../Tabs/TabViewer,../../utils/gpMarkerImport,../../utils/iconSizes

### CreateDummySongDialog.tsx (265 lines)
- 13:export function CreateDummySongDialog({ onClose }: CreateDummySongDialogProps)
- **deps**: ../../stores/useSetlistStore,../../stores/useSongStore,../../stores/useTabStore,../../stores/useToastStore

### MidiSettingsDialog.tsx (261 lines)
- 37:export function MidiSettingsDialog({ onClose }: MidiSettingsDialogProps)
- **deps**: ../../services/midiService,../../stores/useMidiStore,../../stores/useToastStore

### Sidebar.tsx (1116 lines)
- 25:export function Sidebar({ onSeekTo, duration, currentTime, isViewer = false, collapsed = false, onToggleCollapse, o...
- **deps**: ../Markers/MarkerList,../../services/exportService,../../stores/useModeStore,../../stores/useSetlistStore,../../stores/useSongStore,../../stores/useTabStore,../../stores/useToastStore,../../utils/formatTime,../../utils/iconSizes

### SongTabs.tsx (253 lines)
- 15:export function SongTabs({ onAddSong, onCreateDummy, isViewer = false }: SongTabsProps)
- **deps**: ../../stores/useSetlistStore,../../stores/useSongStore,../../stores/useTabStore,../../stores/useToastStore,../../utils/iconSizes

### SyncStatus.tsx (266 lines)
- 13:export function SyncStatus({ onConnect, onDisconnect }: SyncStatusProps)
- **deps**: ../../services/midiService,../../../shared/syncProtocol,../../stores/useMidiStore,../../stores/useSyncStore

### Toast.tsx (40 lines)
- 11:export function ToastContainer()
- **deps**: ../../stores/useToastStore,../../utils/iconSizes

### UrlImportDialog.tsx (164 lines)
- 15:export function UrlImportDialog({ onClose, onImported }: UrlImportDialogProps)
- **deps**: ../../services/db,../../services/exportService,../../stores/useSyncStore,../../stores/useToastStore

## src/components/Player

### CountInIndicator.tsx (39 lines)
- 8:export function CountInIndicator()
- **deps**: ../../stores/useCountInStore

### CountInToggle.tsx (116 lines)
- 11:export function CountInToggle({ compact = false }: CountInToggleProps = {})
- **deps**: ../../services/clickSoundGenerator,../../stores/useCountInStore,../../stores/useMetronomeStore,../../stores/useSongStore

### DummyWaveform.tsx (145 lines)
- 16:export function DummyWaveform({ duration, currentTime, height = 96, onSeek }: DummyWaveformProps)
- **deps**: ../../stores/useSongStore

### LoopControls.tsx (136 lines)
- 15:export function LoopControls({ songLoop }: LoopControlsProps)
- **deps**: ../../stores/useLoopStore,../../utils/formatTime,../../utils/iconSizes

### Looppopoverbutton.tsx (31 lines)
- 13:export function LoopPopoverButton({ songLoop }: LoopPopoverButtonProps)
- **deps**: ../Common/Popover

### MetronomeSplitButton.tsx (195 lines)
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

### WaveformPlayer.tsx (429 lines)
- 24:export function WaveformPlayer({
- **deps**: ../../stores/useLoopStore,../../stores/useSongStore,../../stores/useTempoStore

### WaveformTimeline.tsx (70 lines)
- 12:export function WaveformTimeline({ duration, currentTime }: WaveformTimelineProps)

## src/components/Markers

### MarkerEditForm.tsx (97 lines)
- 16:export function MarkerEditForm({ marker, onSave, onCancel }: MarkerEditFormProps)
- **deps**: ../../types,../../utils/sectionColors

### MarkerForm.tsx (131 lines)
- 21:export function MarkerForm({ currentTime, songId, onAdd, onCancel }: MarkerFormProps)
- **deps**: ../../types,../../utils/sectionColors

### MarkerList.tsx (193 lines)
- 16:export function MarkerList({ onSeekTo, duration, currentTime, onMarkerSelect }: MarkerListProps)
- **deps**: ../../stores/useLoopStore,../../stores/useSongStore,../../utils/formatTime,../../utils/iconSizes

## src/components/Tabs

### GpMarkerImportDialog.tsx (108 lines)
- 12:export function GpMarkerImportDialog({
- **deps**: ../../utils/formatTime,../../utils/gpMarkerImport

### NotationPanel.tsx (580 lines)
- 51:export interface TempoMapEntry
- 57:export function NotationPanel({
- **deps**: ../../hooks/useExternalMediaSync,../../utils/iconSizes,../../utils/tuningPresets

### SheetBar.tsx (175 lines)
- 19:export function SheetBar({ songId, isViewer = false }: SheetBarProps)
- **deps**: ../../stores/useModeStore,../../stores/useTabStore,../../types,../../utils/iconSizes

### SyncOffsetEditor.tsx (229 lines)
- 26:export function SyncOffsetEditor({
- **deps**: ../../utils/iconSizes

### TabEditor.tsx (152 lines)
- 20:export function TabEditor({ marker, songId }: TabEditorProps)
- **deps**: ../../stores/useTabStore,../../types,../../utils/iconSizes

### TabViewer.tsx (58 lines)
- 14:export function TabViewer({ marker, currentTime, isPlaying, sectionEnd, isViewer = false }: TabViewerProps)
- **deps**: ../../stores/useTabStore,../../types

## src/components/Controller

### RemoteControlView.tsx (385 lines)
- 18:export function RemoteControlView()
- **deps**: ../../services/syncEmitter,../../stores/useSetlistStore,../../stores/useSongStore,../../stores/useSyncStore,../../stores/useTabStore,../../stores/useTempoStore,../../utils/formatTime,../../utils/iconSizes

## shared

### syncProtocol.ts (204 lines)
- 7:export type SyncRole = 'host' | 'viewer';
- 11:export type ControlCommandType =
- 20:export interface ControlCommand
- 27:export interface PlaybackState
- 41:export interface ClientToServerEvents
- 79:export interface ServerToClientEvents
- 123:export interface MarkerSyncPayload
- 132:export interface TabSyncPayload
- 141:export interface SheetSyncPayload
- 151:export interface SongSyncPayload
- 169:export interface SongDataPayload
- 181:export interface SetlistSyncPayload
- 189:export interface PeerInfo
- 196:export interface SessionSnapshot

## server

### index.ts (375 lines)
- **deps**: ../shared/syncProtocol.js

## src/

### App.tsx (6 lines)
- 7:export default App;

## src/

### main.tsx (9 lines)
