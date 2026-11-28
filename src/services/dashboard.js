import {
  WEEKDAYS,
  buildDateTime,
  compareDateTime,
  daysFromToday,
  formatDateLong,
  formatDateShort,
  formatTime,
  relativeDayLabel,
  toDateKey,
  todayKey,
  weekdayIndex,
} from '../utils/dates';
import { filterDiscoverableRecords } from './privacyPolicy';
import { sumAmounts } from '../utils/money';
import { isRoutineScheduledForDate } from './routines';

/**
 * Pure aggregation behind the Inicio dashboard.
 *
 * Everything here is a plain function over already-hydrated collections so the screen
 * stays declarative (one `useMemo`) and the logic can be reasoned about in isolation.
 */

export function greetingForHour(hour) {
  const h = Number(hour);
  const safe = Number.isFinite(h) ? h : 0;
  if (safe < 6) return 'Buenas noches';
  if (safe < 13) return 'Buenos días';
  if (safe < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

function timeOf(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Delay to the next local clock-minute boundary, used by the focused dashboard refresh. */
export function millisecondsToNextMinute(timestamp = Date.now()) {
  const value = Number(timestamp);
  if (!Number.isFinite(value)) return 60000;
  const offset = ((value % 60000) + 60000) % 60000;
  return offset === 0 ? 60000 : 60000 - offset;
}

/** Whole minutes until a local activity start; invalid date/time pairs return null. */
export function minutesUntilActivity(dateKey, time, now = new Date()) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(time || ''));
  if (
    !Number.isFinite(now?.getTime?.())
    || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ''))
    || !match
    || Number(match[1]) > 23
    || Number(match[2]) > 59
  ) {
    return null;
  }
  const startsAt = buildDateTime(dateKey, time);
  const [year, month, day] = String(dateKey).split('-').map(Number);
  if (startsAt.getFullYear() !== year || startsAt.getMonth() !== month - 1 || startsAt.getDate() !== day) return null;
  const minutes = Math.ceil((startsAt.getTime() - now.getTime()) / 60000);
  return Number.isFinite(minutes) ? Math.max(0, minutes) : null;
}

/** Short Spanish countdown for the next scheduled start. */
export function formatTimeUntil(minutes) {
  if (!Number.isFinite(minutes) || minutes < 0) return null;
  const safe = Math.ceil(minutes);
  if (safe === 0) return 'Ahora';
  if (safe < 120) return `En ${safe} min`;
  const hours = Math.floor(safe / 60);
  const remaining = safe % 60;
  return remaining ? `En ${hours} h ${remaining}m` : `En ${hours} h`;
}

export function dailyCommitmentSummary(weekdayLabel, count) {
  const safeCount = Number.isFinite(count) ? count : 0;
  if (safeCount === 0) return `${weekdayLabel} · Sin compromisos para hoy`;
  return `${weekdayLabel} · ${safeCount} ${safeCount === 1 ? 'compromiso' : 'compromisos'} para hoy`;
}

/** `{id,name}` of the habits still missing today's tick. */
export function pendingHabits(habits = [], today = todayKey()) {
  return habits.filter((habit) => !Array.isArray(habit.marks) || !habit.marks.includes(today));
}

/** True when an activity session is suspended for a given dateKey. */
export function isActivitySuspended(activity, dateKey) {
  return Boolean(activity?.suspended?.[dateKey]);
}

/** Consecutive days (ending today or yesterday) in which the habit was ticked. */
export function habitStreak(habit, today = todayKey()) {
  const marks = new Set(Array.isArray(habit?.marks) ? habit.marks : []);
  let streak = 0;
  let cursor = today;
  for (let step = 0; step < 400; step += 1) {
    if (marks.has(cursor)) {
      streak += 1;
      cursor = shiftKey(cursor, -1);
    } else if (step === 0) {
      cursor = shiftKey(cursor, -1); // a streak may still be alive if today is not ticked yet
    } else {
      break;
    }
  }
  return streak;
}

function shiftKey(key, days) {
  const [year, month, day] = String(key).split('-').map(Number);
  const d = new Date(year, (month || 1) - 1, day || 1);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Last `count` date keys, oldest first — used by the habit week strip. */
export function lastDays(count = 7, today = todayKey()) {
  return Array.from({ length: count }, (unused, index) => shiftKey(today, index - (count - 1)));
}

export function buildDashboard({
  events = [],
  activities = [],
  habits = [],
  expenses = [],
  notes = [],
  birthdays = [],
  routines = [],
  now = new Date(),
} = {}) {
  const today = toDateKey(now);
  const currentTime = timeOf(now);
  const dayIndex = weekdayIndex(now);
  const monthPrefix = today.slice(0, 7);
  const publicExpenses = filterDiscoverableRecords(expenses);
  const publicNotes = filterDiscoverableRecords(notes);

  const todayActivities = activities
    .filter((item) => Number(item.day) === dayIndex)
    .slice()
    .sort((a, b) => String(a.start).localeCompare(String(b.start)));

  // Suspended sessions do not count as pending: they stay visible below, clearly
  // marked, while the hero and the counters only answer for what is really ahead.
  const activeActivities = todayActivities.filter((item) => !isActivitySuspended(item, today));
  const suspendedActivities = todayActivities.filter((item) => isActivitySuspended(item, today));

  // Everything the calendar holds for today, over or pending alike: the greeting has to answer
  // "¿cuánto tengo hoy?", and counting only the weekly schedule ignored every dated event.
  const todayEvents = events.filter((event) => event.dateKey === today);
  const todayRoutines = routines.filter((routine) => isRoutineScheduledForDate(routine, today));

  const activityItem = (item, status) => ({
    id: `act-${item.id}`,
    sourceId: item.id,
    kind: 'activity',
    typeLabel: 'Clase',
    title: item.title,
    startTime: String(item.start || '').trim() || null,
    endTime: String(item.end || '').trim() || null,
    dateKey: today,
    detail: item.location || 'Horario universitario',
    color: item.color,
    status,
    minutesRemaining: status === 'in-progress' ? minutesUntilActivity(today, item.end, now) : null,
    minutesUntil: status === 'upcoming' ? minutesUntilActivity(today, item.start, now) : null,
  });
  const eventItem = (item) => ({
    id: `event-${item.id}`,
    sourceId: item.id,
    kind: 'event',
    typeLabel: 'Evento',
    title: item.title,
    startTime: item.time,
    endTime: item.endTime || null,
    dateKey: item.dateKey,
    detail: item.category || 'Evento',
    color: item.color,
    status: 'upcoming',
    minutesUntil: minutesUntilActivity(item.dateKey, item.time, now),
  });
  const routineItem = (item) => ({
    id: `routine-${item.id}`,
    sourceId: item.id,
    routineId: item.id,
    kind: 'routine',
    typeLabel: 'Rutina',
    title: item.name,
    startTime: item.startTime || null,
    endTime: item.endTime || null,
    dateKey: today,
    detail: item.description || 'Rutina personal',
    color: item.color,
    completed: item.completedDates?.includes(today) === true,
    status: item.completedDates?.includes(today) ? 'completed' : 'pending',
  });

  const inProgressActivities = activeActivities
    .filter((item) => item.start && item.start <= currentTime && String(item.end || item.start) > currentTime)
    .slice()
    .sort((a, b) => String(b.start).localeCompare(String(a.start)));
  const currentActivity = inProgressActivities.length ? activityItem(inProgressActivities[0], 'in-progress') : null;
  const concurrentActivities = inProgressActivities.slice(1).map((item) => activityItem(item, 'in-progress'));
  const nextTimedItems = [
    ...activeActivities
      .filter((item) => item.start && item.start > currentTime)
      .map((item) => activityItem(item, 'upcoming')),
    ...events
      .filter((item) => item.time && compareDateTime(item, { dateKey: today, time: currentTime }) >= 0)
      .map(eventItem),
  ].sort((a, b) => String(a.dateKey).localeCompare(String(b.dateKey)) || String(a.startTime).localeCompare(String(b.startTime)) || a.title.localeCompare(b.title));
  const anytimeItems = [
    ...activeActivities.filter((item) => !String(item.start || '').trim()).map((item) => activityItem(item, 'anytime')),
    ...todayRoutines.map(routineItem),
  ];
  const hasConfiguredData = activities.length > 0 || routines.length > 0 || events.length > 0;
  const hasTodayData = activeActivities.length > 0 || todayEvents.length > 0 || todayRoutines.length > 0;
  const hasActiveToday = Boolean(currentActivity || concurrentActivities.length || nextTimedItems.some((item) => item.dateKey === today) || anytimeItems.length);
  const dayState = !hasConfiguredData
    ? 'unconfigured'
    : !hasTodayData
      ? suspendedActivities.length ? 'suspended' : 'free'
      : hasActiveToday
        ? 'active'
        : 'finished';

  const upcomingEvents = events
    .filter((event) => compareDateTime(event, { dateKey: today, time: currentTime }) >= 0)
    .slice()
    .sort(compareDateTime);

  const nextUp = [
    ...activeActivities
      // An activity that ends exactly at the current minute has already finished.
      .filter((item) => String(item.end || item.start) > currentTime)
      .map((item) => ({
        id: `act-${item.id}`,
        kind: 'activity',
        title: item.title,
        time: formatTime(item.start),
        detail: item.location || 'Horario de hoy',
        color: item.color,
      })),
    ...upcomingEvents.slice(0, 4).map((event) => ({
      id: `evt-${event.id}`,
      kind: 'event',
      title: event.title,
      time: formatTime(event.time),
      detail: event.dateKey === today ? 'Hoy' : `${relativeDayLabel(event.dateKey)} · ${formatDateShort(event.dateKey)}`,
      color: event.color,
    })),
  ].slice(0, 3);

  const todayAgenda = [
    ...activeActivities.map((item) => ({
      id: `act-${item.id}`, kind: 'activity', title: item.title, startTime: item.start, endTime: item.end,
      detail: item.location || 'Horario universitario', color: item.color,
    })),
    ...todayRoutines.map((item) => ({
      id: `routine-${item.id}`, routineId: item.id, kind: 'routine', title: item.name,
      startTime: item.startTime, endTime: item.endTime, detail: item.description || 'Rutina personal',
      color: item.color, completed: item.completedDates?.includes(today) === true,
    })),
    ...todayEvents.map((item) => ({
      id: `event-${item.id}`, kind: 'event', title: item.title, startTime: item.time,
      endTime: null, detail: 'Evento', color: item.color,
    })),
  ].sort((a, b) => {
    if (a.startTime == null && b.startTime != null) return 1;
    if (a.startTime != null && b.startTime == null) return -1;
    return String(a.startTime || '').localeCompare(String(b.startTime || '')) || a.title.localeCompare(b.title);
  });

  const todayExpenses = publicExpenses.filter((item) => item.dateKey === today);
  const monthExpenses = publicExpenses.filter((item) => String(item.dateKey || '').startsWith(monthPrefix));

  return {
    today,
    dateLabel: formatDateLong(today),
    weekdayLabel: WEEKDAYS[dayIndex].long,
    greeting: greetingForHour(now.getHours()),
    todayActivities: activeActivities,
    suspendedToday: suspendedActivities,
    todayEvents,
    todayRoutines,
    currentActivity,
    concurrentActivities,
    nextTimedItems,
    anytimeItems,
    dayState,
    todayAgenda,
    // What the greeting answers with: everything scheduled for today, weekly blocks and dated
    // events together, whether or not the clock already went past them. Suspended sessions
    // are listed separately and never added to this count.
    todayCommitments: activeActivities.length + todayEvents.length + todayRoutines.length,
    upcomingEvents,
    nextUp,
    pendingHabits: pendingHabits(habits, today),
    habitsDoneToday: habits.length - pendingHabits(habits, today).length,
    todayExpenses,
    spentToday: sumAmounts(todayExpenses),
    spentMonth: sumAmounts(monthExpenses),
    notesCount: publicNotes.length,
    pinnedNotes: publicNotes.filter((note) => note.pinned).length,
    upcomingBirthdays: birthdays
      .map((birthday) => ({ ...birthday, inDays: daysFromToday(nextBirthdayKey(birthday, now)) }))
      .filter((item) => Number.isFinite(item.inDays) && item.inDays <= 30)
      .sort((a, b) => a.inDays - b.inDays),
  };
}

/** dateKey of the next anniversary of a birthday (year included: `daysFromToday` needs it). */
export function nextBirthdayKey(birthday, now = new Date()) {
  const source = String(birthday?.dateKey || '');
  const parts = source.split('-');
  if (parts.length < 3) return '';
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!month || !day) return '';
  const candidate = new Date(now.getFullYear(), month - 1, day);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (candidate < startOfToday) candidate.setFullYear(now.getFullYear() + 1);
  return `${candidate.getFullYear()}-${String(candidate.getMonth() + 1).padStart(2, '0')}-${String(candidate.getDate()).padStart(2, '0')}`;
}
