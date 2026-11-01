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
import { BAD, FAILED_BASS, FAILED_LEAD, STATE_CASES, type StateCase } from './stateCases';

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
const track = (trackName: string) => ({ trackName });
const noop = () => {};
const boom = () => { throw BAD; };

// Each tab's cases (src/stateCases.ts) name the store state a file should land on. Here every
// reachable case is arranged through the real store and checked in state and in the rendered panel.
function expectCase(c: StateCase, tab: string, store: { get(): any }) {
    const p = c.patch as { phase: string; status: string; warnings: string[] };
    const state = store.get();
    expect({ phase: state.phase, status: state.status, warnings: state.warnings }).toEqual({ phase: p.phase, status: p.status, warnings: p.warnings });

    // Not getByRole: the MIDI slider's <output> also has the status role.
    const status = document.getElementById(`${tab}-status`)!;
    expect(status.getAttribute('data-tone')).toBe(p.phase === 'error' ? 'error' : 'neutral');
    expect(status.textContent).toBe(p.status && `${p.phase === 'error' ? '✖ ' : ''}${p.status}`);
    expect(document.getElementById(`${tab}-warnings`)!.textContent).toBe(p.warnings.length ? `⚠ ${p.warnings.join(' ')}` : '');
    expect(screen.getByRole('button', { name: 'Download' }).hasAttribute('disabled')).toBe(p.phase !== 'ready');
}

// Arrangers are keyed by case name; a case with neither an arranger nor seedOnly fails the suite.
type Arrange = () => unknown;
function runCases(tab: string, arrangers: Record<string, Arrange>, make: (arranged: unknown) => { store: any; render: () => void }) {
    const cases = STATE_CASES[tab];
    it('covers every case', () => {
        expect(Object.keys(arrangers).sort()).toEqual(cases.filter((c) => !c.seedOnly).map((c) => c.name).sort());
    });
    it.each(cases.filter((c) => !c.seedOnly).map((c) => [c.name, c] as const))('%s', async (name, c) => {
        const arranged = await arrangers[name]();
        const { store, render: draw } = make(arranged);
        draw();
        await act(async () => { await store.loadFile(bytes()); });
        expectCase(c, tab, store);
    });
}

describe('Guitar Pro states', () => {
    const gp = (result: object) => () => { converters.gp.mockReturnValue({ songName: 'S', artistName: 'A', skipped: [], pianoTracks: [], tracks: [], ...result }); };
    runCases('gp', {
        'parse failure': () => { converters.gp.mockImplementation(boom); },
        'no tracks': gp({}),
        'only skipped tracks': gp({ skipped: ['Drums'], pianoTracks: [track('Piano')] }),
        clean: gp({ tracks: [track('Lead'), track('Bass')] }),
        'skipped warning': gp({ tracks: [track('Lead')], skipped: ['Drums'] }),
    }, () => {
        const store = createGpStore();
        return { store, render: () => render(<GpPanel store={store} onDownload={noop} />) };
    });
});

describe('MusicXML states', () => {
    const xml = (result: object) => () => { converters.musicXml.mockReturnValue({ songName: 'S', artistName: 'A', skipped: [], pianoTracks: [], lyrics: [], tracks: [track('Lead')], ...result }); };
    const lyric = (trackName: string) => ({ trackName, vocals: [{}] });
    runCases('musicxml', {
        'parse failure': () => { converters.musicXml.mockImplementation(boom); },
        'no tracks': xml({ tracks: [] }),
        'only skipped tracks': xml({ tracks: [], skipped: ['Drums'] }),
        'clean (blank status)': xml({}),
        'skipped warning': xml({ skipped: ['Drums'] }),
        'piano hand fallback warning': xml({ pianoTracks: [{ trackName: 'Piano', usedHandFallback: true, notes: { Notes: [{}] } }] }),
        'several lyric tracks': xml({ lyrics: [lyric('Vocals 1'), lyric('Vocals 2')] }),
    }, () => {
        const store = createMusicXmlStore();
        return { store, render: () => render(<MusicXmlPanel store={store} onDownload={noop} />) };
    });
});

describe('Rocksmith states', () => {
    const part = (Name: string, ok = true, Error?: string) => ({ Name, Part: ok ? { InstrumentName: Name } : null, Error });
    const song = (parts: object[]) => ({
        SongKey: 'k', SongData: { SongName: 'S', ArtistName: 'A', AlbumName: 'B', InstrumentParts: [] },
        Structure: { Sections: [] }, Parts: parts,
    });
    const failedLead = part(FAILED_LEAD.Name, false, FAILED_LEAD.Error);
    const failedBass = part(FAILED_BASS.Name, false);
    runCases('psarc', {
        'parse failure': () => ({ throws: true }),
        'no arrangements': () => [],
        'all failed': () => [song([failedLead, failedBass])],
        clean: () => [song([part('Lead'), part('Bass')])],
        'partial failure + extra song': () => [song([failedLead, part('Bass')]), song([part('Lead')])],
    }, (arranged) => {
        const a = arranged as { throws?: boolean } | object[];
        const store = createPsarcStore({
            loadWasm: async () => ({ PsarcInterop: {
                ConvertAllPsarc: () => { if (!Array.isArray(a)) throw BAD; return JSON.stringify(a); },
                GetOggAudio: () => new Uint8Array(),
            } }),
            fetchAlbumArt: async () => null,
        });
        return { store, render: () => render(<PsarcPanel store={store} onDownload={noop} />) };
    });
});

describe('MIDI states', () => {
    const empty = async () => ({ tracks: [[]], division: 480 });
    const converted = (usedHandFallback: boolean) => () =>
        converters.piano.mockReturnValueOnce({ keyboardNotes: { Notes: Array.from({ length: 42 }, () => ({})) }, usedHandFallback });
    const withParse = (parse: () => Promise<unknown>, arrange: () => void = () => {}) => () => { arrange(); return parse; };
    runCases('midi', {
        'parse failure': withParse(async () => { throw BAD; }),
        'no piano notes': withParse(empty),
        'conversion failure': withParse(empty, () => converters.piano.mockImplementationOnce(boom)),
        clean: withParse(empty, converted(false)),
        'hand fallback warning': withParse(empty, converted(true)),
    }, (parse) => {
        const store = createMidiStore({ parse: parse as never });
        return { store, render: () => render(<MidiPanel store={store} onDownload={noop} />) };
    });
});
