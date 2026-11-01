// Builds src/ui/tokens/tokens.json (DTCG) into generated CSS vars and a TS module.
import StyleDictionary from 'style-dictionary';

const out = 'src/ui/tokens/generated/';

const sd = new StyleDictionary({
    source: ['src/ui/tokens/tokens.json'],
    log: { verbosity: 'silent' },
    hooks: {
        transforms: {
            // Dimensions are authored as px numbers (RockyRoad XR converts px / 10 to cm).
            'rri/dimension-px': {
                type: 'value',
                filter: (token) => token.$type === 'dimension',
                transform: (token) => `${token.$value}px`,
            },
            'rri/font-family-css': {
                type: 'value',
                filter: (token) => token.$type === 'fontFamily',
                transform: (token) =>
                    token.$value.map((f) => (/\s/.test(f) ? `'${f}'` : f)).join(', '),
            },
        },
        transformGroups: {
            rri: ['attribute/cti', 'name/kebab', 'rri/dimension-px', 'rri/font-family-css'],
            'rri-ts': ['attribute/cti', 'name/camel', 'rri/dimension-px', 'rri/font-family-css'],
        },
    },
    platforms: {
        css: {
            transformGroup: 'rri',
            buildPath: out,
            files: [{ destination: 'tokens.css', format: 'css/variables', options: { outputReferences: true } }],
        },
        ts: {
            transformGroup: 'rri-ts',
            buildPath: out,
            files: [{ destination: 'tokens.ts', format: 'javascript/es6' }],
        },
    },
});

await sd.buildAllPlatforms();
