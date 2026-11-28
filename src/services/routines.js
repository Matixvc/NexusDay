import { weekdayIndex } from '../utils/dates';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
export const ROUTINE_ICONS = ['checkCircle', 'calendar', 'heart', 'star', 'clock'];
const COLOR_PATTERN = /^#[\da-fA-F]{6}$/;
const MAX_ALARM_LEAD_MINUTES = 7 * 24 * 60;

function validDateKey(value) {
  if (!DATE_PATTERN.test(String(value || ''))) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function normalizeRoutine(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source) || typeof source.id !== 'string' || !source.id.trim()) {
    throw new Error('invalid-routine');
  }
  const name = typeof source.name === 'string' ? source.name.trim() : '';
  if (!name) throw new Error('name-required');
  if (!Array.isArray(source.weekdays) || source.weekdays.length === 0 ||
      source.weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
    throw new Error('invalid-weekdays');
  }
  const weekdays = [...new Set(source.weekdays)].sort((a, b) => a - b);
  if (weekdays.length !== source.weekdays.length) throw new Error('invalid-weekdays');
  const startTime = source.startTime == null || source.startTime === '' ? null : source.startTime;
  const endTime = source.endTime == null || source.endTime === '' ? null : source.endTime;
  if ((startTime !== null && (typeof startTime !== 'string' || !TIME_PATTERN.test(startTime))) ||
      (endTime !== null && (typeof endTime !== 'string' || !TIME_PATTERN.test(endTime))) ||
      (endTime !== null && (startTime === null || endTime <= startTime))) {
    throw new Error('invalid-time');
  }
  const completedDates = source.completedDates == null ? [] : source.completedDates;
  if (!Array.isArray(completedDates) || completedDates.some((date) => !validDateKey(date))) {
    throw new Error('invalid-completed-date');
  }
  const normalizedDates = [...new Set(completedDates)].sort();
  const description = source.description == null ? '' : source.description;
  if (typeof description !== 'string') throw new Error('invalid-description');
  if (source.enabled != null && typeof source.enabled !== 'boolean') throw new Error('invalid-enabled');
  if (source.color != null && (typeof source.color !== 'string' || (source.color && !COLOR_PATTERN.test(source.color)))) throw new Error('invalid-color');
  if (source.icon != null && (typeof source.icon !== 'string' || !ROUTINE_ICONS.includes(source.icon))) throw new Error('invalid-icon');
  const alarmLeadMinutes = source.alarmLeadMinutes == null ? null : source.alarmLeadMinutes;
  if (alarmLeadMinutes !== null && (!Number.isInteger(alarmLeadMinutes) || alarmLeadMinutes < 1 || alarmLeadMinutes > MAX_ALARM_LEAD_MINUTES)) {
    throw new Error('invalid-alarm-lead');
  }
  if (alarmLeadMinutes !== null && startTime === null) throw new Error('alarm-time-required');
  const alarmNotificationId = source.alarmNotificationId == null ? null : source.alarmNotificationId;
  if (alarmNotificationId !== null && typeof alarmNotificationId !== 'string') throw new Error('invalid-alarm-id');
  return {
    ...source,
    id: source.id.trim(),
    name,
    description: description.trim(),
    icon: typeof source.icon === 'string' ? source.icon : 'checkCircle',
    color: typeof source.color === 'string' ? source.color : '',
    weekdays,
    startTime,
    endTime,
    enabled: source.enabled !== false,
    completedDates: normalizedDates,
    alarmLeadMinutes,
    alarmNotificationId,
  };
}

export function isRoutineScheduledForDate(routine, dateKey) {
  if (!validDateKey(dateKey) || routine?.enabled === false || !Array.isArray(routine?.weekdays)) return false;
  const [year, month, day] = dateKey.split('-').map(Number);
  return routine.weekdays.includes(weekdayIndex(new Date(year, month - 1, day)));
}

export function toggleRoutineCompletion(routine, dateKey) {
  if (!validDateKey(dateKey)) throw new Error('invalid-completed-date');
  const item = normalizeRoutine(routine);
  const dates = new Set(item.completedDates);
  if (dates.has(dateKey)) dates.delete(dateKey);
  else dates.add(dateKey);
  return normalizeRoutine({ ...item, completedDates: [...dates] });
}

function duplicateKey(item) {
  return [item.name.normalize('NFKC').toLocaleLowerCase(), item.weekdays.join(','), item.startTime || '', item.endTime || ''].join('|');
}

function duplicateExists(items, candidate, excludedId = null) {
  const key = duplicateKey(candidate);
  return items.some((item) => item.id !== excludedId && duplicateKey(item) === key);
}

/** Serializes routine writes and only publishes a new snapshot after storage succeeds. */
export function createRoutineRepository({ read, write, createId }) {
  let state = { items: [], hydrated: false, recoveryError: false, restoreRecoveryError: false, busy: false };
  let queue = Promise.resolve();
  const listeners = new Set();
  const notify = () => listeners.forEach((listener) => listener());
  const enqueue = (operation) => {
    const task = queue.then(async () => {
      state = { ...state, busy: true };
      notify();
      try { return await operation(); }
      finally {
        state = { ...state, busy: false };
        notify();
      }
    });
    queue = task.catch(() => undefined);
    return task;
  };

  const persistNext = async (next) => {
    try { await write(next); }
    catch { return { ok: false, error: 'storage-write-failed' }; }
    state = { ...state, items: next };
    notify();
    return { ok: true };
  };

  return {
    getSnapshot: () => state,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    async hydrate() {
      return enqueue(async () => {
        if (state.hydrated) return { ok: true };
        try {
          const value = await read();
          if (!Array.isArray(value)) throw new Error('invalid-routines');
          const items = value.map(normalizeRoutine);
          if (new Set(items.map((item) => item.id)).size !== items.length) throw new Error('duplicate-id');
          state = { ...state, items, hydrated: true, recoveryError: false };
          notify();
          return { ok: true };
        } catch (error) {
          state = {
            ...state,
            hydrated: true,
            recoveryError: true,
            restoreRecoveryError: error?.code === 'RESTORE_RECOVERY_REQUIRED',
          };
          notify();
          return { ok: false, error: 'storage-read-failed' };
        }
      });
    },
    create(data) {
      return enqueue(async () => {
        if (!state.hydrated || state.recoveryError) return { ok: false, error: 'storage-not-ready' };
        let item;
        try { item = normalizeRoutine({ ...data, id: createId() }); }
        catch (error) { return { ok: false, error: error.message }; }
        if (state.items.some((current) => current.id === item.id)) return { ok: false, error: 'duplicate-routine' };
        if (duplicateExists(state.items, item)) return { ok: false, error: 'duplicate-routine' };
        const result = await persistNext([item, ...state.items]);
        return result.ok ? { ...result, item } : result;
      });
    },
    update(id, patch) {
      return enqueue(async () => {
        if (!state.hydrated || state.recoveryError) return { ok: false, error: 'storage-not-ready' };
        const existing = state.items.find((item) => item.id === id);
        if (!existing) return { ok: false, error: 'routine-not-found' };
        let item;
        try { item = normalizeRoutine({ ...existing, ...patch, id }); }
        catch (error) { return { ok: false, error: error.message }; }
        if (duplicateExists(state.items, item, id)) return { ok: false, error: 'duplicate-routine' };
        const result = await persistNext(state.items.map((current) => current.id === id ? item : current));
        return result.ok ? { ...result, item } : result;
      });
    },
    remove(id) {
      return enqueue(async () => {
        if (!state.hydrated || state.recoveryError) return { ok: false, error: 'storage-not-ready' };
        if (!state.items.some((item) => item.id === id)) return { ok: false, error: 'routine-not-found' };
        return persistNext(state.items.filter((item) => item.id !== id));
      });
    },
    toggleCompletion(id, dateKey) {
      return enqueue(async () => {
        if (!state.hydrated || state.recoveryError) return { ok: false, error: 'storage-not-ready' };
        const current = state.items.find((item) => item.id === id);
        if (!current) return { ok: false, error: 'routine-not-found' };
        let item;
        try { item = toggleRoutineCompletion(current, dateKey); }
        catch (error) { return { ok: false, error: error.message }; }
        const next = state.items.map((candidate) => candidate.id === id ? item : candidate);
        const result = await persistNext(next);
        return result.ok ? { ...result, item } : result;
      });
    },
    runExclusive(operation) {
      return enqueue(async () => operation({
        items: state.items,
        setSnapshot(next) {
          state = { ...state, items: next.map(normalizeRoutine) };
          notify();
        },
      }));
    },
  };
}
