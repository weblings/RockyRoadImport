import { describe, it, expect } from 'vitest';
import * as alphaTab from '@coderline/alphatab';
import fixtureXml from './fixtures/guitar-three-notes.musicxml?raw';
import pianoFixtureXml from './fixtures/piano-grand-staff.musicxml?raw';
import { convertMusicXml } from './scoreConverter';

// Minimal hand-authored MusicXML (a few notes, not a real song) exercising the
// ScoreLoader.loadScoreFromBytes path convertMusicXml shares with convertGuitarPro.
// Two identically-named parts mirror real exports (e.g. W3C 71e-TabStaves' four
// "Guitar" parts); the hammer-on pair pins the noteStringLookup re-index patch.
const HAMMER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <movement-title>TubeTest</movement-title>
  <part-list>
    <score-part id="P1"><part-name>Guitar</part-name></score-part>
    <score-part id="P2"><part-name>Guitar</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
        <staff-details>
          <staff-lines>6</staff-lines>
          <staff-tuning line="1"><tuning-step>E</tuning-step><tuning-octave>2</tuning-octave></staff-tuning>
          <staff-tuning line="2"><tuning-step>A</tuning-step><tuning-octave>2</tuning-octave></staff-tuning>
          <staff-tuning line="3"><tuning-step>D</tuning-step><tuning-octave>3</tuning-octave></staff-tuning>
          <staff-tuning line="4"><tuning-step>G</tuning-step><tuning-octave>3</tuning-octave></staff-tuning>
          <staff-tuning line="5"><tuning-step>B</tuning-step><tuning-octave>3</tuning-octave></staff-tuning>
          <staff-tuning line="6"><tuning-step>E</tuning-step><tuning-octave>4</tuning-octave></staff-tuning>
        </staff-details>
      </attributes>
      <note>
        <pitch><step>A</step><octave>4</octave></pitch>
        <duration>4</duration>
        <type>quarter</type>
        <notations><technical><string>1</string><fret>5</fret><hammer-on type="start">H</hammer-on></technical></notations>
      </note>
      <note>
        <pitch><step>B</step><octave>4</octave></pitch>
        <duration>4</duration>
        <type>quarter</type>
        <notations><technical><string>1</string><fret>7</fret><hammer-on type="stop">H</hammer-on></technical></notations>
      </note>
    </measure>
  </part>
  <part id="P2">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>TAB</sign></clef>
        <staff-details>
          <staff-lines>6</staff-lines>
          <staff-tuning line="1"><tuning-step>E</tuning-step><tuning-octave>2</tuning-octave></staff-tuning>
          <staff-tuning line="2"><tuning-step>A</tuning-step><tuning-octave>2</tuning-octave></staff-tuning>
          <staff-tuning line="3"><tuning-step>D</tuning-step><tuning-octave>3</tuning-octave></staff-tuning>
          <staff-tuning line="4"><tuning-step>G</tuning-step><tuning-octave>3</tuning-octave></staff-tuning>
          <staff-tuning line="5"><tuning-step>B</tuning-step><tuning-octave>3</tuning-octave></staff-tuning>
          <staff-tuning line="6"><tuning-step>E</tuning-step><tuning-octave>4</tuning-octave></staff-tuning>
        </staff-details>
      </attributes>
      <note>
        <pitch><step>E</step><octave>4</octave></pitch>
        <duration>4</duration>
        <type>quarter</type>
        <notations><technical><string>1</string><fret>0</fret></technical></notations>
      </note>
    </measure>
  </part>
</score-partwise>
`;

function convertFixture() {
    return convertMusicXml(new TextEncoder().encode(HAMMER_XML));
}

describe('convertMusicXml', () => {
    it('reads metadata and tab data through the ScoreLoader entry', () => {
        const result = convertFixture();
        expect(result.songName).toBe('TubeTest');
        expect(result.tracks).toHaveLength(2);
        const [t1, t2] = result.tracks;
        // MusicXML string 1 (highest) maps to 0-indexed String 5, like the GP path.
        expect(t1.notes.Notes[0]).toMatchObject({ Fret: 5, String: 5 });
        expect(t1.notes.Notes[1]).toMatchObject({ Fret: 7, String: 5 });
        expect(t1.part.Tuning?.StringSemitoneOffsets).toEqual([0, 0, 0, 0, 0, 0]);
        // TAB-clef part is detected as stringed too.
        expect(t2.notes.Notes).toHaveLength(1);
    });

    it('marks the hammer-on destination note (MusicXML string-ordering fix)', () => {
        const [t1] = convertFixture().tracks;
        expect(t1.notes.Notes[1].Techniques).toContain('HammerOn');
    });

    it('dedupes identically-named parts positionally like untitled GP tracks', () => {
        const [t1, t2] = convertFixture().tracks;
        expect(t1.part.InstrumentName).toBe('lead');
        expect(t2.part.InstrumentName).toBe('rhythm');
    });

    it('maps an X notehead to FretHandMute (upstream #2866 workaround)', () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>TAB</sign></clef>
        <staff-details>
          <staff-lines>6</staff-lines>
          <staff-tuning line="1"><tuning-step>E</tuning-step><tuning-octave>2</tuning-octave></staff-tuning>
          <staff-tuning line="2"><tuning-step>A</tuning-step><tuning-octave>2</tuning-octave></staff-tuning>
          <staff-tuning line="3"><tuning-step>D</tuning-step><tuning-octave>3</tuning-octave></staff-tuning>
          <staff-tuning line="4"><tuning-step>G</tuning-step><tuning-octave>3</tuning-octave></staff-tuning>
          <staff-tuning line="5"><tuning-step>B</tuning-step><tuning-octave>3</tuning-octave></staff-tuning>
          <staff-tuning line="6"><tuning-step>E</tuning-step><tuning-octave>4</tuning-octave></staff-tuning>
        </staff-details>
      </attributes>
      <note>
        <pitch><step>E</step><octave>4</octave></pitch>
        <duration>4</duration>
        <type>quarter</type>
        <notehead>x</notehead>
        <notations><technical><string>1</string><fret>0</fret></technical></notations>
      </note>
    </measure>
  </part>
</score-partwise>
`;
        const [track] = convertMusicXml(new TextEncoder().encode(xml)).tracks;
        expect(track.notes.Notes).toHaveLength(1);
        expect(track.notes.Notes[0].Techniques).toContain('FretHandMute');
    });

    it('finds the tab staff even when it is not staves[0] (TuxGuitar/MuseScore shape)', () => {
        // Multi-staff guitar part: staff 1 is standard notation (no tuning), staff 2 is the
        // TAB staff. Real TuxGuitar/MuseScore exports order staves this way, not tab-first.
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <staves>2</staves>
        <clef number="1"><sign>G</sign><line>2</line></clef>
        <clef number="2"><sign>TAB</sign></clef>
        <staff-details number="2">
          <staff-lines>6</staff-lines>
          <staff-tuning line="1"><tuning-step>E</tuning-step><tuning-octave>2</tuning-octave></staff-tuning>
          <staff-tuning line="2"><tuning-step>A</tuning-step><tuning-octave>2</tuning-octave></staff-tuning>
          <staff-tuning line="3"><tuning-step>D</tuning-step><tuning-octave>3</tuning-octave></staff-tuning>
          <staff-tuning line="4"><tuning-step>G</tuning-step><tuning-octave>3</tuning-octave></staff-tuning>
          <staff-tuning line="5"><tuning-step>B</tuning-step><tuning-octave>3</tuning-octave></staff-tuning>
          <staff-tuning line="6"><tuning-step>E</tuning-step><tuning-octave>4</tuning-octave></staff-tuning>
        </staff-details>
      </attributes>
      <note>
        <pitch><step>E</step><octave>4</octave></pitch>
        <duration>4</duration>
        <type>quarter</type>
        <staff>1</staff>
      </note>
      <backup><duration>4</duration></backup>
      <note>
        <pitch><step>E</step><octave>4</octave></pitch>
        <duration>4</duration>
        <type>quarter</type>
        <staff>2</staff>
        <notations><technical><string>1</string><fret>0</fret></technical></notations>
      </note>
    </measure>
  </part>
</score-partwise>
`;
        const result = convertMusicXml(new TextEncoder().encode(xml));
        expect(result.skipped).toEqual([]);
        expect(result.tracks).toHaveLength(1);
        expect(result.tracks[0].notes.Notes).toHaveLength(1);
        expect(result.tracks[0].part.Tuning?.StringSemitoneOffsets).toEqual([0, 0, 0, 0, 0, 0]);
        // 2 staves + no <midi-program> (program 0) would match the naive piano rule -
        // the fretted gate runs first so this stays guitar, never piano.
        expect(result.pianoTracks).toEqual([]);
    });

    it('converts the hand-authored .musicxml fixture from disk', () => {
        // Phase 6: the XML-to-Score step needs real .musicxml input, unlike the
        // shared convertScore mapping (covered via alphaTex in scoreConverter.test.ts).
        const result = convertMusicXml(new TextEncoder().encode(fixtureXml));
        expect(result.songName).toBe('FixtureTune');
        expect(result.tracks).toHaveLength(1);
        const [track] = result.tracks;
        expect(track.part.Tuning?.StringSemitoneOffsets).toEqual([0, 0, 0, 0, 0, 0]);
        expect(track.notes.Notes.map((n) => n.Fret)).toEqual([0, 3, 5]);
    });

    it('surfaces <syllabic> alongside lyrics (patched _parseLyric)', () => {
        // Parallel-signal shape per msr/m2g contract: per-verse syllabic values
        // next to beat.lyrics, so the m2g consumer can merge begin/middle/end
        // runs. A lyric without <syllabic> defaults to "" like lyric text does.
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Voice</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>4</duration>
        <type>quarter</type>
        <lyric number="1"><syllabic>begin</syllabic><text>Hel</text></lyric>
      </note>
      <note>
        <pitch><step>D</step><octave>4</octave></pitch>
        <duration>4</duration>
        <type>quarter</type>
        <lyric number="1"><syllabic>end</syllabic><text>lo</text></lyric>
      </note>
      <note>
        <pitch><step>E</step><octave>4</octave></pitch>
        <duration>4</duration>
        <type>quarter</type>
        <lyric number="1"><text>hey</text></lyric>
      </note>
    </measure>
  </part>
</score-partwise>
`;
        const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(new TextEncoder().encode(xml));
        const beats = score.tracks[0].staves[0].bars[0].voices[0].beats;
        expect(beats.map((b) => (b.lyrics?.length ? b.lyrics[0] : ''))).toEqual(['Hel', 'lo', 'hey']);
        expect(beats.map((b) => (b.lyricsSyllabic?.length ? b.lyricsSyllabic[0] : undefined))).toEqual([
            'begin',
            'end',
            '',
        ]);
    });

    it('rejects foreign files with a clean error instead of a garbage score', () => {
        const encode = (s: string) => new TextEncoder().encode(s);
        // Well-formed XML that is not MusicXML, and plain text: neither may slip through
        // the AlphaTexImporter catch-all as a bogus score.
        expect(() => convertMusicXml(encode('<note><foo>bar</foo></note>'))).toThrow();
        expect(() => convertMusicXml(encode('just some words'))).toThrow();
    });
});

describe('piano detection', () => {
    // One single-staff part; midiProgram is the 1-based XML value (omitted = no
    // <midi-instrument>, which also reads program 0). The <score-instrument>
    // sibling is required - the importer ignores a <midi-instrument> whose id
    // matches nothing.
    function singleStaffPart(name: string, opts: { midiProgram?: number; clef?: string; lyric?: string } = {}): string {
        const midi = opts.midiProgram !== undefined
            ? `<score-instrument id="P1-I1"><instrument-name>${name}</instrument-name></score-instrument><midi-instrument id="P1-I1"><midi-channel>1</midi-channel><midi-program>${opts.midiProgram}</midi-program></midi-instrument>`
            : '';
        const lyric = opts.lyric !== undefined
            ? `<lyric number="1"><text>${opts.lyric}</text></lyric>`
            : '';
        return `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>${name}</part-name>${midi}</score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>${opts.clef ?? 'G'}</sign>${opts.clef === 'percussion' ? '' : '<line>2</line>'}</clef>
      </attributes>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>4</duration>
        <type>quarter</type>
        ${lyric}
      </note>
    </measure>
  </part>
</score-partwise>
`;
    }

    const encode = (s: string) => new TextEncoder().encode(s);

    it('detects the hand-authored grand-staff fixture (program 0 + 2 staves)', () => {
        const result = convertMusicXml(encode(pianoFixtureXml));
        expect(result.songName).toBe('PianoFixture');
        expect(result.pianoTracks.map((p) => p.trackName)).toEqual(['Piano']);
        expect(result.tracks).toEqual([]);
        expect(result.skipped).toEqual([]);
    });

    it('detects a single-staff part by program 1-7 without a name keyword', () => {
        // <midi-program>6 -> program 5; neutral name isolates the program rule.
        // Same shape a single-staff GP piano track takes through shared convertScore -
        // the GP tab ignores pianoTracks, so detecting it there is harmless.
        const result = convertMusicXml(encode(singleStaffPart('Electric', { midiProgram: 6 })));
        expect(result.pianoTracks.map((p) => p.trackName)).toEqual(['Electric']);
        expect(result.tracks).toEqual([]);
        expect(result.skipped).toEqual([]);
    });

    it('detects a single-staff part by name keyword when the program is missing', () => {
        const result = convertMusicXml(encode(singleStaffPart('Piano Solo')));
        // The importer normalizes spaces to NBSP in part names - the tokenizer splits on it.
        expect(result.pianoTracks.map((p) => p.trackName)).toEqual(['Piano\u00A0Solo']);
        expect(result.skipped).toEqual([]);
    });

    it('leaves a single-staff vocal part skipped while still extracting its lyrics', () => {
        const result = convertMusicXml(encode(singleStaffPart('Voice', { lyric: 'hey' })));
        expect(result.pianoTracks).toEqual([]);
        expect(result.skipped).toEqual(['Voice']);
        expect(result.lyrics).toHaveLength(1);
        expect(result.lyrics[0].vocals.map((v) => v.Vocal)).toEqual(['hey']);
    });

    it('never detects a percussion part as piano', () => {
        const result = convertMusicXml(encode(singleStaffPart('Drums', { clef: 'percussion' })));
        expect(result.pianoTracks).toEqual([]);
        expect(result.skipped).toEqual(['Drums']);
    });

    it('feeds a lyric-carrying piano part to both consumers', () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <movement-title>PianoVox</movement-title>
  <part-list>
    <score-part id="P1">
      <part-name>Piano</part-name>
      <midi-instrument id="P1-I1"><midi-channel>1</midi-channel><midi-program>1</midi-program></midi-instrument>
    </score-part>
  </part-list>
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
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>4</duration>
        <type>quarter</type>
        <staff>1</staff>
        <lyric number="1"><text>hey</text></lyric>
      </note>
      <backup><duration>4</duration></backup>
      <note>
        <pitch><step>C</step><octave>3</octave></pitch>
        <duration>4</duration>
        <type>quarter</type>
        <staff>2</staff>
      </note>
    </measure>
  </part>
</score-partwise>
`;
        const result = convertMusicXml(encode(xml));
        expect(result.pianoTracks.map((p) => p.trackName)).toEqual(['Piano']);
        expect(result.skipped).toEqual([]);
        expect(result.lyrics).toHaveLength(1);
        expect(result.lyrics[0].vocals.map((v) => v.Vocal)).toEqual(['hey']);
    });
});
