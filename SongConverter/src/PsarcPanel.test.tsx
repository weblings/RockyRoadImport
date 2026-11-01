// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { PsarcPanel } from './PsarcPanel';
import { createPsarcStore } from './stores/psarcStore';

afterEach(cleanup);

function setup() {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const store = createPsarcStore({
        loadWasm: async () => { await gate; return { PsarcInterop: { ConvertAllPsarc: () => '[]', GetOggAudio: () => new Uint8Array() } }; },
        fetchAlbumArt: async () => null,
        isWasmLoaded: () => false,
    });
    return { store, release };
}

describe('PsarcPanel status', () => {
    it('is a polite live region that announces wasm-load and parse results', async () => {
        const { store, release } = setup();
        const { container } = render(<PsarcPanel store={store} onDownload={() => {}} />);
        const status = document.getElementById('psarc-status')!;
        expect(status.getAttribute('aria-live')).toBe('polite');
        expect(status.textContent).toBe('');

        let loading!: Promise<void>;
        await act(async () => { loading = store.loadFile(new File([new Uint8Array(4)], 'song.psarc')); });
        expect(status.textContent).toBe('Loading the converter (first use only)…');

        await act(async () => { release(); await loading; });
        expect(status.textContent).toBe('✖ No arrangements found in this PSARC file. Check that it is a Rocksmith 2014 song.');
        expect(status.getAttribute('data-tone')).toBe('error');
        expect(screen.getByRole('button', { name: 'Download' }).hasAttribute('disabled')).toBe(true);
        expect(screen.getByText('song.psarc')).toBeTruthy();

        const results = await axe(container);
        expect(results.violations).toEqual([]);
    });
});

describe('PsarcPanel partial failure', () => {
    it('keeps Download enabled and shows the failure as a separate warning line', async () => {
        const song = (parts: unknown[]) => JSON.stringify([{
            SongKey: 'k', SongData: { SongName: 'S', ArtistName: 'A', AlbumName: 'B', InstrumentParts: [] },
            Structure: { Sections: [] }, Parts: parts,
        }]);
        const store = createPsarcStore({
            loadWasm: async () => ({ PsarcInterop: {
                ConvertAllPsarc: () => song([
                    { Name: 'Rhythm', Part: { InstrumentName: 'rhythm' } },
                    { Name: 'Lead', Part: null, Error: 'bad tuning' },
                ]),
                GetOggAudio: () => new Uint8Array(),
            } }),
            fetchAlbumArt: async () => null,
        });
        render(<PsarcPanel store={store} onDownload={() => {}} />);
        await act(async () => { await store.loadFile(new File([new Uint8Array(4)], 'song.psarc')); });

        expect(document.getElementById('psarc-status')!.textContent).toBe('Converted 1 of 2 parts: Rhythm.');
        const warnings = document.getElementById('psarc-warnings')!;
        expect(warnings.getAttribute('data-tone')).toBe('warning');
        expect(warnings.textContent).toBe("⚠ Couldn't convert: Lead (bad tuning).");
        expect(screen.getByRole('button', { name: 'Download' }).hasAttribute('disabled')).toBe(false);
    });
});
