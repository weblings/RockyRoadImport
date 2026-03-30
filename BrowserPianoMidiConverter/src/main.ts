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
import { convertPianoMidi } from './pianoConverter';
import type { SongInfo, SongStructure, SongKeyboardNotes } from './songformat';

const app = document.getElementById('app')!;
app.innerHTML = `
    <h2>Piano MIDI Converter</h2>
    <input type="file" id="midi-input" accept=".mid,.midi" />

    <div id="metadata-form" style="display:none; margin-top:16px;">
        <h3 style="margin:0 0 8px 0;">Song Metadata</h3>
        <table style="border-spacing:4px 6px;">
            <tr><td>Song Name</td><td><input type="text" id="meta-song-name" size="40" /></td></tr>
            <tr><td>Artist</td><td><input type="text" id="meta-artist" size="40" /></td></tr>
            <tr><td>Album</td><td><input type="text" id="meta-album" size="40" /></td></tr>
            <tr><td>MIDI Delay (ms)</td><td><input type="number" id="meta-delay" value="0" style="width:80px;" /></td></tr>
            <tr>
                <td>Difficulty (0–5)</td>
                <td>
                    <input type="range" id="meta-difficulty" min="0" max="5" step="0.5" value="0" />
                    <span id="meta-difficulty-value">0</span>
                </td>
            </tr>
        </table>
    </div>

    <br>
    <div id="hand-disclaimer" style="display:none; color:#b45309; font-size:13px;">
        <strong>⚠ Hand Fallback Used</strong>
        <ul>
            <li><strong>No "Left Hand" / "Right Hand" track names detected</strong> — rename MIDI tracks to include these for accurate results.</li>
            <li><strong>Hand assigned by pitch</strong> — below middle C (MIDI 60) → left, above → right. May be wrong where hands cross.</li>
        </ul>
    </div>
    <button id="download-song" disabled>Download song.json</button>
    <button id="download-arrangement" disabled>Download arrangement.json</button>
    <button id="download-keys" disabled>Download keys.json</button>
    <pre id="output" style="font-size:12px; max-height:80vh; overflow:auto;"></pre>
`;

const input          = document.getElementById('midi-input')          as HTMLInputElement;
const output         = document.getElementById('output')              as HTMLPreElement;
const metadataForm   = document.getElementById('metadata-form')       as HTMLElement;
const handDisclaimer = document.getElementById('hand-disclaimer')     as HTMLElement;
const songNameInput  = document.getElementById('meta-song-name')      as HTMLInputElement;
const artistInput    = document.getElementById('meta-artist')         as HTMLInputElement;
const albumInput     = document.getElementById('meta-album')          as HTMLInputElement;
const delayInput     = document.getElementById('meta-delay')          as HTMLInputElement;
const difficultyInput  = document.getElementById('meta-difficulty')   as HTMLInputElement;
const difficultyLabel  = document.getElementById('meta-difficulty-value') as HTMLSpanElement;
const downloadSongBtn  = document.getElementById('download-song')     as HTMLButtonElement;
const downloadBtn      = document.getElementById('download-arrangement') as HTMLButtonElement;
const downloadKeysBtn  = document.getElementById('download-keys')     as HTMLButtonElement;

difficultyInput.addEventListener('input', () => {
    difficultyLabel.textContent = difficultyInput.value;
});

let _structure: SongStructure | null = null;
let _keyboardNotes: SongKeyboardNotes | null = null;

input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;
    file.arrayBuffer()
        .then((buffer) => parseArrayBuffer(buffer))
        .then((midi: IMidiFile) => {
            const tempoMap = buildTempoMap(midi.tracks);
            _structure = buildSongStructure(midi.tracks, tempoMap, midi.division);
            const result = convertPianoMidi(midi.tracks, tempoMap, midi.division, 0);
            _keyboardNotes = result.keyboardNotes;

            const meta = extractMetadata(midi.tracks);
            songNameInput.value = meta.songName;
            artistInput.value   = meta.artist;
            albumInput.value    = '';
            delayInput.value    = '0';
            difficultyInput.value = '0';
            difficultyLabel.textContent = '0';
            metadataForm.style.display = 'block';

            handDisclaimer.style.display = result.usedHandFallback ? 'block' : 'none';
            logMidi(file.name, midi, tempoMap, result.keyboardNotes.Notes.length);
            downloadSongBtn.disabled = false;
            downloadBtn.disabled = false;
            downloadKeysBtn.disabled = false;
        });
});

downloadSongBtn.addEventListener('click', () => {
    if (!_keyboardNotes) return;

    const songLengthSeconds = _keyboardNotes.Notes.reduce(
        (max, n) => Math.max(max, n.TimeOffset + n.TimeLength),
        0,
    );

    const difficulty = parseFloat(difficultyInput.value);

    const songInfo: SongInfo = {
        SongName: songNameInput.value.trim() || 'Unknown',
        ArtistName: artistInput.value.trim() || 'Unknown',
        SongLengthSeconds: songLengthSeconds,
        InstrumentParts: [{
            InstrumentName: 'keys',
            InstrumentType: 'Keys',
            ...(difficulty > 0 ? { SongDifficulty: difficulty } : {}),
        }],
    };

    const album = albumInput.value.trim();
    if (album) songInfo.AlbumName = album;

    downloadJson('song.json', songInfo);
});

downloadBtn.addEventListener('click', () => {
    if (_structure) downloadJson('arrangement.json', _structure);
});

downloadKeysBtn.addEventListener('click', () => {
    if (_keyboardNotes) downloadJson('keys.json', _keyboardNotes);
});

function extractMetadata(tracks: TMidiEvent[][]): { songName: string; artist: string } {
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

function logMidi(filename: string, midi: IMidiFile, tempoMap: TempoChange[], noteCount: number): void {
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
