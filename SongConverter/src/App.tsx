import { useEffect, useMemo, useState } from 'react';
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
import { Tabs } from '@weblings/grille';
import type { ZipFiles } from './zipFiles';
import { downloadFailure } from './messages';

interface TabStore {
    buildFiles(): Promise<ZipFiles | null>;
    get(): { meta: { songName: string } };
    setDownloadError(message: string | null): void;
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

export async function downloadFrom(store: TabStore): Promise<void> {
    store.setDownloadError(null);
    try {
        const files = await store.buildFiles();
        if (files) triggerZipDownload(files, zipFilenameFor(store.get().meta.songName));
    } catch (err: unknown) {
        store.setDownloadError(downloadFailure(err));
    }
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
    const [tab, setTab] = useState('midi');
    const [walkLabel, setWalkLabel] = useState<string | null>(null);

    // Dev-only error-state walkthrough; see src/walkthrough.ts.
    useEffect(() => {
        if (!import.meta.env.DEV) return;
        const params = new URLSearchParams(window.location.search);
        const dwell = params.get('walkthrough');
        if (dwell === null) return;
        let cancelled = false;
        void import('./walkthrough').then(({ runWalkthrough }) => runWalkthrough({
            stores, dwellMs: Number(dwell) || 2000, tab: params.get('tab'), loop: params.has('loop'),
            setTab, setLabel: setWalkLabel, isCancelled: () => cancelled,
        }));
        return () => { cancelled = true; };
    }, [stores]);

    return (
        <>
            {walkLabel && <div style={{ position: 'fixed', top: 0, right: 0, zIndex: 10, padding: '4px 8px', background: '#222', color: '#fff', font: '12px monospace' }}>{walkLabel}</div>}
            <Tabs label="Converter" selectedKey={tab} onSelectionChange={setTab} tabs={[
                { id: 'midi', label: 'Piano MIDI', content: <MidiPanel store={stores.midi} onDownload={downloadFrom} /> },
                { id: 'psarc', label: 'Rocksmith 2014', content: <PsarcPanel store={stores.psarc} onDownload={downloadFrom} /> },
                { id: 'gp', label: 'Guitar Pro', content: <GpPanel store={stores.gp} onDownload={downloadFrom} /> },
                { id: 'musicxml', label: 'MusicXML', content: <MusicXmlPanel store={stores.musicxml} onDownload={downloadFrom} /> },
            ]} />
            {import.meta.env.VITE_DEMO_MODE === 'true' && <SourceRibbon />}
        </>
    );
}
