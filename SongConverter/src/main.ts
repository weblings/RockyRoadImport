import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import './ui/tokens/generated/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/ribbon.css';
import { parseArrayBuffer } from 'midi-json-parser';
import { zipSync } from 'fflate';
import { createMidiStore } from './stores/midiStore';
import { createPsarcStore } from './stores/psarcStore';
import { createGpStore } from './stores/gpStore';
import { createMusicXmlStore } from './stores/musicXmlStore';
import { fetchAlbumArtPng, loadPsarcWasm, isPsarcWasmLoaded } from './stores/psarcWasm';
import { zipFilenameFor, type AttachmentKind } from './stores/fileIo';
import type { ZipFiles } from './zipFiles';

const app = document.getElementById('app')!;
app.innerHTML = `
    <div class="tabs">
        <button class="tab-btn active" data-tab="midi">Piano MIDI</button>
        <button class="tab-btn" data-tab="psarc">Rocksmith 2014</button>
        <button class="tab-btn" data-tab="gp">Guitar Pro</button>
        <button class="tab-btn" data-tab="musicxml">MusicXML</button>
    </div>

    <div id="tab-midi" class="tab-panel active">
        <h2>Piano MIDI Converter</h2>
        <input type="file" id="midi-input" accept=".mid,.midi" />

        <div id="metadata-form" class="meta-form is-hidden">
            <h3>Song Metadata</h3>
            <table>
                <tr><td>Song Name</td><td><input type="text" id="meta-song-name" size="40" /></td></tr>
                <tr><td>Artist</td><td><input type="text" id="meta-artist" size="40" /></td></tr>
                <tr><td>Album</td><td><input type="text" id="meta-album" size="40" /></td></tr>
                <tr><td>Album Art (optional)</td><td><input type="file" id="meta-album-art" accept="image/*" /></td></tr>
                <tr><td>Song Audio (optional)</td><td><input type="file" id="meta-audio" accept=".ogg,audio/ogg" /></td></tr>
                <tr>
                    <td></td>
                    <td>
                        <span class="field-note">*Audio must be .ogg format.
                            <a href="https://www.freeconvert.com/midi-to-ogg/download" target="_blank" rel="noopener noreferrer">MIDI to OGG converter</a>
                        </span>
                    </td>
                </tr>
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
        <div id="hand-disclaimer" class="is-hidden">
            <strong>&#9888; Hand Fallback Used</strong>
            <ul>
                <li><strong>No "Left Hand" / "Right Hand" track names detected</strong> — rename MIDI tracks to include these for accurate results.</li>
                <li><strong>Hand assigned by pitch</strong> — below middle C (MIDI 60) → left, above → right. May be wrong where hands cross.</li>
            </ul>
        </div>
        <button id="download-all" class="btn-primary" disabled>Download</button>
        <details class="debug-log">
            <summary>Show debug log</summary>
            <pre id="output"></pre>
        </details>
    </div>

    <div id="tab-psarc" class="tab-panel is-hidden">
        <h2>Rocksmith .psarc Importer</h2>
        <input type="file" id="psarc-input" accept=".psarc" />
        <div id="psarc-status" class="field-status"></div>

        <div id="psarc-metadata-form" class="meta-form is-hidden">
            <h3>Song Metadata</h3>
            <table>
                <tr><td>Song Name</td><td><input type="text" id="psarc-song-name" size="40" /></td></tr>
                <tr><td>Artist</td><td><input type="text" id="psarc-artist" size="40" /></td></tr>
                <tr><td>Album</td><td><input type="text" id="psarc-album" size="40" /></td></tr>
            </table>
        </div>

        <br>
        <button id="psarc-download-all" class="btn-primary" disabled>Download</button>
    </div>

    <div id="tab-gp" class="tab-panel is-hidden">
        <h2>Guitar Pro Importer</h2>
        <input type="file" id="gp-input" accept=".gp3,.gp4,.gp5" />
        <div id="gp-status" class="field-status"></div>

        <div id="gp-metadata-form" class="meta-form is-hidden">
            <h3>Song Metadata</h3>
            <table>
                <tr><td>Song Name</td><td><input type="text" id="gp-song-name" size="40" /></td></tr>
                <tr><td>Artist</td><td><input type="text" id="gp-artist" size="40" /></td></tr>
                <tr><td>Album</td><td><input type="text" id="gp-album" size="40" /></td></tr>
                <tr><td>Album Art (optional)</td><td><input type="file" id="gp-album-art" accept="image/*" /></td></tr>
                <tr><td>Song Audio (optional)</td><td><input type="file" id="gp-audio" accept=".ogg,audio/ogg" /></td></tr>
                <tr>
                    <td></td>
                    <td><span class="field-note">*Audio must be .ogg format.</span></td>
                </tr>
            </table>
        </div>

        <br>
        <button id="gp-download-all" class="btn-primary" disabled>Download</button>
    </div>

    <div id="tab-musicxml" class="tab-panel is-hidden">
        <h2>MusicXML Importer (Piano and Guitar)</h2>
        <input type="file" id="musicxml-input" accept=".musicxml,.xml,.mxl" />
        <div id="musicxml-status" class="field-status"></div>

        <div id="musicxml-metadata-form" class="meta-form is-hidden">
            <h3>Song Metadata</h3>
            <table>
                <tr><td>Song Name</td><td><input type="text" id="musicxml-song-name" size="40" /></td></tr>
                <tr><td>Artist</td><td><input type="text" id="musicxml-artist" size="40" /></td></tr>
                <tr><td>Album</td><td><input type="text" id="musicxml-album" size="40" /></td></tr>
                <tr><td>Album Art (optional)</td><td><input type="file" id="musicxml-album-art" accept="image/*" /></td></tr>
                <tr><td>Song Audio (optional)</td><td><input type="file" id="musicxml-audio" accept=".ogg,audio/ogg" /></td></tr>
                <tr id="musicxml-lyrics-row" class="is-hidden"><td>Lyrics from</td><td><select id="musicxml-lyrics-select"></select></td></tr>
                <tr>
                    <td></td>
                    <td><span class="field-note">*Audio must be .ogg format.</span></td>
                </tr>
            </table>
        </div>

        <br>
        <button id="musicxml-download-all" class="btn-primary" disabled>Download</button>
    </div>
`;

// Tabs: only one panel visible at a time.
const tabButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.tab-btn'));
const tabPanels: Record<string, HTMLElement> = {
    midi:  document.getElementById('tab-midi')!,
    psarc: document.getElementById('tab-psarc')!,
    gp:    document.getElementById('tab-gp')!,
    musicxml: document.getElementById('tab-musicxml')!,
};
tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab!;
        tabButtons.forEach((b) => b.classList.toggle('active', b === btn));
        for (const [key, panel] of Object.entries(tabPanels)) {
            panel.classList.toggle('active', key === tab);
            panel.style.display = key === tab ? 'block' : 'none';
        }
    });
});

// Converter state lives in the stores. Everything below only binds DOM to them.
const midi = createMidiStore({ parse: parseArrayBuffer });
const psarc = createPsarcStore({ loadWasm: loadPsarcWasm, fetchAlbumArt: fetchAlbumArtPng, isWasmLoaded: isPsarcWasmLoaded });
const gp = createGpStore();
const musicxml = createMusicXmlStore();

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// Skips redundant writes so re-rendering never disturbs a field being typed in.
function setValue(el: HTMLInputElement | HTMLSelectElement, value: string): void {
    if (el.value !== value) el.value = value;
}

function show(el: HTMLElement, visible: boolean, display = 'block'): void {
    el.style.display = visible ? display : 'none';
}

function triggerZipDownload(files: ZipFiles, zipName: string): void {
    const zip = zipSync(files);
    const blob = new Blob([new Uint8Array(zip)], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = zipName;
    a.click();
    URL.revokeObjectURL(url);
}

interface TabStore {
    loadFile(file: File): Promise<void>;
    buildFiles(): Promise<ZipFiles | null>;
    get(): { meta: { songName: string } };
}

// Wires the main file picker and Download button shared by every tab.
function bindLoadAndDownload(store: TabStore, inputId: string, downloadId: string): void {
    $<HTMLInputElement>(inputId).addEventListener('change', (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) void store.loadFile(file);
    });
    $<HTMLButtonElement>(downloadId).addEventListener('click', () => {
        const zipName = zipFilenameFor(store.get().meta.songName);
        void store.buildFiles().then((files) => {
            if (files) triggerZipDownload(files, zipName);
        });
    });
}

function bindAttachment(store: { setAttachment(k: AttachmentKind, f: File | null): void }, id: string, kind: AttachmentKind): void {
    $<HTMLInputElement>(id).addEventListener('change', (e) => {
        store.setAttachment(kind, (e.target as HTMLInputElement).files?.[0] ?? null);
    });
}

function bindText(id: string, onInput: (value: string) => void): HTMLInputElement {
    const el = $<HTMLInputElement>(id);
    el.addEventListener('input', () => onInput(el.value));
    return el;
}

// --- Piano MIDI ---
const midiSongName = bindText('meta-song-name', (v) => midi.setMeta({ songName: v }));
const midiArtist   = bindText('meta-artist',    (v) => midi.setMeta({ artistName: v }));
const midiAlbum    = bindText('meta-album',     (v) => midi.setMeta({ albumName: v }));
const midiDifficulty = $<HTMLInputElement>('meta-difficulty');
midiDifficulty.addEventListener('input', () => midi.setMeta({ difficulty: parseFloat(midiDifficulty.value) }));
bindAttachment(midi, 'meta-album-art', 'albumArt');
bindAttachment(midi, 'meta-audio', 'audio');
bindLoadAndDownload(midi, 'midi-input', 'download-all');

midi.subscribe(() => {
    const s = midi.get();
    setValue(midiSongName, s.meta.songName);
    setValue(midiArtist, s.meta.artistName);
    setValue(midiAlbum, s.meta.albumName);
    setValue(midiDifficulty, String(s.meta.difficulty));
    $('meta-difficulty-value').textContent = String(s.meta.difficulty);
    show($('metadata-form'), s.formVisible);
    show($('hand-disclaimer'), s.handFallback);
    $('output').textContent = s.status;
    $<HTMLButtonElement>('download-all').disabled = s.phase !== 'ready';
});

// --- Rocksmith .psarc ---
const psarcSongName = bindText('psarc-song-name', (v) => psarc.setMeta({ songName: v }));
const psarcArtist   = bindText('psarc-artist',    (v) => psarc.setMeta({ artistName: v }));
const psarcAlbum    = bindText('psarc-album',     (v) => psarc.setMeta({ albumName: v }));
bindLoadAndDownload(psarc, 'psarc-input', 'psarc-download-all');

psarc.subscribe(() => {
    const s = psarc.get();
    setValue(psarcSongName, s.meta.songName);
    setValue(psarcArtist, s.meta.artistName);
    setValue(psarcAlbum, s.meta.albumName);
    show($('psarc-metadata-form'), s.formVisible);
    $('psarc-status').textContent = s.status;
    $<HTMLButtonElement>('psarc-download-all').disabled = s.phase !== 'ready';
});

// --- Guitar Pro ---
const gpSongName = bindText('gp-song-name', (v) => gp.setMeta({ songName: v }));
const gpArtist   = bindText('gp-artist',    (v) => gp.setMeta({ artistName: v }));
const gpAlbum    = bindText('gp-album',     (v) => gp.setMeta({ albumName: v }));
bindAttachment(gp, 'gp-album-art', 'albumArt');
bindAttachment(gp, 'gp-audio', 'audio');
bindLoadAndDownload(gp, 'gp-input', 'gp-download-all');

gp.subscribe(() => {
    const s = gp.get();
    setValue(gpSongName, s.meta.songName);
    setValue(gpArtist, s.meta.artistName);
    setValue(gpAlbum, s.meta.albumName);
    show($('gp-metadata-form'), s.formVisible);
    $('gp-status').textContent = s.status;
    $<HTMLButtonElement>('gp-download-all').disabled = s.phase !== 'ready';
});

// --- MusicXML ---
const xmlSongName = bindText('musicxml-song-name', (v) => musicxml.setMeta({ songName: v }));
const xmlArtist   = bindText('musicxml-artist',    (v) => musicxml.setMeta({ artistName: v }));
const xmlAlbum    = bindText('musicxml-album',     (v) => musicxml.setMeta({ albumName: v }));
const xmlLyrics = $<HTMLSelectElement>('musicxml-lyrics-select');
xmlLyrics.addEventListener('change', () => musicxml.setMeta({ lyricsTrack: xmlLyrics.value }));
bindAttachment(musicxml, 'musicxml-album-art', 'albumArt');
bindAttachment(musicxml, 'musicxml-audio', 'audio');
bindLoadAndDownload(musicxml, 'musicxml-input', 'musicxml-download-all');

let renderedLyricsOptions: string[] | null = null;
musicxml.subscribe(() => {
    const s = musicxml.get();
    setValue(xmlSongName, s.meta.songName);
    setValue(xmlArtist, s.meta.artistName);
    setValue(xmlAlbum, s.meta.albumName);
    if (s.lyricsOptions !== renderedLyricsOptions) {
        renderedLyricsOptions = s.lyricsOptions;
        xmlLyrics.replaceChildren(...s.lyricsOptions.map((name) => new Option(name, name)));
    }
    setValue(xmlLyrics, s.meta.lyricsTrack);
    show($('musicxml-lyrics-row'), s.lyricsOptions.length > 0, '');
    show($('musicxml-metadata-form'), s.formVisible);
    $('musicxml-status').textContent = s.status;
    $<HTMLButtonElement>('musicxml-download-all').disabled = s.phase !== 'ready';
});

if (import.meta.env.VITE_DEMO_MODE === 'true') {
    const ribbon = document.createElement('div');
    ribbon.id = 'source-ribbon';
    const link = document.createElement('a');
    link.href = 'https://github.com/weblings/RockyRoadImport';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    // GitHub mark — Octicons' mark-github (MIT, @primer/octicons), inlined so the icon
    // has no external asset/network dependency and can inherit color via currentColor.
    link.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">'
        + '<path d="M6.766 11.328c-2.063-.25-3.516-1.734-3.516-3.656 0-.781.281-1.625.75-2.188-.203-.515-.172-1.609.063-2.062.625-.078 1.468.25 1.968.703.594-.187 1.219-.281 1.985-.281.765 0 1.39.094 1.953.265.484-.437 1.344-.765 1.969-.687.218.422.25 1.515.046 2.047.5.593.766 1.39.766 2.203 0 1.922-1.453 3.375-3.547 3.64.531.344.89 1.094.89 1.954v1.625c0 .468.391.734.86.547C13.781 14.359 16 11.53 16 8.03 16 3.61 12.406 0 7.984 0 3.563 0 0 3.61 0 8.031a7.88 7.88 0 0 0 5.172 7.422c.422.156.828-.125.828-.547v-1.25c-.219.094-.5.156-.75.156-1.031 0-1.64-.562-2.078-1.609-.172-.422-.36-.672-.719-.719-.187-.015-.25-.093-.25-.187 0-.188.313-.328.625-.328.453 0 .844.281 1.25.86.313.452.64.655 1.031.655s.641-.14 1-.5c.266-.265.47-.5.657-.656"/>'
        + '</svg> View Source Code';
    ribbon.appendChild(link);
    document.body.appendChild(ribbon);
}
