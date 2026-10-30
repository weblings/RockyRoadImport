import { useMemo } from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-aria-components';
import { parseArrayBuffer } from 'midi-json-parser';
import { zipSync } from 'fflate';
import { createMidiStore } from './stores/midiStore';
import { createPsarcStore } from './stores/psarcStore';
import { createGpStore } from './stores/gpStore';
import { createMusicXmlStore } from './stores/musicXmlStore';
import { fetchAlbumArtPng, loadPsarcWasm, isPsarcWasmLoaded } from './stores/psarcWasm';
import { zipFilenameFor } from './stores/fileIo';
import { MidiPanel } from './MidiPanel';
import { PsarcPanel } from './PsarcPanel';
import { GpPanel } from './GpPanel';
import { MusicXmlPanel } from './MusicXmlPanel';
import type { ZipFiles } from './zipFiles';

interface TabStore {
    buildFiles(): Promise<ZipFiles | null>;
    get(): { meta: { songName: string } };
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

function downloadFrom(store: TabStore): void {
    const zipName = zipFilenameFor(store.get().meta.songName);
    void store.buildFiles().then((files) => {
        if (files) triggerZipDownload(files, zipName);
    });
}

function SourceRibbon() {
    return (
        <div id="source-ribbon">
            <a href="https://github.com/weblings/RockyRoadImport" target="_blank" rel="noopener noreferrer">
                {/* Octicons mark-github (MIT, @primer/octicons), inlined to avoid an external asset. */}
                <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M6.766 11.328c-2.063-.25-3.516-1.734-3.516-3.656 0-.781.281-1.625.75-2.188-.203-.515-.172-1.609.063-2.062.625-.078 1.468.25 1.968.703.594-.187 1.219-.281 1.985-.281.765 0 1.39.094 1.953.265.484-.437 1.344-.765 1.969-.687.218.422.25 1.515.046 2.047.5.593.766 1.39.766 2.203 0 1.922-1.453 3.375-3.547 3.64.531.344.89 1.094.89 1.954v1.625c0 .468.391.734.86.547C13.781 14.359 16 11.53 16 8.03 16 3.61 12.406 0 7.984 0 3.563 0 0 3.61 0 8.031a7.88 7.88 0 0 0 5.172 7.422c.422.156.828-.125.828-.547v-1.25c-.219.094-.5.156-.75.156-1.031 0-1.64-.562-2.078-1.609-.172-.422-.36-.672-.719-.719-.187-.015-.25-.093-.25-.187 0-.188.313-.328.625-.328.453 0 .844.281 1.25.86.313.452.64.655 1.031.655s.641-.14 1-.5c.266-.265.47-.5.657-.656"/>
                </svg>{' '}
                View Source Code
            </a>
        </div>
    );
}

export function App() {
    const stores = useMemo(() => ({
        midi: createMidiStore({ parse: parseArrayBuffer }),
        psarc: createPsarcStore({ loadWasm: loadPsarcWasm, fetchAlbumArt: fetchAlbumArtPng, isWasmLoaded: isPsarcWasmLoaded }),
        gp: createGpStore(),
        musicxml: createMusicXmlStore(),
    }), []);

    return (
        <>
            <Tabs>
                <TabList className="tabs" aria-label="Converter">
                    <Tab id="midi" className="tab-btn">Piano MIDI</Tab>
                    <Tab id="psarc" className="tab-btn">Rocksmith 2014</Tab>
                    <Tab id="gp" className="tab-btn">Guitar Pro</Tab>
                    <Tab id="musicxml" className="tab-btn">MusicXML</Tab>
                </TabList>
                {/* Force-mounted so each panel keeps its local state while hidden. */}
                <TabPanel id="midi" className="tab-panel" shouldForceMount>
                    <MidiPanel store={stores.midi} onDownload={downloadFrom} />
                </TabPanel>
                <TabPanel id="psarc" className="tab-panel" shouldForceMount>
                    <PsarcPanel store={stores.psarc} onDownload={downloadFrom} />
                </TabPanel>
                <TabPanel id="gp" className="tab-panel" shouldForceMount>
                    <GpPanel store={stores.gp} onDownload={downloadFrom} />
                </TabPanel>
                <TabPanel id="musicxml" className="tab-panel" shouldForceMount>
                    <MusicXmlPanel store={stores.musicxml} onDownload={downloadFrom} />
                </TabPanel>
            </Tabs>
            {import.meta.env.VITE_DEMO_MODE === 'true' && <SourceRibbon />}
        </>
    );
}
