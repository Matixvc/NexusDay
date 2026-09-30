import { Platform } from 'react-native';
import { EntityTypes, ExpoCalendarEvent, getCalendarPermissions, getCalendars, requestCalendarPermissions } from 'expo-calendar';
import { WEEKDAYS, buildDateTime, minutesBetween, pad2 } from '../utils/dates';
import { shareText } from './files';

/**
 * Device calendar bridge (SDK 57 API).
 *
 * The legacy `Calendar.createEventAsync / saveEventAsync` helpers are gone: in
 * `expo-calendar` 57 they exist only in `expo-calendar/legacy` and **throw at runtime**
 * (see `build/legacyWarnings.d.ts`). The supported flow is object oriented:
 * - `getCalendars(EntityTypes.EVENT)` → `ExpoCalendar` instances
 * - `calendar.createEvent(details)` → `ExpoCalendarEvent`
 * - `ExpoCalendarEvent.get(id)` → `.update(details)` / `.delete()`
 *
 * Every function here is defensive: on Expo Go, on a simulator without accounts, or when
 * the user says no to the permission, they resolve with a status instead of throwing, so
 * the screens can show a message and keep working with the local copy of the data.
 */

/** `calendarEventId` is what we persist on our own events to keep both sides in sync. */
export const DEFAULT_DURATION = 60;

export function isSupported() {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

/** True when the calendar native module is reachable (Expo Go may not ship it). */
export function isAvailable() {
  try {
    const calendar = require('expo-calendar');
    return typeof calendar?.getCalendars === 'function' && typeof calendar?.ExpoCalendar === 'function';
  } catch {
    return false;
  }
}

const unsupported = () => ({ status: 'unsupported', granted: false, canAskAgain: false });

function normalize(response) {
  if (!response) return unsupported();
  return {
    status: response.status ?? 'unknown',
    granted: Boolean(response.granted),
    canAskAgain: response.canAskAgain !== false,
  };
}

export async function getPermission() {
  if (!isSupported()) return unsupported();
  try {
    return normalize(await getCalendarPermissions());
  } catch (error) {
    console.warn('[calendar] getCalendarPermissions failed', error);
    return unsupported();
  }
}

/**
 * Asks for full access. iOS also offers a write-only variant
 * (`requestCalendarPermissions(true)`) that is enough to insert events, but it hides the
 * user's real calendars, which we need to offer a sensible target and to delete events later.
 */
export async function requestPermission() {
  if (!isSupported()) return unsupported();
  try {
    return normalize(await requestCalendarPermissions());
  } catch (error) {
    console.warn('[calendar] requestCalendarPermissions failed', error);
    return unsupported();
  }
}

let calendarsCache = null;
let preferredCalendarId = null;

/** Writable calendars of the device, as `ExpoCalendar` instances. Cached; `refresh` refetches. */
export async function listCalendars({ refresh = false } = {}) {
  if (!isSupported()) return [];
  if (calendarsCache && !refresh) return calendarsCache;
  try {
    const calendars = await getCalendars(EntityTypes.EVENT);
    calendarsCache = Array.isArray(calendars) ? calendars : [];
    return calendarsCache;
  } catch (error) {
    console.warn('[calendar] getCalendars failed', error);
    return [];
  }
}

export function forgetCalendars() {
  calendarsCache = null;
}

/** Lets the user choose a destination calendar; an unknown id falls back to the default pick. */
export function setPreferredCalendar(calendarId) {
  preferredCalendarId = calendarId || null;
}

/** Permission + destination calendar in one call. Never throws. */
export async function ensureAccess() {
  if (!isSupported()) return { ok: false, status: 'unsupported' };
  const permission = await requestPermission();
  if (!permission.granted) {
    return { ok: false, status: 'denied', canAskAgain: permission.canAskAgain };
  }
  const calendar = await pickWritableCalendar();
  if (!calendar) return { ok: false, status: 'no-calendar' };
  return { ok: true, status: 'ok', calendar, permission };
}

function clip(value, max) {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, max) : '';
}

/**
 * Maps an app event (`{ title, dateKey, time, duration?, endTime?, notes?, location? }`)
 * to the `Partial<Event>` shape `calendar.createEvent` / `event.update` expect.
 */
export function toEventDetails(source, { fallbackDuration = DEFAULT_DURATION } = {}) {
  const startDate = buildDateTime(source.dateKey, source.time);
  const explicit = Number(source.durationMinutes ?? source.duration);
  const derived = source.endTime ? minutesBetween(source.time, source.endTime) : Number.NaN;
  const minutes =
    Number.isFinite(explicit) && explicit > 0
      ? explicit
      : Number.isFinite(derived) && derived > 0
        ? derived
        : fallbackDuration;

  const details = {
    title: clip(source.title, 120) || 'Evento',
    startDate,
    endDate: new Date(startDate.getTime() + minutes * 60000),
    allDay: false,
  };

  const notes = clip(source.notes ?? source.description, 2000);
  if (notes) details.notes = notes;
  const location = clip(source.location, 200);
  if (location) details.location = location;

  return details;
}

async function writeEvent(calendar, event) {
  const details = toEventDetails(event);
  const previous = event.calendarEventId || null;

  try {
    if (previous) {
      try {
        const existing = await ExpoCalendarEvent.get(previous);
        await existing.update(details);
        return { status: 'updated', calendarEventId: existing.id || previous };
      } catch {
        // It was deleted on the device (or belongs to a hidden calendar): insert a fresh copy.
        const recreated = await calendar.createEvent(details);
        return { status: 'created', calendarEventId: recreated.id };
      }
    }
    const created = await calendar.createEvent(details);
    return { status: 'created', calendarEventId: created.id };
  } catch (error) {
    console.warn('[calendar] could not write the event', error);
    return { status: 'error', calendarEventId: previous };
  }
}

/**
 * Creates or updates the device event behind `event`.
 * Resolves `{ status, calendarEventId }`; store `calendarEventId` back on the app event.
 */
export async function syncEvent(event) {
  const access = await ensureAccess();
  if (!access.ok) return { status: access.status, calendarEventId: event?.calendarEventId ?? null, canAskAgain: access.canAskAgain };
  const result = await writeEvent(access.calendar, event);
  return { ...result, calendarTitle: access.calendar.title || '' };
}

/**
 * Pushes a batch of app events to the device.
 * Returns `{ status, created, updated, failed, patches }` where `patches` is a list of
 * `{ id, calendarEventId }` ready to hand to `patchEvent`/`updateMany` in the context.
 */
export async function syncAllEvents(events = []) {
  const access = await ensureAccess();
  if (!access.ok) {
    return { status: access.status, created: 0, updated: 0, failed: 0, patches: [], canAskAgain: access.canAskAgain };
  }

  let created = 0;
  let updated = 0;
  let failed = 0;
  const patches = [];

  for (const event of events) {
    if (!event?.dateKey || !event?.time) {
      failed += 1;
      continue;
    }
    const result = await writeEvent(access.calendar, event);
    if (result.status === 'created' || result.status === 'updated') {
      if (result.status === 'created') created += 1;
      else updated += 1;
      if (event.calendarEventId !== result.calendarEventId) {
        patches.push({ id: event.id, calendarEventId: result.calendarEventId });
      }
    } else {
      failed += 1;
    }
  }

  const status = created || updated ? (failed ? 'partial' : 'ok') : 'error';
  return { status, created, updated, failed, patches, calendarTitle: access.calendar.title || '' };
}

/** Deletes the device event referenced by an id or an app event. Returns whether it worked. */
export async function removeEvent(reference) {
  const eventId = typeof reference === 'string' ? reference : reference?.calendarEventId;
  if (!eventId || !isSupported()) return false;
  try {
    const event = await ExpoCalendarEvent.get(eventId);
    await event.delete();
    return true;
  } catch (error) {
    console.warn('[calendar] could not delete the event', error);
    return false;
  }
}

/** Deletes every device event the app created for the given app events. */
export async function removeSyncedEvents(events = []) {
  const ids = events.map((event) => event?.calendarEventId).filter(Boolean);
  let removed = 0;
  for (const id of ids) {
    const ok = await removeEvent(id);
    if (ok) removed += 1;
  }
  return { requested: ids.length, removed };
}

/**
 * Repeats a set of agenda activities (`{ title, start, end, location }`) on the same weekday
 * for the next `weeks` weeks. Used by "pasarlo al calendario" on the schedule screen.
 */
export async function syncActivities({ activities = [], dayIndex = 0, weeks = 4 } = {}) {
  const access = await ensureAccess();
  if (!access.ok) {
    return { status: access.status, created: 0, failed: 0, canAskAgain: access.canAskAgain };
  }

  const weekday = WEEKDAYS[dayIndex] ?? WEEKDAYS[0];
  const today = new Date();
  let created = 0;
  let failed = 0;

  for (let week = 0; week < weeks; week += 1) {
    const dateKey = nextDateKey(weekday.dow, today, week);
    for (const activity of activities) {
      if (!activity?.title || !activity?.start) {
        failed += 1;
        continue;
      }
      const result = await writeEvent(access.calendar, {
        title: activity.title,
        dateKey,
        time: activity.start,
        endTime: activity.end,
        location: activity.location,
        notes: activity.notes,
      });
      if (result.status === 'created' || result.status === 'updated') created += 1;
      else failed += 1;
    }
  }

  const status = created ? (failed ? 'partial' : 'ok') : 'error';
  return { status, created, failed, weekday: weekday.long, calendarTitle: access.calendar.title || '' };
}

/** First date, `weekOffset` weeks after `from`, that falls on JS weekday `dow` (0 = domingo). */
export function nextDateKey(dow, from = new Date(), weekOffset = 0) {
  const base = new Date(from);
  base.setHours(0, 0, 0, 0);
  const shift = (Number(dow) - base.getDay() + 7) % 7 + Math.max(0, Number(weekOffset) || 0) * 7;
  base.setDate(base.getDate() + shift);
  return `${base.getFullYear()}-${pad2(base.getMonth() + 1)}-${pad2(base.getDate())}`;
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

/**
 * Serialises app events as an `.ics` file (RFC 5545). This is the fallback path when the
 * user does not want to grant calendar access: the file can be opened or shared anywhere.
 */
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
    const details = toEventDetails(event);
    const uid = event.calendarEventId || event.id || `evento-${index}`;
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

const STATUS_MESSAGES = {
  unsupported: 'Este dispositivo no permite acceder a su calendario.',
  denied: 'Sin acceso al calendario. Puedes activarlo en Ajustes › NexusDay › Calendario.',
  'no-calendar': 'No hay ningún calendario editable en este dispositivo.',
  error: 'El calendario del dispositivo rechazó la operación.',
  partial: 'Algunos eventos no se pudieron guardar en el calendario.',
};

/** Human readable reason for a failed calendar operation, or `null` when it went fine. */
export function describeCalendarStatus(status, canAskAgain = true) {
  if (!status || status === 'ok') return null;
  if (status === 'denied' && canAskAgain === false) return STATUS_MESSAGES.denied;
  if (status === 'denied') return 'Permiso de calendario denegado.';
  return STATUS_MESSAGES[status] || STATUS_MESSAGES.error;
}

/** One-liner describing the outcome of `syncAllEvents` / `syncActivities`. */
export function describeSyncResult(result) {
  if (!result) return STATUS_MESSAGES.error;
  if (result.status === 'denied' || result.status === 'unsupported' || result.status === 'no-calendar') {
    return describeCalendarStatus(result.status, result.canAskAgain);
  }
  const saved = (result.created || 0) + (result.updated || 0);
  const where = result.calendarTitle ? ` en ${result.calendarTitle}` : '';
  if (!saved) return STATUS_MESSAGES.error;
  if (result.failed) return `${saved} evento(s) guardados${where} y ${result.failed} sin guardar.`;
  return `${saved} evento(s) guardados${where}.`;
}




/** Simple `{ id, title }` list for the UI. */
export async function listCalendarOptions() {
  const calendars = await listCalendars();
  return calendars.map((calendar) => ({
    id: calendar.id,
    title: calendar.title || 'Calendario',
    writable: calendar.allowsModifications !== false,
    primary: Boolean(calendar.isPrimary),
  }));
}

/** The calendar we will write into: the preferred one, then the first writable, then any. */
export async function pickWritableCalendar(options = {}) {
  const calendars = await listCalendars(options);
  if (!calendars.length) return null;
  const writable = calendars.filter((calendar) => calendar.allowsModifications !== false);
  const pool = writable.length ? writable : calendars;
  const chosen =
    pool.find((calendar) => calendar.id === preferredCalendarId) ||
    pool.find((calendar) => calendar.isPrimary) ||
    pool[0];
  preferredCalendarId = chosen?.id ?? preferredCalendarId;
  return chosen ?? null;
}
