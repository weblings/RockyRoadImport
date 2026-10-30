import type { IMidiFile } from 'midi-json-parser-worker';
import { buildTempoMap, buildSongStructure } from '../tempoMap';
import { convertPianoMidi } from '../pianoConverter';
import { buildSongInfo } from '../songBuilder';
import { buildMidiFiles, type ZipFiles } from '../zipFiles';
import { extractMetadata, logMidi } from '../midiLog';
import type { SongStructure, SongKeyboardNotes } from '../songformat';
import { createStore } from './store';
import { errorMessage, readOptionalFile, type AttachmentFiles, type AttachmentKind, type Phase } from './fileIo';

export interface MidiState {
    phase: Phase;
    // Debug log or the latest parse/convert message.
    status: string;
    formVisible: boolean;
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
        formVisible: false,
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
                    status: 'Warning: No piano notes found. Check that the MIDI file contains note data on a piano/keys track.',
                });
                return;
            }

            const text = logMidi(filename, midi, tempoMap, keyboardNotes.Notes.length);
            console.log(text);
            store.set({ phase: 'ready', handFallback: result.usedHandFallback, status: text });
        } catch (err: unknown) {
            store.set({ phase: 'error', status: `Conversion error: ${errorMessage(err)}` });
        }
    }

    return {
        get: store.get,
        subscribe: store.subscribe,

        async loadFile(file: File): Promise<void> {
            const id = ++requestId;
            structure = null;
            keyboardNotes = null;
            store.set({ phase: 'parsing', status: 'Parsing…' });
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
                store.set({ phase: 'error', status: `Error parsing MIDI file: ${errorMessage(err)}` });
            }
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
