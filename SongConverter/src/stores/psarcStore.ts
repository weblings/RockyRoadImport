import type { PsarcSongResult } from '../songformat';
import { buildPsarcFiles, type ZipFiles } from '../zipFiles';
import { createStore } from './store';
import type { Phase } from './fileIo';
import { FILE_KIND, LOADING_CONVERTER, NO_ARRANGEMENTS, PARSING, allPartsFailed, convertedParts, failedParts, ignoredSongs, parseFailure } from '../messages';

export interface PsarcState {
    phase: Phase;
    status: string;
    // Things to check on a ready result; Download stays enabled.
    warnings: string[];
    formVisible: boolean;
    fileName: string | null;
    // Message from the last failed Download, cleared on retry or new file.
    downloadError: string | null;
    meta: { songName: string; artistName: string; albumName: string };
}

export interface PsarcDeps {
    loadWasm(): Promise<any>;
    fetchAlbumArt(exports: any, psarcBytes: Uint8Array, songKey: string): Promise<Uint8Array | null>;
    // When false, the one-off converter-loading message shows before the first parse.
    isWasmLoaded?(): boolean;
}

export function createPsarcStore(deps: PsarcDeps) {
    const store = createStore<PsarcState>({
        phase: 'idle',
        status: '',
        warnings: [],
        formVisible: false,
        fileName: null,
        downloadError: null,
        meta: { songName: '', artistName: '', albumName: '' },
    });
    let requestId = 0;
    let result: PsarcSongResult | null = null;
    // Per-load, so a slower earlier fetch can never land on a newer song.
    let albumArt: Promise<Uint8Array | null> = Promise.resolve(null);
    let oggAudio: Uint8Array | null = null;

    return {
        get: store.get,
        subscribe: store.subscribe,

        // Dev walkthrough only (src/walkthrough.ts).
        seed(patch: Partial<PsarcState>): void {
            store.set(patch);
        },

        async loadFile(file: File): Promise<void> {
            const id = ++requestId;
            result = null;
            albumArt = Promise.resolve(null);
            oggAudio = null;
            store.set({ phase: 'parsing', status: PARSING, warnings: [], formVisible: false, fileName: file.name, downloadError: null });
            try {
                const psarcBytes = new Uint8Array(await file.arrayBuffer());
                if (deps.isWasmLoaded && !deps.isWasmLoaded()) {
                    store.set({ status: LOADING_CONVERTER });
                }
                const exports = await deps.loadWasm();
                if (id !== requestId) return;

                const songs: PsarcSongResult[] = JSON.parse(exports.PsarcInterop.ConvertAllPsarc(psarcBytes));
                if (songs.length === 0 || songs[0].Parts.length === 0) {
                    store.set({ phase: 'error', status: NO_ARRANGEMENTS });
                    return;
                }

                // A .psarc almost always holds one song; a compilation archive imports only the first.
                const song = songs[0];
                result = song;
                store.set({
                    formVisible: true,
                    meta: {
                        songName: song.SongData?.SongName ?? '',
                        artistName: song.SongData?.ArtistName ?? '',
                        albumName: song.SongData?.AlbumName ?? '',
                    },
                });

                const succeeded = song.Parts.filter((p) => p.Part != null);
                const failed = song.Parts.filter((p) => p.Part == null);
                if (succeeded.length === 0) {
                    store.set({ phase: 'error', status: allPartsFailed(failed) });
                    return;
                }

                const status = convertedParts(succeeded.length, song.Parts.length, succeeded.map((p) => p.Name));
                const warnings: string[] = [];
                if (failed.length > 0) warnings.push(failedParts(failed));
                if (songs.length > 1) warnings.push(ignoredSongs(songs.length - 1));

                // Album art and audio are non-fatal: a failure drops that file, not the chart data.
                albumArt = deps.fetchAlbumArt(exports, psarcBytes, song.SongKey).catch((err: unknown) => {
                    console.warn('Album art extraction failed:', err);
                    return null;
                });
                const ogg: Uint8Array = exports.PsarcInterop.GetOggAudio(psarcBytes, song.SongKey);
                oggAudio = ogg.length > 0 ? ogg : null;

                store.set({ phase: 'ready', status, warnings });
            } catch (err: unknown) {
                if (id !== requestId) return;
                store.set({ phase: 'error', status: parseFailure(FILE_KIND.psarc, err) });
            }
        },

        setDownloadError(message: string | null): void {
            store.set({ downloadError: message });
        },

        setMeta(patch: Partial<PsarcState['meta']>): void {
            store.set({ meta: { ...store.get().meta, ...patch } });
        },

        // Awaits album art so an early Download click still ships it.
        async buildFiles(): Promise<ZipFiles | null> {
            if (!result) return null;
            const current = result;
            const pendingArt = albumArt;
            const audio = oggAudio;
            const { meta } = store.get();
            const art = await pendingArt;
            return buildPsarcFiles({ result: current, ...meta }, { albumArt: art, audio });
        },
    };
}

export type PsarcStore = ReturnType<typeof createPsarcStore>;
