import type { ReactNode } from 'react';
import { Tab, TabList, TabPanel, Tabs as AriaTabs } from 'react-aria-components';

export interface TabItem {
    id: string;
    label: string;
    content: ReactNode;
}

export interface TabsProps {
    label: string;
    tabs: TabItem[];
}

// Panels are force-mounted so each keeps its local state while hidden.
export function Tabs({ label, tabs }: TabsProps) {
    return (
        <AriaTabs>
            <TabList className="ui-tab-list" aria-label={label}>
                {tabs.map((t) => <Tab key={t.id} id={t.id} className="ui-tab">{t.label}</Tab>)}
            </TabList>
            {tabs.map((t) => (
                <TabPanel key={t.id} id={t.id} className="ui-tab-panel" shouldForceMount>{t.content}</TabPanel>
            ))}
        </AriaTabs>
    );
}
