import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

// Screenshot baselines are per-platform (win32 here), and the local font makes them
// approximate. Loaded states use the committed fixtures. .psarc has no loaded state
// because there is no redistributable fixture.
const fixture = (name: string) => fileURLToPath(new URL(`../src/fixtures/${name}`, import.meta.url));

const tabs = [
    { id: 'midi', input: 'input[type="file"]', file: 'piano-three-notes.mid', ready: '#midi-download-all' },
    { id: 'gp', input: 'input[type="file"]', file: 'guitar-three-notes.musicxml', ready: '#gp-download-all' },
    { id: 'musicxml', input: 'input[type="file"]', file: 'piano-grand-staff.musicxml', ready: '#musicxml-download-all' },
    { id: 'psarc', input: null, file: null, ready: null },
] as const;

const tabNames: Record<string, string> = { midi: 'Piano MIDI', psarc: 'Rocksmith 2014', gp: 'Guitar Pro', musicxml: 'MusicXML' };

async function openTab(page: Page, id: string) {
    await page.goto('/');
    await page.getByRole('tab', { name: tabNames[id] }).click();
}

for (const t of tabs) {
    test(`${t.id} empty`, async ({ page }) => {
        await openTab(page, t.id);
        await expect(page).toHaveScreenshot(`${t.id}-empty.png`);
    });

    if (!t.input) continue;
    test(`${t.id} loaded`, async ({ page }) => {
        await openTab(page, t.id);
        await page.getByRole('tabpanel').locator(t.input).setInputFiles(fixture(t.file));
        await expect(page.locator(t.ready)).toBeEnabled();
        await expect(page).toHaveScreenshot(`${t.id}-loaded.png`);
    });
}

test.describe('musicxml lyrics picker', () => {
    async function load(page: Page) {
        await openTab(page, 'musicxml');
        await page.getByRole('tabpanel').locator('input[type="file"]').setInputFiles(fixture('multi-lyrics.musicxml'));
        const trigger = page.getByRole('button', { name: /Lyrics from/ });
        await expect(trigger).toBeVisible();
        return trigger;
    }

    test('open list', async ({ page }) => {
        const trigger = await load(page);
        await trigger.click();
        await expect(page.getByRole('option', { name: 'Harmony' })).toBeVisible();
        await expect(page).toHaveScreenshot('musicxml-lyrics-open.png');
    });

    test('click commits the choice', async ({ page }) => {
        const trigger = await load(page);
        await trigger.click();
        await page.getByRole('option', { name: 'Harmony' }).click();
        await expect(trigger).toContainText('Harmony');
    });

    test('arrows on the closed trigger leave the value alone', async ({ page }) => {
        const trigger = await load(page);
        await expect(trigger).toContainText('Lead Vocals');
        await trigger.focus();
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowRight');
        await expect(trigger).toContainText('Lead Vocals');
    });

    test('keyboard commit with Enter, Escape cancels, focus returns', async ({ page }) => {
        const trigger = await load(page);
        await trigger.focus();
        await page.keyboard.press('Enter');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Escape');
        await expect(trigger).toBeFocused();
        await expect(trigger).toContainText('Lead Vocals');

        await page.keyboard.press('Enter');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        await expect(trigger).toBeFocused();
        await expect(trigger).toContainText('Backing Vocals');
    });
});

test.describe('tab keyboard', () => {
    test('arrows move tabs and Tab lands inside the active panel', async ({ page }) => {
        await page.goto('/');
        await page.getByRole('tab', { name: 'Piano MIDI' }).focus();
        await page.keyboard.press('ArrowRight');
        await expect(page.getByRole('tab', { name: 'Rocksmith 2014' })).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(page.getByRole('tabpanel').locator(':focus')).toHaveCount(1);
    });
});
