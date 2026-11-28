import * as Notif from './notifications';
import {
  WEEKDAYS,
  buildDateTime,
  fromDateKey,
  nextYearlyOccurrence,
  parseTime,
  toDateKey,
  todayKey,
  weekdayIndex,
} from '../utils/dates';

/** Lead times for calendar events, in minutes. -1 = no reminder. */
export const EVENT_REMINDERS = [
  { label: 'Sin aviso', value: -1 },
  { label: 'A la hora', value: 0 },
  { label: '15 min antes', value: 15 },
  { label: '30 min antes', value: 30 },
  { label: '1 h antes', value: 60 },
  { label: '2 h antes', value: 120 },
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

/**
 * Aviso previo de una clase del horario, en minutos. -1 = sin aviso.
 *
 * Una clase es un bloque semanal sin fecha, así que su recordatorio es un *one-shot* para la
 * próxima ocurrencia (reconstruido en cada arranque por `resyncReminders`): nunca fue un
 * recordatorio recurrente semanal, porque `expo-notifications` aquí solo expone disparos
 * puntuales.
 */
export const CLASS_REMINDERS = [
  { label: 'Desactivado', value: -1 },
  { label: '15 min antes', value: 15 },
  { label: '30 min antes', value: 30 },
  { label: '1 hora antes', value: 60 },
  { label: '2 horas antes', value: 120 },
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
    return { notificationId: null, notice: null, status: 'disabled' };
  }

  const when = buildDateTime(dateKey, time);
  when.setMinutes(when.getMinutes() - leadMinutes);
  const result = await Notif.scheduleAt({
    title: `📌 ${title}`,
    body: notes && notes.trim() ? notes.trim().slice(0, 120) : `A las ${time}.`,
    date: when,
    data: { kind: 'event', itemId: id },
  });

  if (result.status === 'scheduled') return { notificationId: result.id, notice: null, status: result.status };
  return { notificationId: null, notice: describe(result.status, result), status: result.status };
}

export async function syncEventAlarm({ id, dateKey, time, title, alarmTime, alarmLeadMinutes }, existingId) {
  await Notif.cancel(existingId);
  if (alarmLeadMinutes == null) return { alarmNotificationId: null, status: 'disabled' };
  const result = await Notif.scheduleAlarm({ targetDate: buildDateTime(dateKey, alarmTime || time), leadMinutes: alarmLeadMinutes, title: 'Alarma de evento', body: 'Tienes un evento programado.', data: { kind: 'event-alarm', itemId: id }, privateContent: true });
  return result.status === 'scheduled' ? { alarmNotificationId: result.id, status: result.status, precision: result.precision } : { alarmNotificationId: null, status: result.status, notice: describe(result.status, result) };
}

export async function syncNoteAlarm({ id, alarmDateKey, alarmTime, alarmLeadMinutes, private: isPrivate }, existingId) {
  await Notif.cancel(existingId);
  if (alarmLeadMinutes == null || !alarmDateKey || !alarmTime) return { alarmNotificationId: null, status: 'disabled' };
  const result = await Notif.scheduleAlarm({ targetDate: buildDateTime(alarmDateKey, alarmTime), leadMinutes: alarmLeadMinutes, title: 'Alarma de NexusDay', body: 'Tienes una nota programada.', data: { kind: 'note-alarm', itemId: id }, privateContent: Boolean(isPrivate) });
  return result.status === 'scheduled' ? { alarmNotificationId: result.id, status: result.status, precision: result.precision } : { alarmNotificationId: null, status: result.status, notice: describe(result.status, result) };
}


/**
 * Fecha y hora de la próxima ocurrencia de una clase semanal que no esté suspendida.
 *
 * Una asignatura del horario tiene `day` (0 = lunes) y `start`, sin fecha. Aquí se busca el
 * próximo `Date` que caiga en ese día de la semana, a esa hora, saltando los días marcados en
 * `suspended` (un mapa `{ 'YYYY-MM-DD': true }`). Devuelve `null` si no hay ocurrencia en las
 * próximas 8 semanas (por ejemplo, una clase suspendida indefinidamente).
 */
export function nextClassOccurrence({ day, start, suspended = {} }, from = new Date()) {
  const dow = WEEKDAYS[Number(day)]?.dow;
  if (dow == null) return null;
  const { hour, minute } = parseTime(start || '09:00');

  for (let offset = 0; offset < 56; offset += 1) {
    const candidate = new Date(from);
    candidate.setHours(hour, minute, 0, 0);
    candidate.setDate(candidate.getDate() + offset);
    // Solo el día de la semana de la clase cuenta; el resto se descarta.
    if (candidate.getDay() !== dow) continue;
    // Una ocurrencia ya pasada hoy tampoco avisa: se busca la siguiente.
    if (candidate.getTime() <= from.getTime()) continue;
    if (suspended[toDateKey(candidate)]) continue;
    return candidate;
  }
  return null;
}

/** First class whose advance alarm is still in the future. */
export function nextClassAlarmOccurrence(activity, leadMinutes, from = new Date()) {
  const lead = Number(leadMinutes);
  if (!Number.isInteger(lead) || lead < 1) return null;
  return nextClassOccurrence(activity, new Date(from.getTime() + lead * 60000));
}

/**
 * Recordatorio one-shot para una clase del horario, en la próxima ocurrencia no suspendida.
 * Siempre cancela `existingId` primero, igual que el resto de sincronizadores.
 */
export async function syncClassReminder({ id, title, day, start, location, leadMinutes, suspended }, existingId) {
  await Notif.cancel(existingId);

  if (leadMinutes === -1 || leadMinutes == null) {
    return { notificationId: null, notice: null, status: 'disabled' };
  }

  // If this week's lead point already passed, target the following active occurrence.
  const when = nextClassAlarmOccurrence({ day, start, suspended }, leadMinutes);
  if (!when) return { notificationId: null, notice: null, status: 'skipped' };
  const result = await Notif.scheduleAlarm({
    title: `📚 ${title}`,
    body: location ? `${location} · empieza a las ${start}.` : `Empieza a las ${start}.`,
    targetDate: when,
    leadMinutes,
    data: { kind: 'class', itemId: id },
  });

  if (result.status === 'scheduled') {
    return {
      notificationId: result.id,
      notice: result.precision === 'approximate' ? 'La alarma se programó, pero Android puede entregarla con retraso.' : null,
      status: result.status,
      precision: result.precision,
      exactPermission: result.exactPermission,
    };
  }
  return { notificationId: null, notice: describe(result.status, result), status: result.status, precision: result.precision };
}

/** Next enabled routine occurrence whose advance alarm is still in the future. */
export function nextRoutineAlarmOccurrence({ weekdays, startTime, enabled = true, completedDates = [] }, leadMinutes, from = new Date()) {
  if (!enabled || !startTime || !Array.isArray(weekdays) || !weekdays.length) return null;
  const lead = Number(leadMinutes);
  if (!Number.isInteger(lead) || lead < 1) return null;
  const { hour, minute } = parseTime(startTime);
  const threshold = new Date(from.getTime() + lead * 60000);
  for (let offset = 0; offset < 14; offset += 1) {
    const candidate = new Date(threshold);
    candidate.setHours(hour, minute, 0, 0);
    candidate.setDate(candidate.getDate() + offset);
    if (!weekdays.includes(weekdayIndex(candidate))) continue;
    if (candidate.getTime() <= threshold.getTime()) continue;
    if (completedDates.includes(toDateKey(candidate))) continue;
    return candidate;
  }
  return null;
}

export async function syncRoutineAlarm(routine, existingId = routine?.alarmNotificationId) {
  await Notif.cancel(existingId);
  const leadMinutes = routine?.alarmLeadMinutes;
  if (routine?.enabled === false || leadMinutes == null || !routine?.startTime) {
    return { alarmNotificationId: null, notice: null, status: 'disabled' };
  }
  const targetDate = nextRoutineAlarmOccurrence(routine, leadMinutes);
  if (!targetDate) return { alarmNotificationId: null, notice: null, status: 'skipped' };
  const result = await Notif.scheduleAlarm({
    title: `Rutina: ${routine.name}`,
    body: `Comienza a las ${routine.startTime}.`,
    targetDate,
    leadMinutes,
    data: { kind: 'routine', itemId: routine.id },
  });
  if (result.status === 'scheduled') {
    return {
      alarmNotificationId: result.id,
      notice: result.precision === 'approximate' ? 'La alarma se programó, pero Android puede entregarla con retraso.' : null,
      status: result.status,
      precision: result.precision,
    };
  }
  return { alarmNotificationId: null, notice: describe(result.status, result), status: result.status };
}

/**
 * Rearma en cada arranque lo que quedó sin recordatorio.
 *
 * Android descarga las notificaciones programadas tras un reinicio o una actualización, y lo
 * guardado con los permisos aún apagados nunca recibió un id. Esto rearma solo lo que falta —
 * los ítems que ya tienen `notificationId` se dejan intactos — y las fechas pasadas fallan en
 * silencio, así que es seguro ejecutarlo una vez por arranque. Los recordatorios de clase y de
 * hábito son one-shot: deben reconstruirse aquí o quedarían mudos tras el que ya disparó.
 */
export async function resyncReminders({ events = [], birthdays = [], notes = [], habits = [], activities = [], routines = [] }) {
  const eventPatches = [];
  const birthdayPatches = [];
  const eventAlarmPatches = [];
  const birthdayAlarmPatches = [];
  const noteAlarmPatches = [];
  const habitPatches = [];
  const activityPatches = [];
  const routinePatches = [];
  const failures = [];
  const scheduledAlarmIds = new Set((await Notif.getScheduledAlarms()).map((request) => request.identifier));
  const recordOutcome = (result, domain, id, patches) => {
    if (result.notificationId) patches.push({ id, notificationId: result.notificationId });
    else if (result.status && !['disabled', 'skipped', 'past'].includes(result.status)) {
      failures.push({ domain, id, status: result.status });
    }
  };

  for (const event of events) {
    if (event.alarmLeadMinutes == null && event.alarmNotificationId) {
      await Notif.cancel(event.alarmNotificationId);
      eventAlarmPatches.push({ id: event.id, alarmNotificationId: null });
    }
    if (!event.notificationId && (event.leadMinutes ?? -1) !== -1) recordOutcome(await syncEventReminder(event, null), 'events', event.id, eventPatches);
    if (event.alarmLeadMinutes != null && (!event.alarmNotificationId || !scheduledAlarmIds.has(event.alarmNotificationId))) {
      const result = await syncEventAlarm(event, null);
      if (result.alarmNotificationId) eventAlarmPatches.push({ id: event.id, alarmNotificationId: result.alarmNotificationId });
      else if (result.status && !['disabled', 'skipped', 'past'].includes(result.status)) failures.push({ domain: 'event-alarms', id: event.id, status: result.status });
    }
  }

  for (const birthday of birthdays) {
    if (birthday.alarmLeadMinutes == null && birthday.alarmNotificationId) {
      await Notif.cancel(birthday.alarmNotificationId);
      birthdayAlarmPatches.push({ id: birthday.id, alarmNotificationId: null });
    }
    if (!birthday.notificationId) recordOutcome(await syncBirthdayReminder(birthday, null), 'birthdays', birthday.id, birthdayPatches);
    if (birthday.alarmLeadMinutes != null && (!birthday.alarmNotificationId || !scheduledAlarmIds.has(birthday.alarmNotificationId))) {
      const result = await syncBirthdayAlarm(birthday, null);
      if (result.alarmNotificationId) birthdayAlarmPatches.push({ id: birthday.id, alarmNotificationId: result.alarmNotificationId });
      else if (result.status && !['disabled', 'skipped', 'past'].includes(result.status)) failures.push({ domain: 'birthday-alarms', id: birthday.id, status: result.status });
    }
  }

  for (const note of notes) {
    if (note.alarmLeadMinutes == null && note.alarmNotificationId) {
      await Notif.cancel(note.alarmNotificationId);
      noteAlarmPatches.push({ id: note.id, alarmNotificationId: null });
    } else if (note.alarmLeadMinutes != null && (!note.alarmNotificationId || !scheduledAlarmIds.has(note.alarmNotificationId))) {
      const result = await syncNoteAlarm(note, null);
      if (result.alarmNotificationId) noteAlarmPatches.push({ id: note.id, alarmNotificationId: result.alarmNotificationId });
      else if (result.status && !['disabled', 'skipped', 'past'].includes(result.status)) failures.push({ domain: 'note-alarms', id: note.id, status: result.status });
    }
  }

  for (const habit of habits) {
    if (habit.notificationId || !habit.remindAt) continue;
    recordOutcome(await syncHabitReminder(habit, null), 'habits', habit.id, habitPatches);
  }

  // Class reminders are one-shots for the next occurrence, so they must be re-armed every
  // start — exactly like habits — or the class would go silent after the one that fired.
  for (const activity of activities) {
    if ((activity.leadMinutes ?? -1) === -1) continue;
    if (activity.notificationId && scheduledAlarmIds.has(activity.notificationId)) continue;
    recordOutcome(await syncClassReminder(activity, null), 'activities', activity.id, activityPatches);
  }

  for (const routine of routines) {
    if (routine.enabled === false || routine.alarmLeadMinutes == null || !routine.startTime) {
      if (routine.alarmNotificationId) {
        await Notif.cancel(routine.alarmNotificationId);
        routinePatches.push({ id: routine.id, alarmNotificationId: null });
      }
      continue;
    }
    if (routine.alarmNotificationId && scheduledAlarmIds.has(routine.alarmNotificationId)) continue;
    const result = await syncRoutineAlarm(routine, null);
    if (result.alarmNotificationId) routinePatches.push({ id: routine.id, alarmNotificationId: result.alarmNotificationId });
    else if (result.status && !['disabled', 'skipped', 'past'].includes(result.status)) failures.push({ domain: 'routines', id: routine.id, status: result.status });
  }

  return { eventPatches, birthdayPatches, eventAlarmPatches, birthdayAlarmPatches, noteAlarmPatches, habitPatches, activityPatches, routinePatches, failures };
}

/**
 * Rebuilds the yearly birthday reminder.
 * The anchor date is (next birthday - daysBefore), and the trigger repeats
 * annually on that anchor, so it keeps firing every year without re-syncing.
 */
export async function syncBirthdayReminder({ id, name, dateKey, time, daysBefore }, existingId) {
  await Notif.cancel(existingId);

  if (daysBefore == null) return { notificationId: null, notice: null, status: 'disabled' };

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

  if (result.status === 'scheduled') return { notificationId: result.id, notice: null, status: result.status };
  return { notificationId: null, notice: describe(result.status, result), status: result.status };
}

export async function syncBirthdayAlarm({ id, dateKey, alarmTime = '09:00', alarmLeadMinutes }, existingId) {
  await Notif.cancel(existingId);
  if (alarmLeadMinutes == null) return { alarmNotificationId: null, status: 'disabled' };
  const birth = fromDateKey(dateKey);
  const { hour, minute } = parseTime(alarmTime || '09:00');
  const result = await Notif.scheduleAlarm({ targetDate: nextYearlyOccurrence(birth.getMonth(), birth.getDate(), hour, minute), leadMinutes: alarmLeadMinutes, title: 'Alarma de cumpleaños', body: 'Tienes un cumpleaños próximo.', data: { kind: 'birthday-alarm', itemId: id }, privateContent: true });
  return result.status === 'scheduled' ? { alarmNotificationId: result.id, status: result.status, precision: result.precision } : { alarmNotificationId: null, status: result.status, notice: describe(result.status, result) };
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
  if (!remindAt || done) return { notificationId: null, notice: null, status: 'disabled' };

  const result = await Notif.scheduleAt({
    title: `${emoji || '✅'} ${name}`,
    body: 'Toca “✓ Completar” para marcarlo sin abrir la app.',
    date: buildDateTime(today, remindAt),
    data: { kind: 'habit', itemId: id },
  });

  if (result.status === 'scheduled') return { notificationId: result.id, notice: null, status: result.status };
  return { notificationId: null, notice: describe(result.status, result), status: result.status };
}
