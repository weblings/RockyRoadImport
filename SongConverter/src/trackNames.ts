// Whole-word track-name matching shared by the score and MIDI piano paths.
// Substring matching caused false hits (Bassoon->bass, Rhythm->rh,
// Rhodes->rh, Lefty->left, Composer->comp, Misleading->lead), so names are
// tokenized (dots stripped for R.H./L.H., camelCase split, split on
// non-letters which also covers NBSP) and matched as whole tokens against
// per-role alias lists. Plural/suffix forms substring matching got by
// accident are kept as explicit aliases.
export const TRACK_NAME_ALIASES = {
    bass: ['bass', 'contrabass'],
    lead: ['lead'],
    solo: ['solo', 'soloist'],
    rhythm: ['rhythm'],
    chord: ['chord', 'chords'],
    comp: ['comp', 'comping'],
    piano: ['piano', 'pianoforte', 'pno', 'keys'],
    right: ['right', 'rh'],
    left: ['left', 'lh'],
} as const;

export function trackNameTokens(name: string): string[] {
    return name
        .replace(/(?<=[\p{Ll}\p{Nd}])(?=[\p{Lu}])/gu, ' ')
        .toLowerCase()
        .replace(/\./g, '')
        .split(/[^\p{L}]+/u)
        .filter((t) => t.length > 0);
}

export function trackNameHas(name: string, aliases: readonly string[]): boolean {
    const tokens = new Set(trackNameTokens(name));
    return aliases.some((a) => tokens.has(a));
}
