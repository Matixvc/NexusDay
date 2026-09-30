import {
  WEEKDAYS,
  compareDateTime,
  daysFromToday,
  formatDateLong,
  formatDateShort,
  formatTime,
  relativeDayLabel,
  todayKey,
  weekdayIndex,
} from '../utils/dates';
import { sumAmounts } from '../utils/money';

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

/** `{id,name}` of the habits still missing today's tick. */
export function pendingHabits(habits = [], today = todayKey()) {
  return habits.filter((habit) => !Array.isArray(habit.marks) || !habit.marks.includes(today));
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
  now = new Date(),
} = {}) {
  const today = todayKey();
  const currentTime = timeOf(now);
  const dayIndex = weekdayIndex(now);
  const monthPrefix = today.slice(0, 7);

  const todayActivities = activities
    .filter((item) => Number(item.day) === dayIndex)
    .slice()
    .sort((a, b) => String(a.start).localeCompare(String(b.start)));

  const upcomingEvents = events
    .filter((event) => compareDateTime(event, { dateKey: today, time: currentTime }) >= 0)
    .slice()
    .sort(compareDateTime);

  const nextUp = [
    ...todayActivities
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

  const todayExpenses = expenses.filter((item) => item.dateKey === today);
  const monthExpenses = expenses.filter((item) => String(item.dateKey || '').startsWith(monthPrefix));

  return {
    today,
    dateLabel: formatDateLong(today),
    weekdayLabel: WEEKDAYS[dayIndex].long,
    greeting: greetingForHour(now.getHours()),
    todayActivities,
    upcomingEvents,
    nextUp,
    pendingHabits: pendingHabits(habits, today),
    habitsDoneToday: habits.length - pendingHabits(habits, today).length,
    todayExpenses,
    spentToday: sumAmounts(todayExpenses),
    spentMonth: sumAmounts(monthExpenses),
    notesCount: notes.length,
    pinnedNotes: notes.filter((note) => note.pinned).length,
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
