import { describe, it, expect } from 'vitest';
import type { TMidiEvent } from 'midi-json-parser-worker';
import { convertPianoMidi } from './pianoConverter';

// Hand-built MIDI event arrays (no .mid fixture needed): a named track with a
// piano program and one middle-C note on/off pair.
function namedTrack(name: string, program: number | null, noteNumber: number): TMidiEvent[] {
    const track: unknown[] = [{ delta: 0, trackName: name }];
    if (program !== null) {
        track.push({ delta: 0, channel: 0, programChange: { programNumber: program } });
    }
    track.push({ delta: 0, channel: 0, noteOn: { noteNumber, velocity: 80 } });
    track.push({ delta: 96, channel: 0, noteOff: { noteNumber, velocity: 0 } });
    return track as TMidiEvent[];
}

describe('convertPianoMidi track-name matching', () => {
    it('no longer reads Rhythm as right-hand', () => {
        const result = convertPianoMidi([namedTrack('Rhythm', 0, 72)], [], 96, 0);
        expect(result.usedHandFallback).toBe(true);
        expect(result.keyboardNotes.Notes[0].Hand).toBe('right'); // pitch split, not the name
    });

    it('no longer reads Lefty as left-hand', () => {
        const result = convertPianoMidi([namedTrack('Lefty', 0, 72)], [], 96, 0);
        expect(result.usedHandFallback).toBe(true);
        expect(result.keyboardNotes.Notes[0].Hand).toBe('right');
    });

    it('still honors dotted hand abbreviations', () => {
        const result = convertPianoMidi([namedTrack('R.H. Piano', 0, 48)], [], 96, 0);
        expect(result.usedHandFallback).toBe(false);
        expect(result.keyboardNotes.Notes[0].Hand).toBe('right');
    });
});
