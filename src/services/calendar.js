import { fromDateKey, weekdayIndex } from '../utils/dates';
import { birthdayDateKeyForYear, birthdayOccursOn } from './birthdayDates';

export const CALENDAR_FILTERS = [
  { id: 'all', label: 'Todo' },
  { id: 'events', label: 'Eventos' },
  { id: 'classes', label: 'Clases' },
  { id: 'birthdays', label: 'Cumpleaños' },
];

const FILTER_BY_KIND = { event: 'events', class: 'classes', birthday: 'birthdays' };
const included = (filter, kind) => filter === 'all' || filter === FILTER_BY_KIND[kind];

/** Month key used by the calendar pager, normalized to the first day. */
export function shiftCalendarMonth(monthKey, amount) {
  const [year, month] = String(monthKey || '').split('-').map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(amount)) {
    return monthKey;
  }
  const shifted = new Date(year, month - 1 + amount, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}-01`;
}

/** Keep the selected day when navigating months, clamped to shorter months. */
export function dateKeyInMonth(dateKey, monthKey) {
  const [year, month] = String(monthKey || '').split('-').map(Number);
  const day = Number(String(dateKey || '').slice(8, 10));
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(day)) {
    return dateKey;
  }
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

export function calendarEmptyState(filter = 'all') {
  if (filter === 'events') return { title: 'Sin eventos', hint: 'No hay eventos personales para esta fecha.' };
  if (filter === 'birthdays') return { title: 'Sin cumpleaños', hint: 'No hay cumpleaños para esta fecha.' };
  if (filter === 'classes') return { title: 'Sin clases', hint: 'No hay clases programadas para esta fecha.' };
  return { title: 'Día libre', hint: 'No hay eventos, clases ni cumpleaños para esta fecha.' };
}

export function buildDayAgenda({ dateKey, events = [], activities = [], birthdays = [], filter = 'all' }) {
  const dayOfWeek = weekdayIndex(fromDateKey(dateKey));
  const rows = [];

  if (included(filter, 'event')) {
    events.filter((event) => event.dateKey === dateKey).forEach((event) => {
      rows.push({
        kind: 'event',
        id: `event-${event.id}`,
        sourceId: event.id,
        source: event,
        title: event.title,
        time: event.time || '00:00',
        endTime: event.endTime,
        detail: event.notes,
        category: event.category,
        color: event.color,
      });
    });
  }

  if (included(filter, 'class')) {
    activities
      .filter((activity) => Number(activity.day) === dayOfWeek)
      .filter((activity) => !activity.suspended?.[dateKey])
      .forEach((activity) => {
        rows.push({
          kind: 'class',
          id: `class-${activity.id}`,
          sourceId: activity.id,
          source: activity,
          title: activity.title,
          time: activity.start || '00:00',
          endTime: activity.end,
          detail: activity.location,
          color: activity.color,
        });
      });
  }

  if (included(filter, 'birthday')) {
    birthdays.filter((birthday) => birthdayOccursOn(birthday, dateKey)).forEach((birthday) => {
      rows.push({
        kind: 'birthday',
        id: `birthday-${birthday.id}`,
        sourceId: birthday.id,
        source: birthday,
        title: birthday.name,
        time: birthday.time || '09:00',
        detail: 'Cumpleaños anual',
        color: birthday.color,
        emoji: birthday.emoji || '🎂',
      });
    });
  }

  return rows.sort((a, b) => String(a.time).localeCompare(String(b.time)) || a.title.localeCompare(b.title));
}

export function buildCalendarMarks({ events = [], birthdays = [], year, selectedKey, filter = 'all', colors }) {
  const marks = {};
  const addDot = (dateKey, dot) => {
    if (!dateKey) return;
    const entry = marks[dateKey] || { dots: [] };
    if (!entry.dots.some((item) => item.key === dot.key)) entry.dots.push(dot);
    marks[dateKey] = entry;
  };

  if (included(filter, 'event')) {
    events.forEach((event) =>
      addDot(event.dateKey, { key: 'events', color: colors.event, selectedDotColor: colors.event }),
    );
  }
  if (included(filter, 'birthday')) {
    birthdays.forEach((birthday) => {
      addDot(birthdayDateKeyForYear(birthday, year), {
        key: 'birthdays',
        color: colors.birthday,
        selectedDotColor: colors.birthday,
      });
    });
  }

  Object.keys(marks).forEach((key) => {
    marks[key] = { ...marks[key], selected: key === selectedKey, disableTouchEvent: false };
  });
  if (selectedKey && !marks[selectedKey]) marks[selectedKey] = { selected: true, dots: [] };
  return marks;
}
