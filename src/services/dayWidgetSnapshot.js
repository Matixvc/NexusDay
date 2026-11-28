import { toDateKey, weekdayIndex } from '../utils/dates';

/** Minimal, privacy-safe projection for the Android Mi día widget. */
export function buildDayWidgetSnapshot({ activities = [], routines = [], events = [], now = new Date() } = {}) {
  const dateKey = toDateKey(now);
  const day = weekdayIndex(now);
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const classes = activities.filter((item) => Number(item?.day) === day && !item?.suspended?.[dateKey]).sort((a, b) => String(a.start || '').localeCompare(String(b.start || '')));
  const nextClass = classes.find((item) => String(item.end || item.start || '') > currentTime);
  const pendingRoutineCount = routines.filter((item) => item?.enabled !== false && Array.isArray(item?.weekdays) && item.weekdays.includes(day) && !(item.completedDates || []).includes(dateKey)).length;
  const nextEvent = events.filter((item) => item?.dateKey === dateKey && String(item?.time || '') >= currentTime).sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')))[0];
  return {
    dateKey,
    dateLabel: `${dateKey.slice(8, 10)}/${dateKey.slice(5, 7)}/${dateKey.slice(0, 4)}`,
    updatedAt: now.getTime(),
    status: activities.length === 0 && routines.length === 0 && events.length === 0 ? 'empty' : classes.length ? 'scheduled' : 'free',
    nextClass: nextClass ? { start: String(nextClass.start || ''), end: String(nextClass.end || ''), title: null } : null,
    pendingRoutineCount,
    nextEvent: nextEvent ? { time: String(nextEvent.time || ''), title: null } : null,
  };
}

export function getDayWidgetSnapshotView(snapshot, now = new Date()) {
  if (!snapshot || snapshot.dateKey !== toDateKey(now)) return { status: 'stale', dateKey: snapshot?.dateKey || null, dateLabel: snapshot?.dateLabel || null, updatedAt: snapshot?.updatedAt || null, nextClass: null, pendingRoutineCount: 0, nextEvent: null };
  return snapshot;
}
