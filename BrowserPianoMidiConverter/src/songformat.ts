// Mirrors the OpenSongChart JSON types used on disk.
// Sourced from ThreeCP/Project/src/SongFormat.ts — piano-relevant subset only.
// No conversion logic — the JSON files are the right shape.

export interface ISongEvent {
    TimeOffset: number;
    EndTime?: number;
}

export interface SongBeat extends ISongEvent {
    TimeOffset: number;
    IsMeasure?: boolean;
    EndTime?: number;
}

export interface SongSection {
    Name: string;
    StartTime?: number;
    EndTime?: number;
}

export interface SongStructure {
    Sections: SongSection[];
    Beats: SongBeat[];
}

export interface SongInstrumentPart {
    InstrumentName: string;
    InstrumentType: string;
    SongDifficulty?: number;
    Tuning?: StringTuning;
    CapoFret?: number;
}

export interface SongInfo {
    SongName: string;
    SongYear?: number;
    SongLengthSeconds: number;
    ArtistName: string;
    AlbumName?: string;
    InstrumentParts: SongInstrumentPart[];
}

export interface SongKeyboardNote extends ISongEvent {
    TimeOffset: number;
    TimeLength: number;
    Note: number;       // MIDI note number (21–108 for 88-key piano)
    Velocity: number;   // 0–127
    Hand?: 'left' | 'right';     // optional hand assignment (split at middle C / note 60)
    SustainActive?: boolean;      // true when CC64 sustain pedal is held at note start
}

export interface SongKeyboardNotes {
    Sections: SongSection[];
    Notes: SongKeyboardNote[];
}

// --- Guitar/psarc types below, mirroring the C# SongFormat.cs classes of the same
// name (SongInstrumentNotes, SongNote, SongChord, SongDifficultyLevel). These are pure
// types for the JSON the psarc-import wasm module returns - no conversion logic lives
// on the TS side, that's all in the reused C#.

export interface SongChord {
    Name: string;
    Fingers: number[];
    Frets: number[];
}

export interface CentsOffset {
    TimeOffset: number;
    Cents: number;
}

export interface SongNote extends ISongEvent {
    TimeOffset: number;
    TimeLength: number;
    Fret: number;
    String: number;
    Techniques?: string;      // comma-joined ESongNoteTechnique flag names, e.g. "FretHandMute, Chord"
    HandFret?: number;
    SlideFret?: number;
    ChordID?: number;
    FingerID?: number;
    CentsOffsets?: CentsOffset[];
    EndTime: number;
}

export interface SongDifficultyLevel {
    Difficulty: number;
    StartTime: number;
    EndTime: number;
    Notes: SongNote[];
}

export interface SongInstrumentNotes {
    Sections: SongSection[];
    Chords: SongChord[];
    Notes: SongNote[];
    AlternateLevels?: SongDifficultyLevel[];
}

export interface StringTuning {
    StringSemitoneOffsets: number[];
}

export interface SongVocal {
    Vocal: string;
    TimeOffset: number;
}

// The full SongInfo/InstrumentParts shape used by song.json - separate from the
// lighter-weight SongInfo above (which the MIDI path builds directly in main.ts).
export interface SongData {
    SongName: string;
    SongYear?: number;
    SongLengthSeconds: number;
    ArtistName: string;
    AlbumName?: string;
    A440CentsOffset?: number;
    InstrumentParts?: SongInstrumentPart[];
}

// Mirrors the PsarcInterop.ConvertAllPsarc JSON output shape: one entry per song entry
// found in the .psarc (almost always exactly one for a single-song file), each carrying
// every arrangement it contains. A part with no Part/Notes/Vocals and a set Error failed
// to convert but didn't abort the rest.
export interface PsarcPartResult {
    Name: string;
    Part?: SongInstrumentPart;
    Notes?: SongInstrumentNotes;
    Vocals?: SongVocal[];
    Error?: string;
}

export interface PsarcSongResult {
    SongData: SongData;
    Parts: PsarcPartResult[];
}
