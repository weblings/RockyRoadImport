import { defineConfig } from 'vitest/config';

// Demo builds serve from /RockyRoadImport/ on GitHub Pages, not root.
export default defineConfig({
    base: process.env.VITE_DEMO_MODE === 'true' ? '/RockyRoadImport/' : '/',
    test: { exclude: ['e2e/**', 'node_modules/**'] },
});
