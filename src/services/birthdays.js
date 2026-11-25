import { BIRTHDAY_LEADS, dropReminder, syncBirthdayReminder } from './reminders';
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
  };

  if (mode === 'edit') {
    const result = await syncBirthdayReminder({ id, ...payload }, values.notificationId);
    if (!await updateBirthday(id, { ...payload, notificationId: result.notificationId })) {
      return { status: 'write-failed', notice: 'No se pudo guardar el cumpleaños.' };
    }
    return result;
  }

  const created = await addBirthday({ ...payload, notificationId: null });
  if (!created) return { status: 'write-failed', notice: 'No se pudo guardar el cumpleaños.' };
  const result = await syncBirthdayReminder({ id: created.id, ...payload }, null);
  updateBirthday(created.id, { notificationId: result.notificationId });
  return result;
}

export async function deleteBirthdayRecord({ id, birthdays, removeBirthday }) {
  const target = birthdays.find((item) => item.id === id);
  if (target) await dropReminder(target);
  removeBirthday(id);
}
