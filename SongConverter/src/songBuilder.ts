import type { PianoTrackInfo } from './scoreConverter';
import type {
    SongInfo,
    SongInstrumentPart,
    SongKeyboardNotes,
    SongInstrumentNotes,
} from './songformat';
import { GENERATED_BY } from './version';

// Shared song.json builder for the MIDI, Guitar Pro, and MusicXML tabs, so the
// piano output (ngd.6) reuses one merge rather than adding another ad-hoc site.
// Pure data in/out - no alphaTab import, so MIDI-only users never pay for it.

// OpenSongChart takes a single keys part (the MIDI path precedent), so every
// detected Score piano part merges into one keys.json. Sections ride
// arrangement.json, exactly like the MIDI path's empty Sections.
export function mergePianoTracks(pianoTracks: PianoTrackInfo[]): SongKeyboardNotes {
    const notes = pianoTracks.flatMap((t) => t.notes);
    notes.sort((a, b) => a.TimeOffset - b.TimeOffset);
    return { Sections: [], Notes: notes };
}

export function keysInstrumentPart(difficulty = 0): SongInstrumentPart {
    return {
        InstrumentName: 'keys',
        InstrumentType: 'Keys',
        ...(difficulty > 0 ? { SongDifficulty: difficulty } : {}),
    };
}

function endTimeOf(n: { EndTime?: number; TimeOffset: number; TimeLength?: number }): number {
    return n.EndTime ?? n.TimeOffset + (n.TimeLength ?? 0);
}

export function buildSongInfo(args: {
    songName: string;
    artistName: string;
    albumName?: string;
    guitarParts?: SongInstrumentPart[];
    guitarNotes?: SongInstrumentNotes[];
    keysNotes?: SongKeyboardNotes | null;
    vocalOnsets?: number[];
    difficulty?: number;
}): SongInfo {
    let length = 0;
    for (const g of args.guitarNotes ?? []) {
        for (const n of g.Notes) length = Math.max(length, endTimeOf(n));
    }
    const keys = args.keysNotes;
    if (keys) {
        for (const n of keys.Notes) length = Math.max(length, endTimeOf(n));
    }
    // Vocals carry onsets only, so the last onset stands in for the end time.
    for (const t of args.vocalOnsets ?? []) length = Math.max(length, t);

    const parts = [...(args.guitarParts ?? [])];
    // A detected-but-empty piano part ships no keys.json; the download gate
    // already ensures some other content exists in that case.
    if (keys && keys.Notes.length > 0) parts.push(keysInstrumentPart(args.difficulty ?? 0));

    const info: SongInfo = {
        SongName: args.songName.trim() || 'Unknown',
        ArtistName: args.artistName.trim() || 'Unknown',
        SongLengthSeconds: length,
        InstrumentParts: parts,
        GeneratedBy: GENERATED_BY,
    };
    const album = args.albumName?.trim();
    if (album) info.AlbumName = album;
    return info;
}
