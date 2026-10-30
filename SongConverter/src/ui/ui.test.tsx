// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { Button, Callout, Disclosure, FieldList, FieldNote, FileTrigger, Select, Slider, TextField } from './index';

afterEach(cleanup);

async function expectNoViolations(container: HTMLElement) {
    const results = await axe(container);
    expect(results.violations).toEqual([]);
}

describe('Button', () => {
    it('fires onPress and respects isDisabled', async () => {
        const onPress = vi.fn();
        const { rerender } = render(<Button onPress={onPress}>Go</Button>);
        await userEvent.click(screen.getByRole('button', { name: 'Go' }));
        expect(onPress).toHaveBeenCalledTimes(1);

        rerender(<Button isDisabled onPress={onPress}>Go</Button>);
        await userEvent.click(screen.getByRole('button', { name: 'Go' }));
        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('has no axe violations', async () => {
        const { container } = render(<Button variant="primary">Download</Button>);
        await expectNoViolations(container);
    });
});

describe('TextField', () => {
    it('is named by its label and reports typed values', async () => {
        const onChange = vi.fn();
        render(<TextField label="Artist" value="" onChange={onChange} />);
        await userEvent.type(screen.getByRole('textbox', { name: 'Artist' }), 'A');
        expect(onChange).toHaveBeenLastCalledWith('A');
    });

    it('has no axe violations', async () => {
        const { container } = render(<FieldList><TextField label="Artist" value="x" onChange={() => {}} /></FieldList>);
        await expectNoViolations(container);
    });
});

describe('FileTrigger', () => {
    it('shows the filename from props and a placeholder when empty', () => {
        const { rerender } = render(<FileTrigger label="Audio" accept={['.ogg']} fileName={null} onSelect={() => {}} />);
        expect(screen.getByText('No file chosen')).toBeTruthy();
        rerender(<FileTrigger label="Audio" accept={['.ogg']} fileName="song.ogg" onSelect={() => {}} />);
        expect(screen.getByText('song.ogg')).toBeTruthy();
    });

    it('passes the chosen file to onSelect', async () => {
        const onSelect = vi.fn();
        const { container } = render(<FileTrigger label="Audio" accept={['.ogg']} fileName={null} onSelect={onSelect} />);
        const file = new File(['x'], 'song.ogg', { type: 'audio/ogg' });
        await userEvent.upload(container.querySelector('input[type="file"]')!, file);
        expect(onSelect).toHaveBeenCalledWith(file);
    });

    it('has no axe violations', async () => {
        const { container } = render(
            <FieldList>
                <FileTrigger label="Audio" accept={['.ogg']} fileName="song.ogg" onSelect={() => {}} />
                <FieldNote>*Audio must be .ogg format.</FieldNote>
            </FieldList>,
        );
        await expectNoViolations(container);
    });
});

describe('Select', () => {
    const options = ['Vocals', 'Backing', 'Harmony'];

    it('fires onChange once when an option is picked from the open list', async () => {
        const onChange = vi.fn();
        render(<Select label="Lyrics from" options={options} value="Vocals" onChange={onChange} />);
        await userEvent.click(screen.getByRole('button', { name: /Lyrics from/ }));
        await userEvent.click(screen.getByRole('option', { name: 'Backing' }));
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith('Backing');
    });

    it('does not fire onChange for arrow keys on the closed trigger', async () => {
        const onChange = vi.fn();
        render(<Select label="Lyrics from" options={options} value="Vocals" onChange={onChange} />);
        screen.getByRole('button', { name: /Lyrics from/ }).focus();
        await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowLeft}');
        expect(onChange).not.toHaveBeenCalled();
    });

    it('has no axe violations', async () => {
        const { container } = render(<FieldList><Select label="Lyrics from" options={options} value="Vocals" onChange={() => {}} /></FieldList>);
        await expectNoViolations(container);
    });
});

describe('Slider', () => {
    it('steps with arrow keys and reports numeric values', async () => {
        const onChange = vi.fn();
        render(<Slider label="Difficulty" min={0} max={5} step={0.5} value={1} onChange={onChange} />);
        screen.getByRole('slider').focus();
        await userEvent.keyboard('{ArrowRight}');
        expect(onChange).toHaveBeenCalledWith(1.5);
    });

    it('has no axe violations', async () => {
        const { container } = render(<FieldList><Slider label="Difficulty" min={0} max={5} step={0.5} value={1} onChange={() => {}} /></FieldList>);
        await expectNoViolations(container);
    });
});

describe('Disclosure', () => {
    it('toggles its panel from the trigger', async () => {
        render(<Disclosure title="Show log"><p>log text</p></Disclosure>);
        const trigger = screen.getByRole('button', { name: 'Show log' });
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
        await userEvent.click(trigger);
        expect(trigger.getAttribute('aria-expanded')).toBe('true');
        expect(screen.getByText('log text')).toBeTruthy();
    });

    it('has no axe violations', async () => {
        const { container } = render(<Disclosure title="Show log"><p>log text</p></Disclosure>);
        await expectNoViolations(container);
    });
});

describe('Callout', () => {
    it('renders as a note with its title and body', () => {
        render(<Callout title="Heads up"><p>details</p></Callout>);
        expect(screen.getByRole('note').textContent).toContain('Heads up');
        expect(screen.getByText('details')).toBeTruthy();
    });

    it('has no axe violations', async () => {
        const { container } = render(<Callout title="Heads up"><p>details</p></Callout>);
        await expectNoViolations(container);
    });
});
