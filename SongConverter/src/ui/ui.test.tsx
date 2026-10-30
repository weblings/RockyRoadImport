// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { Button, FieldList, FieldNote, FileTrigger, TextField } from './index';

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
