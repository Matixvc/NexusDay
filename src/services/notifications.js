import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { KEYS, loadJSON, saveJSON } from './storage';
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
export const CATEGORY_ID = 'nexusday_recordatorio';

/** Action ids shared by the category buttons and the response handler. */
export const ACTIONS = {
  complete: 'complete',
  snooze: 'snooze',
};

/** Minutes a "⏱ Posponer" pushes a reminder back. */
export const SNOOZE_MINUTES = 15;

let handlerConfigured = false;
let channelReady = false;
let categoryReady = false;
let responseListenerAttached = false;

/** Response ids already handled, so a cold start never runs an action twice. */
const handledResponses = new Set();

/** Subscribers that mirror an action onto the live UI (see AppDataContext). */
const actionListeners = new Set();

export function subscribeToNotificationActions(listener) {
  actionListeners.add(listener);
  return () => actionListeners.delete(listener);
}

function emitAction(action) {
  actionListeners.forEach((listener) => {
    try {
      listener(action);
    } catch (error) {
      console.warn('[notifications] an action listener failed', error);
    }
  });
}

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
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 150, 250],
      lightColor: colors.accent,
      enableLights: true,
      enableVibrate: true,
      bypassDnd: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.ALARM,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
        flags: { enforceAudibility: true, requestHardwareAudioVideoSynchronization: false },
      },
    });
    channelReady = true;
  } catch (error) {
    console.warn('[notifications] could not create the Android channel', error);
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
export async function scheduleAt({ title, body, date, data }) {
  if (!isSupported()) return { status: 'unsupported' };
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return { status: 'invalid' };
  if (date.getTime() <= Date.now() + 2000) return { status: 'past' };

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
        // iOS 15+ honours this: reminders come through even in a Focus mode.
        interruptionLevel: 'timeSensitive',
        categoryIdentifier: CATEGORY_ID,
        data: { source: 'nexusday', ...data },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
        channelId: CHANNEL_ID,
      },
    });
    return { status: 'scheduled', id };
  } catch (error) {
    console.warn('[notifications] scheduleAt failed', error);
    return { status: 'error' };
  }
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

/* ------------------------------------------------------------------ *
 * Interactive actions ("✓ Completar" / "⏱ Posponer")
 * ------------------------------------------------------------------ */

/** Collections that can hold a `notificationId`, so a snooze can keep the link alive. */
const REMINDER_COLLECTIONS = [KEYS.events, KEYS.habits, KEYS.birthdays];

/** Ticks today's habit without opening the app, then tells the UI about it. */
async function completeHabit(itemId) {
  const habits = await loadJSON(KEYS.habits, []);
  const today = todayKey();
  const index = habits.findIndex((habit) => habit.id === itemId);
  if (index < 0) return;

  const marks = Array.isArray(habits[index].marks) ? habits[index].marks : [];
  if (marks.includes(today)) return;

  const next = [...marks, today].sort();
  habits[index] = { ...habits[index], marks: next };
  await saveJSON(KEYS.habits, habits);
  emitAction({ type: 'habit-complete', itemId, marks: next });
}

/** Points an item at its new notification so the resync does not spawn a duplicate. */
async function patchNotificationId(itemId, notificationId) {
  for (const key of REMINDER_COLLECTIONS) {
    const items = await loadJSON(key, []);
    const index = items.findIndex((item) => item.id === itemId);
    if (index < 0) continue;
    const next = [...items];
    next[index] = { ...next[index], notificationId };
    await saveJSON(key, next);
    emitAction({ type: 'reminder-id', itemId, notificationId });
    return;
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
