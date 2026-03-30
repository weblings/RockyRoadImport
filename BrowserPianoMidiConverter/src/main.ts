import { parseArrayBuffer } from 'midi-json-parser';
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
import { buildTempoMap, buildSongStructure, type TempoChange } from './tempoMap';
import type { SongStructure } from './songformat';

const app = document.getElementById('app')!;
app.innerHTML = `
    <h2>Piano MIDI Converter</h2>
    <input type="file" id="midi-input" accept=".mid,.midi" />
    <br><br>
    <button id="download-arrangement" disabled>Download arrangement.json</button>
    <pre id="output" style="font-size:12px; max-height:80vh; overflow:auto;"></pre>
`;

const input = document.getElementById('midi-input') as HTMLInputElement;
const output = document.getElementById('output') as HTMLPreElement;
const downloadBtn = document.getElementById('download-arrangement') as HTMLButtonElement;

let _structure: SongStructure | null = null;

input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;
    file.arrayBuffer()
        .then((buffer) => parseArrayBuffer(buffer))
        .then((midi: IMidiFile) => {
            const tempoMap = buildTempoMap(midi.tracks);
            _structure = buildSongStructure(midi.tracks, tempoMap, midi.division);
            logMidi(file.name, midi, tempoMap);
            downloadBtn.disabled = false;
        });
});

downloadBtn.addEventListener('click', () => {
    if (_structure) downloadJson('arrangement.json', _structure);
});

function downloadJson(filename: string, data: unknown): void {
    const json = JSON.stringify(data, (_key, value) => {
        if (value === null) return undefined;
        if (Array.isArray(value) && value.length === 0) return undefined;
        return value as unknown;
    }, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function logMidi(filename: string, midi: IMidiFile, tempoMap: TempoChange[]): void {
    const lines: string[] = [];

    lines.push(`File: ${filename}`);
    lines.push(`Format: ${midi.format}  |  Division: ${midi.division} ticks/quarter  |  Tracks: ${midi.tracks.length}`);
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
    output.textContent = text;
    console.log(text);
}

function getTrackName(track: TMidiEvent[]): string | null {
    for (const event of track) {
        if ('trackName' in event) {
            return (event as IMidiTrackNameEvent).trackName;
        }
    }
    return null;
}
