/** Serializes completion changes per routine while the repository confirms persistence. */
export function createRoutineToggleGuard({ toggleRoutineCompletion, onPendingChange = () => {} }) {
  const pending = new Set();

  return {
    async toggle(routineId, dateKey) {
      if (pending.has(routineId)) return { ok: false, status: 'busy' };
      pending.add(routineId);
      onPendingChange(routineId, true);
      try {
        const result = await toggleRoutineCompletion(routineId, dateKey);
        if (!result?.ok) return { ok: false, status: 'failed' };
        const completed = result.item?.completedDates?.includes(dateKey) === true;
        return { ok: true, status: completed ? 'completed' : 'pending' };
      } catch {
        return { ok: false, status: 'failed' };
      } finally {
        pending.delete(routineId);
        onPendingChange(routineId, false);
      }
    },
  };
}

export function eventDestination(event) {
  return {
    route: 'Agenda',
    params: { focusId: event.id, dateKey: event.dateKey },
  };
}
