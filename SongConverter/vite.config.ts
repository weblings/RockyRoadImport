import { defineConfig } from 'vite';

// Demo builds serve from /RockyRoadImport/ on GitHub Pages, not root.
export default defineConfig({
    base: process.env.VITE_DEMO_MODE === 'true' ? '/RockyRoadImport/' : '/',
});
