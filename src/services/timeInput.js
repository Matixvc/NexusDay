import { isValidTime, minutesOfDay } from '../utils/dates';

export function formatTimeInput(value) {
  const raw = String(value ?? '').replace(/[^\d:]/g, '');
  if (raw.includes(':')) {
    const [hours = '', minutes = ''] = raw.split(':');
    return `${hours.slice(0, 2)}:${minutes.slice(0, 2)}`;
  }
  const digits = raw.slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
}

export function timeInputError(value) {
  const text = String(value ?? '').trim();
  if (!text) return 'Escribe una hora en formato HH:mm.';
  if (!/^\d{2}:\d{2}$/.test(text)) return 'Completa la hora en formato HH:mm.';
  if (!isValidTime(text)) return 'Usa una hora entre 00:00 y 23:59.';
  return null;
}

export function timeRangeError(start, end) {
  if (timeInputError(start) || timeInputError(end)) return null;
  return minutesOfDay(end) > minutesOfDay(start)
    ? null
    : 'La hora de fin debe ser posterior al inicio.';
}
