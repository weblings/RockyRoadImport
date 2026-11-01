// Browser-only .psarc wasm plumbing. Conversion logic lives in the reused C# (PsarcChartCore).

declare global {
    interface Window {
        __psarcDotnet?: any;
    }
}

// Vite's dev server refuses to serve public/ .js files through import(), so load it via a
// real <script type="module"> tag, which the browser resolves natively over plain HTTP.
function loadDotnetViaScriptTag(): Promise<any> {
    return new Promise((resolve, reject) => {
        if (window.__psarcDotnet) {
            resolve(window.__psarcDotnet);
            return;
        }

        // Raw string, so Vite won't rewrite it — prefix with BASE_URL ourselves.
        const base = import.meta.env.BASE_URL;
        const script = document.createElement('script');
        script.type = 'module';
        script.textContent = `
            import { dotnet } from '${base}psarc-wasm/dotnet.js';
            window.__psarcDotnet = dotnet;
            window.dispatchEvent(new Event('psarc-dotnet-ready'));
        `;
        window.addEventListener('psarc-dotnet-ready', () => resolve(window.__psarcDotnet), { once: true });
        script.onerror = () => reject(new Error(`Failed to load ${base}psarc-wasm/dotnet.js`));
        document.head.appendChild(script);
    });
}

let exportsPromise: Promise<any> | null = null;
let loaded = false;

export const isPsarcWasmLoaded = (): boolean => loaded;

// Loaded lazily and once, so MIDI-only users never pay for it.
export function loadPsarcWasm(): Promise<any> {
    exportsPromise ??= (async () => {
        const dotnet = await loadDotnetViaScriptTag();
        const { getAssemblyExports, getConfig } = await dotnet.create();
        const exports = await getAssemblyExports(getConfig().mainAssemblyName);
        loaded = true;
        return exports;
    })().catch((err) => {
        exportsPromise = null;
        throw err;
    });
    return exportsPromise;
}

// GetAlbumArt returns raw decoded pixels ([width][height][RGBA8...]). PNG encoding happens here
// via OffscreenCanvas because the wasm build has no System.Drawing.
export async function fetchAlbumArtPng(exports: any, psarcBytes: Uint8Array, songKey: string): Promise<Uint8Array | null> {
    const raw: Uint8Array = exports.PsarcInterop.GetAlbumArt(psarcBytes, songKey, 256);
    if (!raw || raw.length === 0) return null;

    const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    const width = view.getInt32(0, true);
    const height = view.getInt32(4, true);
    const rgba = new Uint8ClampedArray(raw.buffer as ArrayBuffer, raw.byteOffset + 8, width * height * 4);

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.putImageData(new ImageData(rgba, width, height), 0, 0);

    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return new Uint8Array(await blob.arrayBuffer());
}
