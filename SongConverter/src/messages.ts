// User-facing status and error copy. Failures read "Couldn't <verb> <thing>: <reason>."; empty
// states name the likely cause. messages.test.ts fails if a store or App spells these out again.

export function plural(count: number, noun: string): string {
    return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

// Raw exception text is a reason, not a sentence: trim it, drop a trailing period, never leave it blank.
function reasonOf(err: unknown): string {
    const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
    return raw.trim().replace(/\.+$/, '') || 'unknown error';
}

export function failure(action: string, err: unknown): string {
    return `Couldn't ${action}: ${reasonOf(err)}.`;
}

export const FILE_KIND = {
    gp: 'Guitar Pro file',
    midi: 'MIDI file',
    musicXml: 'MusicXML file',
    psarc: 'PSARC file',
} as const;

export const parseFailure = (kind: string, err: unknown) => failure(`read the ${kind}`, err);
export const convertFailure = (kind: string, err: unknown) => failure(`convert the ${kind}`, err);
export const downloadFailure = (err: unknown) => failure('download the ZIP', err);

export const PARSING = 'Parsing…';
export const LOADING_CONVERTER = 'Loading the converter (first use only)…';

export const NO_TRACKS = 'No tracks found in this file. Check that it contains a guitar or bass track.';
export const NO_PIANO_NOTES = 'No piano notes found. Check that the MIDI file contains note data on a piano/keys track.';
export const NO_ARRANGEMENTS = 'No arrangements found in this PSARC file. Check that it is a Rocksmith 2014 song.';

export const noFrettedTracks = (skipped: string[]) =>
    `No fretted-instrument tracks found. Skipped: ${skipped.join(', ')}.`;
export const noConvertibleNotes = (skipped: string[]) =>
    `No convertible notes found. Skipped: ${skipped.join(', ')}.`;
export const skippedNotFretted = (names: string[]) =>
    `Skipped (not a fretted instrument): ${names.join(', ')}.`;

export const convertedTracks = (names: string[]) =>
    `Converted ${plural(names.length, 'track')}: ${names.join(', ')}.`;
export const convertedPianoNotes = (count: number) => `Converted ${plural(count, 'piano note')}.`;
export const convertedParts = (done: number, total: number, names: string[]) =>
    `Converted ${done} of ${plural(total, 'part')}: ${names.join(', ')}.`;

export const lyricsInTracks = (count: number) => `Lyrics in ${count} tracks — choose one below.`;
export const MIDI_HAND_FALLBACK =
    'Hands assigned by pitch (below middle C is left) because no Left Hand / Right Hand track names were found; may be wrong where hands cross. Rename tracks to include them.';
export const PIANO_HAND_FALLBACK = 'Piano hand assigned by fallback (not grand staff); may be wrong where hands cross.';

interface FailedPart { Name: string; Error?: string }
const partReasons = (failed: FailedPart[]) => failed.map((p) => `${p.Name} (${reasonOf(p.Error)})`).join('; ');
export const failedParts = (failed: FailedPart[]) => `Couldn't convert: ${partReasons(failed)}.`;
export const allPartsFailed = (failed: FailedPart[]) =>
    `Couldn't convert any of the ${plural(failed.length, 'arrangement')}: ${partReasons(failed)}.`;
export const ignoredSongs = (count: number) => `Ignored ${plural(count, 'additional song')} in this file.`;
