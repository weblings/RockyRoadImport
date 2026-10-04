import { describe, it, expect } from 'vitest';
import { trackNameTokens, trackNameHas, TRACK_NAME_ALIASES as A } from './trackNames';

describe('trackNameTokens', () => {
    it('strips dots so dotted hand abbreviations stay one token', () => {
        expect(trackNameTokens('R.H. Piano')).toEqual(['rh', 'piano']);
        expect(trackNameTokens('L.H.')).toEqual(['lh']);
    });

    it('splits camelCase and punctuation, including NBSP', () => {
        expect(trackNameTokens('RhythmGuitar')).toEqual(['rhythm', 'guitar']);
        expect(trackNameTokens('Left-Hand')).toEqual(['left', 'hand']);
        expect(trackNameTokens('Piano\u00a0Solo')).toEqual(['piano', 'solo']);
    });
});

describe('trackNameHas', () => {
    it('rejects the substring false hits', () => {
        expect(trackNameHas('Bassoon', A.bass)).toBe(false);
        expect(trackNameHas('Rhythm', A.right)).toBe(false);
        expect(trackNameHas('Rhodes', A.right)).toBe(false);
        expect(trackNameHas('Lefty', A.left)).toBe(false);
        expect(trackNameHas('Composer', A.comp)).toBe(false);
        expect(trackNameHas('Misleading', A.lead)).toBe(false);
    });

    it('keeps plural/suffix forms substring matching got by accident', () => {
        expect(trackNameHas('Contrabass', A.bass)).toBe(true);
        expect(trackNameHas('Chords', A.chord)).toBe(true);
        expect(trackNameHas('Comping', A.comp)).toBe(true);
        expect(trackNameHas('Soloist', A.solo)).toBe(true);
        expect(trackNameHas('Pianoforte', A.piano)).toBe(true);
        expect(trackNameHas('Pno', A.piano)).toBe(true);
        expect(trackNameHas('Keys', A.piano)).toBe(true);
    });

    it('matches dotted and plain hand abbreviations', () => {
        expect(trackNameHas('R.H.', A.right)).toBe(true);
        expect(trackNameHas('L.H.', A.left)).toBe(true);
        expect(trackNameHas('RH', A.right)).toBe(true);
        expect(trackNameHas('LH', A.left)).toBe(true);
    });
});
