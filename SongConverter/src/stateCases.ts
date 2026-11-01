// Every status/error state each tab can show, as the store state it should land on. The dev
// walkthrough seeds these; statusTones.test.tsx drives the real stores and expects the same state.
import {
    FILE_KIND, LOADING_CONVERTER, MIDI_HAND_FALLBACK, NO_ARRANGEMENTS, NO_PIANO_NOTES, NO_TRACKS, PARSING,
    PIANO_HAND_FALLBACK, allPartsFailed, convertFailure, convertedParts, convertedPianoNotes, convertedTracks,
    downloadFailure, failedParts, ignoredSongs, lyricsInTracks, noConvertibleNotes, noFrettedTracks, parseFailure,
    skippedNotFretted,
} from './messages';

export type Patch = Record<string, unknown>;
export interface StateCase {
    name: string;
    patch: Patch;
    // Not reachable by loading a file (in-flight or download-time states); the walkthrough still shows it.
    seedOnly?: boolean;
}

export const BAD = new Error('unexpected end of file');
export const FAILED_LEAD = { Name: 'Lead', Error: 'bad tuning' };
export const FAILED_BASS = { Name: 'Bass' };

const ready = (status: string, extra: Patch = {}): Patch => ({ phase: 'ready', status, warnings: [], formVisible: true, ...extra });
const error = (status: string): Patch => ({ phase: 'error', status, warnings: [] });
const downloadFailed = (status: string): StateCase => ({
    name: 'download failure', seedOnly: true,
    patch: ready(status, { downloadError: downloadFailure(new Error('disk full')) }),
});

export const STATE_CASES: Record<string, StateCase[]> = {
    midi: [
        { name: 'parsing', seedOnly: true, patch: { phase: 'parsing', status: PARSING } },
        { name: 'parse failure', patch: error(parseFailure(FILE_KIND.midi, BAD)) },
        { name: 'no piano notes', patch: error(NO_PIANO_NOTES) },
        { name: 'conversion failure', patch: error(convertFailure(FILE_KIND.midi, BAD)) },
        { name: 'clean', patch: ready(convertedPianoNotes(42)) },
        { name: 'hand fallback warning', patch: ready(convertedPianoNotes(42), { warnings: [MIDI_HAND_FALLBACK] }) },
        downloadFailed(convertedPianoNotes(42)),
    ],
    psarc: [
        { name: 'loading converter', seedOnly: true, patch: { phase: 'parsing', status: LOADING_CONVERTER } },
        { name: 'parse failure', patch: error(parseFailure(FILE_KIND.psarc, BAD)) },
        { name: 'no arrangements', patch: error(NO_ARRANGEMENTS) },
        { name: 'all failed', patch: error(allPartsFailed([FAILED_LEAD, FAILED_BASS])) },
        { name: 'clean', patch: ready(convertedParts(2, 2, ['Lead', 'Bass'])) },
        {
            name: 'partial failure + extra song',
            patch: ready(convertedParts(1, 2, ['Bass']), { warnings: [failedParts([FAILED_LEAD]), ignoredSongs(1)] }),
        },
        downloadFailed(convertedParts(2, 2, ['Lead', 'Bass'])),
    ],
    gp: [
        { name: 'parse failure', patch: error(parseFailure(FILE_KIND.gp, BAD)) },
        { name: 'no tracks', patch: error(NO_TRACKS) },
        { name: 'only skipped tracks', patch: error(noFrettedTracks(['Drums', 'Piano'])) },
        { name: 'clean', patch: ready(convertedTracks(['Lead', 'Bass'])) },
        { name: 'skipped warning', patch: ready(convertedTracks(['Lead']), { warnings: [skippedNotFretted(['Drums'])] }) },
        downloadFailed(convertedTracks(['Lead'])),
    ],
    musicxml: [
        { name: 'parse failure', patch: error(parseFailure(FILE_KIND.musicXml, BAD)) },
        { name: 'no tracks', patch: error(NO_TRACKS) },
        { name: 'only skipped tracks', patch: error(noConvertibleNotes(['Drums'])) },
        { name: 'clean (blank status)', patch: ready('') },
        { name: 'skipped warning', patch: ready('', { warnings: [skippedNotFretted(['Drums'])] }) },
        { name: 'piano hand fallback warning', patch: ready('', { warnings: [PIANO_HAND_FALLBACK] }) },
        { name: 'several lyric tracks', patch: ready(lyricsInTracks(2), { lyricsOptions: ['Vocals 1', 'Vocals 2'] }) },
        downloadFailed(''),
    ],
};
