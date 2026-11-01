import { strToU8 } from 'fflate';
import { buildSongInfo as buildSharedSongInfo, mergePianoTracks } from './songBuilder';
import type { ScoreConvertResult } from './scoreConverter';
import type { TrackLyrics } from './vocals';
import type { SongInfo, SongStructure, SongKeyboardNotes, PsarcSongResult } from './songformat';
import { GENERATED_BY } from './version';

// Per-format zip entry assembly, kept pure (no DOM) so golden tests can pin the output.
// Per-format differences (JSON replacer, name fallbacks) are intentional for now.

export type ZipFiles = Record<string, Uint8Array>;

export interface Attachments {
    albumArt?: Uint8Array | null;
    audio?: Uint8Array | null;
}

function addAttachments(files: ZipFiles, a: Attachments): void {
    if (a.albumArt) files['albumart.png'] = a.albumArt;
    if (a.audio)    files['song.ogg']     = a.audio;
}

const midiReplacer = (_key: string, value: unknown): unknown => {
    if (value === null) return undefined;
    if (Array.isArray(value) && value.length === 0) return undefined;
    return value;
};

export function buildMidiFiles(args: {
    songInfo: SongInfo;
    structure: SongStructure;
    keyboardNotes: SongKeyboardNotes;
} & Attachments): ZipFiles {
    const files: ZipFiles = {
        'song.json':        strToU8(JSON.stringify(args.songInfo,      midiReplacer, 2)),
        'arrangement.json': strToU8(JSON.stringify(args.structure,     midiReplacer, 2)),
        'keys.json':        strToU8(JSON.stringify(args.keyboardNotes, midiReplacer, 2)),
    };
    addAttachments(files, args);
    return files;
}

export function buildPsarcFiles(args: {
    result: PsarcSongResult;
    songName: string;
    artistName: string;
    albumName: string;
}, attachments: Attachments): ZipFiles | null {
    const succeeded = args.result.Parts.filter((p) => p.Part != null);
    if (succeeded.length === 0) return null;

    const songInfo = {
        ...args.result.SongData,
        SongName: args.songName.trim() || args.result.SongData.SongName,
        ArtistName: args.artistName.trim() || args.result.SongData.ArtistName,
        AlbumName: args.albumName.trim() || undefined,
        GeneratedBy: GENERATED_BY,
    };

    const files: ZipFiles = {
        'song.json': strToU8(JSON.stringify(songInfo, null, 2)),
    };
    for (const part of succeeded) {
        files[`${part.Name}.json`] = strToU8(JSON.stringify(part.Notes ?? part.Vocals, null, 2));
    }
    if (args.result.Structure) {
        files['arrangement.json'] = strToU8(JSON.stringify(args.result.Structure, null, 2));
    }
    addAttachments(files, attachments);
    return files;
}

export function buildGpFiles(args: {
    result: ScoreConvertResult;
    songName: string;
    artistName: string;
    albumName: string;
}, attachments: Attachments): ZipFiles | null {
    const { result } = args;
    if (result.tracks.length === 0) return null;

    const songInfo: SongInfo = buildSharedSongInfo({
        songName: args.songName || result.songName,
        artistName: args.artistName || result.artistName,
        albumName: args.albumName,
        guitarParts: result.tracks.map((t) => t.part),
        guitarNotes: result.tracks.map((t) => t.notes),
    });

    const files: ZipFiles = {
        'song.json':        strToU8(JSON.stringify(songInfo, null, 2)),
        'arrangement.json': strToU8(JSON.stringify(result.structure, null, 2)),
    };
    for (const track of result.tracks) {
        files[`${track.part.InstrumentName}.json`] = strToU8(JSON.stringify(track.notes, null, 2));
    }
    addAttachments(files, attachments);
    return files;
}

// Single lyric part auto-picks; several use the chosen track name (default: the first).
export function pickMusicXmlLyrics(result: ScoreConvertResult, chosenTrack: string): TrackLyrics | null {
    const options = result.lyrics.filter((l) => l.vocals.length > 0);
    if (options.length === 0) return null;
    if (options.length === 1) return options[0];
    return options.find((l) => l.trackName === chosenTrack) ?? options[0];
}

export function buildMusicXmlFiles(args: {
    result: ScoreConvertResult;
    songName: string;
    artistName: string;
    albumName: string;
    lyricsTrack: string;
}, attachments: Attachments): ZipFiles | null {
    const { result } = args;
    const lyrics = pickMusicXmlLyrics(result, args.lyricsTrack);

    // All piano parts merge into one keys.json + keys/Keys part (the MIDI
    // path shape); mixed guitar+piano+vocals files stay one upload.
    const keysNotes = mergePianoTracks(result.pianoTracks);
    const hasKeys = keysNotes.Notes.length > 0;
    if (result.tracks.length === 0 && !lyrics && !hasKeys) return null;

    const songInfo: SongInfo = buildSharedSongInfo({
        songName: args.songName || result.songName,
        artistName: args.artistName || result.artistName,
        albumName: args.albumName,
        guitarParts: result.tracks.map((t) => t.part),
        guitarNotes: result.tracks.map((t) => t.notes),
        keysNotes,
        vocalOnsets: lyrics ? lyrics.vocals.map((v) => v.TimeOffset) : [],
    });
    if (lyrics) {
        songInfo.InstrumentParts.push({ InstrumentName: 'vocals', InstrumentType: 'Vocals' });
    }

    const files: ZipFiles = {
        'song.json':        strToU8(JSON.stringify(songInfo, null, 2)),
        'arrangement.json': strToU8(JSON.stringify(result.structure, null, 2)),
    };
    for (const track of result.tracks) {
        files[`${track.part.InstrumentName}.json`] = strToU8(JSON.stringify(track.notes, null, 2));
    }
    if (hasKeys) files['keys.json'] = strToU8(JSON.stringify(keysNotes, null, 2));
    if (lyrics) files['vocals.json'] = strToU8(JSON.stringify(lyrics.vocals, null, 2));
    addAttachments(files, attachments);
    return files;
}
