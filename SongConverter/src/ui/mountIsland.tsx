import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';

// Mounts a React subtree into an element owned by non-React code.
export function mountIsland(el: HTMLElement, node: ReactNode): () => void {
    const root = createRoot(el);
    root.render(node);
    return () => root.unmount();
}
