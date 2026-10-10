import { describe, it, expect } from 'vitest';
import * as alphaTab from '@coderline/alphatab';
import pianoFixtureXml from './fixtures/piano-grand-staff.musicxml?raw';
import leakFixtureXml from './fixtures/piano-dynamics-cross-staff.musicxml?raw';
import repeatFixtureXml from './fixtures/piano-repeat-volta.musicxml?raw';
import { buildPlaybackOrder, convertMusicXml } from './scoreConverter';
import { handForScoreNote, pitchFallbackHand } from './hands';

// Hand-authored MusicXML (a few notes, not real songs): single-staff 'Piano'
// parts (name keyword, no <midi-instrument>) exercising ngd.3's clef, voice,
// tie-merge, and rest paths through the ScoreLoader entry.
function pianoPart(inner: string, clef = '<sign>G</sign><line>2</line>'): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef>${clef}</clef>
      </attributes>
      ${inner}
    </measure>
  </part>
</score-partwise>
`;
}

function pitched(step: string, octave: number, tie: 'start' | 'stop' | null = null): string {
    const tieXml = tie === null
        ? ''
        : `<tie type="${tie}"/><notations><tied type="${tie}"/></notations>`;
    return `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>4</duration><type>quarter</type>${tieXml}</note>`;
}

// A <direction> dynamics mark or hairpin wedge between notes. The dynamics
// tag is the lowercase MusicXML name (p, f, fp, sfz, ...).
function dynamicMark(mark: string): string {
    return `<direction><direction-type><dynamics><${mark}/></dynamics></direction-type></direction>`;
}

function wedge(type: 'crescendo' | 'diminuendo' | 'stop'): string {
    return `<direction><direction-type><wedge type="${type}"/></direction-type></direction>`;
}

const encode = (s: string) => new TextEncoder().encode(s);

// Hand-authored grand staff (G+F clefs, 2 staves) for ngd.5: pedal marks sit
// on the bass staff only, like real exports. Quarter notes on both staves
// keep both hands sounding through every pedal window.
function pedalPart(m1: string, m2 = ''): string {
    const measure = (n: number, inner: string) => `<measure number="${n}">${inner}</measure>`;
    return `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <staves>2</staves>
        <clef number="1"><sign>G</sign><line>2</line></clef>
        <clef number="2"><sign>F</sign><line>4</line></clef>
      </attributes>
      ${m1}
    </measure>
    ${m2 ? measure(2, m2) : ''}
  </part>
</score-partwise>
`;
}

function staffNote(step: string, octave: number, staff: 1 | 2): string {
    return `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>4</duration><type>quarter</type><staff>${staff}</staff></note>`;
}

function pedalMark(type: 'start' | 'stop' | 'change'): string {
    return `<direction><direction-type><pedal type="${type}"/></direction-type><staff>2</staff></direction>`;
}

function sustainFlags(xml: string): { Note: number; Hand?: string; Sustain: boolean; Time: number }[] {
    const [piano] = convertMusicXml(encode(xml)).pianoTracks;
    return piano.notes.map((n) => ({ Note: n.Note, Hand: n.Hand, Sustain: n.SustainActive ?? false, Time: n.TimeOffset }));
}

describe('piano note mapping', () => {
    it('maps the grand-staff fixture by staff (treble right, bass left)', () => {
        const [piano] = convertMusicXml(encode(pianoFixtureXml)).pianoTracks;
        expect(piano.usedHandFallback).toBe(false);
        // Stable time sort interleaves the staves sharing one timeline.
        expect(piano.notes.map((n) => n.Note)).toEqual([60, 48, 62, 50, 64, 52, 65, 53]);
        expect(piano.notes.map((n) => n.Hand)).toEqual(
            ['right', 'left', 'right', 'left', 'right', 'left', 'right', 'left'],
        );
        for (const n of piano.notes) {
            expect(n.EndTime).toBe(n.TimeOffset + n.TimeLength);
            // No dynamics marks; the importer default F maps to 95.
            expect(n.Velocity).toBe(95);
        }
    });

    it('maps <direction> dynamics to velocity (p persists, f replaces)', () => {
        const xml = pianoPart(
            `${dynamicMark('p')}${pitched('C', 4)}${pitched('D', 4)}${dynamicMark('f')}${pitched('E', 4)}`,
        );
        const [piano] = convertMusicXml(encode(xml)).pianoTracks;
        expect(piano.notes.map((n) => n.Velocity)).toEqual([47, 47, 95]);
    });

    it('covers accent-type dynamics (fp, sfz)', () => {
        const xml = pianoPart(
            `${dynamicMark('fp')}${pitched('C', 4)}${dynamicMark('sfz')}${pitched('D', 4)}`,
        );
        const [piano] = convertMusicXml(encode(xml)).pianoTracks;
        expect(piano.notes.map((n) => n.Velocity)).toEqual([95, 111]);
    });

    it('ignores hairpins (beat.crescendo carries no target level)', () => {
        const xml = pianoPart(
            `${dynamicMark('p')}${wedge('crescendo')}${pitched('C', 4)}${pitched('D', 4)}` +
            `${wedge('stop')}${dynamicMark('f')}${pitched('E', 4)}`,
        );
        const [piano] = convertMusicXml(encode(xml)).pianoTracks;
        expect(piano.notes.map((n) => n.Velocity)).toEqual([47, 47, 95]);
    });

    it('keeps per-staff dynamics timelines apart (cross-staff leak)', () => {
        // Treble p must not reach the m.1 bass note; bass ff must not reach
        // the m.2 treble note. Fails while alphaTab's part-wide
        // _currentDynamics leaks across the <backup> interleave.
        const [piano] = convertMusicXml(encode(leakFixtureXml)).pianoTracks;
        expect(piano.notes.filter((n) => n.Hand === 'right').map((n) => n.Velocity)).toEqual([95, 47, 47]);
        expect(piano.notes.filter((n) => n.Hand === 'left').map((n) => n.Velocity)).toEqual([95, 111, 111]);
    });

    it('lets an unmarked staff borrow the other staff\'s marks, never a later one', () => {
        // Treble-only marks (common: one mark between the staves): pp at beat 1, f at beat 3.
        // Bass has none, so it follows the treble from each mark's time on - beat 1-2 pp, 3-4 f.
        const mark = (m: string) =>
            `<direction><direction-type><dynamics><${m}/></dynamics></direction-type><staff>1</staff></direction>`;
        const xml = pedalPart(
            mark('pp') + staffNote('C', 5, 1) + staffNote('D', 5, 1) + mark('f') + staffNote('E', 5, 1) + staffNote('F', 5, 1)
            + '<backup><duration>16</duration></backup>'
            + staffNote('C', 3, 2) + staffNote('D', 3, 2) + staffNote('E', 3, 2) + staffNote('F', 3, 2),
        );
        const [piano] = convertMusicXml(encode(xml)).pianoTracks;
        expect(piano.notes.filter((n) => n.Hand === 'right').map((n) => n.Velocity)).toEqual([31, 31, 95, 95]);
        expect(piano.notes.filter((n) => n.Hand === 'left').map((n) => n.Velocity)).toEqual([31, 31, 95, 95]);
    });

    it('keeps a staff on its own marks once it has one', () => {
        // Bass marks p at beat 2; the later treble ff must not override it.
        const mark = (m: string, staff: 1 | 2) =>
            `<direction><direction-type><dynamics><${m}/></dynamics></direction-type><staff>${staff}</staff></direction>`;
        const xml = pedalPart(
            staffNote('C', 5, 1) + staffNote('D', 5, 1) + mark('ff', 1) + staffNote('E', 5, 1) + staffNote('F', 5, 1)
            + '<backup><duration>16</duration></backup>'
            + staffNote('C', 3, 2) + mark('p', 2) + staffNote('D', 3, 2) + staffNote('E', 3, 2) + staffNote('F', 3, 2),
        );
        const [piano] = convertMusicXml(encode(xml)).pianoTracks;
        expect(piano.notes.filter((n) => n.Hand === 'left').map((n) => n.Velocity)).toEqual([95, 47, 47, 47]);
        expect(piano.notes.filter((n) => n.Hand === 'right').map((n) => n.Velocity)).toEqual([95, 47, 111, 111]);
    });

    it('merges tie chains, skips rests, and lets clef beat pitch', () => {
        const xml = pianoPart(
            `${pitched('A', 2, 'start')}${pitched('A', 2, 'stop')}` +
            '<note><rest/><duration>4</duration><type>quarter</type></note>' +
            pitched('C', 5),
        );
        const [piano] = convertMusicXml(encode(xml)).pianoTracks;
        expect(piano.usedHandFallback).toBe(true);
        expect(piano.notes).toHaveLength(2);
        const [tied, single] = piano.notes;
        // A2 (45) sits below middle C but the G clef assigns the right hand.
        expect(tied).toMatchObject({ Note: 45, Hand: 'right' });
        expect(tied.TimeLength).toBe(2 * single.TimeLength);
        expect(tied.EndTime).toBe(tied.TimeOffset + tied.TimeLength);
    });

    it('assigns a bass-clef single staff to the left hand', () => {
        const xml = pianoPart(pitched('C', 4), '<sign>F</sign><line>4</line>');
        const [piano] = convertMusicXml(encode(xml)).pianoTracks;
        // Pitch 60 alone would read right; the F clef says left.
        expect(piano.notes.map((n) => n.Hand)).toEqual(['left']);
    });

    it('splits same-pitch voices by voice index under a C clef', () => {
        const voice = (n: number) =>
            `<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type><voice>${n}</voice></note>`;
        const xml = pianoPart(
            `${voice(1)}<backup><duration>4</duration></backup>${voice(2)}`,
            '<sign>C</sign><line>3</line>',
        );
        const [piano] = convertMusicXml(encode(xml)).pianoTracks;
        expect(piano.notes.map((n) => n.Note)).toEqual([60, 60]);
        expect(piano.notes.map((n) => n.Hand)).toEqual(['right', 'left']);
    });
});

describe('piano repeats and endings', () => {
    // Five bars (intro, 2x repeat of bars 2-3, first/second endings) play as
    // seven: 1,2,3,4,2,3,5. Whole-note bars at 120 BPM start 2s apart.
    it('walks the repeat section and both endings in playback order', () => {
        const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(encode(repeatFixtureXml));
        expect(buildPlaybackOrder(score).map((o) => o.barIndex)).toEqual([0, 1, 2, 3, 1, 2, 4]);
    });

    it('expands repeated bars into re-timed notes (volta endings selected per pass)', () => {
        const result = convertMusicXml(encode(repeatFixtureXml));
        const [piano] = result.pianoTracks;
        const treble = piano.notes.filter((n) => n.Hand === 'right');
        const bass = piano.notes.filter((n) => n.Hand === 'left');
        expect(piano.notes).toHaveLength(14);
        expect(treble.map((n) => n.Note)).toEqual([64, 67, 69, 71, 67, 69, 72]);
        expect(bass.map((n) => n.Note)).toEqual([48, 50, 52, 53, 50, 52, 55]);
        for (const hand of [treble, bass]) {
            expect(hand.map((n) => n.TimeOffset)).toEqual([0, 2, 4, 6, 8, 10, 12]);
        }
        expect(result.structure.Beats).toHaveLength(28);
    });

    it('re-strikes a tie-stop on replay instead of stretching a stale same-pitch note', () => {
        // m.1 C4 tied into the repeat start; m.2 also re-strikes C4; m.3 D4. Order 1,2,3,2,3.
        const n = (step: string, dur: number, type: string, tie: 'start' | 'stop' | null = null) =>
            `<note><pitch><step>${step}</step><octave>4</octave></pitch><duration>${dur}</duration><type>${type}</type>`
            + (tie ? `<tie type="${tie}"/><notations><tied type="${tie}"/></notations>` : '') + '</note>';
        const xml = pianoPart(n('C', 16, 'whole', 'start')).replace('</part>',
            `<measure number="2"><barline location="left"><repeat direction="forward"/></barline>${n('C', 8, 'half', 'stop')}${n('C', 8, 'half')}</measure>`
            + `<measure number="3">${n('D', 16, 'whole')}<barline location="right"><repeat direction="backward"/></barline></measure></part>`);
        const [piano] = convertMusicXml(encode(xml)).pianoTracks;
        expect(piano.notes.map((x) => [x.Note, x.TimeOffset, x.EndTime])).toEqual([
            [60, 0, 3], [60, 3, 4], [62, 4, 6], [60, 6, 7], [60, 7, 8], [62, 8, 10],
        ]);
    });
});

describe('piano pedal to SustainActive', () => {
    // Bass-only marks apply part-wide: the treble notes sustain too.
    // m.1: down at 0, up mid-bar at 8; m.2: down at 0, change at 8, no stop.
    const xml = pedalPart(
        `${staffNote('C', 5, 1)}${staffNote('D', 5, 1)}${staffNote('E', 5, 1)}${staffNote('F', 5, 1)}` +
        '<backup><duration>16</duration></backup>' +
        `${pedalMark('start')}${staffNote('C', 3, 2)}${staffNote('D', 3, 2)}` +
        `${pedalMark('stop')}${staffNote('E', 3, 2)}${staffNote('F', 3, 2)}`,
        `${staffNote('G', 5, 1)}${staffNote('A', 5, 1)}${staffNote('B', 5, 1)}${staffNote('C', 6, 1)}` +
        '<backup><duration>16</duration></backup>' +
        `${pedalMark('start')}${staffNote('G', 2, 2)}${staffNote('A', 2, 2)}` +
        `${pedalMark('change')}${staffNote('B', 2, 2)}${staffNote('C', 3, 2)}`,
    );

    it('marks notes while the pedal is down on both hands', () => {
        // m.1 C5 (right) and C3 (left) at offset 0; C3 repeats in m.2, so
        // scope by time (quarters are 0.5s, each bar lasts 2s).
        const flags = sustainFlags(xml)
            .filter((n) => (n.Note === 72 || n.Note === 48) && n.Time < 2)
            .map(({ Note, Hand, Sustain }) => ({ Note, Hand, Sustain }));
        expect(flags).toEqual([
            { Note: 72, Hand: 'right', Sustain: true },
            { Note: 48, Hand: 'left', Sustain: true },
        ]);
    });

    it('clears notes after a mid-bar stop on both hands', () => {
        const flags = sustainFlags(xml)
            .filter((n) => n.Note === 77 || n.Note === 53)
            .map(({ Note, Hand, Sustain }) => ({ Note, Hand, Sustain }));
        // F5 (right) and F3 (left) sound at offset 12, after the stop at 8.
        expect(flags).toEqual([
            { Note: 77, Hand: 'right', Sustain: false },
            { Note: 53, Hand: 'left', Sustain: false },
        ]);
    });

    it('holds through change and an unpaired down to the part end', () => {
        const flags = sustainFlags(xml).filter((n) => n.Note >= 79 || (n.Note <= 50 && n.Note >= 43));
        // m.2 throughout (down at 0, change at 8, no stop) plus m.1's
        // pre-stop C3/D3 - ten sustained notes in all.
        expect(flags.every((n) => n.Sustain)).toBe(true);
        expect(flags).toHaveLength(10);
    });

    it('keeps a stop alone in a later bar (cross-bar span patch)', () => {
        // Fails while the importer drops a stop with no same-bar opener:
        // the m.1 span would stick down through m.2 instead of ending.
        const twoBar = pedalPart(
            `${staffNote('C', 5, 1)}${staffNote('D', 5, 1)}${staffNote('E', 5, 1)}${staffNote('F', 5, 1)}` +
            '<backup><duration>16</duration></backup>' +
            `${pedalMark('start')}${staffNote('C', 3, 2)}${staffNote('D', 3, 2)}${staffNote('E', 3, 2)}${staffNote('F', 3, 2)}`,
            `${staffNote('G', 5, 1)}${staffNote('A', 5, 1)}${staffNote('B', 5, 1)}${staffNote('C', 6, 1)}` +
            '<backup><duration>16</duration></backup>' +
            `${pedalMark('stop')}${staffNote('G', 2, 2)}${staffNote('A', 2, 2)}${staffNote('B', 2, 2)}${staffNote('C', 3, 2)}`,
        );
        const flags = sustainFlags(twoBar);
        const bar1 = flags.filter((n) => (n.Note === 72 || n.Note === 48) && n.Time < 2);
        const bar2 = flags.filter((n) => n.Note === 79 || n.Note === 43);
        expect(bar1).toHaveLength(2);
        expect(bar2).toHaveLength(2);
        expect(bar1.every((n) => n.Sustain)).toBe(true);
        expect(bar2.every((n) => !n.Sustain)).toBe(true);
    });
});

describe('handForScoreNote', () => {
    const { G2, F4, C3 } = alphaTab.model.Clef;

    it('lets the staff index win over clef and pitch on grand staff', () => {
        expect(handForScoreNote({ staffCount: 2, staffIndex: 0, clef: F4, voiceIndex: 0, multiVoice: false, pitch: 40 })).toBe('right');
        expect(handForScoreNote({ staffCount: 2, staffIndex: 1, clef: G2, voiceIndex: 0, multiVoice: false, pitch: 90 })).toBe('left');
    });

    it('reads G/F clefs on any other staff count', () => {
        expect(handForScoreNote({ staffCount: 1, staffIndex: 0, clef: G2, voiceIndex: 0, multiVoice: false, pitch: 40 })).toBe('right');
        expect(handForScoreNote({ staffCount: 1, staffIndex: 0, clef: F4, voiceIndex: 0, multiVoice: false, pitch: 80 })).toBe('left');
        expect(handForScoreNote({ staffCount: 3, staffIndex: 2, clef: F4, voiceIndex: 0, multiVoice: false, pitch: 80 })).toBe('left');
    });

    it('falls back to voice then pitch under other clefs', () => {
        expect(handForScoreNote({ staffCount: 1, staffIndex: 0, clef: C3, voiceIndex: 0, multiVoice: true, pitch: 40 })).toBe('right');
        expect(handForScoreNote({ staffCount: 1, staffIndex: 0, clef: C3, voiceIndex: 1, multiVoice: true, pitch: 80 })).toBe('left');
        expect(handForScoreNote({ staffCount: 1, staffIndex: 0, clef: C3, voiceIndex: 0, multiVoice: false, pitch: 40 })).toBe('left');
        expect(handForScoreNote({ staffCount: 1, staffIndex: 0, clef: C3, voiceIndex: 0, multiVoice: false, pitch: 72 })).toBe('right');
    });

    it('splits pitch at middle C', () => {
        expect(pitchFallbackHand(59)).toBe('left');
        expect(pitchFallbackHand(60)).toBe('right');
    });
});
