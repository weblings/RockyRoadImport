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
