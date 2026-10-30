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
import { createElement } from 'react';
import { mountIsland } from './ui';
import { MidiPanel } from './MidiPanel';
import { GpPanel } from './GpPanel';
import { MusicXmlPanel } from './MusicXmlPanel';
import { zipFilenameFor } from './stores/fileIo';
import type { ZipFiles } from './zipFiles';

const app = document.getElementById('app')!;
app.innerHTML = `
    <div class="tabs">
        <button class="tab-btn active" data-tab="midi">Piano MIDI</button>
        <button class="tab-btn" data-tab="psarc">Rocksmith 2014</button>
        <button class="tab-btn" data-tab="gp">Guitar Pro</button>
        <button class="tab-btn" data-tab="musicxml">MusicXML</button>
    </div>

    <div id="tab-midi" class="tab-panel active"><div id="midi-island"></div></div>

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

    <div id="tab-gp" class="tab-panel is-hidden"><div id="gp-island"></div></div>

    <div id="tab-musicxml" class="tab-panel is-hidden"><div id="musicxml-island"></div></div>
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

function downloadFrom(store: TabStore): void {
    const zipName = zipFilenameFor(store.get().meta.songName);
    void store.buildFiles().then((files) => {
        if (files) triggerZipDownload(files, zipName);
    });
}

// Wires the main file picker and Download button shared by every tab.
function bindLoadAndDownload(store: TabStore, inputId: string, downloadId: string): void {
    $<HTMLInputElement>(inputId).addEventListener('change', (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) void store.loadFile(file);
    });
    $<HTMLButtonElement>(downloadId).addEventListener('click', () => downloadFrom(store));
}

function bindText(id: string, onInput: (value: string) => void): HTMLInputElement {
    const el = $<HTMLInputElement>(id);
    el.addEventListener('input', () => onInput(el.value));
    return el;
}

// --- Piano MIDI ---
mountIsland($('midi-island'), createElement(MidiPanel, { store: midi, onDownload: downloadFrom }));

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
mountIsland($('gp-island'), createElement(GpPanel, { store: gp, onDownload: downloadFrom }));

// --- MusicXML ---
mountIsland($('musicxml-island'), createElement(MusicXmlPanel, { store: musicxml, onDownload: downloadFrom }));

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
