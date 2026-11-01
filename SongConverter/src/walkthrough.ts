// Dev-only: `npm run dev`, then /?walkthrough=<dwellMs>[&tab=<id>][&loop] steps every tab through its
// error and status states in the real UI. Loaded by dynamic import behind import.meta.env.DEV.
import { STATE_CASES, type Patch } from './stateCases';

interface Seedable { seed(patch: Record<string, unknown>): void }

const BLANK: Patch = { phase: 'idle', status: '', warnings: [], downloadError: null, formVisible: false };

export interface WalkthroughOptions {
    stores: Record<string, Seedable>;
    dwellMs: number;
    tab: string | null;
    loop: boolean;
    setTab(id: string): void;
    setLabel(label: string | null): void;
    isCancelled(): boolean;
}

export async function runWalkthrough(o: WalkthroughOptions): Promise<void> {
    const ids = Object.keys(STATE_CASES).filter((id) => !o.tab || id === o.tab);
    do {
        for (const id of ids) {
            o.setTab(id);
            const steps = STATE_CASES[id];
            for (const [i, step] of steps.entries()) {
                if (o.isCancelled()) return;
                o.stores[id].seed({ ...BLANK, ...step.patch });
                o.setLabel(`${id} ${i + 1}/${steps.length}: ${step.name}`);
                await new Promise((r) => setTimeout(r, o.dwellMs));
            }
            o.stores[id].seed(BLANK);
        }
    } while (o.loop && !o.isCancelled());
    o.setLabel(null);
}
