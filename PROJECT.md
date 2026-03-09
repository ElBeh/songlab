# SongLab – Guitar Practice & Song Structure Tool

## Goal
A browser-based app for guitarists to load songs (MP3/audio files), visualize the waveform, mark song sections (Chorus, Verse, Bridge, Solo, etc.), and practice along with synchronized ASCII guitar tabs.

## Scope

### In Scope
- Load local audio files (MP3, WAV, OGG, FLAC)
- Waveform visualization with playback controls (Play, Pause, Seek)
- Section markers with type labels and color coding
- Loop mode for individual sections or custom A/B ranges
- ASCII tab editor per section with auto-scroll during playback
- Tempo/speed control with optional pitch correction
- Persistent local storage (IndexedDB) for songs, markers, and tabs
- Responsive single-page app (desktop-first, but usable on tablet)

### Out of Scope (for now)
- Cloud sync / multi-device
- Automatic chord/tab detection (AI)
- Sheet music / notation rendering
- Recording / metronome
- Mobile-first design
- Multi-user / sharing features

## Tech Stack
- **Language**: TypeScript
- **Framework**: React 18+
- **Bundler**: Vite
- **Audio**: wavesurfer.js v7
- **Playback control**: Web Audio API
- **Storage**: IndexedDB (via idb wrapper library)
- **State management**: Zustand
- **Styling**: Tailwind CSS v4 (via @tailwindcss/vite)
- **Desktop wrapper (future)**: Tauri (optional)

## Architecture
Single-page application, fully client-side. No backend required.
```
src/
├── components/
│   ├── Player/
│   │   ├── WaveformPlayer.tsx     # Waveform rendering, marker overlays, loop overlays, drag
│   │   ├── WaveformTimeline.tsx   # Custom timeline/ruler below waveform
│   │   └── PlayerControls.tsx     # Transport, time input, loop controls, song loop, reset
│   ├── Markers/
│   │   ├── MarkerForm.tsx         # Add marker form with type, label, color picker
│   │   ├── MarkerList.tsx         # Section list with active highlight, edit, loop, delete
│   │   ├── MarkerEditForm.tsx     # Inline edit form for existing markers
│   └── Tabs/
│       ├── TabEditor.tsx          # ASCII tab textarea with import/export/save
│       └── TabViewer.tsx          # Read-only tab view with auto-scroll during playback
│   └── Layout/
│       └── AppShell.tsx           # App shell, drag & drop, state wiring
├── hooks/
│   └── useKeyboardShortcuts.ts    # Space, M, L, ←/→ shortcuts
├── stores/
│   ├── useSongStore.ts            # Songs + markers state (Zustand)
│   ├── useLoopStore.ts            # Loop state: section loop, A/B loop, A/B mode
│   └── useTabStore.ts             # Tab content state per marker
├── services/
│   └── db.ts                      # IndexedDB access (songs, markers, tabs)
├── types/
│   └── index.ts                   # SongData, SectionMarker, SectionType, LoopRange, SectionTab
├── utils/
│   └── sectionColors.ts           # Default colors per SectionType
├── App.tsx
└── main.tsx
```

## Constraints
- Fully offline-capable (no server dependency)
- Must handle audio files up to ~30 MB without lag
- Target: Chromium-based browsers (Chrome, Brave, Edge) + Firefox
- File System Access API (v0.5+): Chromium-based browsers only (Chrome, Brave, Edge)

## Feature Phases

### v0.1 – Core Playback & Markers (done)
- Load audio file via drag & drop or file picker
- Render waveform (wavesurfer.js)
- Play / Pause / Seek via click on waveform
- Add, edit, delete section markers (types: Intro, Verse, Pre-Chorus, Chorus, Bridge, Solo, Interlude, Outro, Custom)
- Color coding per section type with free color picker
- Color sync across all markers of the same type
- Persist markers per song in IndexedDB (stable song ID via filename + filesize)
- Custom waveform timeline/ruler with 1s ticks, 5s/10s/30s labels
- Section marker drag to reposition on waveform
- Active section highlighting in sidebar during playback
- Marker edit (label, type, color) inline in sidebar
- Keyboard shortcuts: Space (play/pause), M (add marker), ←/→ (seek 5s)
- Auto-pause when opening marker form

### v0.2 – Section Looping (done)
- Click section marker in sidebar → loop that section
- Custom A/B loop: dedicated A/B mode, click waveform to set A and B points
- A/B handles draggable on waveform to fine-tune loop range
- Loop overlay on waveform with A/B line markers
- Loop on/off toggle (button + L shortcut)
- Clear loop button
- Song loop toggle (repeat entire song)
- Reset to start button (⏮)
- Transport and loop controls merged into single PlayerControls bar

### v0.3 – Tab Sync (done)
- ASCII tab editor per section (textarea with monospace font)
- Tabs scroll automatically during playback, synced to section timing
- Import/export tabs as plain text (.txt)
- Persist tabs per marker in IndexedDB
- Edit/View mode toggle per section
- Active section auto-selected during playback

### v0.4 – Tempo Control
- Playback speed slider (50%–150%)
- Pitch correction toggle (preserve pitch when slowing down)
- Speed presets (50%, 75%, 100%)

### v0.5 – Song Library & Setlists
- Persistent song list (IndexedDB) with File System Access API (Chromium only)
- Song library sidebar: browse, select, and reload previously loaded songs
  without re-dropping the file
- Setlist builder: create and name ordered playlists of songs
- Setlist playback mode: auto-advance to next song in setlist
- Song metadata display: title, duration, marker count
- Delete songs from library (removes song + all associated markers)