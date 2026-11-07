// Fails if app code imports React Aria directly. Grille's wrappers are the stable API.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const importRe = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]/g;

function* walk(dir) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) yield* walk(p);
        else if (/\.tsx?$/.test(e.name)) yield p;
    }
}

const errors = [];
for (const file of walk(resolve('src'))) {
    for (const m of readFileSync(file, 'utf8').matchAll(importRe)) {
        const spec = m[1] ?? m[2];
        if (/^(react-aria|@react-aria\/|react-stately|@react-stately\/|@react-types\/)/.test(spec)) {
            errors.push(`${relative(process.cwd(), file)}: '${spec}' must come from @weblings/grille`);
        }
    }
}

if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
}
console.log('react-aria imports ok');
