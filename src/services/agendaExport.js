import { shareText } from './files';
import { buildDateTime, minutesBetween, pad2 } from '../utils/dates';

/**
 * Agenda export (.ics, RFC 5545).
 *
 * NexusDay no escribe en la agenda del teléfono: no pide permisos de calendario y no guarda
 * copias de los eventos fuera de la app. Lo que sí hace es generar un archivo `.ics` con lo
 * que hay en la app, para que la persona lo abra o lo comparta donde quiera.
 */

/** Default length for events that do not declare an end time. */
export const DEFAULT_DURATION = 60;

/** First date, `weekOffset` weeks after `from`, that falls on JS weekday `dow` (0 = domingo). */
export function nextDateKey(dow, from = new Date(), weekOffset = 0) {
  const base = new Date(from);
  base.setHours(0, 0, 0, 0);
  const shift = (Number(dow) - base.getDay() + 7) % 7 + Math.max(0, Number(weekOffset) || 0) * 7;
  base.setDate(base.getDate() + shift);
  return `${base.getFullYear()}-${pad2(base.getMonth() + 1)}-${pad2(base.getDate())}`;
}

function clip(value, max) {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, max) : '';
}

/** Start/end of an app event; the `.ics` writer and the schedule export share this shape. */
export function eventWindow(source, { fallbackDuration = DEFAULT_DURATION } = {}) {
  const startDate = buildDateTime(source.dateKey, source.time);
  const explicit = Number(source.durationMinutes ?? source.duration);
  const derived = source.endTime ? minutesBetween(source.time, source.endTime) : Number.NaN;
  const minutes =
    Number.isFinite(explicit) && explicit > 0
      ? explicit
      : Number.isFinite(derived) && derived > 0
        ? derived
        : fallbackDuration;

  return {
    title: clip(source.title, 120) || 'Evento',
    startDate,
    endDate: new Date(startDate.getTime() + minutes * 60000),
    notes: clip(source.notes ?? source.description, 2000),
    location: clip(source.location, 200),
  };
}

function icsEscape(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function icsStamp(date) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`;
}

/** "Floating" local time: no Z, so the event keeps the same wall clock wherever it is opened. */
function icsLocal(date) {
  const d = new Date(date);
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}T${pad2(d.getHours())}${pad2(d.getMinutes())}00`;
}

/** Serialises app events as an `.ics` file. Pure string work: no permissions, no network. */
export function buildAgendaICS(events = [], { product = 'NexusDay' } = {}) {
  const stamp = icsStamp(new Date());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${product}//Agenda//es`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  events.forEach((event, index) => {
    if (!event?.dateKey) return;
    const details = eventWindow(event);
    const uid = event.id || `evento-${index}`;
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${icsEscape(`${uid}@nexusday`)}`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART:${icsLocal(details.startDate)}`);
    lines.push(`DTEND:${icsLocal(details.endDate)}`);
    lines.push(`SUMMARY:${icsEscape(details.title)}`);
    if (details.location) lines.push(`LOCATION:${icsEscape(details.location)}`);
    if (details.notes) lines.push(`DESCRIPTION:${icsEscape(details.notes)}`);
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/** Writes the `.ics` into the sandbox and opens the share sheet. */
export async function shareAgendaICS(events = [], { name = 'agenda.ics', dialogTitle = 'Compartir agenda' } = {}) {
  return shareText({ name, text: buildAgendaICS(events), dialogTitle });
}
