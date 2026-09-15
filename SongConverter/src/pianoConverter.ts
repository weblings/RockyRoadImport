import type {
    TMidiEvent,
    IMidiNoteOnEvent,
    IMidiNoteOffEvent,
    IMidiControlChangeEvent,
    IMidiTrackNameEvent,
    IMidiProgramChangeEvent,
} from 'midi-json-parser-worker';
import { ticksToSeconds, type TempoChange } from './tempoMap';
import type { SongKeyboardNote, SongKeyboardNotes } from './songformat';

interface PendingNote {
    startTick: number;
    velocity: number;
    sustainActive: boolean;
}

interface DetectedTrack {
    track: TMidiEvent[];
    hand: 'left' | 'right' | null; // null = split by pitch threshold
}

function getTrackName(track: TMidiEvent[]): string | null {
    for (const event of track) {
        if ('trackName' in event) {
            return (event as IMidiTrackNameEvent).trackName;
        }
    }
    return null;
}

function detectPianoTracks(tracks: TMidiEvent[][]): DetectedTrack[] {
    const results: DetectedTrack[] = [];

    for (const track of tracks) {
        const hasNotes = track.some((e) => 'noteOn' in e);
        if (!hasNotes) continue;

        const name = (getTrackName(track) ?? '').toLowerCase();

        // Track name keywords take priority
        if (
            name.includes('piano') ||
            name.includes('right') || name.includes('rh') ||
            name.includes('left')  || name.includes('lh')
        ) {
            const hand: 'left' | 'right' | null =
                name.includes('left') || name.includes('lh') ? 'left' :
                name.includes('right') || name.includes('rh') ? 'right' :
                null;
            results.push({ track, hand });
            continue;
        }

        // GM program change 0–7 = acoustic/electric piano family
        const hasPianoProgram = track.some(
            (e) => 'programChange' in e &&
                   (e as IMidiProgramChangeEvent).programChange.programNumber <= 7,
        );
        if (hasPianoProgram) {
            results.push({ track, hand: null });
        }
    }

    // Fallback: use all tracks that contain notes
    if (results.length === 0) {
        for (const track of tracks) {
            if (track.some((e) => 'noteOn' in e)) {
                results.push({ track, hand: null });
            }
        }
    }

    return results;
}

function endNote(
    channel: number,
    noteNumber: number,
    endTick: number,
    pending: Map<number, PendingNote>,
    tempoMap: TempoChange[],
    division: number,
    midiTimeOffset: number,
    hand: 'left' | 'right' | null,
    notes: SongKeyboardNote[],
): void {
    if (noteNumber === 0) return; // matches C# NoteNumber > 0 guard

    const key = channel * 128 + noteNumber;
    const p = pending.get(key);
    if (!p) return; // noteOff without a prior noteOn — skip gracefully
    pending.delete(key);

    const timeOffset = ticksToSeconds(p.startTick, tempoMap, division) + midiTimeOffset;
    const timeLength = ticksToSeconds(endTick, tempoMap, division) - ticksToSeconds(p.startTick, tempoMap, division);

    const resolvedHand: 'left' | 'right' | undefined =
        hand ?? (noteNumber < 60 ? 'left' : 'right');

    const note: SongKeyboardNote = {
        TimeOffset: timeOffset,
        TimeLength: timeLength,
        EndTime: timeOffset + timeLength,
        Note: noteNumber,
        Velocity: p.velocity,
        Hand: resolvedHand,
    };

    if (p.sustainActive) note.SustainActive = true;

    notes.push(note);
}

/**
 * Extract piano notes from a parsed MIDI file and return a SongKeyboardNotes structure.
 * Detects piano tracks by name, GM program change, or fallback.
 * Mirrors the keys section of RockBandConverter.cs with hand splitting and CC64 sustain added.
 */
export interface PianoConversionResult {
    keyboardNotes: SongKeyboardNotes;
    usedHandFallback: boolean; // true when any track had no explicit left/right name
}

export function convertPianoMidi(
    tracks: TMidiEvent[][],
    tempoMap: TempoChange[],
    division: number,
    midiTimeOffset: number,
): PianoConversionResult {
    const pianoTracks = detectPianoTracks(tracks);
    const usedHandFallback = pianoTracks.some((t) => t.hand === null);
    const notes: SongKeyboardNote[] = [];

    for (const { track, hand } of pianoTracks) {
        const sustainActive: boolean[] = new Array(16).fill(false) as boolean[];
        const pending = new Map<number, PendingNote>();
        let absoluteTick = 0;

        for (const event of track) {
            absoluteTick += (event as { delta: number }).delta;

            if ('controlChange' in event) {
                const e = event as IMidiControlChangeEvent;
                if (e.controlChange.type === 64) {
                    sustainActive[e.channel] = e.controlChange.value >= 64;
                }
            } else if ('noteOn' in event) {
                const e = event as IMidiNoteOnEvent;
                if (e.noteOn.velocity > 0) {
                    const key = e.channel * 128 + e.noteOn.noteNumber;
                    pending.set(key, {
                        startTick: absoluteTick,
                        velocity: e.noteOn.velocity,
                        sustainActive: sustainActive[e.channel],
                    });
                } else {
                    // velocity=0 treated as noteOff (mirrors MidiFile.cs lines 120-126)
                    endNote(e.channel, e.noteOn.noteNumber, absoluteTick, pending, tempoMap, division, midiTimeOffset, hand, notes);
                }
            } else if ('noteOff' in event) {
                const e = event as IMidiNoteOffEvent;
                endNote(e.channel, e.noteOff.noteNumber, absoluteTick, pending, tempoMap, division, midiTimeOffset, hand, notes);
            }
        }
    }

    notes.sort((a, b) => a.TimeOffset - b.TimeOffset);

    return {
        keyboardNotes: { Sections: [], Notes: notes },
        usedHandFallback,
    };
}
