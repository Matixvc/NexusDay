import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

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
 */

export const CHANNEL_ID = 'recordatorios';

let handlerConfigured = false;
let channelReady = false;

const unsupported = () => ({ status: 'unsupported', granted: false, canAskAgain: false });

export function isSupported() {
  return Platform.OS === 'ios' || Platform.OS === 'android';
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
}

async function ensureChannel() {
  if (Platform.OS !== 'android' || channelReady) return;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Recordatorios',
      description: 'Avisos de eventos, horarios y cumpleaños.',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 220, 140, 220],
      lightColor: '#4fd1c5',
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
export async function scheduleAt({ title, body, date }) {
  if (!isSupported()) return { status: 'unsupported' };
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return { status: 'invalid' };
  if (date.getTime() <= Date.now() + 2000) return { status: 'past' };

  configureNotifications();
  await ensureChannel();

  const permission = await requestPermission();
  if (!permission.granted) return { status: 'denied', canAskAgain: permission.canAskAgain };

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: 'default', data: { source: 'nexusday' } },
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
export async function scheduleYearly({ title, body, month, day, hour, minute }) {
  if (!isSupported()) return { status: 'unsupported' };

  configureNotifications();
  await ensureChannel();

  const permission = await requestPermission();
  if (!permission.granted) return { status: 'denied', canAskAgain: permission.canAskAgain };

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: 'default', data: { source: 'nexusday', repeats: 'yearly' } },
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
