import type {
    TMidiEvent,
    IMidiSetTempoEvent,
    IMidiTimeSignatureEvent,
} from 'midi-json-parser-worker';
import type { SongBeat, SongSection, SongStructure } from './songformat';

export interface TempoChange {
    tick: number;
    microsecondsPerQuarter: number;
}

/**
 * Collect all setTempo events from all tracks, sorted by absolute tick.
 * Prepends a default 120 BPM entry at tick 0 if none exists.
 */
export function buildTempoMap(tracks: TMidiEvent[][]): TempoChange[] {
    const changes: TempoChange[] = [];

    for (const track of tracks) {
        let tick = 0;
        for (const event of track) {
            tick += (event as { delta: number }).delta;
            if ('setTempo' in event) {
                const e = event as IMidiSetTempoEvent;
                changes.push({ tick, microsecondsPerQuarter: e.setTempo.microsecondsPerQuarter });
            }
        }
    }

    changes.sort((a, b) => a.tick - b.tick);

    if (changes.length === 0 || changes[0].tick > 0) {
        changes.unshift({ tick: 0, microsecondsPerQuarter: 500_000 }); // default 120 BPM
    }

    return changes;
}

/**
 * Convert an absolute tick position to wall-clock seconds.
 * Mirrors the tick-advance logic in RockBandConverter.cs lines 315-346.
 */
export function ticksToSeconds(absoluteTick: number, tempoMap: TempoChange[], division: number): number {
    let seconds = 0;

    for (let i = 0; i < tempoMap.length; i++) {
        const segStart = tempoMap[i].tick;
        if (absoluteTick <= segStart) break;

        const segEnd = i + 1 < tempoMap.length ? tempoMap[i + 1].tick : absoluteTick;
        const ticksInSeg = Math.min(absoluteTick, segEnd) - segStart;
        seconds += (ticksInSeg / division) * (tempoMap[i].microsecondsPerQuarter / 1_000_000);
    }

    return seconds;
}

/** Return the first time signature event found across all tracks, defaulting to 4/4. */
function getTimeSignature(tracks: TMidiEvent[][]): { numerator: number; denominator: number } {
    for (const track of tracks) {
        for (const event of track) {
            if ('timeSignature' in event) {
                const e = event as IMidiTimeSignatureEvent;
                return { numerator: e.timeSignature.numerator, denominator: e.timeSignature.denominator };
            }
        }
    }
    return { numerator: 4, denominator: 4 };
}

/** Return the last absolute tick across all tracks. */
function getTotalTicks(tracks: TMidiEvent[][]): number {
    let maxTick = 0;
    for (const track of tracks) {
        let tick = 0;
        for (const event of track) {
            tick += (event as { delta: number }).delta;
        }
        if (tick > maxTick) maxTick = tick;
    }
    return maxTick;
}

/**
 * Generate a SongStructure with synthetic beat markers derived from the tempo map and time signature.
 * Used for plain piano MIDI files that have no Rock Band BEAT track.
 */
export function buildSongStructure(
    tracks: TMidiEvent[][],
    tempoMap: TempoChange[],
    division: number,
): SongStructure {
    const timeSig = getTimeSignature(tracks);
    const totalTicks = getTotalTicks(tracks);

    // Ticks per beat: quarter note = division ticks; adjust for denominator
    const ticksPerBeat = Math.round((division * 4) / timeSig.denominator);
    const ticksPerMeasure = ticksPerBeat * timeSig.numerator;

    const beats: SongBeat[] = [];

    for (let tick = 0; tick < totalTicks; tick += ticksPerBeat) {
        const beat: SongBeat = { TimeOffset: ticksToSeconds(tick, tempoMap, division) };
        if (tick % ticksPerMeasure === 0) beat.IsMeasure = true;
        beats.push(beat);
    }

    const sections: SongSection[] = [];
    return { Sections: sections, Beats: beats };
}
