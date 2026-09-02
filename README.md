# RockyRoadImport

- Converts a Rocksmith 2014 (`.psarc`) song, a Guitar Pro (`.gp3`/`.gp4`/`.gp5`) file, or a piano
  MIDI (`.mid`) file into OpenSongChart format — the chart format
  [RockyRoad](https://github.com/weblings/RockyRoad) reads.
- Runs entirely in your browser — nothing is uploaded anywhere, your song files never leave your
  computer.

**[Try GitHub Pages demo](https://weblings.github.io/RockyRoadImport/)** — no install needed.

## Quick Start

### General Setup (MIDI + Guitar Pro)

1. **Install [Node.js](https://nodejs.org/)** (version 20 or newer). This gives you the `node` and `npm` commands used below.
   - **Windows:** `winget install OpenJS.NodeJS.LTS` (winget ships with Windows 10/11 already)
   - **macOS:** `brew install node` (needs [Homebrew](https://brew.sh))
   - **Linux (Debian/Ubuntu):** `sudo apt install nodejs npm`
2. **Get the code.** Either `git clone https://github.com/weblings/RockyRoadImport.git`, or on the
   [GitHub repo page](https://github.com/weblings/RockyRoadImport), click the green **Code**
   button → **Download ZIP**, then unzip it — no git required.
3. **Open a terminal in the `SongConverter` folder.**
4. **Run `npm install`.** This downloads the project's dependencies — one-time setup, takes a
   minute or two.
5. **Run `npm run dev`.** Open the URL it prints (something like `http://localhost:5173/`).

### Rocksmith 2014 (`.psarc`)

The **Rocksmith 2014** tab needs one extra setup step beyond Quick Start, because it runs C# code compiled to WebAssembly:

1. **Install [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0).**
   - **Windows:** `winget install Microsoft.DotNet.SDK.8`
   - **macOS:** `brew install --cask dotnet-sdk`
   - **Linux (Ubuntu/Debian):** `sudo apt install dotnet-sdk-8.0` — available directly on recent
     Ubuntu (22.04+); older or other distros may need Microsoft's package repo added first, see
     [Microsoft's install docs](https://learn.microsoft.com/dotnet/core/install/linux)
2. **Install the WebAssembly build tools:** run `dotnet workload install wasm-tools` in a terminal
   (one-time, may take a few minutes).
3. **Build the wasm module:** in the `SongConverter` folder, run
   `npm run build:wasm`.
4. Refresh the page (`npm run dev` doesn't need restarting) — the **Rocksmith 2014** tab now works.
   Choose your `.psarc` file, fill in the song metadata, and click **Download**.

## Troubleshooting

**Rocksmith 2014 tab doesn't work / "Error parsing .psarc file":**
- The wasm module needs the one-time setup above — if you skipped it, the tab will fail with an
  error rather than silently not appearing.
- Confirm `dotnet workload install wasm-tools` actually completed before running
  `npm run build:wasm` — a missing workload makes the build fail, not just run slowly.
- After running `npm run build:wasm`, just refresh the browser tab — no need to restart
  `npm run dev`.

**Guitar Pro tab doesn't work**
- Currently only `.gp3`, `.gp4`, or `.gp5` are supported. Newer Guitar Pro formats (`.gpx` from GP6, `.gp` from GP7/8) are not.
- [TuxGuitar](https://www.tuxguitar.app/) (free) is a good way to notate tabs — export as `.gp5`. It can also export
audio, but as a `.wav`. If you convert that audio to an `.ogg` you can add it to the `Song Audio` field
- This feature is probably closer to beta. It was tested on the `Loch Lomond` sample, which doesn't include hammer-ons, or bends.

## FAQ

**What's OpenSongChart / ChartPlayer / ChartConverter?**

Repos by [Mike Oliphant](https://github.com/mikeoliphant). Without this amazing tech foundation, I would not have even attempted this project!
- [OpenSongChart](https://github.com/mikeoliphant/OpenSongChart) is an open format for song
  charts — the one this tool produces and [RockyRoad](https://github.com/weblings/RockyRoad) reads.
- [ChartPlayer](https://github.com/mikeoliphant/ChartPlayer) is a cross-platform application for
  playing along to OpenSongChart charts.
- [ChartConverter](https://github.com/mikeoliphant/ChartConverter) is an app for converting other chart formats to OpenSongChart.

**What file types are supported?**
Rocksmith 2014 `.psarc`, Guitar Pro `.gp3`/`.gp4`/`.gp5`, and piano MIDI (`.mid`) files today. Rock
Band conversion is planned but not yet available.

**What do I do with the converted output?**
Unzip it into the songs folder RockyRoad points at — see RockyRoad's
["Play your own songs"](https://github.com/weblings/RockyRoad#play-your-own-songs) section.

**Why not just use ChartConverter?**
- ChartConverter by default only takes the most difficult charts in psarc. To get all of the difficulties, RockyRoad has slightly modified how it writes and reads OpenSongChart. I'll look into if these tweaks are worthwhile upstream changes or not.
- ChartConverter doesn't support MIDI or GuitarPro as input as of now.

## License

RockyRoadImport is licensed under the [GNU General Public License v3.0 or later](LICENSE).
`PsarcChartCore` directly compiles source from [ChartConverter](https://github.com/mikeoliphant/ChartConverter)
(GPL-3.0), so this project carries the same license forward. The `PsarcUtil` and `OpenSongChart`
submodules keep their own MIT licenses — GPL applies to RockyRoadImport's own code, not to those
dependencies.
