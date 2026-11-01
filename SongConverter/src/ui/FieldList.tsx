import type { ReactNode } from 'react';

// Label/control rows share one label column, sized to the widest label.
export function FieldList({ children }: { children: ReactNode }) {
    return <div className="ui-field-list">{children}</div>;
}

export function FieldNote({ children }: { children: ReactNode }) {
    return <div className="ui-field ui-field-note"><span>{children}</span></div>;
}
