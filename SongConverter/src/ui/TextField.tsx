import { Input, Label, TextField as AriaTextField } from 'react-aria-components';

export interface TextFieldProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    id?: string;
}

export function TextField({ label, value, onChange, id }: TextFieldProps) {
    return (
        <AriaTextField className="ui-field" value={value} onChange={onChange}>
            <Label className="ui-field-label">{label}</Label>
            <Input id={id} className="ui-text-input" size={40} />
        </AriaTextField>
    );
}
