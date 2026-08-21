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

    it('groups simultaneous notes into a chord with a shared, valid ChordID', () => {
        // alphaTex's (a b c) grouping is just simultaneous notes, not a named GP chord diagram
        // (no beat.chordId) - this is the incidental-chord path real files mostly hit.
        const score = scoreFrom('.\n:4 (0.6 2.5 2.4) |');
        const [track] = convertScore(score).tracks;
        expect(track.notes.Notes).toHaveLength(3);

        const chordId = track.notes.Notes[0].ChordID;
        expect(chordId).toBeTypeOf('number');
        expect(track.notes.Notes.every((n) => n.ChordID === chordId)).toBe(true);

        // A Chord-tagged note with no resolvable ChordID is exactly the bug that silently
        // dropped it from rendering - the chord entry must actually exist.
        const chord = track.notes.Chords[chordId!];
        expect(chord).toBeDefined();
        expect(chord.Frets).toContain(0);
        expect(chord.Frets).toContain(2);

        // The renderer only skips a string when *both* Fingers and Frets are -1 there - a 0 in
        // Fingers for an unplayed (-1) string draws a phantom note. Only 3 of 6 strings played.
        for (let i = 0; i < chord.Frets.length; i++) {
            if (chord.Frets[i] === -1) expect(chord.Fingers[i]).toBe(-1);
        }

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

    it('assumes Lead for a lone untitled track, and dedupes repeated roles across several', () => {
        const score = scoreFrom(
            '.\n:4 0.6 0.6 |\n' +
            '\\track "Guitar 2"\n.\n:4 0.6 0.6 |\n' +
            '\\track "Guitar 3"\n.\n:4 0.6 0.6 |',
        );
        const [t1, t2, t3] = convertScore(score).tracks;
        expect(t1.part.InstrumentName).toBe('lead');
        expect(t2.part.InstrumentName).toBe('rhythm');
        expect(t3.part.InstrumentName).toBe('rhythm2');
    });

    it('uses a track name hint over position-based guessing', () => {
        const score = scoreFrom('.\n:4 0.6 0.6 |\n\\track "Lead Guitar"\n.\n:4 0.6 0.6 |');
        const [, second] = convertScore(score).tracks;
        expect(second.part.InstrumentType).toBe('LeadGuitar');
    });

    it('produces a non-empty top-level structure (arrangement.json) even with no explicit sections', () => {
        const score = scoreFrom('.\n:4 0.6 0.6 0.6 0.6 | 0.6 0.6 0.6 0.6 |');
        const { structure } = convertScore(score);
        expect(structure.Beats.length).toBeGreaterThan(0);
        expect(structure.Beats.filter((b) => b.IsMeasure)).toHaveLength(2);
    });
});
