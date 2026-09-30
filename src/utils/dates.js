const WEEKDAY_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Index 0 = lunes ... index 6 = domingo (ordering used by the weekly schedule). */
export const WEEKDAYS = [
  { short: 'Lun', long: 'Lunes', dow: 1 },
  { short: 'Mar', long: 'Martes', dow: 2 },
  { short: 'Mié', long: 'Miércoles', dow: 3 },
  { short: 'Jue', long: 'Jueves', dow: 4 },
  { short: 'Vie', long: 'Viernes', dow: 5 },
  { short: 'Sáb', long: 'Sábado', dow: 6 },
  { short: 'Dom', long: 'Domingo', dow: 0 },
];

export const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export const MONTHS_SHORT = MONTHS.map((name) => name.slice(0, 3));

const MS_PER_DAY = 86400000;

export function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function pad2(value) {
  return String(value).padStart(2, '0');
}

/** 'YYYY-MM-DD' in *local* time (never UTC, to avoid off-by-one-day bugs). */
export function toDateKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** 'YYYY-MM-DD' -> local Date at 00:00. */
export function fromDateKey(key) {
  const [year, month, day] = String(key).split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function todayKey() {
  return toDateKey(new Date());
}

export function startOfDay(date) {
  const d = date instanceof Date ? new Date(date) : new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Position inside WEEKDAYS (0 = lunes). */
export function weekdayIndex(date) {
  const d = date instanceof Date ? date : new Date(date);
  return (d.getDay() + 6) % 7;
}

export function addDaysToKey(key, days) {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

/** Whole days between today and `key`; negative for past dates. */
export function daysFromToday(key) {
  const target = startOfDay(fromDateKey(key)).getTime();
  const today = startOfDay(new Date()).getTime();
  return Math.round((target - today) / MS_PER_DAY);
}

export function formatDateLong(key) {
  const d = fromDateKey(key);
  return `${WEEKDAY_LONG[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

export function formatDateMedium(key) {
  const d = fromDateKey(key);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateShort(key) {
  const d = fromDateKey(key);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

export function formatMonthYear(date) {
  const d = date instanceof Date ? date : fromDateKey(date);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function relativeDayLabel(key) {
  const diff = daysFromToday(key);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  if (diff === -1) return 'Ayer';
  if (diff > 1 && diff < 7) return WEEKDAYS[weekdayIndex(fromDateKey(key))].long;
  return formatDateShort(key);
}

/** 'HH:mm' -> { hour, minute } ; falls back to 09:00 when unparseable. */
export function parseTime(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? '').trim());
  if (!match) return { hour: 9, minute: 0 };
  const hour = Math.min(23, Math.max(0, Number(match[1])));
  const minute = Math.min(59, Math.max(0, Number(match[2])));
  return { hour, minute };
}

export function isValidTime(value) {
  return /^\d{1,2}:\d{2}$/.test(String(value ?? '').trim());
}

export function minutesOfDay(value) {
  const { hour, minute } = parseTime(value);
  return hour * 60 + minute;
}

export function formatTime(value) {
  const { hour, minute } = parseTime(value);
  return `${pad2(hour)}:${pad2(minute)}`;
}

/** Wrap a minute delta around the 24h day (keeps HH:mm normalized). */
export function shiftTime(value, deltaMinutes) {
  let total = minutesOfDay(value) + deltaMinutes;
  total %= 1440;
  if (total < 0) total += 1440;
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
}

export function buildDateTime(dateKey, time) {
  const { hour, minute } = parseTime(time);
  const d = fromDateKey(dateKey);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/** Duration between two 'HH:mm' values, negative when the range is invalid. */
export function minutesBetween(start, end) {
  return minutesOfDay(end) - minutesOfDay(start);
}

export function formatDuration(minutes) {
  const safe = Math.max(0, minutes);
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} h`;
  return `${hours} h ${mins} min`;
}

/** Next yearly occurrence of month/day at hour:minute (month is 0-based). */
export function nextYearlyOccurrence(month, day, hour = 0, minute = 0, from = new Date()) {
  const candidate = new Date(from.getFullYear(), month, day, hour, minute, 0, 0);
  if (candidate.getTime() < from.getTime()) {
    candidate.setFullYear(from.getFullYear() + 1);
  }
  return candidate;
}

/** Whole days from today until the next month/day occurrence (0 = hoy). */
export function daysUntilYearly(month, day, from = new Date()) {
  const target = new Date(from.getFullYear(), month, day);
  if (target < startOfDay(from)) target.setFullYear(from.getFullYear() + 1);
  return Math.round((target.getTime() - startOfDay(from).getTime()) / MS_PER_DAY);
}

/** Years completed on `dateKey` relative to `ref`. */
export function ageOn(dateKey, ref = new Date()) {
  const birth = fromDateKey(dateKey);
  const today = startOfDay(ref);
  let age = today.getFullYear() - birth.getFullYear();
  const hadBirthdayThisYear =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hadBirthdayThisYear) age -= 1;
  return age;
}

export function timeAgo(timestamp) {
  const diff = Date.now() - Number(timestamp || 0);
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'ahora mismo';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'ayer';
  if (days < 7) return `hace ${days} días`;
  return formatDateShort(toDateKey(new Date(Number(timestamp))));
}

/** Sort helper for items carrying a dateKey + time pair. */
export function compareDateTime(a, b) {
  return buildDateTime(a.dateKey, a.time).getTime() - buildDateTime(b.dateKey, b.time).getTime();
}

