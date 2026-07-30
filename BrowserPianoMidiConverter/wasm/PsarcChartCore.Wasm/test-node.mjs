// Quick regression check: run PsarcInterop against a real .psarc file under Node,
// against the same Release build `npm run build:wasm` ships from. Rerun this after
// any change to PsarcChartCore/PsarcUtil/Rocksmith2014PsarcLib - `dotnet build -c
// Release` here first if bin/Release isn't already up to date.
import { dotnet } from './bin/Release/net8.0/wwwroot/_framework/dotnet.js';
import { readFileSync, writeFileSync } from 'node:fs';

const psarcPath = process.argv[2];
if (!psarcPath) {
    console.error('Usage: node test-node.mjs <path-to.psarc>');
    process.exit(1);
}

const { getAssemblyExports, getConfig } = await dotnet.create();
const config = getConfig();
const exports = await getAssemblyExports(config.mainAssemblyName);

const bytes = readFileSync(psarcPath);

console.log('--- ConvertAllPsarc ---');
const resultJson = exports.PsarcInterop.ConvertAllPsarc(bytes);
console.log('Result length (chars):', resultJson.length);

const songs = JSON.parse(resultJson);
console.log(`Songs: ${songs.length}`);
for (const song of songs) {
    console.log(`  "${song.SongData.SongName}" by ${song.SongData.ArtistName} - ${song.Parts.length} part(s)`);
    for (const part of song.Parts) {
        const status = part.Part ? 'ok' : `FAILED: ${part.Error}`;
        const noteCount = part.Notes?.Notes?.length ?? part.Vocals?.length ?? 0;
        console.log(`    - ${part.Name}: ${status} (${noteCount} notes/lines)`);
    }
}

writeFileSync('wasm-output.json', resultJson);
console.log('Wrote wasm-output.json');

console.log('\n--- GetAlbumArt ---');
const artBytes = exports.PsarcInterop.GetAlbumArt(bytes, songs[0].SongKey, 256);
if (artBytes.length === 0) {
    console.log('No album art found.');
} else {
    const view = new DataView(artBytes.buffer, artBytes.byteOffset, artBytes.byteLength);
    const width = view.getInt32(0, true);
    const height = view.getInt32(4, true);
    const rgba = artBytes.subarray(8);
    console.log(`Album art: ${width}x${height} (${rgba.length} RGBA bytes, expected ${width * height * 4})`);
    writeFileSync('albumart-test.bmp', rgbaToBmp(width, height, rgba));
    console.log('Wrote albumart-test.bmp - open it to visually confirm colors (checks for R/B channel swap)');
}

// Minimal uncompressed 24bpp BMP writer, just so the decoded pixels can be opened in any
// image viewer for a manual sanity check - no compression/format logic to get wrong here.
function rgbaToBmp(width, height, rgba) {
    const rowSize = Math.ceil((24 * width) / 32) * 4;
    const pixelDataSize = rowSize * height;
    const fileSize = 54 + pixelDataSize;
    const buf = Buffer.alloc(fileSize);

    buf.write('BM', 0);
    buf.writeUInt32LE(fileSize, 2);
    buf.writeUInt32LE(54, 10); // pixel data offset

    buf.writeUInt32LE(40, 14); // DIB header size
    buf.writeInt32LE(width, 18);
    buf.writeInt32LE(height, 22); // positive = bottom-up
    buf.writeUInt16LE(1, 26); // planes
    buf.writeUInt16LE(24, 28); // bits per pixel
    buf.writeUInt32LE(0, 30); // no compression
    buf.writeUInt32LE(pixelDataSize, 34);

    for (let y = 0; y < height; y++) {
        const srcY = height - 1 - y; // BMP rows are bottom-up
        const rowStart = 54 + y * rowSize;
        for (let x = 0; x < width; x++) {
            const srcOffset = (srcY * width + x) * 4;
            const dstOffset = rowStart + x * 3;
            buf[dstOffset] = rgba[srcOffset + 2];     // B
            buf[dstOffset + 1] = rgba[srcOffset + 1]; // G
            buf[dstOffset + 2] = rgba[srcOffset];     // R
        }
    }

    return buf;
}
