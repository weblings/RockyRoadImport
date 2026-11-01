import type { IMidiFile } from 'midi-json-parser-worker';
import { buildTempoMap, buildSongStructure } from '../tempoMap';
import { convertPianoMidi } from '../pianoConverter';
import { buildSongInfo } from '../songBuilder';
import { buildMidiFiles, type ZipFiles } from '../zipFiles';
import { extractMetadata, logMidi } from '../midiLog';
import type { SongStructure, SongKeyboardNotes } from '../songformat';
import { createStore } from './store';
import { readOptionalFile, type AttachmentFiles, type AttachmentKind, type Phase } from './fileIo';
import { FILE_KIND, NO_PIANO_NOTES, PARSING, convertFailure, convertedPianoNotes, parseFailure } from '../messages';

export interface MidiState {
    phase: Phase;
    // One-line result or error message.
    status: string;
    // Full conversion log, shown in the collapsed debug disclosure.
    log: string;
    formVisible: boolean;
    fileName: string | null;
    // Message from the last failed Download, cleared on retry or new file.
    downloadError: string | null;
    handFallback: boolean;
    meta: { songName: string; artistName: string; albumName: string; difficulty: number };
    attachments: AttachmentFiles;
}

export interface MidiDeps {
    // midi-json-parser needs a browser Worker, so the shell injects it.
    parse(buffer: ArrayBuffer): Promise<IMidiFile>;
}

export function createMidiStore(deps: MidiDeps) {
    const store = createStore<MidiState>({
        phase: 'idle',
        status: '',
        log: '',
        formVisible: false,
        fileName: null,
        downloadError: null,
        handFallback: false,
        meta: { songName: '', artistName: '', albumName: '', difficulty: 0 },
        attachments: { albumArt: null, audio: null },
    });
    let requestId = 0;
    let structure: SongStructure | null = null;
    let keyboardNotes: SongKeyboardNotes | null = null;

    function convert(midi: IMidiFile, filename: string): void {
        try {
            const tempoMap = buildTempoMap(midi.tracks);
            structure = buildSongStructure(midi.tracks, tempoMap, midi.division);
            const result = convertPianoMidi(midi.tracks, tempoMap, midi.division, 0);
            keyboardNotes = result.keyboardNotes;

            if (keyboardNotes.Notes.length === 0) {
                store.set({
                    phase: 'error',
                    handFallback: false,
                    status: NO_PIANO_NOTES,
                });
                return;
            }

            const text = logMidi(filename, midi, tempoMap, keyboardNotes.Notes.length);
            console.log(text);
            const count = keyboardNotes.Notes.length;
            store.set({ phase: 'ready', handFallback: result.usedHandFallback, status: convertedPianoNotes(count), log: text });
        } catch (err: unknown) {
            store.set({ phase: 'error', status: convertFailure(FILE_KIND.midi, err) });
        }
    }

    return {
        get: store.get,
        subscribe: store.subscribe,

        // Dev walkthrough only (src/walkthrough.ts).
        seed(patch: Partial<MidiState>): void {
            store.set(patch);
        },

        async loadFile(file: File): Promise<void> {
            const id = ++requestId;
            structure = null;
            keyboardNotes = null;
            store.set({ phase: 'parsing', status: PARSING, log: '', formVisible: false, handFallback: false, fileName: file.name, downloadError: null });
            try {
                const midi = await deps.parse(await file.arrayBuffer());
                if (id !== requestId) return;

                const meta = extractMetadata(midi.tracks);
                store.set({
                    formVisible: true,
                    meta: { songName: meta.songName, artistName: meta.artist, albumName: '', difficulty: 0 },
                });
                convert(midi, file.name);
            } catch (err: unknown) {
                if (id !== requestId) return;
                store.set({ phase: 'error', status: parseFailure(FILE_KIND.midi, err) });
            }
        },

        setDownloadError(message: string | null): void {
            store.set({ downloadError: message });
        },

        setMeta(patch: Partial<MidiState['meta']>): void {
            store.set({ meta: { ...store.get().meta, ...patch } });
        },

        setAttachment(kind: AttachmentKind, file: File | null): void {
            store.set({ attachments: { ...store.get().attachments, [kind]: file } });
        },

        async buildFiles(): Promise<ZipFiles | null> {
            if (!structure || !keyboardNotes) return null;
            const notes = keyboardNotes;
            const arrangement = structure;
            const { meta, attachments } = store.get();
            const songInfo = buildSongInfo({
                songName: meta.songName,
                artistName: meta.artistName,
                albumName: meta.albumName,
                keysNotes: notes,
                difficulty: meta.difficulty,
            });
            const [albumArt, audio] = await Promise.all([
                readOptionalFile(attachments.albumArt),
                readOptionalFile(attachments.audio),
            ]);
            return buildMidiFiles({ songInfo, structure: arrangement, keyboardNotes: notes, albumArt, audio });
        },
    };
}

export type MidiStore = ReturnType<typeof createMidiStore>;
