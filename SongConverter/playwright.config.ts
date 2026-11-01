import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: 'e2e',
    use: { baseURL: 'http://localhost:5173', viewport: { width: 900, height: 900 } },
    webServer: { command: 'npm run dev -- --port 5173', url: 'http://localhost:5173', reuseExistingServer: true },
    expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01 } },
});
