import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { KEYS, loadValue, saveValue } from '../services/storage';
import { usePersistentCollection } from '../hooks/usePersistentCollection';
import { setPreferredCalendar } from '../services/calendar';
import * as Notif from '../services/notifications';
import { resyncReminders } from '../services/reminders';
import {
  seedActivities,
  seedBirthdays,
  seedEvents,
  seedExpenses,
  seedHabits,
  seedNotes,
} from '../data/seeds';

const AppDataContext = createContext(null);

const UNKNOWN_PERMISSION = { status: 'unknown', granted: false, canAskAgain: true, checked: false };

const DEFAULT_SETTINGS = { displayName: '', preferredCalendarId: null };

/**
 * First-run tutorial.
 *
 * `completed` is `null` while the flag is read from AsyncStorage, which keeps the app shell
 * on a neutral splash instead of flashing the tutorial at returning users. `replay` marks
 * the tutorial Ajustes can re-open later: that one must not wipe the user's own data.
 */
const UNSEEN_TUTORIAL = { completed: null, replay: false };

/**
 * Single source of truth for the six persisted collections, the user preferences
 * (greeting name, preferred calendar) and the notification permission state.
 * Screens consume it through `useAppData()`.
 */
export function AppDataProvider({ children }) {
  const activities = usePersistentCollection(KEYS.activities, seedActivities());
  const events = usePersistentCollection(KEYS.events, seedEvents());
  const birthdays = usePersistentCollection(KEYS.birthdays, seedBirthdays());
  const notes = usePersistentCollection(KEYS.notes, seedNotes());
  const habits = usePersistentCollection(KEYS.habits, seedHabits());
  const expenses = usePersistentCollection(KEYS.expenses, seedExpenses());

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [permission, setPermission] = useState(UNKNOWN_PERMISSION);
  const [tutorial, setTutorial] = useState(UNSEEN_TUTORIAL);

  useEffect(() => {
    let alive = true;
    loadValue(KEYS.onboarding, false).then((stored) => {
      if (!alive) return;
      setTutorial({ completed: Boolean(stored), replay: false });
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    loadValue(KEYS.settings, DEFAULT_SETTINGS).then((stored) => {
      if (!alive) return;
      const next = stored && typeof stored === 'object' ? { ...DEFAULT_SETTINGS, ...stored } : DEFAULT_SETTINGS;
      setSettings(next);
      setSettingsLoaded(true);
      if (next.preferredCalendarId) setPreferredCalendar(next.preferredCalendarId);
    });
    return () => {
      alive = false;
    };
  }, []);

  const updateSettings = useCallback((patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveValue(KEYS.settings, next);
      return next;
    });
    if (patch?.preferredCalendarId !== undefined) setPreferredCalendar(patch.preferredCalendarId);
  }, []);


  const refreshPermission = useCallback(async () => {
    const status = await Notif.getPermissionStatus();
    setPermission({ ...status, checked: true });
    return status;
  }, []);

  const requestNotifications = useCallback(async () => {
    const status = await Notif.requestPermission();
    setPermission({ ...status, checked: true });
    return status;
  }, []);

  useEffect(() => {
    Notif.configureNotifications();
    let active = true;
    Notif.getPermissionStatus().then((status) => {
      if (active) setPermission({ ...status, checked: true });
    });

    // A "✓ Completar" from the notification shade is applied to the live collection, so
    // the tick shows up in the UI without waiting for the next app start.
    const unsubscribe = Notif.subscribeToNotificationActions((action) => {
      if (action.type === 'habit-complete') {
        habits.update(action.itemId, { marks: action.marks });
        return;
      }
      if (action.type === 'reminder-id') {
        if (events.items.some((item) => item.id === action.itemId)) {
          events.update(action.itemId, { notificationId: action.notificationId });
        } else if (habits.items.some((item) => item.id === action.itemId)) {
          habits.update(action.itemId, { notificationId: action.notificationId });
        } else {
          birthdays.update(action.itemId, { notificationId: action.notificationId });
        }
      }
    });

    // Permission is often flipped from the OS settings screen (the "Activá los
    // avisos" card sends people there), so re-read it whenever the app returns.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && active) refreshPermission();
    });

    return () => {
      active = false;
      unsubscribe();
      subscription.remove();
    };
  }, [refreshPermission, habits, events, birthdays]);

  // Re-arm reminders that Android may have dropped (reboot, app update) or that
  // were saved before permission was granted. Runs once per session, after
  // hydration, and retries when permission flips to granted.
  const resyncedOnce = useRef(false);
  const pendingRef = useRef({ events: [], birthdays: [] });

  useEffect(() => {
    pendingRef.current = { events: events.items, birthdays: birthdays.items };
  });

  const allHydrated =
    activities.hydrated &&
    events.hydrated &&
    birthdays.hydrated &&
    notes.hydrated &&
    habits.hydrated &&
    expenses.hydrated;

  /** Wipes every local collection (used by Ajustes › Borrar datos and the first-run wipe). */
  const clearAllData = useCallback(() => {
    activities.replaceAll([]);
    events.replaceAll([]);
    birthdays.replaceAll([]);
    notes.replaceAll([]);
    habits.replaceAll([]);
    expenses.replaceAll([]);
  }, [activities, events, birthdays, notes, habits, expenses]);

  /**
   * Tutorial finished. On the first run this also wipes the sample data, so the user
   * starts from a completely blank app instead of inheriting somebody else's schedule.
   */
  const finishTutorial = useCallback(() => {
    if (!tutorial.replay) clearAllData();
    saveValue(KEYS.onboarding, true);
    setTutorial({ completed: true, replay: false });
  }, [tutorial.replay, clearAllData]);

  /** Ajustes › "Ver el tutorial otra vez": show the slides again, keeping the data. */
  const replayTutorial = useCallback(() => {
    saveValue(KEYS.onboarding, false);
    setTutorial({ completed: false, replay: true });
  }, []);

  useEffect(() => {
    if (!allHydrated) return;
    if (!permission.granted) {
      // Permission revoked mid-session cancels everything, so allow one more
      // pass if it is granted again before the app closes.
      resyncedOnce.current = false;
      return;
    }
    if (resyncedOnce.current) return;
    resyncedOnce.current = true;

    let active = true;
    resyncReminders({ ...pendingRef.current, habits: habits.items }).then(
      ({ eventPatches, birthdayPatches, habitPatches }) => {
        if (!active) return;
        eventPatches.forEach(({ id, notificationId }) => events.update(id, { notificationId }));
        birthdayPatches.forEach(({ id, notificationId }) => birthdays.update(id, { notificationId }));
        habitPatches.forEach(({ id, notificationId }) => habits.update(id, { notificationId }));
      },
    );

    return () => {
      active = false;
    };
  }, [allHydrated, permission.granted, events, birthdays, habits]);

  const value = useMemo(
    () => ({
      hydrated: allHydrated,

      onboardingCompleted: tutorial.completed,
      tutorialReplay: tutorial.replay,
      finishTutorial,
      replayTutorial,

      activities: activities.items,
      addActivity: activities.create,
      updateActivity: activities.update,
      removeActivity: activities.remove,

      events: events.items,
      addEvent: events.create,
      updateEvent: events.update,
      removeEvent: events.remove,

      birthdays: birthdays.items,
      addBirthday: birthdays.create,
      updateBirthday: birthdays.update,
      removeBirthday: birthdays.remove,

      notes: notes.items,
      addNote: notes.create,
      updateNote: notes.update,
      removeNote: notes.remove,

      habits: habits.items,
      addHabit: habits.create,
      updateHabit: habits.update,
      removeHabit: habits.remove,

      expenses: expenses.items,
      addExpense: expenses.create,
      updateExpense: expenses.update,
      removeExpense: expenses.remove,

      settings,
      settingsLoaded,
      updateSettings,
      clearAllData,

      permission,
      refreshPermission,
      requestNotifications,
      notificationsSupported: Notif.isSupported(),
    }),
    [
      allHydrated,
      activities,
      events,
      birthdays,
      notes,
      habits,
      expenses,
      settings,
      settingsLoaded,
      updateSettings,
      clearAllData,
      tutorial,
      finishTutorial,
      replayTutorial,
      permission,
      refreshPermission,
      requestNotifications,
    ],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error('useAppData must be used inside <AppDataProvider>');
  }
  return context;
}
