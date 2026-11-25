import { useCallback, useEffect, useState } from 'react';
import { loadJSON, mutateCollection, subscribeCollection, withCollectionLock } from '../services/storage';
import { uid } from '../utils/dates';

export function usePersistentCollection(key) {
  const [items, setItems] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [recoveryError, setRecoveryError] = useState(null);

  useEffect(() => {
    let alive = true;
    const unsubscribe = subscribeCollection(key, setItems);
    withCollectionLock(async () => {
      try {
        const stored = await loadJSON(key, null);
        if (alive) {
          setItems(stored ?? []);
          setHydrated(true);
        }
      } catch (error) {
        if (alive) setRecoveryError(error.code || 'COLLECTION_READ_FAILED');
      }
    });
    return () => { alive = false; unsubscribe(); };
  }, [key]);

  const commit = useCallback(async (transform) => {
    if (!hydrated || recoveryError) return false;
    try { return await mutateCollection(key, transform); }
    catch { return false; }
  }, [key, hydrated, recoveryError]);

  const create = useCallback(async (data) => {
    const item = { id: uid(data?.idPrefix || 'x'), ...data };
    delete item.idPrefix;
    return await commit(prev => [item, ...prev]) ? item : null;
  }, [commit]);

  const update = useCallback((id, patch) => commit(prev => {
    if (!prev.some(item => item.id === id)) return null;
    return prev.map(item => item.id === id
      ? { ...item, ...(typeof patch === 'function' ? patch(item) : patch) }
      : item);
  }), [commit]);

  const remove = useCallback(id => commit(prev => {
    const next = prev.filter(item => item.id !== id);
    return next.length !== prev.length ? next : null;
  }), [commit]);

  // Used only after ND-02 has committed and verified all keys.
  return { items, create, update, remove, replaceAll: setItems, hydrated, recoveryError };
}
