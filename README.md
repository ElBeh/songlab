# SongLab

**Guitar practice & song structure tool for your browser.**

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)
![React](https://img.shields.io/badge/React-19-61dafb)
![wavesurfer.js](https://img.shields.io/badge/wavesurfer.js-7-purple)

---

## What is SongLab?

SongLab is a browser-based practice tool for musicians and bands (all major browsers supported). Load a song, visualize its waveform, mark sections (Chorus, Verse, Bridge, Solo…), attach ASCII tabs or notes per section, and practice at your own pace with looping and tempo controls. Band Sync Mode turns it into a shared digital music stand over your local network with your own setlist.

### Features

- **Waveform visualization** – Load MP3, WAV, OGG or FLAC files and see the full waveform
- **Section markers** – Color-coded markers for Intro, Verse, Chorus, Bridge, Solo and more
- **ASCII tab editor** – Multiple tab sheets per song (Guitar, Bass, Keys, Vocals, Drums) with auto-scroll during playback
- **Section & A/B looping** – Loop any section or custom range with a loop counter and target count
- **Tempo control** – Slow down to 50% or speed up to 150% with optional pitch correction
- **Song library** – Persistent storage via IndexedDB, songs survive browser restarts
- **Setlists** – Build ordered playlists with drag & drop reordering and pause entries
- **Dummy songs** – Create songs without audio for tab-only practice or pre-show prep
- **Band Sync Mode** – Real-time sync across devices on your local network (one host, multiple viewers)
- **PWA support** – Install as a standalone app, works offline after first load

## Screenshots

<!-- TODO: Add screenshots
![Waveform with markers](docs/screenshots/waveform-markers.png)
![Tab editor](docs/screenshots/tab-editor.png)
![Band Sync](docs/screenshots/band-sync.png)
-->

*Screenshots coming soon.*

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- npm (comes with Node.js)

### Solo Practice (Development)

```bash
git clone https://github.com/ElBeh/songlab.git
cd songlab
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

### Band Sync Mode

Band Sync requires building the app and running the sync server. All band members connect to the host's IP address.

```bash
# Build the frontend
npm run build

# Start the sync server (serves the app + WebSocket)
npm start
```

The server starts on `http://0.0.0.0:3000`. Band members open `http://<host-ip>:3000` on their devices.

**During development** you can run both Vite and the sync server simultaneously:

```bash
npm run dev:sync
```

### How Band Sync Works

SongLab's Band Sync is designed for the **shared room** scenario: the band plays live, the app provides a synchronized digital music stand on every device.

- **Host** controls playback, song selection, and setlist navigation
- **Viewers** see the current song, section markers, and their chosen tab sheet in real time
- **No audio streaming** – the sync server only transmits playback position, markers, and tab content
- Viewers are **read-only** – only the host can edit sections, tabs, and control playback

## Tech Stack

| Category | Technology |
|---|---|
| Language | TypeScript 5.9 |
| Framework | React 19 |
| Bundler | Vite 7 |
| Audio | wavesurfer.js 7 |
| State management | Zustand |
| Persistence | IndexedDB (via idb) |
| Styling | Tailwind CSS 4 |
| Band Sync | Express 5 + socket.io 4 |
| PWA | vite-plugin-pwa |

## Roadmap

- Band Sync: mDNS auto-discovery (no more manual IP entry)
- Hosted web version (Vercel / GitHub Pages) for instant solo practice
- Tauri desktop app with bundled sync server
- Band Sync enhancements: host promotion, presenter mode

## License

This project is licensed under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).