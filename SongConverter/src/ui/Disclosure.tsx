import type { ReactNode } from 'react';
import { Button, Disclosure as AriaDisclosure, DisclosurePanel, Heading } from 'react-aria-components';

export interface DisclosureProps {
    title: string;
    children: ReactNode;
}

export function Disclosure({ title, children }: DisclosureProps) {
    return (
        <AriaDisclosure className="ui-disclosure">
            <Heading className="ui-disclosure-heading">
                <Button slot="trigger" className="ui-disclosure-trigger">{title}</Button>
            </Heading>
            <DisclosurePanel className="ui-disclosure-panel">{children}</DisclosurePanel>
        </AriaDisclosure>
    );
}
