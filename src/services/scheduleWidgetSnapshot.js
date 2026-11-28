import { toDateKey, weekdayIndex } from '../utils/dates';

/** Builds the only data allowed to leave the app process for the Android schedule widget. */
export function buildScheduleWidgetSnapshot({ activities = [], now = new Date(), showDetails = false } = {}) {
  const dateKey = toDateKey(now);
  const day = weekdayIndex(now);
  const scheduled = activities
    .filter((activity) => Number(activity?.day) === day)
    .slice()
    .sort((a, b) => String(a?.start || '').localeCompare(String(b?.start || '')));
  const active = scheduled.filter((activity) => !activity?.suspended?.[dateKey]);
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const current = active.find((activity) => String(activity?.start || '') <= currentTime && currentTime < String(activity?.end || '')) || null;
  const next = active.find((activity) => String(activity?.end || activity?.start || '') > currentTime) || null;

  return {
    dateKey,
    updatedAt: now.getTime(),
    status: activities.length === 0 ? 'empty' : scheduled.length === 0 ? 'free' : active.length === 0 ? 'suspended' : 'scheduled',
    dateLabel: `${dateKey.slice(8, 10)}/${dateKey.slice(5, 7)}/${dateKey.slice(0, 4)}`,
    classes: active.map((activity) => ({
      start: String(activity.start || ''),
      end: String(activity.end || ''),
      title: showDetails ? String(activity.title || '') : null,
    })),
    nextClass: next ? {
      start: String(next.start || ''),
      end: String(next.end || ''),
      title: showDetails ? String(next.title || '') : null,
    } : null,
    currentClass: current ? {
      start: String(current.start || ''),
      end: String(current.end || ''),
      title: showDetails ? String(current.title || '') : null,
    } : null,
  };
}

/** A persisted snapshot from yesterday must never be presented as today's classes. */
export function getScheduleWidgetSnapshotView(snapshot, now = new Date()) {
  if (!snapshot || snapshot.dateKey !== toDateKey(now)) {
    return { status: 'stale', dateKey: snapshot?.dateKey || null, dateLabel: snapshot?.dateLabel || null, updatedAt: snapshot?.updatedAt || null, classes: [], nextClass: null, currentClass: null };
  }
  return snapshot;
}
