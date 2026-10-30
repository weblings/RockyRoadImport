import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
// midi-json-parser needs a browser Worker, so tests use the worker's own parse function.
import { parseArrayBuffer } from 'midi-json-parser-worker/build/es2019/midi-file-parser';
import { strFromU8 } from 'fflate';
import guitarXml from './fixtures/guitar-three-notes.musicxml?raw';
import pianoXml from './fixtures/piano-grand-staff.musicxml?raw';
import { buildTempoMap, buildSongStructure } from './tempoMap';
import { convertPianoMidi } from './pianoConverter';
import { buildSongInfo } from './songBuilder';
import { convertMusicXml } from './scoreConverter';
import type { PsarcSongResult } from './songformat';
import {
    buildMidiFiles, buildPsarcFiles, buildGpFiles, buildMusicXmlFiles, type ZipFiles,
} from './zipFiles';

// Keeps snapshots stable across version bumps.
vi.mock('./version', () => ({ GENERATED_BY: 'RockyRoadImport_vTEST' }));

// Golden tests: fixture + metadata -> exact zip entries. Update snapshots only for an
// intended output change. Binary attachments are pinned by size and hash.
function render(files: ZipFiles | null): unknown {
    if (!files) return null;
    return Object.fromEntries(Object.entries(files).map(([name, bytes]) => [
        name,
        name.endsWith('.json')
            ? strFromU8(bytes)
            : `<${bytes.length} bytes sha1:${createHash('sha1').update(bytes).digest('hex')}>`,
    ]));
}

const art = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
const audio = new Uint8Array([79, 103, 103, 83, 9, 8]);

describe('MIDI zip entries', () => {
    const buf = readFileSync(new URL('./fixtures/piano-three-notes.mid', import.meta.url));
    const midi = parseArrayBuffer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    const tempoMap = buildTempoMap(midi.tracks);
    const structure = buildSongStructure(midi.tracks, tempoMap, midi.division);
    const { keyboardNotes } = convertPianoMidi(midi.tracks, tempoMap, midi.division, 0);
    const songInfo = buildSongInfo({
        songName: 'Golden Song', artistName: 'Tester', albumName: '', keysNotes: keyboardNotes, difficulty: 2.5,
    });

    it('without attachments', () => {
        expect(Object.keys(buildMidiFiles({ songInfo, structure, keyboardNotes }))).toEqual(
            ['song.json', 'arrangement.json', 'keys.json']);
        expect(render(buildMidiFiles({ songInfo, structure, keyboardNotes }))).toMatchSnapshot();
    });

    it('with art and audio', () => {
        const files = buildMidiFiles({ songInfo, structure, keyboardNotes, albumArt: art, audio });
        expect(Object.keys(files).slice(3)).toEqual(['albumart.png', 'song.ogg']);
    });
});

describe('Guitar Pro zip entries', () => {
    const result = convertMusicXml(new TextEncoder().encode(guitarXml));
    const meta = { result, songName: '', artistName: 'Someone', albumName: '' };

    it('falls back to parsed song name, with attachments', () => {
        expect(render(buildGpFiles(meta, { albumArt: art, audio }))).toMatchSnapshot();
    });

    it('returns null with no tracks', () => {
        expect(buildGpFiles({ ...meta, result: { ...result, tracks: [] } }, {})).toBeNull();
    });
});

describe('MusicXML zip entries', () => {
    const guitar = convertMusicXml(new TextEncoder().encode(guitarXml));
    const piano = convertMusicXml(new TextEncoder().encode(pianoXml));
    const base = { songName: 'Typed Name', artistName: '', albumName: 'Typed Album', lyricsTrack: '' };

    it('guitar', () => {
        expect(render(buildMusicXmlFiles({ result: guitar, ...base }, {}))).toMatchSnapshot();
    });

    it('piano keys.json', () => {
        expect(render(buildMusicXmlFiles({ result: piano, ...base }, { audio }))).toMatchSnapshot();
    });
});

describe('psarc zip entries', () => {
    const result = {
        SongKey: 'GoldenKey',
        SongData: { SongName: 'Parsed Name', ArtistName: 'Parsed Artist', AlbumName: 'Parsed Album', InstrumentParts: [] },
        Structure: { Sections: [] },
        Parts: [
            { Name: 'lead', Part: { InstrumentName: 'lead' }, Notes: { Notes: [{ TimeOffset: 1 }] } },
            { Name: 'vocals', Part: { InstrumentName: 'vocals' }, Vocals: [{ TimeOffset: 2 }] },
            { Name: 'broken', Part: null, Error: 'x' },
        ],
    } as unknown as PsarcSongResult;

    it('trims names, empty album becomes undefined, failed parts skipped', () => {
        const files = buildPsarcFiles(
            { result, songName: '  Edited  ', artistName: '', albumName: '   ' },
            { albumArt: art, audio },
        );
        expect(render(files)).toMatchSnapshot();
    });

    it('returns null when no part parsed', () => {
        const none = { ...result, Parts: [{ Name: 'b', Part: null }] } as unknown as PsarcSongResult;
        expect(buildPsarcFiles({ result: none, songName: '', artistName: '', albumName: '' }, {})).toBeNull();
    });
});
