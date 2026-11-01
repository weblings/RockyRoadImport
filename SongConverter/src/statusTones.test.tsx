// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { GpPanel } from './GpPanel';
import { MidiPanel } from './MidiPanel';
import { MusicXmlPanel } from './MusicXmlPanel';
import { PsarcPanel } from './PsarcPanel';
import { createGpStore } from './stores/gpStore';
import { createMidiStore } from './stores/midiStore';
import { createMusicXmlStore } from './stores/musicXmlStore';
import { createPsarcStore } from './stores/psarcStore';

const converters = vi.hoisted(() => ({ gp: vi.fn(), musicXml: vi.fn(), piano: vi.fn() }));
vi.mock('./scoreConverter', () => ({
    convertGuitarPro: converters.gp,
    convertMusicXml: converters.musicXml,
}));

// Defaults to the real converter; MIDI cases override it to force a conversion outcome.
vi.mock('./pianoConverter', async (importActual) => {
    const actual = await importActual<typeof import('./pianoConverter')>();
    converters.piano.mockImplementation(actual.convertPianoMidi);
    return { ...actual, convertPianoMidi: converters.piano };
});

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const bytes = () => new File([new Uint8Array(4)], 'input');
const track = { trackName: 'Lead' };
const noop = () => {};

// Every message a tab can show, pinned to one vocabulary: the status line is neutral or error
// (error = nothing downloadable), and anything to double-check sits in a separate warning line.
interface Case {
    name: string;
    tone: 'error' | 'neutral';
    downloadable: boolean;
    text: RegExp | '';
    warning?: RegExp;
}

function expectStatus(c: Case, tab: string) {
    // Not getByRole: the MIDI slider's <output> also has the status role.
    const status = document.getElementById(`${tab}-status`)!;
    expect(status.getAttribute('data-tone')).toBe(c.tone);
    if (c.text === '') expect(status.textContent).toBe('');
    else expect(status.textContent).toMatch(c.text);

    const warnings = document.getElementById(`${tab}-warnings`);
    if (c.warning) expect(warnings!.textContent).toMatch(c.warning);
    else if (warnings) expect(warnings.textContent).toBe('');

    expect(screen.getByRole('button', { name: 'Download' }).hasAttribute('disabled')).toBe(!c.downloadable);
}

describe('Guitar Pro status tones', () => {
    const gp = (result: object): Case['name'] extends string ? () => void : never => () => converters.gp.mockReturnValue({
        songName: 'S', artistName: 'A', skipped: [], pianoTracks: [], tracks: [], ...result,
    });
    const cases: Array<[Case, () => void]> = [
        [{ name: 'clean', tone: 'neutral', downloadable: true, text: /^Converted 1 track: Lead\.$/ }, gp({ tracks: [track] })],
        [{ name: 'skipped', tone: 'neutral', downloadable: true, text: /^Converted 1 track: Lead\.$/, warning: /^⚠ Skipped \(not a fretted instrument\): Drums/ }, gp({ tracks: [track], skipped: ['Drums'] })],
        [{ name: 'nothing usable', tone: 'error', downloadable: false, text: /^✖ No fretted-instrument tracks found\. Skipped: Drums/ }, gp({ skipped: ['Drums'] })],
        [{ name: 'empty', tone: 'error', downloadable: false, text: /^✖ No tracks found in this file\./ }, gp({})],
        [{ name: 'throws', tone: 'error', downloadable: false, text: /^✖ Couldn't read the Guitar Pro file: bad\./ }, () => converters.gp.mockImplementation(() => { throw new Error('bad'); })],
    ];
    it.each(cases)('case %#', async (c, arrange) => {
        arrange();
        const store = createGpStore();
        render(<GpPanel store={store} onDownload={noop} />);
        await act(async () => { await store.loadFile(bytes()); });
        expectStatus(c, 'gp');
    });
});

describe('MusicXML status tones', () => {
    const xml = (result: object) => () => converters.musicXml.mockReturnValue({
        songName: 'S', artistName: 'A', skipped: [], pianoTracks: [], lyrics: [], tracks: [track], ...result,
    });
    const lyric = (trackName: string) => ({ trackName, vocals: [{}] });
    const cases: Array<[Case, () => void]> = [
        [{ name: 'clean', tone: 'neutral', downloadable: true, text: '' }, xml({})],
        [{ name: 'skipped', tone: 'neutral', downloadable: true, text: '', warning: /^⚠ Skipped \(not a fretted instrument\): Drums/ }, xml({ skipped: ['Drums'] })],
        [{ name: 'hand fallback', tone: 'neutral', downloadable: true, text: '', warning: /^⚠ Piano hand assigned by fallback/ }, xml({ pianoTracks: [{ trackName: 'Piano', usedHandFallback: true, notes: { Notes: [{}] } }] })],
        [{ name: 'several lyric tracks', tone: 'neutral', downloadable: true, text: /^Lyrics in 2 tracks — choose one below\.$/ }, xml({ lyrics: [lyric('V1'), lyric('V2')] })],
        [{ name: 'nothing usable', tone: 'error', downloadable: false, text: /^✖ No convertible notes found\. Skipped: Drums/ }, xml({ tracks: [], skipped: ['Drums'] })],
        [{ name: 'throws', tone: 'error', downloadable: false, text: /^✖ Couldn't read the MusicXML file: bad\./ }, () => converters.musicXml.mockImplementation(() => { throw new Error('bad'); })],
    ];
    it.each(cases)('case %#', async (c, arrange) => {
        arrange();
        const store = createMusicXmlStore();
        render(<MusicXmlPanel store={store} onDownload={noop} />);
        await act(async () => { await store.loadFile(bytes()); });
        expectStatus(c, 'musicxml');
    });
});

describe('Rocksmith status tones', () => {
    const part = (Name: string, ok = true) => ({ Name, Part: ok ? { InstrumentName: Name } : null, Error: ok ? undefined : 'boom' });
    const song = (parts: object[]) => ({
        SongKey: 'k', SongData: { SongName: 'S', ArtistName: 'A', AlbumName: 'B', InstrumentParts: [] },
        Structure: { Sections: [] }, Parts: parts,
    });
    const cases: Array<[Case, object[]]> = [
        [{ name: 'clean', tone: 'neutral', downloadable: true, text: /^Converted 1 of 1 part: lead\.$/ }, [song([part('lead')])]],
        [{ name: 'partial failure', tone: 'neutral', downloadable: true, text: /^Converted 1 of 2 parts: lead\.$/, warning: /^⚠ Couldn't convert: bass \(boom\)\.$/ }, [song([part('lead'), part('bass', false)])]],
        [{ name: 'extra songs ignored', tone: 'neutral', downloadable: true, text: /^Converted 1 of 1 part: lead\.$/, warning: /^⚠ Ignored 1 additional song in this file\.$/ }, [song([part('lead')]), song([part('lead')])]],
        [{ name: 'all failed', tone: 'error', downloadable: false, text: /^✖ Couldn't convert any of the 1 arrangement/ }, [song([part('bass', false)])]],
        [{ name: 'no arrangements', tone: 'error', downloadable: false, text: /^✖ No arrangements found/ }, []],
    ];
    it.each(cases)('case %#', async (c, songs) => {
        const store = createPsarcStore({
            loadWasm: async () => ({ PsarcInterop: { ConvertAllPsarc: () => JSON.stringify(songs), GetOggAudio: () => new Uint8Array() } }),
            fetchAlbumArt: async () => null,
        });
        render(<PsarcPanel store={store} onDownload={noop} />);
        await act(async () => { await store.loadFile(bytes()); });
        expectStatus(c, 'psarc');
    });
});

describe('MIDI status tones', () => {
    const empty = async () => ({ tracks: [[]], division: 480 });
    const converted = (usedHandFallback: boolean) => () =>
        converters.piano.mockReturnValueOnce({ keyboardNotes: { Notes: [{}] }, usedHandFallback });
    const cases: Array<[Case, () => Promise<unknown>, () => void]> = [
        [{ name: 'parse failure', tone: 'error', downloadable: false, text: /^✖ Couldn't read the MIDI file: bad\./ }, async () => { throw new Error('bad'); }, () => {}],
        [{ name: 'no piano notes', tone: 'error', downloadable: false, text: /^✖ No piano notes found\./ }, empty, () => {}],
        [{ name: 'conversion failure', tone: 'error', downloadable: false, text: /^✖ Couldn't convert the MIDI file: bad\./ }, empty, () => converters.piano.mockImplementationOnce(() => { throw new Error('bad'); })],
        [{ name: 'clean', tone: 'neutral', downloadable: true, text: /^Converted 1 piano note\.$/ }, empty, converted(false)],
        [{ name: 'hand fallback', tone: 'neutral', downloadable: true, text: /^Converted 1 piano note\.$/, warning: /^⚠ Hands assigned by pitch/ }, empty, converted(true)],
    ];
    it.each(cases)('case %#', async (c, parse, arrange) => {
        arrange();
        const store = createMidiStore({ parse: parse as never });
        render(<MidiPanel store={store} onDownload={noop} />);
        await act(async () => { await store.loadFile(bytes()); });
        expectStatus(c, 'midi');
    });
});
