import { BIRTHDAY_LEADS, dropReminder, syncBirthdayAlarm, syncBirthdayReminder } from './reminders';
import { cancelAlarm } from './notifications';
export { birthdayDateKeyForYear, birthdayOccursOn, birthdayTurnsNext } from './birthdayDates';

export const BIRTHDAY_EMOJIS = ['🎂', '🎉', '🎈', '🎁', '⭐', '🌟', '🎧', '⚽', '📚', '🐱', '🐶', '✈️'];

export function blankBirthday(color, selectedDateKey = '') {
  const monthDay = /^\d{4}-(\d{2}-\d{2})$/.exec(String(selectedDateKey))?.[1] || '01-01';
  return {
    name: '',
    emoji: '🎂',
    dateKey: `2000-${monthDay}`,
    time: '09:00',
    daysBefore: 0,
    color,
    notificationId: null,
    alarmLeadMinutes: null,
    alarmNotificationId: null,
    alarmTime: '09:00',
  };
}

export function birthdayLeadLabel(daysBefore) {
  return BIRTHDAY_LEADS.find((item) => item.value === daysBefore)?.label || 'El mismo día';
}

export async function saveBirthdayRecord({ mode, id, values, addBirthday, updateBirthday }) {
  const payload = {
    name: values.name.trim(),
    emoji: values.emoji,
    dateKey: values.dateKey,
    time: values.time,
    daysBefore: values.daysBefore,
    color: values.color,
    alarmLeadMinutes: values.alarmLeadMinutes ?? null,
    alarmTime: values.alarmTime || '09:00',
  };

  if (mode === 'edit') {
    const result = await syncBirthdayReminder({ id, ...payload }, values.notificationId);
    const alarm = await syncBirthdayAlarm({ id, ...payload }, values.alarmNotificationId);
    if (!await updateBirthday(id, { ...payload, notificationId: result.notificationId, alarmNotificationId: alarm.alarmNotificationId })) {
      return { status: 'write-failed', notice: 'No se pudo guardar el cumpleaños.' };
    }
    return { ...result, notice: alarm.notice || result.notice };
  }

  const created = await addBirthday({ ...payload, notificationId: null, alarmNotificationId: null });
  if (!created) return { status: 'write-failed', notice: 'No se pudo guardar el cumpleaños.' };
  const result = await syncBirthdayReminder({ id: created.id, ...payload }, null);
  const alarm = await syncBirthdayAlarm({ id: created.id, ...payload }, null);
  updateBirthday(created.id, { notificationId: result.notificationId, alarmNotificationId: alarm.alarmNotificationId });
  return { ...result, notice: alarm.notice || result.notice };
}

export async function deleteBirthdayRecord({ id, birthdays, removeBirthday }) {
  const target = birthdays.find((item) => item.id === id);
  if (target) await dropReminder(target);
  if (target?.alarmNotificationId) await cancelAlarm(target.alarmNotificationId);
  removeBirthday(id);
}
