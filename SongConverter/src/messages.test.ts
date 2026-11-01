import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { failure, plural } from './messages';

describe('messages', () => {
    it('formats failures as Couldn\'t <action>: <reason>.', () => {
        expect(failure('read the MIDI file', new Error('bad header.'))).toBe("Couldn't read the MIDI file: bad header.");
    });
    it('never leaves the reason blank', () => {
        expect(failure('read the MIDI file', new Error(''))).toBe("Couldn't read the MIDI file: unknown error.");
        expect(failure('read the MIDI file', { message: 'x' })).toBe("Couldn't read the MIDI file: unknown error.");
    });
    it('pluralizes', () => {
        expect(plural(1, 'track')).toBe('1 track');
        expect(plural(2, 'track')).toBe('2 tracks');
    });
});

// Copy lives in messages.ts; a store or component spelling it out again drifts out of voice.
describe('copy lives in messages.ts', () => {
    const banned = [/Could not/, /Error parsing/, /Conversion error/, /Download failed/, /Failed to load/, /[a-z]\(s\)/, /Loading wasm/];
    const dirs = ['.', 'stores'].map((d) => join(__dirname, d));
    const files = dirs.flatMap((d) =>
        readdirSync(d).filter((f) => /\.tsx?$/.test(f) && !/\.test\.|^messages\.ts$|^playground/.test(f)).map((f) => join(d, f)));
    it.each(files)('%s', (file) => {
        const text = readFileSync(file, 'utf8');
        for (const re of banned) expect(text, `${file} matches ${re}`).not.toMatch(re);
    });
});
