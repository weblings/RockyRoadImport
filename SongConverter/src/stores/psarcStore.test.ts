import { describe, it, expect, vi } from 'vitest';
import { strFromU8 } from 'fflate';
import { createPsarcStore, type PsarcDeps } from './psarcStore';

vi.mock('../version', () => ({ GENERATED_BY: 'RockyRoadImport_vTEST' }));

function songJson(name: string): string {
    return JSON.stringify([{
        SongKey: name,
        SongData: { SongName: name, ArtistName: 'Artist', AlbumName: 'Album', InstrumentParts: [] },
        Structure: { Sections: [] },
        Parts: [{ Name: 'lead', Part: { InstrumentName: 'lead' }, Notes: { Notes: [] } }],
    }]);
}

// The fake wasm echoes the file's text as the song name, so each pick is distinguishable.
function fakeExports() {
    return {
        PsarcInterop: {
            ConvertAllPsarc: (bytes: Uint8Array) => songJson(new TextDecoder().decode(bytes)),
            GetOggAudio: () => new Uint8Array(),
        },
    };
}

function deferred<T>() {
    let resolve!: (v: T) => void;
    const promise = new Promise<T>((r) => { resolve = r; });
    return { promise, resolve };
}

const file = (name: string) => new File([name], `${name}.psarc`);

describe('psarc store async behavior', () => {
    it('does not hand the previous song\'s art to a newer pick', async () => {
        const artA = deferred<Uint8Array | null>();
        const fetchAlbumArt = vi.fn<PsarcDeps['fetchAlbumArt']>(async (_e, _b, key) =>
            key === 'A' ? artA.promise : new Uint8Array([66]));
        const store = createPsarcStore({ loadWasm: async () => fakeExports(), fetchAlbumArt });

        await store.loadFile(file('A'));
        await store.loadFile(file('B'));
        artA.resolve(new Uint8Array([65]));

        const files = await store.buildFiles();
        expect(files!['albumart.png']).toEqual(new Uint8Array([66]));
        expect(JSON.parse(strFromU8(files!['song.json'])).SongName).toBe('B');
    });

    it('waits for album art when Download is clicked before the fetch resolves', async () => {
        const art = deferred<Uint8Array | null>();
        const store = createPsarcStore({
            loadWasm: async () => fakeExports(),
            fetchAlbumArt: () => art.promise,
        });
        await store.loadFile(file('A'));
        expect(store.get().phase).toBe('ready');

        const pending = store.buildFiles();
        art.resolve(new Uint8Array([1, 2, 3]));
        expect((await pending)!['albumart.png']).toEqual(new Uint8Array([1, 2, 3]));
    });

    it('still builds without art when the art fetch fails', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const store = createPsarcStore({
            loadWasm: async () => fakeExports(),
            fetchAlbumArt: async () => { throw new Error('no dds'); },
        });
        await store.loadFile(file('A'));
        const files = await store.buildFiles();
        expect(files).not.toBeNull();
        expect(files!['albumart.png']).toBeUndefined();
    });

    it('drops a slower earlier parse that finishes after a newer pick', async () => {
        const wasmA = deferred<any>();
        let calls = 0;
        const store = createPsarcStore({
            loadWasm: () => (++calls === 1 ? wasmA.promise : Promise.resolve(fakeExports())),
            fetchAlbumArt: async () => null,
        });

        const first = store.loadFile(file('A'));
        await store.loadFile(file('B'));
        wasmA.resolve(fakeExports());
        await first;

        expect(store.get().meta.songName).toBe('B');
    });
});
