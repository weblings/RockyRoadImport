import { parseArrayBuffer } from 'midi-json-parser';
import { zipSync, strToU8 } from 'fflate';
import type {
    IMidiFile,
    IMidiSetTempoEvent,
    IMidiTrackNameEvent,
    IMidiTextEvent,
    IMidiNoteOnEvent,
    IMidiNoteOffEvent,
    IMidiControlChangeEvent,
    IMidiProgramChangeEvent,
    TMidiEvent,
} from 'midi-json-parser-worker';
import { buildTempoMap, buildSongStructure, type TempoChange } from './tempoMap';
import { convertPianoMidi } from './pianoConverter';
import type { SongInfo, SongStructure, SongKeyboardNotes, PsarcSongResult } from './songformat';

const app = document.getElementById('app')!;
app.innerHTML = `
    <h2>Piano MIDI Converter</h2>
    <input type="file" id="midi-input" accept=".mid,.midi" />

    <div id="metadata-form" style="display:none; margin-top:16px;">
        <h3 style="margin:0 0 8px 0;">Song Metadata</h3>
        <table style="border-spacing:4px 6px;">
            <tr><td>Song Name</td><td><input type="text" id="meta-song-name" size="40" /></td></tr>
            <tr><td>Artist</td><td><input type="text" id="meta-artist" size="40" /></td></tr>
            <tr><td>Album</td><td><input type="text" id="meta-album" size="40" /></td></tr>
            <tr><td>Album Art (optional)</td><td><input type="file" id="meta-album-art" accept="image/*" /></td></tr>
            <tr><td>MIDI Delay (ms)</td><td><input type="number" id="meta-delay" value="0" style="width:80px;" /></td></tr>
            <tr>
                <td>Difficulty (0–5)</td>
                <td>
                    <input type="range" id="meta-difficulty" min="0" max="5" step="0.5" value="0" />
                    <span id="meta-difficulty-value">0</span>
                </td>
            </tr>
        </table>
    </div>

    <br>
    <div id="hand-disclaimer" style="display:none; color:#b45309; font-size:13px;">
        <strong>&#9888; Hand Fallback Used</strong>
        <ul>
            <li><strong>No "Left Hand" / "Right Hand" track names detected</strong> — rename MIDI tracks to include these for accurate results.</li>
            <li><strong>Hand assigned by pitch</strong> — below middle C (MIDI 60) → left, above → right. May be wrong where hands cross.</li>
        </ul>
    </div>
    <button id="download-all" disabled>Download All (.zip)</button>
    <button id="download-song" disabled>Download song.json</button>
    <button id="download-arrangement" disabled>Download arrangement.json</button>
    <button id="download-keys" disabled>Download keys.json</button>
    <details style="margin-top:12px;">
        <summary style="cursor:pointer; font-size:13px; color:#555;">Show debug log</summary>
        <pre id="output" style="font-size:12px; max-height:60vh; overflow:auto;"></pre>
    </details>

    <hr style="margin:24px 0;">

    <h2>Rocksmith .psarc Importer</h2>
    <input type="file" id="psarc-input" accept=".psarc" />
    <div id="psarc-status" style="font-size:13px; color:#555; margin-top:4px;"></div>

    <div id="psarc-metadata-form" style="display:none; margin-top:16px;">
        <h3 style="margin:0 0 8px 0;">Song Metadata</h3>
        <table style="border-spacing:4px 6px;">
            <tr><td>Song Name</td><td><input type="text" id="psarc-song-name" size="40" /></td></tr>
            <tr><td>Artist</td><td><input type="text" id="psarc-artist" size="40" /></td></tr>
            <tr><td>Album</td><td><input type="text" id="psarc-album" size="40" /></td></tr>
        </table>
    </div>

    <br>
    <button id="psarc-download-all" disabled>Download All (.zip)</button>
`;

const input           = document.getElementById('midi-input')          as HTMLInputElement;
const output          = document.getElementById('output')              as HTMLPreElement;
const metadataForm    = document.getElementById('metadata-form')       as HTMLElement;
const handDisclaimer  = document.getElementById('hand-disclaimer')     as HTMLElement;
const songNameInput   = document.getElementById('meta-song-name')      as HTMLInputElement;
const artistInput     = document.getElementById('meta-artist')         as HTMLInputElement;
const albumInput      = document.getElementById('meta-album')          as HTMLInputElement;
const albumArtInput   = document.getElementById('meta-album-art')      as HTMLInputElement;
const delayInput      = document.getElementById('meta-delay')          as HTMLInputElement;
const difficultyInput = document.getElementById('meta-difficulty')     as HTMLInputElement;
const difficultyLabel = document.getElementById('meta-difficulty-value') as HTMLSpanElement;
const downloadAllBtn  = document.getElementById('download-all')        as HTMLButtonElement;
const downloadSongBtn = document.getElementById('download-song')       as HTMLButtonElement;
const downloadBtn     = document.getElementById('download-arrangement') as HTMLButtonElement;
const downloadKeysBtn = document.getElementById('download-keys')       as HTMLButtonElement;

const psarcInput            = document.getElementById('psarc-input')             as HTMLInputElement;
const psarcStatus           = document.getElementById('psarc-status')            as HTMLElement;
const psarcMetadataForm     = document.getElementById('psarc-metadata-form')     as HTMLElement;
const psarcSongNameInput    = document.getElementById('psarc-song-name')         as HTMLInputElement;
const psarcArtistInput      = document.getElementById('psarc-artist')            as HTMLInputElement;
const psarcAlbumInput       = document.getElementById('psarc-album')             as HTMLInputElement;
const psarcDownloadAllBtn   = document.getElementById('psarc-download-all')      as HTMLButtonElement;

difficultyInput.addEventListener('input', () => {
    difficultyLabel.textContent = difficultyInput.value;
});

// Re-run conversion when delay changes so note times stay in sync with downloads
delayInput.addEventListener('change', () => {
    if (_midi) runConversion();
});

let _midi: IMidiFile | null = null;
let _midiFilename = '';
let _structure: SongStructure | null = null;
let _keyboardNotes: SongKeyboardNotes | null = null;

input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;
    output.textContent = 'Parsing…';
    setDownloadsEnabled(false);
    file.arrayBuffer()
        .then((buffer) => parseArrayBuffer(buffer))
        .then((midi: IMidiFile) => {
            _midi = midi;
            _midiFilename = file.name;

            const meta = extractMetadata(midi.tracks);
            songNameInput.value = meta.songName;
            artistInput.value   = meta.artist;
            albumInput.value    = '';
            delayInput.value    = '0';
            difficultyInput.value = '0';
            difficultyLabel.textContent = '0';
            metadataForm.style.display = 'block';

            runConversion();
        })
        .catch((err: unknown) => {
            output.textContent = `Error parsing MIDI file: ${err instanceof Error ? err.message : String(err)}`;
        });
});

function runConversion(): void {
    if (!_midi) return;
    try {
        const tempoMap = buildTempoMap(_midi.tracks);
        _structure = buildSongStructure(_midi.tracks, tempoMap, _midi.division);
        const delayMs = parseFloat(delayInput.value) || 0;
        const result = convertPianoMidi(_midi.tracks, tempoMap, _midi.division, delayMs / 1000);
        _keyboardNotes = result.keyboardNotes;

        if (_keyboardNotes.Notes.length === 0) {
            output.textContent = 'Warning: No piano notes found. Check that the MIDI file contains note data on a piano/keys track.';
            handDisclaimer.style.display = 'none';
            setDownloadsEnabled(false);
            return;
        }

        handDisclaimer.style.display = result.usedHandFallback ? 'block' : 'none';
        logMidi(_midiFilename, _midi, tempoMap, _keyboardNotes.Notes.length);
        setDownloadsEnabled(true);
    } catch (err: unknown) {
        output.textContent = `Conversion error: ${err instanceof Error ? err.message : String(err)}`;
        setDownloadsEnabled(false);
    }
}

function setDownloadsEnabled(enabled: boolean): void {
    downloadAllBtn.disabled  = !enabled;
    downloadSongBtn.disabled = !enabled;
    downloadBtn.disabled     = !enabled;
    downloadKeysBtn.disabled = !enabled;
}

function buildSongInfo(): SongInfo {
    const notes = _keyboardNotes!.Notes;
    const songLengthSeconds = notes.reduce(
        (max, n) => Math.max(max, n.TimeOffset + n.TimeLength),
        0,
    );
    const difficulty = parseFloat(difficultyInput.value);
    const info: SongInfo = {
        SongName: songNameInput.value.trim() || 'Unknown',
        ArtistName: artistInput.value.trim() || 'Unknown',
        SongLengthSeconds: songLengthSeconds,
        InstrumentParts: [{
            InstrumentName: 'keys',
            InstrumentType: 'Keys',
            ...(difficulty > 0 ? { SongDifficulty: difficulty } : {}),
        }],
    };
    const album = albumInput.value.trim();
    if (album) info.AlbumName = album;
    return info;
}

downloadSongBtn.addEventListener('click', () => {
    if (!_keyboardNotes) return;
    downloadJson('song.json', buildSongInfo());
});

downloadBtn.addEventListener('click', () => {
    if (_structure) downloadJson('arrangement.json', _structure);
});

downloadKeysBtn.addEventListener('click', () => {
    if (_keyboardNotes) downloadJson('keys.json', _keyboardNotes);
});

downloadAllBtn.addEventListener('click', () => {
    if (!_structure || !_keyboardNotes) return;

    const replacer = (_key: string, value: unknown): unknown => {
        if (value === null) return undefined;
        if (Array.isArray(value) && value.length === 0) return undefined;
        return value;
    };

    const files: Record<string, Uint8Array> = {
        'song.json':        strToU8(JSON.stringify(buildSongInfo(),  replacer, 2)),
        'arrangement.json': strToU8(JSON.stringify(_structure,       replacer, 2)),
        'keys.json':        strToU8(JSON.stringify(_keyboardNotes,   replacer, 2)),
    };

    const artFile = albumArtInput.files?.[0];
    if (artFile) {
        artFile.arrayBuffer()
            .then((buf) => {
                files['albumart.png'] = new Uint8Array(buf);
                triggerZipDownload(files);
            })
            .catch(() => {
                // Art failed to read — proceed without it
                triggerZipDownload(files);
            });
    } else {
        triggerZipDownload(files);
    }
});

// --- .psarc (Rocksmith) import ---
// Conversion logic lives entirely in the reused C# (PsarcChartCore, compiled to wasm) -
// this just drives the wasm module and reuses the same downloadJson/triggerZipDownload
// helpers the MIDI path already uses. Loaded lazily so MIDI-only users never pay for it.

let _psarcExports: any = null;
let _psarcResult: PsarcSongResult | null = null;
let _psarcAlbumArt: Uint8Array | null = null;

declare global {
    interface Window {
        __psarcDotnet?: any;
    }
}

// Vite's dev server routes every import() inside Vite-transformed source through its own
// module pipeline, which refuses to serve .js files living under public/ that way (by
// design - its own error message says so). The documented workaround is to load it via a
// real <script type="module"> tag instead: that's a separate module graph root the
// browser resolves natively over plain HTTP, bypassing Vite's dev-time transform entirely.
function loadDotnetViaScriptTag(): Promise<any> {
    return new Promise((resolve, reject) => {
        if (window.__psarcDotnet) {
            resolve(window.__psarcDotnet);
            return;
        }

        const script = document.createElement('script');
        script.type = 'module';
        script.textContent = `
            import { dotnet } from '/psarc-wasm/dotnet.js';
            window.__psarcDotnet = dotnet;
            window.dispatchEvent(new Event('psarc-dotnet-ready'));
        `;
        window.addEventListener('psarc-dotnet-ready', () => resolve(window.__psarcDotnet), { once: true });
        script.onerror = () => reject(new Error('Failed to load /psarc-wasm/dotnet.js'));
        document.head.appendChild(script);
    });
}

async function loadPsarcWasm(): Promise<any> {
    if (_psarcExports) return _psarcExports;

    psarcStatus.textContent = 'Loading wasm module (first use only)…';
    const dotnet = await loadDotnetViaScriptTag();
    const { getAssemblyExports, getConfig } = await dotnet.create();
    const config = getConfig();
    _psarcExports = await getAssemblyExports(config.mainAssemblyName);
    return _psarcExports;
}

// GetAlbumArt hands back raw decoded pixels ([width][height][RGBA8...]) rather than a PNG -
// DDS decoding stays in C# (reuses Pfim's block decompression, already proven against the
// desktop tool), but PNG encoding happens here via OffscreenCanvas so the wasm build doesn't
// need System.Drawing, which has no browser-wasm support.
async function fetchAlbumArtPng(exports: any, psarcBytes: Uint8Array, songKey: string): Promise<Uint8Array | null> {
    const raw: Uint8Array = exports.PsarcInterop.GetAlbumArt(psarcBytes, songKey, 256);
    if (!raw || raw.length === 0) return null;

    const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    const width = view.getInt32(0, true);
    const height = view.getInt32(4, true);
    const rgba = new Uint8ClampedArray(raw.buffer as ArrayBuffer, raw.byteOffset + 8, width * height * 4);

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.putImageData(new ImageData(rgba, width, height), 0, 0);

    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return new Uint8Array(await blob.arrayBuffer());
}

psarcInput.addEventListener('change', () => {
    const file = psarcInput.files?.[0];
    if (!file) return;

    psarcStatus.textContent = 'Parsing…';
    psarcMetadataForm.style.display = 'none';
    psarcDownloadAllBtn.disabled = true;
    _psarcResult = null;
    _psarcAlbumArt = null;

    file.arrayBuffer()
        .then(async (buffer) => {
            const psarcBytes = new Uint8Array(buffer);
            const exports = await loadPsarcWasm();

            const resultJson = exports.PsarcInterop.ConvertAllPsarc(psarcBytes);
            const songs: PsarcSongResult[] = JSON.parse(resultJson);

            if (songs.length === 0 || songs[0].Parts.length === 0) {
                psarcStatus.textContent = 'No arrangements found in this .psarc file.';
                return;
            }

            // A .psarc almost always holds exactly one song; if it holds more (a
            // compilation archive), only the first is imported.
            _psarcResult = songs[0];

            psarcSongNameInput.value = _psarcResult.SongData?.SongName ?? '';
            psarcArtistInput.value = _psarcResult.SongData?.ArtistName ?? '';
            psarcAlbumInput.value = _psarcResult.SongData?.AlbumName ?? '';
            psarcMetadataForm.style.display = 'block';

            const succeeded = _psarcResult.Parts.filter((p) => p.Part != null);
            const failed = _psarcResult.Parts.filter((p) => p.Part == null);

            if (succeeded.length === 0) {
                psarcStatus.textContent = `All ${failed.length} arrangement(s) failed to convert.`;
                return;
            }

            let status = `Converted ${succeeded.length}/${_psarcResult.Parts.length} part(s): ${succeeded.map((p) => p.Name).join(', ')}.`;
            if (songs.length > 1) status += ` (${songs.length - 1} additional song(s) in this file were ignored.)`;
            if (failed.length > 0) status += ` Failed: ${failed.map((p) => `${p.Name} (${p.Error})`).join('; ')}`;
            psarcStatus.textContent = status;

            psarcDownloadAllBtn.disabled = false;

            // Non-fatal, same as the desktop tool's try/catch-and-skip around album art -
            // doesn't block chart data if it fails or the song has none.
            fetchAlbumArtPng(exports, psarcBytes, _psarcResult.SongKey)
                .then((png) => { _psarcAlbumArt = png; })
                .catch((err: unknown) => {
                    console.warn('Album art extraction failed:', err);
                });
        })
        .catch((err: unknown) => {
            psarcStatus.textContent = `Error parsing .psarc file: ${err instanceof Error ? err.message : String(err)}`;
        });
});

psarcDownloadAllBtn.addEventListener('click', () => {
    if (!_psarcResult) return;

    const succeeded = _psarcResult.Parts.filter((p) => p.Part != null);
    if (succeeded.length === 0) return;

    const songInfo = {
        ..._psarcResult.SongData,
        SongName: psarcSongNameInput.value.trim() || _psarcResult.SongData.SongName,
        ArtistName: psarcArtistInput.value.trim() || _psarcResult.SongData.ArtistName,
        AlbumName: psarcAlbumInput.value.trim() || undefined,
    };

    const files: Record<string, Uint8Array> = {
        'song.json': strToU8(JSON.stringify(songInfo, null, 2)),
    };

    for (const part of succeeded) {
        files[`${part.Name}.json`] = strToU8(JSON.stringify(part.Notes ?? part.Vocals, null, 2));
    }

    if (_psarcAlbumArt) {
        files['albumart.png'] = _psarcAlbumArt;
    }

    triggerZipDownload(files);
});

function triggerZipDownload(files: Record<string, Uint8Array>): void {
    const zip = zipSync(files);
    const blob = new Blob([new Uint8Array(zip)], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${songNameInput.value.trim() || 'song'}.zip`;
    a.click();
    URL.revokeObjectURL(url);
}

function extractMetadata(tracks: TMidiEvent[][]): { songName: string; artist: string } {
    const candidates: string[] = [];

    for (const track of tracks) {
        for (const event of track) {
            if ('trackName' in event) {
                const v = (event as IMidiTrackNameEvent).trackName.trim();
                if (v) candidates.push(v);
            } else if ('text' in event) {
                const v = (event as IMidiTextEvent).text.trim();
                if (v) candidates.push(v);
            }
            if (candidates.length >= 2) break;
        }
        if (candidates.length >= 2) break;
    }

    return { songName: candidates[0] ?? '', artist: candidates[1] ?? '' };
}

function downloadJson(filename: string, data: unknown): void {
    const json = JSON.stringify(data, (_key, value) => {
        if (value === null) return undefined;
        if (Array.isArray(value) && value.length === 0) return undefined;
        return value as unknown;
    }, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function logMidi(filename: string, midi: IMidiFile, tempoMap: TempoChange[], noteCount: number): void {
    const lines: string[] = [];

    lines.push(`File: ${filename}`);
    lines.push(`Format: ${midi.format}  |  Division: ${midi.division} ticks/quarter  |  Tracks: ${midi.tracks.length}  |  Piano notes extracted: ${noteCount}`);
    lines.push('');

    // Tempo map summary
    lines.push('── Tempo map');
    for (const entry of tempoMap) {
        const bpm = Math.round(60_000_000 / entry.microsecondsPerQuarter);
        lines.push(`   tick=${entry.tick}  ${entry.microsecondsPerQuarter} µs/quarter (${bpm} BPM)`);
    }
    lines.push('');

    midi.tracks.forEach((track, trackIndex) => {
        const trackName = getTrackName(track);
        lines.push(`── Track ${trackIndex}${trackName ? `: "${trackName}"` : ''} (${track.length} events)`);

        let tempoCount = 0;
        let noteOnCount = 0;
        let noteOffCount = 0;
        let cc64Count = 0;
        let programChanges: number[] = [];
        const textEvents: string[] = [];

        for (const event of track) {
            if ('setTempo' in event) {
                const e = event as IMidiSetTempoEvent;
                const bpm = Math.round(60_000_000 / e.setTempo.microsecondsPerQuarter);
                lines.push(`   setTempo     δ=${e.delta}  ${e.setTempo.microsecondsPerQuarter} µs/quarter (${bpm} BPM)`);
                tempoCount++;
            } else if ('trackName' in event) {
                const e = event as IMidiTrackNameEvent;
                lines.push(`   trackName    δ=${e.delta}  "${e.trackName}"`);
            } else if ('text' in event) {
                const e = event as IMidiTextEvent;
                textEvents.push(e.text);
            } else if ('noteOn' in event) {
                // NOTE: The C# MidiFile.cs (line 120-126) treats noteOn velocity=0 as a noteOff.
                // midi-json-parser normalizes these — verify by checking if noteOff count matches noteOn count.
                const e = event as IMidiNoteOnEvent;
                if (noteOnCount < 5) {
                    lines.push(`   noteOn       δ=${e.delta}  ch=${e.channel}  note=${e.noteOn.noteNumber}  vel=${e.noteOn.velocity}`);
                } else if (noteOnCount === 5) {
                    lines.push(`   noteOn       ... (showing first 5 only)`);
                }
                noteOnCount++;
            } else if ('noteOff' in event) {
                // The C# MidiFile.cs (line 128-131) handles NoteOff as a distinct command.
                // Confirmed: library surfaces these separately from noteOn velocity=0.
                const e = event as IMidiNoteOffEvent;
                if (noteOffCount < 5) {
                    lines.push(`   noteOff      δ=${e.delta}  ch=${e.channel}  note=${e.noteOff.noteNumber}  vel=${e.noteOff.velocity}`);
                } else if (noteOffCount === 5) {
                    lines.push(`   noteOff      ... (showing first 5 only)`);
                }
                noteOffCount++;
            } else if ('controlChange' in event) {
                const e = event as IMidiControlChangeEvent;
                if (e.controlChange.type === 64) {
                    lines.push(`   CC64 sustain δ=${e.delta}  ch=${e.channel}  val=${e.controlChange.value}`);
                    cc64Count++;
                }
            } else if ('programChange' in event) {
                // GM patch: 0-7 = acoustic/electric piano family — used for track detection in Phase 4
                const e = event as IMidiProgramChangeEvent;
                programChanges.push(e.programChange.programNumber);
                lines.push(`   programChange δ=${e.delta}  ch=${e.channel}  program=${e.programChange.programNumber}${e.programChange.programNumber <= 7 ? ' (piano family)' : ''}`);
            }
        }

        if (textEvents.length > 0) {
            lines.push(`   text events: ${textEvents.map((t) => `"${t}"`).join(', ')}`);
        }

        lines.push(`   Summary: ${tempoCount} tempo | ${noteOnCount} noteOn | ${noteOffCount} noteOff | ${cc64Count} CC64 sustain | programs: [${programChanges.join(', ')}]`);

        // Warn if noteOn/noteOff counts don't match — indicates unpaired notes that will affect Phase 4 duration calculation
        if (noteOnCount > 0 && noteOnCount !== noteOffCount) {
            lines.push(`   ⚠ noteOn/noteOff mismatch (${noteOnCount} on, ${noteOffCount} off) — pairing will rely on noteOn vel=0 normalization`);
        }

        lines.push('');
    });

    const text = lines.join('\n');
    output.textContent = text;
    console.log(text);
}

function getTrackName(track: TMidiEvent[]): string | null {
    for (const event of track) {
        if ('trackName' in event) {
            return (event as IMidiTrackNameEvent).trackName;
        }
    }
    return null;
}
