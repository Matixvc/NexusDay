import { birthdayOccursOn } from './birthdayDates';
import { toDateKey, weekdayIndex } from '../utils/dates';

export function buildCalendarWidgetSnapshot({ activities = [], events = [], birthdays = [], now = new Date() } = {}) {
  const dateKey = toDateKey(now);
  const day = weekdayIndex(now);
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const classes = activities.filter((item) => Number(item?.day) === day && !item?.suspended?.[dateKey]);
  const todaysEvents = events.filter((item) => item?.dateKey === dateKey);
  const todaysBirthdays = birthdays.filter((item) => birthdayOccursOn(item, dateKey));
  const candidates = [...todaysEvents, ...todaysBirthdays].filter((item) => String(item?.time || '09:00') >= time).sort((a, b) => String(a?.time || '09:00').localeCompare(String(b?.time || '09:00')));
  const next = candidates[0];
  return {
    dateKey,
    dateLabel: `${dateKey.slice(8, 10)}/${dateKey.slice(5, 7)}/${dateKey.slice(0, 4)}`,
    updatedAt: now.getTime(),
    status: activities.length === 0 && events.length === 0 && birthdays.length === 0 ? 'empty' : (classes.length + todaysEvents.length + todaysBirthdays.length) ? 'scheduled' : 'free',
    nextEvent: next ? { time: String(next.time || '09:00'), title: null } : null,
    activityCount: classes.length + todaysEvents.length,
    birthdayPresent: todaysBirthdays.length > 0,
  };
}

export function getCalendarWidgetSnapshotView(snapshot, now = new Date()) {
  if (!snapshot || snapshot.dateKey !== toDateKey(now)) return { status: 'stale', dateKey: snapshot?.dateKey || null, dateLabel: snapshot?.dateLabel || null, updatedAt: snapshot?.updatedAt || null, nextEvent: null, activityCount: 0, birthdayPresent: false };
  return snapshot;
}
