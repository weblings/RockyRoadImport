# RockyRoadImport

- Converts a Rocksmith 2014 (`.psarc`) song, a Guitar Pro (`.gp3`/`.gp4`/`.gp5`) file, or a piano
  MIDI (`.mid`) file into OpenSongChart format — the chart format
  [RockyRoad](https://github.com/weblings/RockyRoad) reads.
- Runs entirely in your browser — nothing is uploaded anywhere, your song files never leave your
  computer.

## Quick Start (piano MIDI)

1. **Install [Node.js](https://nodejs.org/)** (the one prerequisite — version 20 or newer). This
   gives you the `node` and `npm` commands used below. One-line install, per OS:
   - **Windows:** `winget install OpenJS.NodeJS.LTS` (winget ships with Windows 10/11 already)
   - **macOS:** `brew install node` (needs [Homebrew](https://brew.sh) — if you don't have that
     yet, its own one-line installer is on that page)
   - **Linux (Debian/Ubuntu):** `sudo apt install nodejs npm` — the distro-bundled version can lag
     behind, so check `node --version` afterward and make sure it's 20+; if it's older, use
     [NodeSource's setup script](https://github.com/nodesource/distributions) instead

   Or just grab the installer for your OS from the link above if you'd rather not use a package
   manager.
2. **Get the code.** Either `git clone https://github.com/weblings/RockyRoadImport.git`, or on the
   [GitHub repo page](https://github.com/weblings/RockyRoadImport), click the green **Code**
   button → **Download ZIP**, then unzip it — no git required.
3. **Open a terminal in the `BrowserPianoMidiConverter` folder.**
4. **Run `npm install`.** This downloads the project's dependencies — one-time setup, takes a
   minute or two.
5. **Run `npm run dev`.** Open the URL it prints (something like `http://localhost:5173/`).
6. On the **MIDI** tab, choose your `.mid` file, fill in the song name/artist, and click
   **Download** — you get a `.zip` with your converted song folder inside.

## Converting Rocksmith 2014 (`.psarc`) files

The **Rocksmith 2014** tab needs one extra one-time setup step beyond the above, because that
conversion runs C# code compiled to WebAssembly:

1. **Install the [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0).** One-line
   install, per OS:
   - **Windows:** `winget install Microsoft.DotNet.SDK.8`
   - **macOS:** `brew install --cask dotnet-sdk`
   - **Linux (Ubuntu/Debian):** `sudo apt install dotnet-sdk-8.0` — available directly on recent
     Ubuntu (22.04+); older or other distros may need Microsoft's package repo added first, see
     [Microsoft's install docs](https://learn.microsoft.com/dotnet/core/install/linux)

   Or grab the installer for your OS from the link above if you'd rather not use a package manager.
2. **Install the WebAssembly build tools:** run `dotnet workload install wasm-tools` in a terminal
   (one-time, may take a few minutes).
3. **Build the wasm module:** in the `BrowserPianoMidiConverter` folder, run
   `npm run build:wasm`.
4. Refresh the page (`npm run dev` doesn't need restarting) — the **Rocksmith 2014** tab now works.
   Choose your `.psarc` file, fill in the song metadata, and click **Download**.

## Converting Guitar Pro (`.gp3`/`.gp4`/`.gp5`) files

No extra setup beyond Quick Start above — unlike the Rocksmith 2014 path, this one is pure
JavaScript (no .NET, no wasm build step). On the **Guitar Pro** tab, choose your `.gp3`, `.gp4`, or
`.gp5` file, fill in the song metadata, and click **Download**. Newer Guitar Pro formats (`.gpx`
from GP6, `.gp` from GP7/8) aren't supported — they're a different file format under the hood, not
just a newer version of the same one.

Don't have a `.gp5` yet? [TuxGuitar](https://www.tuxguitar.app/) (free) is a good way to notate a
tab from scratch or from another source — export as `.gp5` and feed it in here. It can also export
audio, but as a `.wav`; convert it to `.ogg` (e.g. via `ffmpeg`) before using it as the optional
Song Audio field above, which requires `.ogg`.

## Troubleshooting

**Rocksmith 2014 tab doesn't work / "Error parsing .psarc file":**
- The wasm module needs the one-time setup above — if you skipped it, the tab will fail with an
  error rather than silently not appearing.
- Confirm `dotnet workload install wasm-tools` actually completed before running
  `npm run build:wasm` — a missing workload makes the build fail, not just run slowly.
- After running `npm run build:wasm`, just refresh the browser tab — no need to restart
  `npm run dev`.

## FAQ

**What's OpenSongChart / ChartPlayer / ChartConverter?**

Repos by [Mike Oliphant](https://github.com/mikeoliphant). Without this amazing tech foundation, I would not have even attempted this project!
- [OpenSongChart](https://github.com/mikeoliphant/OpenSongFormat) is an open format for song
  charts — the one this tool produces and [RockyRoad](https://github.com/weblings/RockyRoad) reads.
- [ChartPlayer](https://github.com/mikeoliphant/ChartPlayer) is a cross-platform application for
  playing along to OpenSongChart charts.
- [ChartConverter](https://github.com/mikeoliphant/ChartConverter) is an app for converting
  Rocksmith PSARC to OpenSongChart format — see "Why not just use ChartConverter?" below for how
  this tool differs.

**What file types are supported?**
Rocksmith 2014 `.psarc`, Guitar Pro `.gp3`/`.gp4`/`.gp5`, and piano MIDI (`.mid`) files today. Rock
Band conversion is planned but not yet available.

**What do I do with the converted output?**
Unzip it into the songs folder RockyRoad points at — see RockyRoad's
["Play your own songs"](https://github.com/weblings/RockyRoad#play-your-own-songs) section.

**Why not just use ChartConverter?**
To guarantee compatibility with RockyRoad use this converter.
- ChartConverter didn't expose its MIDI logic to the user
- To get all of the difficulty charts out of psarc, RockyRoad has slightly modified how it writes and reads OpenSongChart. I'll look into if these tweaks are worthwhile upstream changes or not.
