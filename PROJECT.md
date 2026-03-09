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
- **Audio**: wavesurfer.js v7 (Waveform, Regions plugin)
- **Playback control**: Web Audio API
- **Storage**: IndexedDB (via idb wrapper library)
- **Styling**: Tailwind CSS
- **Desktop wrapper (future)**: Tauri (optional)

## Architecture
Single-page application, fully client-side. No backend required.

```
src/
├── components/        # React UI components
│   ├── Player/        # Waveform, transport controls
│   ├── Markers/       # Section marker management
│   ├── Tabs/          # ASCII tab editor & display
│   └── Layout/        # App shell, sidebar, toolbar
├── hooks/             # Custom React hooks (useAudio, useMarkers, etc.)
├── stores/            # State management (Zustand or React Context)
├── services/          # IndexedDB access, file import/export
├── types/             # TypeScript type definitions
├── utils/             # Helper functions
├── App.tsx
└── main.tsx
```

## Constraints
- Fully offline-capable (no server dependency)
- Must handle audio files up to ~30 MB without lag
- Target: Chromium-based browsers (Chrome, Brave, Edge) + Firefox

## Feature Phases

### v0.1 – Core Playback & Markers
- Load audio file via drag & drop or file picker
- Render waveform (wavesurfer.js)
- Play / Pause / Seek via click on waveform
- Add, edit, delete section markers (types: Intro, Verse, Pre-Chorus, Chorus, Bridge, Solo, Interlude, Outro, Custom)
- Color coding per section type
- Persist markers per song in IndexedDB

### v0.2 – Section Looping
- Click section marker → loop that section
- Custom A/B loop: select arbitrary range on waveform
- Loop counter display (optional)

### v0.3 – Tab Sync
- ASCII tab editor per section (textarea with monospace font)
- Tabs scroll automatically during playback, synced to section timing
- Import/export tabs as plain text

### v0.4 – Tempo Control
- Playback speed slider (50%–150%)
- Pitch correction toggle (preserve pitch when slowing down)
- Speed presets (50%, 75%, 100%)
