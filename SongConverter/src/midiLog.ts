import type {
    IMidiFile,
    IMidiSetTempoEvent,
    IMidiTrackNameEvent,
    IMidiTextEvent,
    IMidiNoteOnEvent,
    IMidiNoteOffEvent,
    IMidiControlChangeEvent,
    IMidiProgramChangeEvent,
    TMidiEvent,
} from 'midi-json-parser-worker';
import type { TempoChange } from './tempoMap';

export function extractMetadata(tracks: TMidiEvent[][]): { songName: string; artist: string } {
    const candidates: string[] = [];

    for (const track of tracks) {
        for (const event of track) {
            if ('trackName' in event) {
                const v = (event as IMidiTrackNameEvent).trackName.trim();
                if (v) candidates.push(v);
            } else if ('text' in event) {
                const v = (event as IMidiTextEvent).text.trim();
                if (v) candidates.push(v);
            }
            if (candidates.length >= 2) break;
        }
        if (candidates.length >= 2) break;
    }

    return { songName: candidates[0] ?? '', artist: candidates[1] ?? '' };
}

export function logMidi(filename: string, midi: IMidiFile, tempoMap: TempoChange[], noteCount: number): string {
    const lines: string[] = [];

    lines.push(`File: ${filename}`);
    lines.push(`Format: ${midi.format}  |  Division: ${midi.division} ticks/quarter  |  Tracks: ${midi.tracks.length}  |  Piano notes extracted: ${noteCount}`);
    lines.push('');

    // Tempo map summary
    lines.push('── Tempo map');
    for (const entry of tempoMap) {
        const bpm = Math.round(60_000_000 / entry.microsecondsPerQuarter);
        lines.push(`   tick=${entry.tick}  ${entry.microsecondsPerQuarter} µs/quarter (${bpm} BPM)`);
    }
    lines.push('');

    midi.tracks.forEach((track, trackIndex) => {
        const trackName = getTrackName(track);
        lines.push(`── Track ${trackIndex}${trackName ? `: "${trackName}"` : ''} (${track.length} events)`);

        let tempoCount = 0;
        let noteOnCount = 0;
        let noteOffCount = 0;
        let cc64Count = 0;
        let programChanges: number[] = [];
        const textEvents: string[] = [];

        for (const event of track) {
            if ('setTempo' in event) {
                const e = event as IMidiSetTempoEvent;
                const bpm = Math.round(60_000_000 / e.setTempo.microsecondsPerQuarter);
                lines.push(`   setTempo     δ=${e.delta}  ${e.setTempo.microsecondsPerQuarter} µs/quarter (${bpm} BPM)`);
                tempoCount++;
            } else if ('trackName' in event) {
                const e = event as IMidiTrackNameEvent;
                lines.push(`   trackName    δ=${e.delta}  "${e.trackName}"`);
            } else if ('text' in event) {
                const e = event as IMidiTextEvent;
                textEvents.push(e.text);
            } else if ('noteOn' in event) {
                // NOTE: The C# MidiFile.cs (line 120-126) treats noteOn velocity=0 as a noteOff.
                // midi-json-parser normalizes these — verify by checking if noteOff count matches noteOn count.
                const e = event as IMidiNoteOnEvent;
                if (noteOnCount < 5) {
                    lines.push(`   noteOn       δ=${e.delta}  ch=${e.channel}  note=${e.noteOn.noteNumber}  vel=${e.noteOn.velocity}`);
                } else if (noteOnCount === 5) {
                    lines.push(`   noteOn       ... (showing first 5 only)`);
                }
                noteOnCount++;
            } else if ('noteOff' in event) {
                // The C# MidiFile.cs (line 128-131) handles NoteOff as a distinct command.
                // Confirmed: library surfaces these separately from noteOn velocity=0.
                const e = event as IMidiNoteOffEvent;
                if (noteOffCount < 5) {
                    lines.push(`   noteOff      δ=${e.delta}  ch=${e.channel}  note=${e.noteOff.noteNumber}  vel=${e.noteOff.velocity}`);
                } else if (noteOffCount === 5) {
                    lines.push(`   noteOff      ... (showing first 5 only)`);
                }
                noteOffCount++;
            } else if ('controlChange' in event) {
                const e = event as IMidiControlChangeEvent;
                if (e.controlChange.type === 64) {
                    lines.push(`   CC64 sustain δ=${e.delta}  ch=${e.channel}  val=${e.controlChange.value}`);
                    cc64Count++;
                }
            } else if ('programChange' in event) {
                // GM patch: 0-7 = acoustic/electric piano family — used for track detection in Phase 4
                const e = event as IMidiProgramChangeEvent;
                programChanges.push(e.programChange.programNumber);
                lines.push(`   programChange δ=${e.delta}  ch=${e.channel}  program=${e.programChange.programNumber}${e.programChange.programNumber <= 7 ? ' (piano family)' : ''}`);
            }
        }

        if (textEvents.length > 0) {
            lines.push(`   text events: ${textEvents.map((t) => `"${t}"`).join(', ')}`);
        }

        lines.push(`   Summary: ${tempoCount} tempo | ${noteOnCount} noteOn | ${noteOffCount} noteOff | ${cc64Count} CC64 sustain | programs: [${programChanges.join(', ')}]`);

        // Warn if noteOn/noteOff counts don't match — indicates unpaired notes that will affect Phase 4 duration calculation
        if (noteOnCount > 0 && noteOnCount !== noteOffCount) {
            lines.push(`   ⚠ noteOn/noteOff mismatch (${noteOnCount} on, ${noteOffCount} off) — pairing will rely on noteOn vel=0 normalization`);
        }

        lines.push('');
    });

    const text = lines.join('\n');
    return text;
}

function getTrackName(track: TMidiEvent[]): string | null {
    for (const event of track) {
        if ('trackName' in event) {
            return (event as IMidiTrackNameEvent).trackName;
        }
    }
    return null;
}
