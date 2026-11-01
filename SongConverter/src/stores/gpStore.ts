import type { ScoreConvertResult } from '../scoreConverter';
import { buildGpFiles, type ZipFiles } from '../zipFiles';
import { createStore } from './store';
import { readOptionalFile, type AttachmentFiles, type AttachmentKind, type Phase } from './fileIo';
import { FILE_KIND, NO_TRACKS, PARSING, convertedTracks, noFrettedTracks, parseFailure, skippedNotFretted } from '../messages';

export interface GpState {
    phase: Phase;
    status: string;
    // Things to check on a ready result; Download stays enabled.
    warnings: string[];
    formVisible: boolean;
    fileName: string | null;
    // Message from the last failed Download, cleared on retry or new file.
    downloadError: string | null;
    meta: { songName: string; artistName: string; albumName: string };
    attachments: AttachmentFiles;
}

// Parsing is alphaTab's job (scoreConverter), dynamically imported so MIDI-only users skip it.
export function createGpStore() {
    const store = createStore<GpState>({
        phase: 'idle',
        status: '',
        warnings: [],
        formVisible: false,
        fileName: null,
        downloadError: null,
        meta: { songName: '', artistName: '', albumName: '' },
        attachments: { albumArt: null, audio: null },
    });
    let requestId = 0;
    let result: ScoreConvertResult | null = null;

    return {
        get: store.get,
        subscribe: store.subscribe,

        // Dev walkthrough only (src/walkthrough.ts).
        seed(patch: Partial<GpState>): void {
            store.set(patch);
        },

        async loadFile(file: File): Promise<void> {
            const id = ++requestId;
            result = null;
            store.set({ phase: 'parsing', status: PARSING, warnings: [], formVisible: false, fileName: file.name, downloadError: null });
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
                            ? noFrettedTracks(skipped)
                            : NO_TRACKS,
                    });
                    return;
                }

                result = converted;
                const status = convertedTracks(converted.tracks.map((t) => t.trackName));
                const warnings = skipped.length > 0 ? [skippedNotFretted(skipped)] : [];
                store.set({
                    phase: 'ready',
                    status,
                    warnings,
                    formVisible: true,
                    meta: { songName: converted.songName, artistName: converted.artistName, albumName: '' },
                });
            } catch (err: unknown) {
                if (id !== requestId) return;
                store.set({ phase: 'error', status: parseFailure(FILE_KIND.gp, err) });
            }
        },

        setDownloadError(message: string | null): void {
            store.set({ downloadError: message });
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
