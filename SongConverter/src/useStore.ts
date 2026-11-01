import { useSyncExternalStore } from 'react';
import type { Store } from './stores/store';

export function useStore<S>(store: Pick<Store<S>, 'get' | 'subscribe'>): S {
    return useSyncExternalStore(store.subscribe, store.get);
}
