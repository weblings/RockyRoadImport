// Dev-only: `npm run dev`, then /?walkthrough=<dwellMs>[&tab=<id>][&loop] steps every tab through its
// error and status states in the real UI. Loaded by dynamic import behind import.meta.env.DEV.
import {
    FILE_KIND, LOADING_CONVERTER, NO_ARRANGEMENTS, NO_PIANO_NOTES, NO_TRACKS, PARSING, PIANO_HAND_FALLBACK,
    allPartsFailed, convertFailure, convertedParts, convertedPianoNotes, convertedTracks, downloadFailure,
    failedParts, ignoredSongs, lyricsInTracks, noConvertibleNotes, noFrettedTracks, parseFailure, skippedNotFretted,
} from './messages';

interface Seedable { seed(patch: Record<string, unknown>): void }
type Patch = Record<string, unknown>;
interface Step { label: string; patch: Patch }

const BLANK: Patch = { phase: 'idle', status: '', warnings: [], downloadError: null, formVisible: false, handFallback: false };
const ready = (status: string, extra: Patch = {}): Patch => ({ phase: 'ready', status, formVisible: true, ...extra });
const error = (status: string): Patch => ({ phase: 'error', status });
const dlFail = ready('', { downloadError: downloadFailure(new Error('disk full')) });
const bad = new Error('unexpected end of file');
const failedLead = { Name: 'Lead', Error: 'bad tuning' };

const STEPS: Record<string, Step[]> = {
    midi: [
        { label: 'parsing', patch: { phase: 'parsing', status: PARSING } },
        { label: 'parse failure', patch: error(parseFailure(FILE_KIND.midi, bad)) },
        { label: 'no piano notes', patch: error(NO_PIANO_NOTES) },
        { label: 'conversion failure', patch: error(convertFailure(FILE_KIND.midi, bad)) },
        { label: 'clean', patch: ready(convertedPianoNotes(42)) },
        { label: 'hand fallback callout', patch: ready(convertedPianoNotes(42), { handFallback: true }) },
        { label: 'download failure', patch: { ...dlFail, status: convertedPianoNotes(42) } },
    ],
    psarc: [
        { label: 'loading converter', patch: { phase: 'parsing', status: LOADING_CONVERTER } },
        { label: 'parse failure', patch: error(parseFailure(FILE_KIND.psarc, bad)) },
        { label: 'no arrangements', patch: error(NO_ARRANGEMENTS) },
        { label: 'all failed', patch: error(allPartsFailed([failedLead, { Name: 'Bass' }])) },
        { label: 'clean', patch: ready(convertedParts(2, 2, ['Lead', 'Bass'])) },
        { label: 'partial failure + extra songs', patch: ready(convertedParts(1, 2, ['Bass']), { warnings: [failedParts([failedLead]), ignoredSongs(2)] }) },
        { label: 'download failure', patch: { ...dlFail, status: convertedParts(2, 2, ['Lead', 'Bass']) } },
    ],
    gp: [
        { label: 'parse failure', patch: error(parseFailure(FILE_KIND.gp, bad)) },
        { label: 'no tracks', patch: error(NO_TRACKS) },
        { label: 'only skipped tracks', patch: error(noFrettedTracks(['Drums', 'Piano'])) },
        { label: 'clean', patch: ready(convertedTracks(['Lead', 'Bass'])) },
        { label: 'skipped warning', patch: ready(convertedTracks(['Lead']), { warnings: [skippedNotFretted(['Drums'])] }) },
        { label: 'download failure', patch: { ...dlFail, status: convertedTracks(['Lead']) } },
    ],
    musicxml: [
        { label: 'parse failure', patch: error(parseFailure(FILE_KIND.musicXml, bad)) },
        { label: 'no tracks', patch: error(NO_TRACKS) },
        { label: 'only skipped tracks', patch: error(noConvertibleNotes(['Drums'])) },
        { label: 'clean (blank status)', patch: ready('') },
        { label: 'skipped warning', patch: ready('', { warnings: [skippedNotFretted(['Drums'])] }) },
        { label: 'piano hand fallback warning', patch: ready('', { warnings: [PIANO_HAND_FALLBACK] }) },
        { label: 'several lyric tracks', patch: ready(lyricsInTracks(2), { lyricsOptions: ['Vocals 1', 'Vocals 2'] }) },
        { label: 'download failure', patch: dlFail },
    ],
};

export interface WalkthroughOptions {
    stores: Record<string, Seedable>;
    dwellMs: number;
    tab: string | null;
    loop: boolean;
    setTab(id: string): void;
    setLabel(label: string | null): void;
    isCancelled(): boolean;
}

export async function runWalkthrough(o: WalkthroughOptions): Promise<void> {
    const ids = Object.keys(STEPS).filter((id) => !o.tab || id === o.tab);
    do {
        for (const id of ids) {
            o.setTab(id);
            const steps = STEPS[id];
            for (const [i, step] of steps.entries()) {
                if (o.isCancelled()) return;
                o.stores[id].seed({ ...BLANK, ...step.patch });
                o.setLabel(`${id} ${i + 1}/${steps.length}: ${step.label}`);
                await new Promise((r) => setTimeout(r, o.dwellMs));
            }
            o.stores[id].seed(BLANK);
        }
    } while (o.loop && !o.isCancelled());
    o.setLabel(null);
}
