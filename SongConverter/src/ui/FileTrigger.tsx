import { useId } from 'react';
import { FileTrigger as AriaFileTrigger } from 'react-aria-components';
import { Button } from './Button';

export interface FileTriggerProps {
    label: string;
    accept: string[];
    // Shown beside the button. Comes from the caller's state because the hidden input can't be refilled.
    fileName: string | null;
    onSelect: (file: File | null) => void;
    // Inline pickers have no visible row label, so the label is only announced.
    layout?: 'field' | 'inline';
}

export function FileTrigger({ label, accept, fileName, onSelect, layout = 'field' }: FileTriggerProps) {
    const labelId = useId();
    return (
        <div className="ui-field ui-file-trigger" data-layout={layout}>
            <span id={labelId} className="ui-field-label">{label}</span>
            <div className="ui-file-trigger-control">
                <AriaFileTrigger acceptedFileTypes={accept} onSelect={(files) => onSelect(files?.item(0) ?? null)}>
                    <Button aria-labelledby={labelId}>Choose File</Button>
                </AriaFileTrigger>
                <span className="ui-file-name">{fileName ?? 'No file chosen'}</span>
            </div>
        </div>
    );
}
