import * as alphaTab from '@coderline/alphatab';
import { ticksToSeconds, type TempoChange } from './tempoMap';
import type {
    SongInstrumentPart,
    SongInstrumentNotes,
    SongNote,
    SongChord,
    SongSection,
    SongBeat,
    SongStructure,
    CentsOffset,
} from './songformat';

// Guitar Pro (.gp3/.gp4/.gp5) → OpenSongChart conversion. alphaTab does the parsing; this file
// maps its Score/Track/Bar/Beat/Note model onto the same shape the psarc (Rocksmith) path
// produces, reusing tempoMap.ts's tick math for timing.

export interface GpTrackResult {
    trackName: string;
    part: SongInstrumentPart;
    notes: SongInstrumentNotes;
}

export interface GpConvertResult {
    songName: string;
    artistName: string;
    tracks: GpTrackResult[];
    skipped: string[]; // track names skipped (not a fretted instrument, e.g. drums)
    structure: SongStructure; // shared across all tracks - RockyRoad requires arrangement.json
}

// ESongNoteTechnique bit flags - mirrors Dependencies/OpenSongChart/SongFormat/SongFormat.cs.
// Kept as plain numbers (not a TS enum) since the only thing written out is the comma-joined
// flag-name string psarc's Techniques field already uses.
const Technique = {
    HammerOn: 1 << 1,
    PullOff: 1 << 2,
    Accent: 1 << 3,
    PalmMute: 1 << 4,
    FretHandMute: 1 << 5,
    Slide: 1 << 6,
    Bend: 1 << 7,
    Tremolo: 1 << 8,
    Vibrato: 1 << 9,
    Harmonic: 1 << 10,
    PinchHarmonic: 1 << 11,
    Tap: 1 << 12,
    Slap: 1 << 13,
    Pop: 1 << 14,
    Chord: 1 << 15,
    ChordNote: 1 << 16,
    Continued: 1 << 17,
    Arpeggio: 1 << 18,
} as const;
const TECHNIQUE_NAMES = Object.keys(Technique) as (keyof typeof Technique)[];

function techniquesToString(flags: number): string | undefined {
    if (flags === 0) return undefined;
    return TECHNIQUE_NAMES.filter((name) => (flags & Technique[name]) !== 0).join(', ');
}

// Standard tuning per string count, lowest string first, absolute MIDI pitch. OpenSongChart's
// StringSemitoneOffsets is an *offset from standard*, not an absolute pitch - every track's
// tuning is diffed against whichever of these matches its string count.
const STANDARD_TUNING: Record<number, number[]> = {
    4: [28, 33, 38, 43],           // bass: E1 A1 D2 G2
    5: [23, 28, 33, 38, 43],       // 5-string bass: B0 E1 A1 D2 G2
    6: [40, 45, 50, 55, 59, 64],   // guitar: E2 A2 D3 G3 B3 E4
    7: [35, 40, 45, 50, 55, 59, 64], // 7-string guitar: B1 E2 A2 D3 G3 B3 E4
};

function isBassRange(tuning: number[]): boolean {
    // Bass strings sit roughly an octave below guitar strings - compare the lowest string
    // against the boundary between the two STANDARD_TUNING tables above.
    return tuning[0] < 35;
}

interface Role {
    instrumentName: string; // slug used for both InstrumentName and the output filename
    instrumentType: string;
}

// Name keywords take priority (mirrors pianoConverter.ts's detectPianoTracks); with no hints,
// the first kept track is assumed Lead (per Andrew's call), later ones Rhythm. nameCounts
// de-dupes repeated roles ("rhythm", "rhythm2", ...) across the whole song.
function determineRole(track: alphaTab.model.Track, tuning: number[], nameCounts: Map<string, number>, isFirstKept: boolean): Role {
    const name = (track.name || '').toLowerCase();
    let base: string;
    let instrumentType: string;

    if (isBassRange(tuning) || name.includes('bass')) {
        base = 'bass'; instrumentType = 'BassGuitar';
    } else if (name.includes('lead') || name.includes('solo')) {
        base = 'lead'; instrumentType = 'LeadGuitar';
    } else if (name.includes('rhythm') || name.includes('chord') || name.includes('comp')) {
        base = 'rhythm'; instrumentType = 'RhythmGuitar';
    } else if (isFirstKept) {
        base = 'lead'; instrumentType = 'LeadGuitar';
    } else {
        base = 'rhythm'; instrumentType = 'RhythmGuitar';
    }

    const count = nameCounts.get(base) ?? 0;
    nameCounts.set(base, count + 1);
    return { instrumentName: count === 0 ? base : `${base}${count + 1}`, instrumentType };
}

function buildTuningOffsets(tuning: number[]): number[] {
    const standard = STANDARD_TUNING[tuning.length];
    if (!standard) {
        // Unusual string count (e.g. a 8-string or a re-entrant ukulele-style tuning) - fall
        // back to treating the actual tuning as if it were already standard (all-zero offsets)
        // rather than guessing a reference to diff against.
        return tuning.map(() => 0);
    }
    return tuning.map((pitch, i) => pitch - standard[i]);
}

// alphaTab doesn't expose its ticks-per-quarter constant directly - generating a MidiFile is the
// reliable way to get it, plus tempo events already resolved to absolute ticks.
function buildTempoMap(score: alphaTab.model.Score): { tempoMap: TempoChange[]; division: number } {
    const midiFile = new alphaTab.midi.MidiFile();
    const handler = new alphaTab.midi.AlphaSynthMidiFileHandler(midiFile);
    new alphaTab.midi.MidiFileGenerator(score, null, handler).generate();

    const tempoMap: TempoChange[] = [];
    for (const event of midiFile.events) {
        if (event instanceof alphaTab.midi.TempoChangeEvent) {
            tempoMap.push({ tick: event.tick, microsecondsPerQuarter: event.microSecondsPerQuarterNote });
        }
    }
    tempoMap.sort((a, b) => a.tick - b.tick);
    if (tempoMap.length === 0 || tempoMap[0].tick > 0) {
        tempoMap.unshift({ tick: 0, microsecondsPerQuarter: 500_000 }); // default 120 BPM
    }

    return { tempoMap, division: midiFile.division };
}

// Shared across every track (RockyRoad's ActiveSceneScreen.ts requires this file to exist) -
// built from whichever staff has bars, since bar/beat timing is the same for every track in a
// score. Mirrors tempoMap.ts's buildSongStructure, but bar starts come from a real Beat's
// absolutePlaybackStart rather than a running total, so mid-song time-signature changes still
// line up correctly.
function buildStructure(score: alphaTab.model.Score, tempoMap: TempoChange[], division: number): SongStructure {
    const staff = score.tracks.map((t) => t.staves[0]).find((s) => s && s.bars.length > 0);
    if (!staff) return { Sections: [], Beats: [] };

    const sections: SongSection[] = [];
    const beats: SongBeat[] = [];

    for (const bar of staff.bars) {
        const firstBeat = bar.voices[0]?.beats[0];
        if (!firstBeat) continue;
        const barStart = firstBeat.absolutePlaybackStart;
        const masterBar = bar.masterBar;

        if (masterBar.section) {
            sections.push({
                Name: masterBar.section.text || masterBar.section.marker,
                StartTime: ticksToSeconds(barStart, tempoMap, division),
            });
        }

        const ticksPerBeat = Math.round((division * 4) / masterBar.timeSignatureDenominator);
        for (let i = 0; i < masterBar.timeSignatureNumerator; i++) {
            beats.push({
                TimeOffset: ticksToSeconds(barStart + i * ticksPerBeat, tempoMap, division),
                IsMeasure: i === 0,
            });
        }
    }

    return { Sections: sections, Beats: beats };
}

export function convertGuitarPro(bytes: Uint8Array): GpConvertResult {
    return convertScore(alphaTab.importer.ScoreLoader.loadScoreFromBytes(bytes));
}

// Split out from convertGuitarPro so tests can build a Score via alphaTab's alphaTex importer
// (ScoreLoader.loadAlphaTex) instead of needing binary .gp3/.gp4/.gp5 fixture files.
export function convertScore(score: alphaTab.model.Score): GpConvertResult {
    const { tempoMap, division } = buildTempoMap(score);

    const tracks: GpTrackResult[] = [];
    const skipped: string[] = [];
    const nameCounts = new Map<string, number>();

    for (const track of score.tracks) {
        const staff = track.staves[0];
        const trackName = track.name || `Track ${track.index + 1}`;
        if (!staff || track.isPercussion || staff.isPercussion || !staff.isStringed) {
            skipped.push(trackName);
            continue;
        }
        const tuning = [...staff.tuning].reverse();
        const role = determineRole(track, tuning, nameCounts, tracks.length === 0);
        tracks.push(convertTrack(staff, trackName, tuning, role, tempoMap, division));
    }

    return {
        songName: score.title || '',
        artistName: score.artist || '',
        tracks,
        skipped,
        structure: buildStructure(score, tempoMap, division),
    };
}

function convertTrack(
    staff: alphaTab.model.Staff,
    trackName: string,
    tuning: number[],
    role: Role,
    tempoMap: TempoChange[],
    division: number,
): GpTrackResult {
    const sections: SongSection[] = [];
    const notes: SongNote[] = [];
    const chords: SongChord[] = [];
    const chordIdByKey = new Map<string, number>(); // alphaTab chord uniqueId -> our ChordID index

    for (const bar of staff.bars) {
        const masterBar = bar.masterBar;
        if (masterBar.section) {
            const firstBeat = bar.voices[0]?.beats[0];
            if (firstBeat) {
                sections.push({
                    Name: masterBar.section.text || masterBar.section.marker,
                    StartTime: ticksToSeconds(firstBeat.absolutePlaybackStart, tempoMap, division),
                });
            }
        }

        for (const voice of bar.voices) {
            for (const beat of voice.beats) {
                if (beat.isRest || beat.notes.length === 0) continue;

                const startTime = ticksToSeconds(beat.absolutePlaybackStart, tempoMap, division);
                const endTime = ticksToSeconds(beat.absolutePlaybackStart + beat.playbackDuration, tempoMap, division);

                let chordId: number | undefined;
                if (beat.chordId && staff.hasChord(beat.chordId)) {
                    const chord = staff.getChord(beat.chordId)!;
                    const key = chord.uniqueId;
                    if (!chordIdByKey.has(key)) {
                        chordIdByKey.set(key, chords.length);
                        chords.push({
                            Name: chord.name,
                            Frets: chord.strings,
                            // alphaTab doesn't expose per-string fingering on Chord - left as
                            // zeros (unknown) rather than guessed.
                            Fingers: chord.strings.map(() => 0),
                        });
                    }
                    chordId = chordIdByKey.get(key)!;
                }

                const isChordBeat = beat.notes.length > 1;
                for (const note of beat.notes) {
                    notes.push(buildNote(note, beat, startTime, endTime, chordId, isChordBeat));
                }
            }
        }
    }

    return {
        trackName,
        part: {
            InstrumentName: role.instrumentName,
            InstrumentType: role.instrumentType,
            Tuning: { StringSemitoneOffsets: buildTuningOffsets(tuning) },
            CapoFret: staff.capo || undefined,
        },
        notes: { Sections: sections, Chords: chords, Notes: notes },
    };
}

function buildNote(
    note: alphaTab.model.Note,
    beat: alphaTab.model.Beat,
    startTime: number,
    endTime: number,
    chordId: number | undefined,
    isChordBeat: boolean,
): SongNote {
    let flags = 0;
    // Flag lands on the destination note (matches Rocksmith's own NoteMask convention) - the
    // note actually played via hammer-on/pull-off rather than picked.
    if (note.isHammerPullDestination) flags |= note.fret > (note.hammerPullOrigin?.fret ?? note.fret) ? Technique.HammerOn : Technique.PullOff;
    if (note.accentuated !== alphaTab.model.AccentuationType.None) flags |= Technique.Accent;
    if (note.isPalmMute || beat.isPalmMute) flags |= Technique.PalmMute;
    if (note.isDead) flags |= Technique.FretHandMute;
    if (note.slideInType !== alphaTab.model.SlideInType.None || note.slideOutType !== alphaTab.model.SlideOutType.None) flags |= Technique.Slide;
    if (note.hasBend) flags |= Technique.Bend;
    if (beat.vibrato !== alphaTab.model.VibratoType.None || note.vibrato !== alphaTab.model.VibratoType.None) flags |= Technique.Vibrato;
    if (note.isHarmonic) flags |= note.harmonicType === alphaTab.model.HarmonicType.Pinch ? Technique.PinchHarmonic : Technique.Harmonic;
    if (beat.tap) flags |= Technique.Tap;
    if (beat.slap) flags |= Technique.Slap;
    if (beat.pop) flags |= Technique.Pop;
    if (note.isTieDestination) flags |= Technique.Continued;
    if (isChordBeat) flags |= note.index === 0 ? Technique.Chord : Technique.ChordNote;

    const songNote: SongNote = {
        TimeOffset: startTime,
        TimeLength: endTime - startTime,
        EndTime: endTime,
        Fret: note.fret,
        String: note.string - 1, // alphaTab is 1-indexed (1 = lowest); this schema is 0-indexed
        Techniques: techniquesToString(flags),
        ChordID: chordId,
        FingerID: note.leftHandFinger !== alphaTab.model.Fingers.Unknown ? note.leftHandFinger : undefined,
    };

    if (note.slideOutType === alphaTab.model.SlideOutType.Shift || note.slideOutType === alphaTab.model.SlideOutType.Legato) {
        if (note.slideTarget) songNote.SlideFret = note.slideTarget.fret;
    }

    if (note.hasBend && note.bendPoints) {
        // BendPoint.offset is 0-60 across the note's duration; .value's unit (best-effort,
        // unverified against alphaTab's own source - flag for review once a real bend-containing
        // .gp5 file is converted) is treated as quarter-semitones, i.e. 25 cents per unit.
        const duration = endTime - startTime;
        songNote.CentsOffsets = note.bendPoints.map((bp): CentsOffset => ({
            TimeOffset: startTime + (bp.offset / 60) * duration,
            Cents: bp.value * 25,
        }));
    }

    return songNote;
}
