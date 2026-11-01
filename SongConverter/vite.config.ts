import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Demo builds serve from /RockyRoadImport/ on GitHub Pages, not root.
export default defineConfig({
    base: process.env.VITE_DEMO_MODE === 'true' ? '/RockyRoadImport/' : '/',
    plugins: [react()],
    test: { exclude: ['e2e/**', 'node_modules/**'] },
});
