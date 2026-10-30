import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

// Screenshot baselines are per-platform (win32 here), and the local font makes them
// approximate. Loaded states use the committed fixtures. .psarc has no loaded state
// because there is no redistributable fixture.
const fixture = (name: string) => fileURLToPath(new URL(`../src/fixtures/${name}`, import.meta.url));

const tabs = [
    { id: 'midi', input: '#midi-input', file: 'piano-three-notes.mid', ready: '#download-all' },
    { id: 'gp', input: '#gp-island input[type="file"]', file: 'guitar-three-notes.musicxml', ready: '#gp-download-all' },
    { id: 'musicxml', input: '#musicxml-input', file: 'piano-grand-staff.musicxml', ready: '#musicxml-download-all' },
    { id: 'psarc', input: null, file: null, ready: null },
] as const;

async function openTab(page: Page, id: string) {
    await page.goto('/');
    await page.click(`.tab-btn[data-tab="${id}"]`);
}

for (const t of tabs) {
    test(`${t.id} empty`, async ({ page }) => {
        await openTab(page, t.id);
        await expect(page).toHaveScreenshot(`${t.id}-empty.png`);
    });

    if (!t.input) continue;
    test(`${t.id} loaded`, async ({ page }) => {
        await openTab(page, t.id);
        await page.setInputFiles(t.input, fixture(t.file));
        await expect(page.locator(t.ready)).toBeEnabled();
        await expect(page).toHaveScreenshot(`${t.id}-loaded.png`);
    });
}
