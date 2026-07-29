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

console.log('--- ListArrangements ---');
const arrangementsJson = exports.PsarcInterop.ListArrangements(bytes);
console.log(arrangementsJson);

const arrangements = JSON.parse(arrangementsJson);
const lead = arrangements.find(a => a.InstrumentType === 'LeadGuitar') ?? arrangements[0];
console.log('\nConverting arrangement:', lead.Name, lead.InstrumentType);

console.log('\n--- ConvertPsarc ---');
const resultJson = exports.PsarcInterop.ConvertPsarc(bytes, lead.Name);
console.log('Result length (chars):', resultJson.length);

writeFileSync('wasm-output.json', resultJson);
console.log('Wrote wasm-output.json');
