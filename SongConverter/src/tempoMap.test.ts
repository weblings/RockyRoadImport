import { describe, it, expect } from 'vitest';
import { buildTempoMap, ticksToSeconds, buildSongStructure } from './tempoMap';
import type { TempoChange } from './tempoMap';

// ---------------------------------------------------------------------------
// buildTempoMap
// ---------------------------------------------------------------------------

describe('buildTempoMap', () => {
    it('prepends default 120 BPM when no tempo events exist', () => {
        const map = buildTempoMap([[]]);
        expect(map).toHaveLength(1);
        expect(map[0]).toEqual({ tick: 0, microsecondsPerQuarter: 500_000 });
    });

    it('prepends default when first tempo event is not at tick 0', () => {
        // One track: a single setTempo event after some delta ticks
        const track = [
            { delta: 480, setTempo: { microsecondsPerQuarter: 600_000 } },
        ];
        const map = buildTempoMap([track as never]);
        expect(map[0]).toEqual({ tick: 0, microsecondsPerQuarter: 500_000 });
        expect(map[1]).toEqual({ tick: 480, microsecondsPerQuarter: 600_000 });
    });

    it('converts delta ticks to absolute ticks correctly', () => {
        // Deltas: 0, 240, 240 → absolute: 0, 240, 480
        const track = [
            { delta: 0,   setTempo: { microsecondsPerQuarter: 500_000 } },
            { delta: 240, setTempo: { microsecondsPerQuarter: 550_000 } },
            { delta: 240, setTempo: { microsecondsPerQuarter: 600_000 } },
        ];
        const map = buildTempoMap([track as never]);
        expect(map[0].tick).toBe(0);
        expect(map[1].tick).toBe(240);
        expect(map[2].tick).toBe(480);
    });

    it('sorts tempo events from multiple tracks by absolute tick', () => {
        const track1 = [{ delta: 960, setTempo: { microsecondsPerQuarter: 600_000 } }];
        const track2 = [{ delta: 480, setTempo: { microsecondsPerQuarter: 550_000 } }];
        const map = buildTempoMap([track1 as never, track2 as never]);
        // Default at 0, then track2's event at 480, then track1's at 960
        expect(map[0].tick).toBe(0);
        expect(map[1].tick).toBe(480);
        expect(map[2].tick).toBe(960);
    });
});

// ---------------------------------------------------------------------------
// ticksToSeconds
// ---------------------------------------------------------------------------

describe('ticksToSeconds', () => {
    it('converts tick 0 to 0 seconds', () => {
        const map: TempoChange[] = [{ tick: 0, microsecondsPerQuarter: 500_000 }];
        expect(ticksToSeconds(0, map, 480)).toBe(0);
    });

    it('constant 120 BPM (500_000 µs/quarter), 480 ticks/quarter: tick 480 → 0.5 s', () => {
        const map: TempoChange[] = [{ tick: 0, microsecondsPerQuarter: 500_000 }];
        expect(ticksToSeconds(480, map, 480)).toBeCloseTo(0.5);
    });

    it('constant 120 BPM: deltas [0, 240, 240] → [0 s, 0.25 s, 0.5 s]', () => {
        const map: TempoChange[] = [{ tick: 0, microsecondsPerQuarter: 500_000 }];
        const division = 480;
        expect(ticksToSeconds(0,   map, division)).toBeCloseTo(0.0);
        expect(ticksToSeconds(240, map, division)).toBeCloseTo(0.25);
        expect(ticksToSeconds(480, map, division)).toBeCloseTo(0.5);
    });

    it('tempo change mid-file: 120 BPM for 480 ticks then 60 BPM for next 480 ticks', () => {
        // 120 BPM = 0.5 s/beat, 60 BPM = 1.0 s/beat, division=480
        const map: TempoChange[] = [
            { tick: 0,   microsecondsPerQuarter: 500_000 }, // 120 BPM
            { tick: 480, microsecondsPerQuarter: 1_000_000 }, // 60 BPM
        ];
        const division = 480;
        expect(ticksToSeconds(480,  map, division)).toBeCloseTo(0.5);  // end of first segment
        expect(ticksToSeconds(960,  map, division)).toBeCloseTo(1.5);  // 0.5 + 1.0
    });
});

// ---------------------------------------------------------------------------
// buildSongStructure
// ---------------------------------------------------------------------------

describe('buildSongStructure', () => {
    it('generates beats at correct time offsets for constant 120 BPM, 4/4, 480 ticks/quarter', () => {
        const timeSigTrack = [{ delta: 0, timeSignature: { numerator: 4, denominator: 4, metronome: 24, thirtyseconds: 8 } }];
        // Two measures of notes just to set total ticks = 3840 (2 bars × 4 beats × 480)
        const noteTrack = [
            { delta: 0,    noteOn: { noteNumber: 60, velocity: 80 }, channel: 0 },
            { delta: 3840, noteOff: { noteNumber: 60, velocity: 0 }, channel: 0 },
        ];
        const tracks = [timeSigTrack as never, noteTrack as never];
        const map = buildTempoMap(tracks);
        const structure = buildSongStructure(tracks, map, 480);

        // Beat 0 at 0 s, beat 1 at 0.5 s, beat 2 at 1.0 s, beat 3 at 1.5 s, beat 4 at 2.0 s …
        expect(structure.Beats[0].TimeOffset).toBeCloseTo(0.0);
        expect(structure.Beats[1].TimeOffset).toBeCloseTo(0.5);
        expect(structure.Beats[4].TimeOffset).toBeCloseTo(2.0);
    });

    it('marks every 4th beat as IsMeasure in 4/4 time', () => {
        const noteTrack = [{ delta: 3840, noteOff: { noteNumber: 60, velocity: 0 }, channel: 0 }];
        const map = buildTempoMap([noteTrack as never]);
        const structure = buildSongStructure([noteTrack as never], map, 480);

        expect(structure.Beats[0].IsMeasure).toBe(true);
        expect(structure.Beats[1].IsMeasure).toBeUndefined();
        expect(structure.Beats[2].IsMeasure).toBeUndefined();
        expect(structure.Beats[3].IsMeasure).toBeUndefined();
        expect(structure.Beats[4].IsMeasure).toBe(true);
    });

    it('defaults to 4/4 time when no time signature event is present', () => {
        const noteTrack = [{ delta: 1920, noteOff: { noteNumber: 60, velocity: 0 }, channel: 0 }];
        const map = buildTempoMap([noteTrack as never]);
        const structure = buildSongStructure([noteTrack as never], map, 480);

        // 4/4 at 480 ticks/quarter → 4 beats before tick 1920
        expect(structure.Beats).toHaveLength(4);
    });
});
