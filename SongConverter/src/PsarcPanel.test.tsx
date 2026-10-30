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
        const status = screen.getByRole('status');
        expect(status.getAttribute('aria-live')).toBe('polite');
        expect(status.textContent).toBe('');

        let loading!: Promise<void>;
        await act(async () => { loading = store.loadFile(new File([new Uint8Array(4)], 'song.psarc')); });
        expect(status.textContent).toBe('Loading wasm module (first use only)…');

        await act(async () => { release(); await loading; });
        expect(status.textContent).toBe('No arrangements found in this .psarc file.');
        expect(screen.getByRole('button', { name: 'Download' }).hasAttribute('disabled')).toBe(true);

        const results = await axe(container);
        expect(results.violations).toEqual([]);
    });
});
