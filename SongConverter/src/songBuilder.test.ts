import { describe, it, expect } from 'vitest';
import type { SongKeyboardNote } from './songformat';
import { mergePianoTracks, keysInstrumentPart, buildSongInfo } from './songBuilder';

function keyNote(note: number, offset: number, length = 1): SongKeyboardNote {
    return { TimeOffset: offset, TimeLength: length, EndTime: offset + length, Note: note, Velocity: 95, Hand: 'right' };
}

describe('mergePianoTracks', () => {
    it('merges every part into one time-sorted keys.json with empty Sections', () => {
        const merged = mergePianoTracks([
            { trackName: 'Piano 1', notes: [keyNote(72, 2), keyNote(60, 0)], usedHandFallback: false },
            { trackName: 'Piano 2', notes: [keyNote(48, 1)], usedHandFallback: true },
        ]);
        expect(merged.Sections).toEqual([]);
        expect(merged.Notes.map((n) => n.Note)).toEqual([60, 48, 72]);
    });

    it('merges to zero notes when no piano parts were detected', () => {
        expect(mergePianoTracks([])).toEqual({ Sections: [], Notes: [] });
    });
});

describe('keysInstrumentPart', () => {
    it('matches the MIDI path keys/Keys shape, difficulty only when set', () => {
        expect(keysInstrumentPart()).toEqual({ InstrumentName: 'keys', InstrumentType: 'Keys' });
        expect(keysInstrumentPart(2.5)).toEqual({ InstrumentName: 'keys', InstrumentType: 'Keys', SongDifficulty: 2.5 });
    });
});

describe('buildSongInfo', () => {
    it('folds guitar, keys, and vocal onsets into one length with all three parts', () => {
        const info = buildSongInfo({
            songName: '  Tune ',
            artistName: 'Band',
            albumName: 'Album',
            guitarParts: [{ InstrumentName: 'lead', InstrumentType: 'LeadGuitar' }],
            guitarNotes: [{ Sections: [], Chords: [], Notes: [
                { TimeOffset: 0, TimeLength: 10, EndTime: 10, Fret: 0, String: 0 },
            ] }],
            keysNotes: { Sections: [], Notes: [keyNote(60, 5, 10)] },
            vocalOnsets: [20],
        });
        expect(info.SongLengthSeconds).toBe(20);
        expect(info.InstrumentParts.map((p) => p.InstrumentName)).toEqual(['lead', 'keys']);
        expect(info.SongName).toBe('Tune');
        expect(info.AlbumName).toBe('Album');
    });

    it('omits the keys part when the piano merge is empty, vocals still extend length', () => {
        const info = buildSongInfo({
            songName: '',
            artistName: '',
            keysNotes: { Sections: [], Notes: [] },
            vocalOnsets: [3],
        });
        expect(info.InstrumentParts).toEqual([]);
        expect(info.SongLengthSeconds).toBe(3);
        expect(info.SongName).toBe('Unknown');
        expect(info.AlbumName).toBeUndefined();
    });
});
