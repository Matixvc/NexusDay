import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { KEYS, loadJSONStrict, saveJSONStrict } from '../services/storage';
import { createRoutineRepository } from '../services/routines';
import { uid } from '../utils/dates';

export function useRoutineCollection() {
  const repository = useMemo(() => createRoutineRepository({
    read: () => loadJSONStrict(KEYS.routines),
    write: (items) => saveJSONStrict(KEYS.routines, items),
    createId: () => uid('routine'),
  }), []);
  const state = useSyncExternalStore(repository.subscribe, repository.getSnapshot, repository.getSnapshot);
  useEffect(() => { repository.hydrate(); }, [repository]);
  return { ...state, ...repository };
}
