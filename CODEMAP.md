# SongLab Code Map

Auto-generated overview of all TypeScript files.
Re-generate: `./scripts/generate-codemap.sh > CODEMAP.md`

---

## src/types

### index.ts (96 lines)
- 3:export type SectionType =
- 14:export interface SectionMarker
- 23:export interface SongData
- 42:export interface LoopRange
- 48:export type TabSheetType = 'Guitar' | 'Bass' | 'Keys' | 'Vocals' | 'Drums' | 'Other';
- 50:export interface TabSheet
- 58:export interface SectionTab
- 67:export interface SetlistEntry
- 72:export interface SetlistPause
- 79:export interface SetlistSong
- 84:export type SetlistItem = SetlistSong | SetlistPause;
- 86:export interface Setlist
- 93:export interface SyncPoint

## src/stores

### useCountInStore.ts (44 lines)
- 20:export const useCountInStore = create<CountInStore>((set)

### useLoopStore.ts (50 lines)
- 27:export const useLoopStore = create<LoopStore>((set)
- **deps**: ../types

### useMetronomeStore.ts (41 lines)
- 27:export const useMetronomeStore = create<MetronomeStore>((set)

### useModeStore.ts (22 lines)
- 3:export type AppMode = 'practice' | 'band';
- 14:export const useModeStore = create<ModeStore>((set)

### useSongStore.ts (358 lines)
- 63:export const useSongStore = create<SongStore>((set, get)
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

### db.ts (209 lines)
- 79:export async function saveSong(song: SongData): Promise<void>
- 88:export async function getSong(id: string): Promise<SongData | undefined>
- 93:export async function getAllSongs(): Promise<SongData[]>
- 98:export async function deleteSong(id: string): Promise<void>
- 105:export async function saveMarker(marker: SectionMarker): Promise<void>
- 110:export async function getMarkersForSong(songId: string): Promise<SectionMarker[]>
- 115:export async function deleteMarker(id: string): Promise<void>
- 122:export async function saveTab(tab: SectionTab): Promise<void>
- 127:export async function getTabsForSong(songId: string): Promise<SectionTab[]>
- 132:export async function deleteTab(id: string): Promise<void>
- 137:export async function saveTabSheet(sheet: TabSheet): Promise<void>
- 142:export async function getTabSheetsForSong(songId: string): Promise<TabSheet[]>
- 147:export async function deleteTabSheet(id: string): Promise<void>
- 154:export async function getConfig<T>(key: string): Promise<T | undefined>
- 160:export async function setConfig<T>(key: string, value: T): Promise<void>
- 167:export async function saveAudioFile(
- 176:export async function getAudioFile(
- 183:export async function deleteAudioFile(songId: string): Promise<void>
- 190:export async function saveGpFile(
- 199:export async function getGpFile(
- 207:export async function deleteGpFile(songId: string): Promise<void>
- **deps**: ../types

### exportService.ts (163 lines)
- 119:export async function exportSong(song: SongData): Promise<void>
- 125:export async function importSong(file: File): Promise<SongData>
- 134:export async function exportSetlist(name: string, songs: SongData[]): Promise<void>
- 152:export async function importSetlist(file: File): Promise<SongData[]>
- **deps**: ../types,../utils/encoding

### metronomeScheduler.ts (179 lines)
- 13:export interface MetronomeHandle
- 59:export function startMetronome(opts: MetronomeOptions): MetronomeHandle
- **deps**: ../components/Tabs/NotationPanel

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

### sectionColors.ts (12 lines)
- 3:export const SECTION_COLORS: Record<SectionType, string> =
- **deps**: ../types

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

### useAudioFile.ts (149 lines)
- 15:export function useAudioFile({ onFileLoaded, onUpgraded }: UseAudioFileOptions = {})
- **deps**: ../services/audioAnalysis,../services/db,../stores/useSongStore,../stores/useTabStore,../types

### useControlCommandHandler.ts (91 lines)
- 17:export function useControlCommandHandler({
- **deps**: ../../shared/syncProtocol,../stores/useSongStore,../stores/useTabStore,../stores/useTempoStore

### useCountIn.ts (62 lines)
- 16:export function useCountIn({ bpm, timeSignature, onComplete, audible = true }: UseCountInOptions)
- **deps**: ../services/clickSoundGenerator,../stores/useCountInStore

### useDummyPlayback.ts (142 lines)
- 18:export function useDummyPlayback({ duration, onTimeUpdate, onFinish, onLoopRestart }: UseDummyPlaybackOptions)
- **deps**: ../stores/useLoopStore

### useExternalMediaSync.ts (167 lines)
- 99:export function useExternalMediaSync({

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

### usePlayback.ts (98 lines)
- 14:export function usePlayback({ onTimeUpdate, onFinish, onLoopRestart }: UsePlaybackOptions = {})
- **deps**: ../stores/useLoopStore

### useSetlistAdvance.ts (132 lines)
- 26:export function useSetlistAdvance({ onPlay }: UseSetlistAdvanceOptions): SetlistAdvanceResult
- **deps**: ../stores/useModeStore,../stores/useSongStore,../stores/useTabStore

### useSyncBroadcast.ts (118 lines)
- 23:export function useSyncBroadcast({ isPlaying, currentTime, countdownRemaining, tickPosition, countInBeat }: UseSync...
- **deps**: ../services/syncEmitter,../../shared/syncProtocol,../stores/useModeStore,../stores/useSyncStore,../stores/useTempoStore

### useSyncSession.ts (379 lines)
- 44:export function useSyncSession({
- **deps**: ../services/db,../services/syncEmitter,../../shared/syncProtocol,../stores/useSongStore,../stores/useSyncStore,../stores/useTabStore,../stores/useTempoStore,../types

## src/components/Layout

### AppShell.tsx (1140 lines)
- 48:export default function AppShell()
- **deps**: ../Controller/RemoteControlView,../../hooks/useActiveMarkerTracker,../../hooks/useAlphaSynthPlayback,../../hooks/useAudioFile,../../hooks/useControlCommandHandler,../../hooks/useCountIn,../../hooks/useDummyPlayback,../../hooks/useGpFile,../../hooks/useKeyboardShortcuts,../../hooks/useMetronome,../../hooks/usePlayback,../../hooks/useSetlistAdvance,../../hooks/useSyncBroadcast,../../hooks/useSyncSession,../Markers/MarkerForm,../Player/CountInIndicator,../Player/CountInToggle,../Player/DummyWaveform,../Player/LoopControls,../Player/MetronomeToggle,../Player/TempoControls,../Player/TransportControls,../Player/VolumeControl,../Player/WaveformPlayer,../../services/syncEmitter,../../../shared/syncProtocol,../../stores/useCountInStore,../../stores/useModeStore,../../stores/useSongStore,../../stores/useSyncStore,../../stores/useTabStore,../../stores/useTempoStore,../../stores/useToastStore,../Tabs/GpMarkerImportDialog,../Tabs/NotationPanel,../Tabs/TabEditor,../Tabs/TabViewer,../../utils/gpMarkerImport

### CreateDummySongDialog.tsx (263 lines)
- 12:export function CreateDummySongDialog({ onClose }: CreateDummySongDialogProps)
- **deps**: ../../stores/useSongStore,../../stores/useTabStore,../../stores/useToastStore

### Sidebar.tsx (645 lines)
- 19:export function Sidebar({ onSeekTo, duration, currentTime, isViewer = false, collapsed = false, onToggleCollapse, o...
- **deps**: ../Markers/MarkerList,../../services/exportService,../../stores/useModeStore,../../stores/useSongStore,../../stores/useTabStore,../../stores/useToastStore

### SongTabs.tsx (248 lines)
- 12:export function SongTabs({ onAddSong, onCreateDummy, isViewer = false }: SongTabsProps)
- **deps**: ../../stores/useSongStore,../../stores/useTabStore,../../stores/useToastStore

### SyncStatus.tsx (212 lines)
- 10:export function SyncStatus({ onConnect, onDisconnect }: SyncStatusProps)
- **deps**: ../../../shared/syncProtocol,../../stores/useSyncStore

### Toast.tsx (38 lines)
- 9:export function ToastContainer()
- **deps**: ../../stores/useToastStore

## src/components/Player

### CountInIndicator.tsx (39 lines)
- 8:export function CountInIndicator()
- **deps**: ../../stores/useCountInStore

### CountInToggle.tsx (107 lines)
- 6:export function CountInToggle()
- **deps**: ../../services/clickSoundGenerator,../../stores/useCountInStore,../../stores/useMetronomeStore,../../stores/useSongStore

### DummyWaveform.tsx (145 lines)
- 16:export function DummyWaveform({ duration, currentTime, height = 96, onSeek }: DummyWaveformProps)
- **deps**: ../../stores/useSongStore

### LoopControls.tsx (134 lines)
- 13:export function LoopControls({ songLoop }: LoopControlsProps)
- **deps**: ../../stores/useLoopStore,../../utils/formatTime

### MetronomeToggle.tsx (131 lines)
- 15:export function MetronomeToggle({
- **deps**: ../../services/clickSoundGenerator,../../stores/useMetronomeStore

### TempoControls.tsx (105 lines)
- 10:export function TempoControls()
- **deps**: ../../stores/useTempoStore

### TransportControls.tsx (132 lines)
- 38:export function TransportControls({

### VolumeControl.tsx (67 lines)
- 4:export function VolumeControl()
- **deps**: ../../stores/useSongStore

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

### MarkerList.tsx (191 lines)
- 14:export function MarkerList({ onSeekTo, duration, currentTime, onMarkerSelect }: MarkerListProps)
- **deps**: ../../stores/useLoopStore,../../stores/useSongStore,../../utils/formatTime

## src/components/Tabs

### GpMarkerImportDialog.tsx (108 lines)
- 12:export function GpMarkerImportDialog({
- **deps**: ../../utils/formatTime,../../utils/gpMarkerImport

### NotationPanel.tsx (557 lines)
- 47:export interface TempoMapEntry
- 53:export function NotationPanel({
- **deps**: ../../hooks/useExternalMediaSync,../../utils/tuningPresets

### SheetBar.tsx (173 lines)
- 17:export function SheetBar({ songId, isViewer = false }: SheetBarProps)
- **deps**: ../../stores/useModeStore,../../stores/useTabStore,../../types

### SyncOffsetEditor.tsx (227 lines)
- 24:export function SyncOffsetEditor({

### TabEditor.tsx (150 lines)
- 18:export function TabEditor({ marker, songId }: TabEditorProps)
- **deps**: ../../stores/useTabStore,../../types

### TabViewer.tsx (58 lines)
- 14:export function TabViewer({ marker, currentTime, isPlaying, sectionEnd, isViewer = false }: TabViewerProps)
- **deps**: ../../stores/useTabStore,../../types

## src/components/Controller

### RemoteControlView.tsx (340 lines)
- 15:export function RemoteControlView()
- **deps**: ../../services/syncEmitter,../../stores/useSongStore,../../stores/useSyncStore,../../stores/useTabStore,../../stores/useTempoStore,../../utils/formatTime

## shared

### syncProtocol.ts (203 lines)
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
- 188:export interface PeerInfo
- 195:export interface SessionSnapshot

## server

### index.ts (244 lines)
- **deps**: ../shared/syncProtocol.js

## src/

### App.tsx (6 lines)
- 7:export default App;

## src/

### main.tsx (9 lines)
