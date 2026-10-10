import type * as alphaTab from '@coderline/alphatab';
import { ticksToSeconds, type TempoChange } from './tempoMap';
import type { SongVocal } from './songformat';

// Score-side vocals: walk lyric-bearing beats (any staff, independent of the
// fretted-instrument gate) and emit SongVocal entries. Plain-text first; the
// begin/middle/end join rides on the msr lyricsSyllabic patch when present.

export interface LyricEntry {
    text: string;
    syllabic: string;
    time: number;
}

export interface TrackLyrics {
    trackName: string;
    vocals: SongVocal[];
    verses: number; // distinct verse lines seen (lyric number first-seen order)
    syllabic: boolean; // any lyricsSyllabic data present (patch applied)
}

// SongVocal has no continues-word flag, so begin/middle/end runs merge into a
// single entry here. Unterminated runs flush as-is; stray middles/ends pass
// through as singles rather than dropping text.
export function mergeLyricEntries(entries: LyricEntry[]): SongVocal[] {
    const vocals: SongVocal[] = [];
    let runText = '';
    let runStart = 0;
    let inRun = false;

    const flush = (): void => {
        if (!inRun) return;
        vocals.push({ Vocal: runText, TimeOffset: runStart });
        runText = '';
        inRun = false;
    };

    for (const entry of entries) {
        const kind = entry.syllabic.toLowerCase();
        if (kind === 'begin') {
            flush();
            runText = entry.text;
            runStart = entry.time;
            inRun = true;
        } else if (kind === 'middle' || kind === 'end') {
            if (inRun) {
                runText += entry.text;
                if (kind === 'end') flush();
            } else {
                vocals.push({ Vocal: entry.text, TimeOffset: entry.time });
            }
        } else {
            flush();
            vocals.push({ Vocal: entry.text, TimeOffset: entry.time });
        }
    }
    flush();
    return vocals;
}

// Port of ChartUtil.FormatVocals (PsarcChartCore): syllable-aware 40-char
// line wrapping via trailing '\n'. Deliberately without the psarc path's
// '+' -> '\n' step - MusicXML has no such convention, so a literal '+' stays
// literal here. Returns a new array; the input is left alone.
export function formatVocals(vocals: SongVocal[]): SongVocal[] {
    const maxCharsPerLine = 40;
    const out: SongVocal[] = vocals.map((v) => ({ ...v }));

    let charsInLine = 0;
    let lastBreakPos = -1;

    for (let pos = 0; pos < out.length; pos++) {
        if (out[pos].Vocal.endsWith('\n')) {
            charsInLine = 0;
            lastBreakPos = pos;
            continue;
        }

        charsInLine += out[pos].Vocal.length;

        if (charsInLine > maxCharsPerLine) {
            pos = lastBreakPos + 1;
            charsInLine = 0;

            for (; pos < out.length; pos++) {
                charsInLine += out[pos].Vocal.length;

                const next = out[pos + 1];
                const isGoodBreak =
                    pos < out.length - 2 &&
                    next !== undefined &&
                    (/^[A-Z]/.test(next.Vocal[0] ?? '') || next.TimeOffset - out[pos].TimeOffset > 0.5);

                if ((isGoodBreak && charsInLine > 20) || charsInLine > maxCharsPerLine) {
                    out[pos] = { TimeOffset: out[pos].TimeOffset, Vocal: `${out[pos].Vocal}\n` };
                    charsInLine = 0;
                    lastBreakPos = pos;
                    break;
                }
            }
        }
    }

    return out;
}

// Lyric beats for one track at the given verse line. Scans every staff since
// a vocal part may sit anywhere; (tick, text) dedupe keeps multi-staff
// notation+tab doubles from emitting twice. Rest/empty beats and empty
// entries are skipped, mirroring applyLyrics' own walk. Repeated bars emit
// per occurrence (re-timed), so the dedupe key uses playback ticks.
export function extractTrackLyrics(
    track: alphaTab.model.Track,
    trackName: string,
    tempoMap: TempoChange[],
    division: number,
    verse = 0,
    occurrences?: { barIndex: number; tickShift: number }[],
): TrackLyrics {
    const seen = new Set<string>();
    const entries: LyricEntry[] = [];
    let verses = 0;
    let syllabic = false;

    for (const staff of track.staves) {
        const barOrder = occurrences ?? staff.bars.map((_, barIndex) => ({ barIndex, tickShift: 0 }));
        for (const { barIndex, tickShift } of barOrder) {
            const bar = staff.bars[barIndex];
            if (!bar) continue;
            for (const voice of bar.voices) {
                for (const beat of voice.beats) {
                    if (beat.isRest || beat.isEmpty || !beat.lyrics) continue;
                    verses = Math.max(verses, beat.lyrics.length);
                    if (Array.isArray(beat.lyricsSyllabic)) syllabic = true;
                    const text = beat.lyrics[verse] ?? '';
                    if (!text) continue;
                    const tick = beat.absolutePlaybackStart + tickShift;
                    const key = `${tick} ${text}`;
                    if (seen.has(key)) continue;
                    seen.add(key);
                    entries.push({
                        text,
                        syllabic:
                            Array.isArray(beat.lyricsSyllabic) && beat.lyricsSyllabic[verse] !== undefined
                                ? beat.lyricsSyllabic[verse]
                                : '',
                        time: ticksToSeconds(tick, tempoMap, division),
                    });
                }
            }
        }
    }

    entries.sort((a, b) => a.time - b.time);
    return { trackName, vocals: formatVocals(mergeLyricEntries(entries)), verses, syllabic };
}
