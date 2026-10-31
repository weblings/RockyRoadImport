import type { ReactNode } from 'react';

export interface StatusMessageProps {
    id?: string;
    tone?: 'neutral' | 'warning' | 'error';
    // Assertive announcement for feedback to an action the user just took.
    urgent?: boolean;
    children?: ReactNode;
}

// The live region stays mounted while empty so screen readers announce text that appears later.
export function StatusMessage({ id, tone = 'neutral', urgent = false, children }: StatusMessageProps) {
    return (
        <div
            id={id}
            className="ui-status-message"
            data-tone={tone}
            role={urgent ? 'alert' : 'status'}
            aria-live={urgent ? 'assertive' : 'polite'}
        >
            {tone !== 'neutral' && children ? <span aria-hidden="true">{tone === 'error' ? '✖' : '⚠'} </span> : null}
            {children}
        </div>
    );
}
