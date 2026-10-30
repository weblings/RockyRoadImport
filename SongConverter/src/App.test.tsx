// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { App } from './App';

// midi-json-parser needs a real worker at import time.
vi.mock('midi-json-parser', () => ({ parseArrayBuffer: vi.fn() }));

afterEach(cleanup);

describe('App shell', () => {
    it('moves between tabs with arrow keys', async () => {
        render(<App />);
        const first = screen.getByRole('tab', { name: 'Piano MIDI' });
        first.focus();
        await userEvent.keyboard('{ArrowRight}');
        const second = screen.getByRole('tab', { name: 'Rocksmith 2014' });
        expect(document.activeElement).toBe(second);
        expect(second.getAttribute('aria-selected')).toBe('true');
    });

    it('has no axe violations', async () => {
        const { container } = render(<App />);
        expect((await axe(container)).violations).toEqual([]);
    });
});
