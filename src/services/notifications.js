import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility, AndroidAudioUsage, AndroidAudioContentType } from 'expo-notifications';
import { KEYS, mutateCollection } from './storage';
import { todayKey } from '../utils/dates';
import { colors } from '../theme/theme';

/**
 * Local notifications only (no push tokens, no backend).
 *
 * SDK 57 notes (verified against node_modules/expo-notifications/build):
 * - `setNotificationHandler` returns a `NotificationBehavior` that uses
 *   `shouldShowBanner` / `shouldShowList` (`shouldShowAlert` is deprecated).
 *   Without a handler, foreground notifications are silently dropped.
 * - Triggers must be `{ type: SchedulableTriggerInputTypes.X, ... }`.
 * - Android needs a notification channel; iOS ignores it, so it is only
 *   created on Android.
 * - Interactive actions: `setNotificationCategoryAsync` is implemented natively on
 *   both platforms in this version (`ExpoNotificationCategoriesModule.kt`), and the
 *   chosen `actionIdentifier` arrives through the response listener. The category id
 *   must not contain ":" or "-".
 */

/**
 * Android channel id.
 *
 * `v2` because Android freezes `importance`/`sound` once a channel exists: a new id is the
 * only way to hand users the alarm-grade channel without uninstalling. Notifications that
 * were scheduled before the upgrade keep pointing at the old channel and still fire.
 */
export const CHANNEL_ID = 'recordatorios_v2';
export const ALARM_CHANNEL_ID = 'alarmas_v1';
export const CATEGORY_ID = 'nexusday_recordatorio';

/** Action ids shared by the category buttons and the response handler. */
export const ACTIONS = {
  complete: 'complete',
  snooze: 'snooze',
};

/** Minutes a "⏱ Posponer" pushes a reminder back. */
export const SNOOZE_MINUTES = 15;
export const ALARM_LEAD_PRESETS = Object.freeze([15, 30, 60, 120]);
export const MAX_CUSTOM_ALARM_LEAD_MINUTES = 7 * 24 * 60;

let handlerConfigured = false;
let channelReady = false;
let alarmChannelReady = false;
let categoryReady = false;
let responseListenerAttached = false;

/** Response ids already handled, so a cold start never runs an action twice. */
const handledResponses = new Set();

const unsupported = () => ({ status: 'unsupported', granted: false, canAskAgain: false });

export function isSupported() {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

/** Declares the two direct actions: tick a habit off, or push the reminder 15 minutes. */
async function registerCategory() {
  if (categoryReady || !isSupported()) return;
  try {
    await Notifications.setNotificationCategoryAsync(CATEGORY_ID, [
      { identifier: ACTIONS.complete, buttonTitle: '✓ Completar' },
      { identifier: ACTIONS.snooze, buttonTitle: '⏱ Posponer' },
    ]);
    categoryReady = true;
  } catch (error) {
    console.warn('[notifications] could not register the category', error);
  }
}

/** Must run once, as early as possible, before any notification is scheduled. */
export function configureNotifications() {
  if (handlerConfigured || !isSupported()) return;
  handlerConfigured = true;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch (error) {
    console.warn('[notifications] could not register the foreground handler', error);
  }

  if (!responseListenerAttached) {
    responseListenerAttached = true;
    Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationResponse(response);
    });
    // A tap that launched the app from cold start has no listener attached, so the last
    // response is read once here.
    Notifications.getLastNotificationResponseAsync()
      .then((response) => handleNotificationResponse(response))
      .catch((error) => console.warn('[notifications] last response unavailable', error));
  }

  registerCategory();
}

async function ensureChannel() {
  if (Platform.OS !== 'android' || channelReady) return;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Recordatorios',
      description: 'Avisos de eventos, horarios, cumpleaños y hábitos.',
      // Alarm-grade: heads-up, sound, vibration, and the alarm audio attributes so the
      // volume slider in ring mode still gets it through.
      importance: AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 150, 250],
      lightColor: colors.accent,
      enableLights: true,
      enableVibrate: true,
      bypassDnd: true,
      lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
      audioAttributes: {
        usage: AndroidAudioUsage.ALARM,
        contentType: AndroidAudioContentType.SONIFICATION,
        flags: { enforceAudibility: true, requestHardwareAudioVideoSynchronization: false },
      },
    });
    channelReady = true;
  } catch (error) {
    console.warn('[notifications] could not create the Android channel', error);
  }
}

async function ensureAlarmChannel() {
  if (Platform.OS !== 'android' || alarmChannelReady) return;
  try {
    await Notifications.setNotificationChannelAsync(ALARM_CHANNEL_ID, {
      name: 'Alarmas',
      description: 'Alarmas explícitas programadas por el usuario.',
      importance: AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 300, 150, 300],
      enableVibrate: true,
      lockscreenVisibility: AndroidNotificationVisibility.PRIVATE,
      audioAttributes: {
        usage: AndroidAudioUsage.ALARM,
        contentType: AndroidAudioContentType.SONIFICATION,
        flags: { enforceAudibility: true, requestHardwareAudioVideoSynchronization: false },
      },
    });
    alarmChannelReady = true;
  } catch (error) {
    console.warn('[notifications] could not create the Android alarm channel', error);
  }
}

function normalize(response) {
  if (!response) return unsupported();
  return {
    status: response.status ?? 'unknown',
    granted: Boolean(response.granted),
    canAskAgain: response.canAskAgain !== false,
  };
}

export async function getPermissionStatus() {
  if (!isSupported()) return unsupported();
  try {
    return normalize(await Notifications.getPermissionsAsync());
  } catch (error) {
    console.warn('[notifications] getPermissionsAsync failed', error);
    return unsupported();
  }
}

export async function requestPermission() {
  if (!isSupported()) return unsupported();
  configureNotifications();
  try {
    return normalize(await Notifications.requestPermissionsAsync());
  } catch (error) {
    console.warn('[notifications] requestPermissionsAsync failed', error);
    return unsupported();
  }
}

/**
 * Schedules a one-shot notification at an absolute date.
 * Never throws: the caller gets a machine readable `status` instead,
 * so a permission denial can be surfaced in the UI without losing the saved item.
 */
export async function scheduleAt({ title, body, date, data, delivery = 'bestEffort', channelId = CHANNEL_ID }) {
  if (!isSupported()) return { status: 'unsupported' };
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return { status: 'invalid' };
  if (date.getTime() <= Date.now() + 2000) return { status: 'past' };

  configureNotifications();
  if (channelId === ALARM_CHANNEL_ID) await ensureAlarmChannel();
  else await ensureChannel();

  const permission = await requestPermission();
  if (!permission.granted) return { status: 'denied', canAskAgain: permission.canAskAgain };

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        // iOS 15+ honours this: reminders come through even in a Focus mode.
        interruptionLevel: 'timeSensitive',
        categoryIdentifier: CATEGORY_ID,
        data: { source: 'nexusday', ...data },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
        channelId,
        ...(Platform.OS === 'android' ? { delivery } : {}),
      },
    });
    return { status: 'scheduled', id };
  } catch (error) {
    console.warn('[notifications] scheduleAt failed', error);
    return { status: 'error' };
  }
}

/** Accepts the four presets and custom whole-minute leads up to seven days. */
export function normalizeAlarmLead(value) {
  const minutes = typeof value === 'string' && value.trim() ? Number(value) : value;
  return Number.isInteger(minutes) && minutes >= 1 && minutes <= MAX_CUSTOM_ALARM_LEAD_MINUTES
    ? minutes
    : null;
}

/** Pure calculation shared by every future alarm editor. */
export function calculateAlarmDate({ targetDate, leadMinutes, now = new Date() }) {
  const lead = normalizeAlarmLead(leadMinutes);
  if (!(targetDate instanceof Date) || Number.isNaN(targetDate.getTime()) || !lead) {
    return { status: 'invalid', date: null, leadMinutes: lead };
  }
  const date = new Date(targetDate.getTime() - lead * 60000);
  if (date.getTime() <= now.getTime() + 2000) return { status: 'past', date, leadMinutes: lead };
  return { status: 'ready', date, leadMinutes: lead };
}

/** Checks or opens Android's exact-alarm settings; callers decide when prompting is appropriate. */
export async function getExactAlarmPermission({ request = false } = {}) {
  if (Platform.OS !== 'android') return { status: 'not-required', granted: true, canAskAgain: false };
  const operation = request
    ? Notifications.requestExactAlarmPermissionsAsync
    : Notifications.getExactAlarmPermissionsAsync;
  if (typeof operation !== 'function') return { status: 'unavailable', granted: false, canAskAgain: false };
  try {
    const response = await operation();
    return {
      status: response.granted ? 'granted' : 'denied',
      granted: Boolean(response.granted),
      canAskAgain: response.canAskAgain !== false,
    };
  } catch (error) {
    console.warn('[notifications] exact alarm permission unavailable', error);
    return { status: 'error', granted: false, canAskAgain: false };
  }
}

function alarmData(data = {}) {
  const safe = { source: 'nexusday', alarm: true };
  if (typeof data.kind === 'string') safe.kind = data.kind;
  if (typeof data.itemId === 'string' || Number.isFinite(data.itemId)) safe.itemId = data.itemId;
  if (typeof data.alarmKey === 'string') safe.alarmKey = data.alarmKey;
  return safe;
}

/** Schedules an explicit alarm; denied exact access degrades honestly to best-effort delivery. */
export async function scheduleAlarm({ targetDate, leadMinutes, title, body, data, privateContent = false }) {
  const calculated = calculateAlarmDate({ targetDate, leadMinutes });
  if (calculated.status !== 'ready') return calculated;

  const exact = await getExactAlarmPermission();
  const exactDelivery = Platform.OS === 'android' && exact.granted;
  const result = await scheduleAt({
    title: privateContent ? 'Alarma de NexusDay' : String(title || 'Alarma de NexusDay').slice(0, 80),
    body: privateContent ? 'Tienes una alarma programada.' : String(body || 'Tienes una alarma programada.').slice(0, 160),
    date: calculated.date,
    data: alarmData(data),
    delivery: exactDelivery ? 'alarmClock' : 'bestEffort',
    channelId: ALARM_CHANNEL_ID,
  });
  return {
    ...result,
    precision: exact.granted ? 'exact' : 'approximate',
    exactPermission: exact.status,
    date: calculated.date,
    leadMinutes: calculated.leadMinutes,
  };
}

export async function getScheduledAlarms() {
  if (!isSupported()) return [];
  try {
    const requests = await Notifications.getAllScheduledNotificationsAsync();
    return requests.filter((request) => request.content?.data?.source === 'nexusday' && request.content?.data?.alarm === true);
  } catch (error) {
    console.warn('[notifications] scheduled alarms unavailable', error);
    return [];
  }
}

/** Read-only reconciliation: reports missing links and scheduled orphans without mutating storage. */
export async function reconcileAlarms(records = []) {
  const scheduled = await getScheduledAlarms();
  const scheduledIds = new Set(scheduled.map((request) => request.identifier));
  // Alarm links are deliberately separate from historical reminder links. Never inspect or
  // mutate `notificationId` here: it belongs to the legacy reminder service.
  const linkedIds = new Set(records.map((record) => record?.alarmNotificationId).filter(Boolean));
  return {
    scheduled,
    missing: records.filter((record) => record?.alarmNotificationId && !scheduledIds.has(record.alarmNotificationId)),
    unlinked: scheduled.filter((request) => !linkedIds.has(request.identifier)),
  };
}

/**
 * Schedules a notification that repeats every year on month/day (month is 0-based).
 * Used for birthday reminders so they survive year boundaries without re-syncing.
 */
export async function scheduleYearly({ title, body, month, day, hour, minute, data }) {
  if (!isSupported()) return { status: 'unsupported' };

  configureNotifications();
  await ensureChannel();

  const permission = await requestPermission();
  if (!permission.granted) return { status: 'denied', canAskAgain: permission.canAskAgain };

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        interruptionLevel: 'timeSensitive',
        categoryIdentifier: CATEGORY_ID,
        data: { source: 'nexusday', repeats: 'yearly', ...data },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.YEARLY,
        month,
        day,
        hour,
        minute,
        channelId: CHANNEL_ID,
      },
    });
    return { status: 'scheduled', id };
  } catch (error) {
    console.warn('[notifications] scheduleYearly failed', error);
    return { status: 'error' };
  }
}

export async function cancel(id) {
  if (!id || !isSupported()) return false;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
    return true;
  } catch (error) {
    // A stale id (already fired / cleared by an app update) is not an error worth surfacing.
    console.warn('[notifications] cancel failed', error);
    return false;
  }
}

export const cancelAlarm = cancel;

/* ------------------------------------------------------------------ *
 * Interactive actions ("✓ Completar" / "⏱ Posponer")
 * ------------------------------------------------------------------ */

/** Collections that can hold a `notificationId`, so a snooze can keep the link alive. */
const REMINDER_COLLECTIONS = [KEYS.events, KEYS.habits, KEYS.birthdays];

/** Ticks today's habit without opening the app, then tells the UI about it. */
async function completeHabit(itemId) {
  const today = todayKey();
  await mutateCollection(KEYS.habits, habits => {
    const habit = habits.find(item => item.id === itemId);
    if (!habit) return null;
    const marks = Array.isArray(habit.marks) ? habit.marks : [];
    if (marks.includes(today) && !habit.notificationId) return null;
    return habits.map(item => item !== habit ? item : {
      ...item, marks: marks.includes(today) ? marks : [...marks, today].sort(), notificationId: null,
    });
  });
}

async function patchNotificationId(itemId, notificationId) {
  for (const key of REMINDER_COLLECTIONS) {
    const changed = await mutateCollection(key, items => {
      if (!items.some(item => item.id === itemId)) return null;
      return items.map(item => item.id === itemId ? { ...item, notificationId } : item);
    });
    if (changed) return;
  }
}

/**
 * Runs the action the user chose in the notification shade.
 *
 * A plain tap (`DEFAULT_ACTION_IDENTIFIER`) only opens the app, so it is ignored here.
 */
export async function handleNotificationResponse(response) {
  if (!response || !isSupported()) return;

  const actionId = response.actionIdentifier;
  if (!actionId || actionId === Notifications.DEFAULT_ACTION_IDENTIFIER) return;

  const request = response.notification?.request;
  const content = request?.content || {};
  const data = content.data || {};
  const responseId = `${request?.identifier || ''}:${actionId}`;
  if (handledResponses.has(responseId)) return;
  handledResponses.add(responseId);

  try {
    if (actionId === ACTIONS.complete) {
      if (data.itemId) await cancel(request.identifier);
      if (data.kind === 'habit' && data.itemId) await completeHabit(data.itemId);
      return;
    }

    if (actionId === ACTIONS.snooze) {
      await cancel(request.identifier);
      const result = await scheduleAt({
        title: content.title,
        body: content.body,
        date: new Date(Date.now() + SNOOZE_MINUTES * 60000),
        data: { ...data, snoozed: true },
      });
      if (result.status === 'scheduled' && data.itemId) {
        await patchNotificationId(data.itemId, result.id);
      }
    }
  } catch (error) {
    console.warn('[notifications] could not run the notification action', error);
  }
}
