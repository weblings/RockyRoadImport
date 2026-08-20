import { describe, it, expect } from 'vitest';
import * as alphaTab from '@coderline/alphatab';
import { convertScore } from './gpConverter';

// Builds a Score via alphaTab's own alphaTex importer rather than needing binary .gp3/.gp4/.gp5
// fixture files - loadAlphaTex feeds the same Score model convertScore consumes either way.
function scoreFrom(tex: string) {
    return alphaTab.importer.ScoreLoader.loadAlphaTex(tex);
}

describe('convertScore', () => {
    it('reads song metadata', () => {
        const score = scoreFrom('\\title "Test Song"\n\\artist "Test Artist"\n.\n:4 0.6 0.6 |');
        const result = convertScore(score);
        expect(result.songName).toBe('Test Song');
        expect(result.artistName).toBe('Test Artist');
    });

    it('converts a standard-tuned 6-string guitar track with default (offset-zero) tuning', () => {
        const score = scoreFrom('.\n:4 0.6 2.5 3.4 4.3 |');
        const [track] = convertScore(score).tracks;
        expect(track.part.InstrumentType).toBe('LeadGuitar');
        expect(track.part.Tuning?.StringSemitoneOffsets).toEqual([0, 0, 0, 0, 0, 0]);
        expect(track.notes.Notes).toHaveLength(4);
        expect(track.notes.Notes[0]).toMatchObject({ Fret: 0, String: 0 });
        expect(track.notes.Notes[1]).toMatchObject({ Fret: 2, String: 1 });
    });

    it('assigns increasing, non-overlapping times to consecutive quarter notes', () => {
        const score = scoreFrom('.\n:4 0.6 0.6 0.6 0.6 |');
        const [track] = convertScore(score).tracks;
        const times = track.notes.Notes.map((n) => n.TimeOffset);
        expect(times[0]).toBe(0);
        for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThan(times[i - 1]);
    });

    it('marks a hammer-on note with the HammerOn technique', () => {
        const score = scoreFrom('.\n:4 0.6{h} 2.6 |');
        const [track] = convertScore(score).tracks;
        expect(track.notes.Notes[1].Techniques).toContain('HammerOn');
    });

    it('groups simultaneous notes into a chord with a shared ChordID', () => {
        const score = scoreFrom('.\n:4 (0.6 2.5 2.4) |');
        const [track] = convertScore(score).tracks;
        expect(track.notes.Notes).toHaveLength(3);
        const chordIds = new Set(track.notes.Notes.map((n) => n.ChordID));
        expect(chordIds.size).toBe(1);
        expect(track.notes.Notes[0].Techniques).toContain('Chord');
        expect(track.notes.Notes[1].Techniques).toContain('ChordNote');
    });

    it('skips a percussion track and reports it', () => {
        const score = scoreFrom(
            '\\track "Drums" \\instrument percussion \\clef neutral\n\\articulation defaults\n:4 KickHit KickHit |\n' +
            '\\track "Guitar"\n.\n:4 0.6 0.6 |',
        );
        const result = convertScore(score);
        expect(result.skipped).toContain('Drums');
        expect(result.tracks.map((t) => t.trackName)).toEqual(['Guitar']);
    });
});
