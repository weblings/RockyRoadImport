// Minimal external store: immutable snapshots, so it also fits React's useSyncExternalStore.
export interface Store<S> {
    get(): S;
    set(patch: Partial<S>): void;
    subscribe(fn: () => void): () => void;
}

export function createStore<S>(initial: S): Store<S> {
    let state = initial;
    const subs = new Set<() => void>();
    return {
        get: () => state,
        set(patch) {
            state = { ...state, ...patch };
            subs.forEach((fn) => fn());
        },
        subscribe(fn) {
            subs.add(fn);
            return () => { subs.delete(fn); };
        },
    };
}
