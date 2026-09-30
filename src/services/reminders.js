import * as Notif from './notifications';
import { buildDateTime, fromDateKey, nextYearlyOccurrence, parseTime, todayKey } from '../utils/dates';

/** Lead times for calendar events, in minutes. -1 = no reminder. */
export const EVENT_REMINDERS = [
  { label: 'Sin aviso', value: -1 },
  { label: 'A la hora', value: 0 },
  { label: '10 min antes', value: 10 },
  { label: '30 min antes', value: 30 },
  { label: '1 h antes', value: 60 },
  { label: '1 día antes', value: 1440 },
];

/** How many days before the birthday the yearly reminder should fire. 7 = a week before. */
export const BIRTHDAY_LEADS = [
  { label: 'El mismo día', value: 0 },
  { label: '1 día antes', value: 1 },
  { label: '3 días antes', value: 3 },
  { label: '1 semana antes', value: 7 },
];

/**
 * Times offered per habit. A habit reminder is a one-shot for *today* (rebuilt on every
 * app start by `resyncReminders`), so it never fires on a day the habit is already ticked.
 */
export const HABIT_REMINDERS = [
  { label: 'Sin aviso', value: null },
  { label: '08:00', value: '08:00' },
  { label: '13:00', value: '13:00' },
  { label: '18:00', value: '18:00' },
  { label: '21:00', value: '21:00' },
  { label: '22:30', value: '22:30' },
];

const NOTICES = {
  unsupported: 'Este dispositivo no soporta notificaciones locales.',
  denied: 'Bloqueaste los permisos: se guardó sin recordatorio. Puedes activarlos luego.',
  past: 'La fecha del recordatorio ya pasó: se guardó sin notificación.',
  error: 'No se pudo programar la notificación. Se guardó sin recordatorio.',
  invalid: 'Falta la fecha u hora del recordatorio. Se guardó sin notificación.',
};

function describe(status, result) {
  if (status === 'denied' && result?.canAskAgain === false) {
    return 'Los permisos de notificación están denegados permanentemente. Actívalos en Ajustes.';
  }
  return NOTICES[status] || NOTICES.error;
}

/** Cancels a reminder that is no longer needed. Safe with null/unknown ids. */
export async function dropReminder(item) {
  if (!item || !item.notificationId) return;
  await Notif.cancel(item.notificationId);
}

/**
 * Rebuilds the notification for a calendar event.
 * Always cancels `existingId` first, so editing an event never leaves orphans.
 */
export async function syncEventReminder({ id, title, notes, dateKey, time, leadMinutes }, existingId) {
  await Notif.cancel(existingId);

  if (leadMinutes === -1 || leadMinutes == null) {
    return { notificationId: null, notice: null };
  }

  const when = buildDateTime(dateKey, time);
  when.setMinutes(when.getMinutes() - leadMinutes);

  const result = await Notif.scheduleAt({
    title: `📌 ${title}`,
    body: notes && notes.trim() ? notes.trim().slice(0, 120) : `A las ${time}.`,
    date: when,
    data: { kind: 'event', itemId: id },
  });

  if (result.status === 'scheduled') return { notificationId: result.id, notice: null };
  return { notificationId: null, notice: describe(result.status, result) };
}

/**
 * Android drops scheduled notifications after a reboot or an app update, and
 * anything saved while permission was still off never got an id in the first
 * place. This re-arms only what is missing — items that already hold a
 * notificationId are left untouched — and past dates fail quietly, so it is
 * safe to run once per app start.
 */
export async function resyncReminders({ events = [], birthdays = [], habits = [] }) {
  const eventPatches = [];
  const birthdayPatches = [];
  const habitPatches = [];

  for (const event of events) {
    if (event.notificationId || (event.leadMinutes ?? -1) === -1) continue;
    const { notificationId } = await syncEventReminder(event, null);
    if (notificationId) eventPatches.push({ id: event.id, notificationId });
  }

  for (const birthday of birthdays) {
    if (birthday.notificationId) continue;
    const { notificationId } = await syncBirthdayReminder(birthday, null);
    if (notificationId) birthdayPatches.push({ id: birthday.id, notificationId });
  }

  for (const habit of habits) {
    if (habit.notificationId || !habit.remindAt) continue;
    const { notificationId } = await syncHabitReminder(habit, null);
    if (notificationId) habitPatches.push({ id: habit.id, notificationId });
  }

  return { eventPatches, birthdayPatches, habitPatches };
}

/**
 * Rebuilds the yearly birthday reminder.
 * The anchor date is (next birthday - daysBefore), and the trigger repeats
 * annually on that anchor, so it keeps firing every year without re-syncing.
 */
export async function syncBirthdayReminder({ id, name, dateKey, time, daysBefore }, existingId) {
  await Notif.cancel(existingId);

  if (daysBefore == null) return { notificationId: null, notice: null };

  const birth = fromDateKey(dateKey);
  const { hour, minute } = parseTime(time);
  const upcoming = nextYearlyOccurrence(birth.getMonth(), birth.getDate(), hour, minute);
  const anchor = new Date(upcoming.getTime() - daysBefore * 86400000);
  const lead = daysBefore === 0 ? 'Hoy' : `En ${daysBefore} día${daysBefore === 1 ? '' : 's'}`;

  const result = await Notif.scheduleYearly({
    title: `🎂 ${name}`,
    body: `Su cumpleaños es ${lead.toLowerCase()} a las ${time}.`,
    month: anchor.getMonth(),
    day: anchor.getDate(),
    hour,
    minute,
    data: { kind: 'birthday', itemId: id },
  });

  if (result.status === 'scheduled') return { notificationId: result.id, notice: null };
  return { notificationId: null, notice: describe(result.status, result) };
}

/**
 * Daily nudge for a habit, scheduled for *today* only.
 *
 * It is cancelled as soon as the day is ticked (or the reminder is turned off), and
 * `resyncReminders` rebuilds it on the next app start, so a habit never gets a 3 a.m.
 * notification for something already done.
 */
export async function syncHabitReminder({ id, name, emoji, marks, remindAt }, existingId) {
  await Notif.cancel(existingId);

  const today = todayKey();
  const done = Array.isArray(marks) && marks.includes(today);
  if (!remindAt || done) return { notificationId: null, notice: null };

  const result = await Notif.scheduleAt({
    title: `${emoji || '✅'} ${name}`,
    body: 'Tocá “✓ Completar” para marcarlo sin abrir el app.',
    date: buildDateTime(today, remindAt),
    data: { kind: 'habit', itemId: id },
  });

  if (result.status === 'scheduled') return { notificationId: result.id, notice: null };
  return { notificationId: null, notice: describe(result.status, result) };
}
