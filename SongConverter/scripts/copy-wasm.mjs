// Copies the published PsarcChartCore.Wasm framework output into public/psarc-wasm/,
// where Vite serves it as a static asset. Run `npm run build:wasm` (requires the .NET 8
// SDK + wasm-tools workload) after changing PsarcChartCore/PsarcUtil/Rocksmith2014PsarcLib.
import { readdirSync, copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
// Plain `dotnet build -c Release`, not `dotnet publish`: publish's IL trimming disables
// System.Text.Json's reflection-based serialization by default (the output types here are
// only ever touched reflectively), and separately hit a native-link error under this SDK.
const srcDir = join(projectRoot, 'wasm', 'PsarcChartCore.Wasm', 'bin', 'Release', 'net8.0', 'wwwroot', '_framework');
const destDir = join(projectRoot, 'public', 'psarc-wasm');

rmSync(destDir, { recursive: true, force: true });
mkdirSync(destDir, { recursive: true });

let count = 0;
for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    // Skip precompressed .br/.gz variants - nothing in this project's dev/build
    // pipeline serves them via content negotiation, so they'd just be dead weight.
    if (entry.name.endsWith('.br') || entry.name.endsWith('.gz')) continue;

    copyFileSync(join(srcDir, entry.name), join(destDir, entry.name));
    count++;
}

console.log(`Copied ${count} files to public/psarc-wasm/`);
