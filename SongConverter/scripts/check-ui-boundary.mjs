// Fails if src/ui imports anything outside itself except the allowed packages.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const root = resolve('src/ui');
const allowed = ['react', 'react-dom', 'react-aria-components'];
const testOnly = ['vitest', 'vitest-axe', '@testing-library/'];
const importRe = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|@import\s*['"]([^'"]+)['"]/g;

function* walk(dir) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) yield* walk(p);
        else if (/\.(tsx?|css)$/.test(e.name)) yield p;
    }
}

const errors = [];
for (const file of walk(root)) {
    const isTest = /\.test\.tsx?$/.test(file);
    for (const m of readFileSync(file, 'utf8').matchAll(importRe)) {
        const spec = m[1] ?? m[2] ?? m[3];
        const rel = relative(process.cwd(), file);
        if (spec.startsWith('.')) {
            const target = resolve(file, '..', spec);
            if (target !== root && !target.startsWith(root + sep)) errors.push(`${rel}: '${spec}' escapes src/ui`);
        } else {
            const pkg = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
            const ok = allowed.includes(pkg) || (isTest && testOnly.some((t) => spec === t || spec.startsWith(t)));
            if (!ok) errors.push(`${rel}: package '${spec}' is not allowed in src/ui`);
        }
    }
}

if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
}
console.log('src/ui boundary ok');
