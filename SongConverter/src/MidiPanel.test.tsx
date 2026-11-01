// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { MidiPanel } from './MidiPanel';
import { createMidiStore } from './stores/midiStore';

afterEach(cleanup);

function setup() {
    const store = createMidiStore({ parse: () => Promise.reject(new Error('bad header')) });
    const view = render(<MidiPanel store={store} onDownload={() => {}} />);
    return { store, ...view };
}

describe('MidiPanel errors', () => {
    it('shows a parse error in the status region, outside the collapsed debug log', async () => {
        const { store, container } = setup();
        await act(async () => { await store.loadFile(new File([new Uint8Array(4)], 'broken.mid')); });

        const status = document.getElementById('midi-status')!;
        expect(status.textContent).toBe('✖ Error parsing MIDI file: bad header');
        expect(status.getAttribute('data-tone')).toBe('error');
        expect(status.closest('.ui-disclosure-panel, [hidden]')).toBeNull();
        expect(screen.getByRole('button', { name: 'Download' }).hasAttribute('disabled')).toBe(true);
        expect((await axe(container)).violations).toEqual([]);
    });

    it('announces a download failure as an alert and clears it', async () => {
        const { store } = setup();
        expect(screen.getByRole('alert').textContent).toBe('');

        act(() => store.setDownloadError('Download failed: boom'));
        expect(screen.getByRole('alert').textContent).toBe('✖ Download failed: boom');

        act(() => store.setDownloadError(null));
        expect(screen.getByRole('alert').textContent).toBe('');
    });

    it('hides the previous song\'s form and hand-fallback callout after a failed load', async () => {
        const parse = vi.fn()
            .mockResolvedValueOnce({ tracks: [[]], division: 480 })
            .mockRejectedValueOnce(new Error('bad header'));
        const store = createMidiStore({ parse });
        render(<MidiPanel store={store} onDownload={() => {}} />);
        act(() => store.setMeta({ songName: 'Good' }));
        await act(async () => { await store.loadFile(new File([new Uint8Array(4)], 'good.mid')); });
        await act(async () => { await store.loadFile(new File([new Uint8Array(4)], 'broken.mid')); });

        expect(store.get().formVisible).toBe(false);
        expect(store.get().handFallback).toBe(false);
        expect(screen.queryByText('Song Metadata')).toBeNull();
    });
});
