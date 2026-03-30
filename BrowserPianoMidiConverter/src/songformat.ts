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
