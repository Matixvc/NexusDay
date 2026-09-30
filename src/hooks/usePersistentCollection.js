import { useCallback, useEffect, useRef, useState } from 'react';
import { loadJSON, saveJSON } from '../services/storage';
import { uid } from '../utils/dates';

/**
 * A JSON array persisted to AsyncStorage under `key`.
 *
 * - Hydrates once on mount, then mirrors every change back to storage.
 * - Writes are skipped until hydration finishes, so the initial value can
 *   never overwrite data already on the device.
 *
 * Returns CRUD helpers operating on `{ id }` shaped objects.
 */
export function usePersistentCollection(key, initialValue = []) {
  const [items, setItems] = useState(initialValue);
  const [hydrated, setHydrated] = useState(false);
  const initialRef = useRef(initialValue);

  useEffect(() => {
    let alive = true;
    (async () => {
      const stored = await loadJSON(key, initialRef.current);
      if (!alive) return;
      setItems(stored);
      setHydrated(true);
    })();
    return () => {
      alive = false;
    };
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    saveJSON(key, items);
  }, [key, items, hydrated]);

  const create = useCallback((data) => {
    const item = { id: uid(data?.idPrefix || 'x'), ...data };
    delete item.idPrefix;
    setItems((prev) => [item, ...prev]);
    return item;
  }, []);

  const update = useCallback((id, patch) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const remove = useCallback((id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const replaceAll = useCallback((next) => {
    setItems(next);
  }, []);

  return { items, setItems, create, update, remove, replaceAll, hydrated };
}
