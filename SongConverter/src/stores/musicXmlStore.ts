import type { ScoreConvertResult } from '../scoreConverter';
import { mergePianoTracks } from '../songBuilder';
import { buildMusicXmlFiles, type ZipFiles } from '../zipFiles';
import { createStore } from './store';
import { errorMessage, readOptionalFile, type AttachmentFiles, type AttachmentKind, type Phase } from './fileIo';

export interface MusicXmlState {
    phase: Phase;
    status: string;
    formVisible: boolean;
    fileName: string | null;
    meta: { songName: string; artistName: string; albumName: string; lyricsTrack: string };
    // Only populated when several tracks carry lyrics, which is when the picker shows.
    lyricsOptions: string[];
    attachments: AttachmentFiles;
}

export function createMusicXmlStore() {
    const store = createStore<MusicXmlState>({
        phase: 'idle',
        status: '',
        formVisible: false,
        fileName: null,
        meta: { songName: '', artistName: '', albumName: '', lyricsTrack: '' },
        lyricsOptions: [],
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
            store.set({ phase: 'parsing', status: 'Parsing…', formVisible: false, fileName: file.name });
            try {
                const buffer = await file.arrayBuffer();
                const { convertMusicXml } = await import('../scoreConverter');
                const converted = convertMusicXml(new Uint8Array(buffer));
                if (id !== requestId) return;
                const lyricTracks = converted.lyrics.filter((l) => l.vocals.length > 0);
                const pianoNames = converted.pianoTracks.map((p) => p.trackName);
                const keysCount = mergePianoTracks(converted.pianoTracks).Notes.length;

                // A detected piano part with no notes ships nothing, so it can't open the download.
                if (converted.tracks.length === 0 && lyricTracks.length === 0 && keysCount === 0) {
                    const skipped = [...converted.skipped, ...pianoNames];
                    store.set({
                        phase: 'error',
                        status: skipped.length > 0
                            ? `No convertible notes found. Skipped: ${skipped.join(', ')}.`
                            : 'No tracks found in this file.',
                    });
                    return;
                }

                result = converted;
                // One lyric part is auto-picked; several get a picker defaulting to the first.
                const lyricsOptions = lyricTracks.length > 1 ? lyricTracks.map((l) => l.trackName) : [];

                // Lyric-bearing and detected-piano tracks aren't "skipped": vocals convert as
                // vocals and piano parts merge into keys.json.
                const skippedShown = converted.skipped.filter((n) => !lyricTracks.some((l) => l.trackName === n) && !pianoNames.includes(n));

                // Only surface things that need attention; a clean parse leaves this blank.
                const notes: string[] = [];
                if (skippedShown.length > 0) notes.push(`Skipped (not a fretted instrument): ${skippedShown.join(', ')}.`);
                if (converted.pianoTracks.some((p) => p.usedHandFallback)) {
                    notes.push('Piano hand assigned by fallback (not grand staff); may be wrong where hands cross.');
                }
                if (lyricTracks.length > 1) notes.push(`Lyrics in ${lyricTracks.length} tracks — choose one.`);

                store.set({
                    phase: 'ready',
                    status: notes.join(' '),
                    formVisible: true,
                    lyricsOptions,
                    meta: {
                        songName: converted.songName,
                        artistName: converted.artistName,
                        albumName: '',
                        lyricsTrack: lyricsOptions[0] ?? '',
                    },
                });
            } catch (err: unknown) {
                if (id !== requestId) return;
                store.set({ phase: 'error', status: `Error parsing MusicXML file: ${errorMessage(err)}` });
            }
        },

        setMeta(patch: Partial<MusicXmlState['meta']>): void {
            store.set({ meta: { ...store.get().meta, ...patch } });
        },

        setAttachment(kind: AttachmentKind, file: File | null): void {
            store.set({ attachments: { ...store.get().attachments, [kind]: file } });
        },

        async buildFiles(): Promise<ZipFiles | null> {
            if (!result) return null;
            const current = result;
            const { meta, attachments } = store.get();
            const [albumArt, audio] = await Promise.all([
                readOptionalFile(attachments.albumArt),
                readOptionalFile(attachments.audio),
            ]);
            return buildMusicXmlFiles({ result: current, ...meta }, { albumArt, audio });
        },
    };
}

export type MusicXmlStore = ReturnType<typeof createMusicXmlStore>;
