import { describe, it, expect } from 'vitest';
import * as alphaTab from '@coderline/alphatab';
import pianoFixtureXml from './fixtures/piano-grand-staff.musicxml?raw';
import leakFixtureXml from './fixtures/piano-dynamics-cross-staff.musicxml?raw';
import { convertMusicXml } from './scoreConverter';
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
