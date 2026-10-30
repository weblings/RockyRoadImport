import type { ScoreConvertResult } from '../scoreConverter';
import { buildGpFiles, type ZipFiles } from '../zipFiles';
import { createStore } from './store';
import { errorMessage, readOptionalFile, type AttachmentFiles, type AttachmentKind, type Phase } from './fileIo';

export interface GpState {
    phase: Phase;
    status: string;
    formVisible: boolean;
    meta: { songName: string; artistName: string; albumName: string };
    attachments: AttachmentFiles;
}

// Parsing is alphaTab's job (scoreConverter), dynamically imported so MIDI-only users skip it.
export function createGpStore() {
    const store = createStore<GpState>({
        phase: 'idle',
        status: '',
        formVisible: false,
        meta: { songName: '', artistName: '', albumName: '' },
        attachments: { albumArt: null, audio: null },
    });
    let requestId = 0;
    let result: ScoreConvertResult | null = null;

    return {
        get: store.get,
        subscribe: store.subscribe,

        async loadFile(file: File): Promise<void> {
            const id = ++requestId;
            result = null;
            store.set({ phase: 'parsing', status: 'Parsing…', formVisible: false });
            try {
                const buffer = await file.arrayBuffer();
                const { convertGuitarPro } = await import('../scoreConverter');
                const converted = convertGuitarPro(new Uint8Array(buffer));
                if (id !== requestId) return;
                // The GP tab ships no keys.json, so detected piano parts count as skipped here.
                const skipped = [...converted.skipped, ...converted.pianoTracks.map((p) => p.trackName)];

                if (converted.tracks.length === 0) {
                    store.set({
                        phase: 'error',
                        status: skipped.length > 0
                            ? `No fretted-instrument tracks found. Skipped: ${skipped.join(', ')}.`
                            : 'No tracks found in this file.',
                    });
                    return;
                }

                result = converted;
                let status = `Converted ${converted.tracks.length} track(s): ${converted.tracks.map((t) => t.trackName).join(', ')}.`;
                if (skipped.length > 0) status += ` Skipped (not a fretted instrument): ${skipped.join(', ')}.`;
                store.set({
                    phase: 'ready',
                    status,
                    formVisible: true,
                    meta: { songName: converted.songName, artistName: converted.artistName, albumName: '' },
                });
            } catch (err: unknown) {
                if (id !== requestId) return;
                store.set({ phase: 'error', status: `Error parsing Guitar Pro file: ${errorMessage(err)}` });
            }
        },

        setMeta(patch: Partial<GpState['meta']>): void {
            store.set({ meta: { ...store.get().meta, ...patch } });
        },

        setAttachment(kind: AttachmentKind, file: File | null): void {
            store.set({ attachments: { ...store.get().attachments, [kind]: file } });
        },

        async buildFiles(): Promise<ZipFiles | null> {
            if (!result || result.tracks.length === 0) return null;
            const current = result;
            const { meta, attachments } = store.get();
            const [albumArt, audio] = await Promise.all([
                readOptionalFile(attachments.albumArt),
                readOptionalFile(attachments.audio),
            ]);
            return buildGpFiles({ result: current, ...meta }, { albumArt, audio });
        },
    };
}

export type GpStore = ReturnType<typeof createGpStore>;
