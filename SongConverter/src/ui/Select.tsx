import { useRef } from 'react';
import { Button, ListBox, ListBoxItem, Popover, Select as AriaSelect, SelectValue, Label } from 'react-aria-components';

export interface SelectProps {
    label: string;
    options: string[];
    value: string;
    // Fires only for a choice made in the open list, never for arrow keys on the closed trigger.
    onChange: (value: string) => void;
}

export function Select({ label, options, value, onChange }: SelectProps) {
    const open = useRef(false);
    return (
        <AriaSelect
            className="ui-field ui-select"
            selectedKey={value}
            onOpenChange={(o) => { open.current = o; }}
            onSelectionChange={(key) => { if (open.current && key !== null) onChange(String(key)); }}
        >
            <Label className="ui-field-label">{label}</Label>
            <Button className="ui-select-trigger"><SelectValue /><span aria-hidden="true">▾</span></Button>
            <Popover className="ui-popover">
                <ListBox className="ui-listbox">
                    {options.map((o) => <ListBoxItem key={o} id={o} className="ui-option">{o}</ListBoxItem>)}
                </ListBox>
            </Popover>
        </AriaSelect>
    );
}
