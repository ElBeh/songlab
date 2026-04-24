# SongLab – Practice Tool & Digital Music Stand

## Goal
A browser-based practice tool and digital music stand for musicians and bands. Load songs (audio files or Guitar Pro notation), visualize the waveform, mark song sections, loop and practice at adjustable tempo, and synchronize playback across devices in Band Sync mode.

## Scope

### In Scope
- Load local audio files (MP3, WAV, OGG, FLAC) with waveform visualization
- Guitar Pro notation rendering (.gp3–.gp8, .gpx) via alphaTab with audio sync
- Dummy songs (no audio file) with alphaSynth MIDI playback from GP files
- Section markers with type labels, color coding, drag-to-reposition
- Loop mode: section loop, custom A/B loop with draggable handles, loop counter
- ASCII tab editor with multiple sheets per song (Guitar, Bass, Keys, Vocals, Drums)
- Tempo/speed control (50%–150%) with pitch correction
- Volume control with RMS-based audio normalization
- Persistent song library with audio and GP files stored in IndexedDB
- Setlist builder with drag & drop reordering and pause entries
- Song and setlist export/import (JSON, including GP files as Base64)
- Band Sync mode: real-time playback sync over local network (WebSocket)
- Remote Controller: viewers can request transport control via mutex
- Count-in: configurable click before playback and loop restarts
- Metronome: continuous click during playback synced to song BPM
- Tuning display: show active track's tuning from GP file
- MIDI input: footswitch/controller support via Web MIDI API with configurable mappings
- PWA support: installable, offline-capable after first load
- Responsive single-page app (desktop-first, landscape-oriented)

### Out of Scope (for now)
- Cloud sync / multi-device persistence
- Automatic chord/tab detection (AI)
- Recording
- Mobile-first design
- Multi-user editing (viewers are read-only in Band Sync)

## Tech Stack

| Category          | Technology                                              |
|-------------------|---------------------------------------------------------|
| Language          | TypeScript 5.9                                          |
| Framework         | React 19                                                |
| Bundler           | Vite 7                                                  |
| Audio             | wavesurfer.js 7                                         |
| Notation          | alphaTab 1.8 (MPL-2.0)                                 |
| State Management  | Zustand 5                                               |
| Persistence       | IndexedDB via idb 8                                     |
| Styling           | Tailwind CSS 4 (via @tailwindcss/vite)                  |
| Band Sync Server  | Express 5 + socket.io 4                                 |
| PWA               | vite-plugin-pwa                                         |
| Linting           | ESLint 9 (flat config) + typescript-eslint + react-hooks + react-refresh |
| Patching          | patch-package (alphaTab patch)                          |

## Architecture

Client-side SPA with optional Node.js sync server for Band Sync mode.

```
src/
├── components/
│   ├── Controller/
│   │   └── RemoteControlView.tsx     # Band Sync viewer remote control UI
│   ├── Layout/
│   │   ├── AppShell.tsx              # Root shell: state wiring, drag & drop, mode routing
│   │   ├── Sidebar.tsx               # Accordion sidebar: sections list, setlist panel
│   │   ├── SongTabs.tsx              # Song library tab bar with add/import/export
│   │   ├── SyncStatus.tsx            # Band Sync + MIDI controller status and controls
│   │   ├── MidiSettingsDialog.tsx    # MIDI mapping table with MIDI Learn
│   │   ├── CreateDummySongDialog.tsx  # Dialog for creating dummy (no-audio) songs
│   │   └── Toast.tsx                 # Toast notification container
│   ├── Markers/
│   │   ├── MarkerForm.tsx            # Add marker form with type, label, color picker
│   │   ├── MarkerList.tsx            # Section list with active highlight, edit, loop, delete
│   │   └── MarkerEditForm.tsx        # Inline edit form for existing markers
│   ├── Player/
│   │   ├── WaveformPlayer.tsx        # Waveform rendering, marker overlays, loop overlays, drag
│   │   ├── WaveformTimeline.tsx      # Custom timeline/ruler below waveform
│   │   ├── TransportControls.tsx     # Play/pause, reset, song loop, seek
│   │   ├── TempoControls.tsx         # Speed slider, pitch correction, presets
│   │   ├── LoopControls.tsx          # Loop on/off, A/B mode, loop counter/target
│   │   ├── VolumeControl.tsx         # Volume slider + normalization toggle
│   │   ├── DummyWaveform.tsx         # Simulated waveform for dummy songs (no audio)
│   │   ├── CountInIndicator.tsx      # Visual countdown overlay during count-in
│   │   ├── CountInToggle.tsx         # Count-in on/off toggle with beat config
│   │   └── MetronomeToggle.tsx       # Metronome on/off toggle with volume control
│   └── Tabs/
│       ├── TabEditor.tsx             # ASCII tab textarea with per-sheet editing
│       ├── TabViewer.tsx             # Read-only tab view with auto-scroll during playback
│       ├── NotationPanel.tsx         # alphaTab notation renderer with track selector + mixer
│       ├── SheetBar.tsx              # Tab sheet selector bar (Guitar, Bass, Keys, etc.)
│       ├── SyncOffsetEditor.tsx      # Fine-tune audio↔notation sync (offset + BPM correction)
│       └── GpMarkerImportDialog.tsx  # Import rehearsal marks from GP file as section markers
├── hooks/
│   ├── usePlayback.ts               # Unified playback interface (audio or dummy)
│   ├── useAudioFile.ts              # Audio file loading, IndexedDB persistence
│   ├── useGpFile.ts                 # Guitar Pro file loading, IndexedDB persistence
│   ├── useAlphaSynthPlayback.ts     # alphaSynth MIDI playback for dummy+GP songs
│   ├── useDummyPlayback.ts          # Simulated playback clock for dummy songs
│   ├── useActiveMarkerTracker.ts    # Track which section marker is active during playback
│   ├── useKeyboardShortcuts.ts      # Space, M, L, ←/→ shortcuts
│   ├── useSetlistAdvance.ts         # Auto-advance to next song with countdown
│   ├── useCountIn.ts                # Count-in click scheduling and state management
│   ├── useMetronome.ts              # Metronome click scheduling synced to BPM/tempo map
│   ├── useMidiInput.ts             # MIDI input → store action dispatch, section navigation
│   ├── useSyncSession.ts            # Band Sync WebSocket connection lifecycle
│   ├── useSyncBroadcast.ts          # Broadcast local state changes to sync peers
│   ├── useExternalMediaSync.ts      # Apply incoming sync state to local playback
│   └── useControlCommandHandler.ts  # Handle remote control commands (play, pause, seek, etc.)
├── stores/
│   ├── useSongStore.ts              # Songs, markers, setlist order (Zustand)
│   ├── useLoopStore.ts              # Loop state: section loop, A/B loop, counter/target
│   ├── useTabStore.ts               # Tab content + tab sheets per song
│   ├── useTempoStore.ts             # Playback rate + pitch correction
│   ├── useModeStore.ts              # App mode (practice/band) + auto-advance toggle
│   ├── useSyncStore.ts              # Band Sync connection state, peers, synced playback
│   ├── useToastStore.ts             # Toast notification queue
│   ├── useMidiStore.ts             # MIDI devices, mappings, learn mode (persisted in config)
│   ├── useCountInStore.ts           # Count-in state (active, beat count, config)
│   └── useMetronomeStore.ts         # Metronome state (enabled, volume, solo)
├── services/
│   ├── db.ts                        # IndexedDB access: songs, markers, tabs, sheets, audio, GP files, config
│   ├── syncEmitter.ts               # Socket.io emit helpers with host/remote guards
│   ├── exportService.ts             # Song/setlist export/import (JSON with GP Base64)
│   ├── midiService.ts              # Web MIDI API access, device enumeration, message parsing
│   ├── audioAnalysis.ts             # RMS-based normalization gain calculation
│   ├── clickSoundGenerator.ts       # Web Audio click synthesis for count-in and metronome
│   └── metronomeScheduler.ts        # Lookahead scheduler for precise metronome timing
├── types/
│   └── index.ts                     # SongData, SectionMarker, SectionTab, TabSheet, Setlist, SyncPoint, etc.
├── utils/
│   ├── sectionColors.ts             # Default colors per SectionType
│   ├── gpMarkerImport.ts            # Extract rehearsal marks from alphaTab Score → SectionMarker
│   ├── formatTime.ts                # mm:ss time formatting
│   ├── encoding.ts                  # ArrayBuffer ↔ Base64 conversion helpers
│   ├── songNavigation.ts           # Shared setlist navigation (prev/next song)
│   └── tuningPresets.ts             # Named tuning presets (Standard, Drop D, DADGAD, etc.)
├── App.tsx
└── main.tsx

server/
└── index.ts                         # Express + socket.io sync server (Band Sync)

shared/
└── syncProtocol.ts                  # Shared types for WebSocket events (client ↔ server)
```

## Data Model (IndexedDB)

Database: `songlab`, current version: 7

| Store        | Key       | Indexes     | Purpose                               |
|-------------|-----------|-------------|---------------------------------------|
| songs       | id        | —           | Song metadata (title, duration, flags) |
| markers     | id        | by-song     | Section markers per song               |
| tabs        | id        | by-song     | ASCII tab content per marker per sheet |
| tabSheets   | id        | by-song     | Tab sheet definitions (Guitar, Bass…)  |
| config      | key       | —           | Key-value settings (songOrder, etc.)   |
| audioFiles  | songId    | —           | Audio file binary (ArrayBuffer)        |
| gpFiles     | songId    | —           | Guitar Pro file binary (ArrayBuffer)   |

## Constraints
- Fully offline-capable after first load (PWA with Workbox caching)
- Must handle audio files up to ~30 MB without lag
- Target: Chromium-based browsers (Chrome, Brave, Edge) + Firefox
- Band Sync: requires Node.js server on local network
- No audio streaming in Band Sync — designed for shared-room rehearsal
- Landscape-oriented UI (desktop-first, usable on tablet)

## Feature History

### v0.1 – Core Playback & Markers
- Load audio file via drag & drop or file picker
- Waveform rendering (wavesurfer.js), play/pause/seek
- Section markers: add, edit, delete, drag-to-reposition
- Color coding per section type with free color picker
- Color sync across all markers of the same type
- Persist markers per song in IndexedDB
- Custom waveform timeline/ruler
- Active section highlighting during playback
- Keyboard shortcuts: Space (play/pause), M (add marker), ←/→ (seek 5s)

### v0.2 – Section Looping
- Section loop via sidebar click
- Custom A/B loop with draggable waveform handles
- Loop overlay visualization on waveform
- Loop on/off toggle (button + L shortcut)
- Song loop (repeat entire song), reset to start

### v0.3 – ASCII Tabs
- ASCII tab editor per section (monospace textarea)
- Multiple tab sheets per song (Guitar, Bass, Keys, Vocals, Drums)
- Auto-scroll tabs during playback, synced to section timing
- Import/export tabs as plain text
- Edit/view mode toggle

### v0.4 – Tempo Control
- Playback speed slider (50%–150%)
- Pitch correction toggle (preserve pitch)
- Speed presets (50%, 75%, 100%)

### v0.5 – Song Library & Setlists
- Persistent song library with audio stored in IndexedDB
- Setlist builder with drag & drop reordering
- Pause entries between songs (configurable duration + label)
- Dummy songs (no audio) for tab-only practice
- Song and setlist export/import (JSON)
- Song metadata display (title, duration, marker count)

### v0.6 – Guitar Pro Notation
- Render .gp3–.gp8 and .gpx files via alphaTab
- Track selector (Guitar, Bass, Keys, Drums, etc.)
- Track mixer with per-track volume, mute, solo
- Page layout (vertical scroll) and horizontal scroll modes with zoom
- Audio + GP: notation cursor synchronized via BPM-based offset
- Dummy + GP: alphaSynth MIDI playback when no audio loaded
- Sync Offset Editor for fine-tuning audio↔notation alignment
- Import rehearsal marks from GP files as section markers (Replace/Merge/Cancel)
- GP files persisted in IndexedDB and included in export/import

### v0.7 – Band Sync Mode
- Real-time sync across devices on local network (socket.io WebSocket)
- Roles: host (full control), viewer (read-only), controller (remote transport)
- Host controls playback, song selection, setlist navigation
- Viewers see notation, markers, tabs with their chosen instrument track
- Auto-advance to next song with configurable countdown
- GP files and all song data transferred to viewers automatically
- Sync protocol with typed events (shared/syncProtocol.ts)

### v0.8 – Polish & PWA
- Volume control with RMS-based audio normalization
- PWA support (installable, offline after first load)
- Accordion sidebar (collapsible sections + setlist panels)
- Sidebar collapse for maximum practice space
- Toast notification system

### v0.9 – Guitar Pro Integration (alphaTab)
- alphaTab integration with patch-package fix for v1.8.1 recursion bug
- Notation cursor display with auto-scroll
- Track mixer panel
- External media cursor sync (audio ↔ notation)
- Band Sync GP integration (GP files transferred to viewers)
- GP file export/import with zoom control

### v0.10 – Remote Controller View
- Remote Controller UI for Band Sync viewers
- Controller role with transport control via mutex (first-come-first-served)
- GP marker import dialog
- Accordion sidebar redesign
- Setlist export optimization

### v0.11 – Count-In, Metronome & Tuning Display
- Count-in: configurable click (1 bar at song BPM) before playback and loop restarts, with visual countdown overlay
- Metronome: continuous click during playback synced to song BPM, with solo mode, volume control, and real-time GP file tempo tracking
- Tuning display: show active track's tuning from GP file (Drop D, DADGAD, etc.)
- Create song directly from GP file
- BPM-based duration input for dummy songs
- Setlist enumeration (numbered entries)
- Master volume control in Notation Panel mixer
- Various UI and optical improvements

### v0.12 – MIDI Input
- MIDI footswitch/controller support via Web MIDI API
- Configurable MIDI mappings with MIDI Learn mode
- Commands: transport toggle, section prev/next, loop toggle, song prev/next, tempo up/down
- MIDI settings dialog with device selection and mapping table
- Mappings persisted in IndexedDB config store

### v0.13 – Setlist URL Import
- Import setlists from cloud URLs via sync server proxy endpoint
- Automatic sharing link conversion for Dropbox and Google Drive
- Server URL and setlist URL persisted across sessions
- New URL import dialog in sidebar import/export menu
- SSRF protection, size limits, and timeout on proxy endpoint

## Roadmap
- Fretboard editor / chord lookup (interactive fretboard for voicings)
- Band Sync enhancements (mDNS auto-discovery, host promotion, presenter mode)
- ESP32 footpedal controller (WiFi/BLE, see TODO_stompswitch.md)
- Tauri desktop app (native installer with bundled sync server)