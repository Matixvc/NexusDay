import { ageOn, fromDateKey, nextYearlyOccurrence, toDateKey } from '../utils/dates';

export function birthdayTurnsNext(dateKey, from = new Date()) {
  const birth = fromDateKey(dateKey);
  return ageOn(dateKey, nextYearlyOccurrence(birth.getMonth(), birth.getDate(), 0, 0, from));
}

/**
 * Occurrence in a concrete year without changing the stored birth date.
 * Existing policy is intentionally preserved: JavaScript rolls 29 February to 1 March in
 * non-leap years, matching `nextYearlyOccurrence` and the reminder service.
 */
export function birthdayDateKeyForYear(birthday, year) {
  const birth = fromDateKey(birthday?.dateKey);
  if (Number.isNaN(birth.getTime())) return '';
  return toDateKey(new Date(Number(year), birth.getMonth(), birth.getDate()));
}

export function birthdayOccursOn(birthday, dateKey) {
  const year = Number(String(dateKey).slice(0, 4));
  return Number.isFinite(year) && birthdayDateKeyForYear(birthday, year) === dateKey;
}
