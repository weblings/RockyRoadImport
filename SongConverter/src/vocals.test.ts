import { describe, it, expect } from 'vitest';
import { convertMusicXml } from './scoreConverter';
import { mergeLyricEntries, formatVocals } from './vocals';

// Hand-authored lyric fixtures (a few notes, not a real song), following the
// musicXml.test.ts pattern. The Voice part carries no tab data, so it lands
// in skipped as notes but is picked up by the lyric scan.
const VOICE_XML = `<?xml version="1.0" encoding="UTF-8"?>
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
        <lyric number="1"><syllabic>single</syllabic><text>hey</text></lyric>
      </note>
    </measure>
  </part>
</score-partwise>
`;

const TWO_VOICE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list>
    <score-part id="P1"><part-name>LeadVocal</part-name></score-part>
    <score-part id="P2"><part-name>Backing</part-name></score-part>
  </part-list>
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
        <lyric number="1"><text>yo</text></lyric>
      </note>
    </measure>
  </part>
  <part id="P2">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note>
        <pitch><step>G</step><octave>3</octave></pitch>
        <duration>4</duration>
        <type>quarter</type>
        <lyric number="1"><text>ah</text></lyric>
      </note>
    </measure>
  </part>
</score-partwise>
`;

describe('mergeLyricEntries', () => {
    it('joins begin/middle/end runs with no separator at the run start time', () => {
        const vocals = mergeLyricEntries([
            { text: 'to', syllabic: 'begin', time: 0 },
            { text: 'geth', syllabic: 'middle', time: 0.5 },
            { text: 'er', syllabic: 'end', time: 1 },
            { text: 'hey', syllabic: 'single', time: 1.5 },
        ]);
        expect(vocals).toEqual([
            { Vocal: 'together', TimeOffset: 0 },
            { Vocal: 'hey', TimeOffset: 1.5 },
        ]);
    });

    it('passes plain entries without syllabic data through untouched', () => {
        const vocals = mergeLyricEntries([
            { text: 'yo', syllabic: '', time: 0 },
            { text: 'ah', syllabic: '', time: 0.5 },
        ]);
        expect(vocals).toEqual([
            { Vocal: 'yo', TimeOffset: 0 },
            { Vocal: 'ah', TimeOffset: 0.5 },
        ]);
    });

    it('flushes an unterminated run and treats stray ends as singles', () => {
        const vocals = mergeLyricEntries([
            { text: 'un', syllabic: 'begin', time: 0 },
            { text: 'done', syllabic: 'end', time: 1 },
            { text: 'stray', syllabic: 'end', time: 2 },
        ]);
        expect(vocals).toEqual([
            { Vocal: 'undone', TimeOffset: 0 },
            { Vocal: 'stray', TimeOffset: 2 },
        ]);
    });
});

describe('formatVocals', () => {
    it('leaves short lines unwrapped', () => {
        const vocals = [
            { Vocal: 'Hello', TimeOffset: 0 },
            { Vocal: 'hey', TimeOffset: 1 },
        ];
        expect(formatVocals(vocals)).toEqual(vocals);
    });

    it('breaks long lines and preserves times', () => {
        const words = ['Alpha', 'beta', 'gamma', 'Delta', 'epsilon', 'Zeta', 'eta', 'Theta', 'iota'];
        const vocals = words.map((Vocal, i) => ({ Vocal, TimeOffset: i * 0.6 }));
        const formatted = formatVocals(vocals);
        expect(formatted.map((v) => v.TimeOffset)).toEqual(vocals.map((v) => v.TimeOffset));
        expect(formatted.map((v) => v.Vocal).join('').replaceAll('\n', '')).toBe(words.join(''));
        expect(formatted.some((v) => v.Vocal.endsWith('\n'))).toBe(true);
    });
});

describe('convertMusicXml lyrics', () => {
    it('exposes a lyric-only part as vocals with joined words', () => {
        const result = convertMusicXml(new TextEncoder().encode(VOICE_XML));
        expect(result.tracks).toHaveLength(0);
        expect(result.skipped).toEqual(['Voice']);
        expect(result.lyrics).toHaveLength(1);
        const [voice] = result.lyrics;
        expect(voice.trackName).toBe('Voice');
        expect(voice.syllabic).toBe(true);
        expect(voice.vocals.map((v) => v.Vocal)).toEqual(['Hello', 'hey']);
        const times = voice.vocals.map((v) => v.TimeOffset);
        expect(times[0]).toBe(0);
        expect(times[1]).toBeGreaterThan(times[0]);
    });

    it('exposes every lyric-bearing part so the UI can offer the choice', () => {
        const result = convertMusicXml(new TextEncoder().encode(TWO_VOICE_XML));
        expect(result.lyrics.map((l) => l.trackName)).toEqual(['LeadVocal', 'Backing']);
        expect(result.lyrics[0].vocals).toEqual([{ Vocal: 'yo', TimeOffset: 0 }]);
        expect(result.lyrics[1].vocals).toEqual([{ Vocal: 'ah', TimeOffset: 0 }]);
    });

    it('reports no lyrics for lyric-free files', () => {
        const result = convertMusicXml(
            new TextEncoder().encode(`<?xml version="1.0" encoding="UTF-8"?>
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
        <notations><technical><string>1</string><fret>0</fret></technical></notations>
      </note>
    </measure>
  </part>
</score-partwise>
`),
        );
        expect(result.lyrics).toEqual([]);
    });
});
