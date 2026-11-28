import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { KEYS, loadJSON, mutateLockedCollection, withCollectionLock, loadValue, persistRestoreSnapshot, saveValue } from '../services/storage';
import { completeBackupCollections, validateBackup } from '../services/backupRestore';
import { usePersistentCollection } from '../hooks/usePersistentCollection';
import { useRoutineCollection } from '../hooks/useRoutineCollection';
import { DEFAULT_TAB_CONFIG, normalizeTabConfig } from '../services/tabs';
import * as Notif from '../services/notifications';
import { resyncReminders } from '../services/reminders';

const AppDataContext = createContext(null);

const UNKNOWN_PERMISSION = { status: 'unknown', granted: false, canAskAgain: true, checked: false };

const DEFAULT_SETTINGS = { displayName: '', career: '', privacyEnabled: true, reduceMotion: false, lastBackupAt: null };

/**
 * First-run tutorial.
 *
 * `completed` is `null` while the flag is read from AsyncStorage, which keeps the app shell
 * on a neutral splash instead of flashing the tutorial at returning users. `replay` marks
 * the tutorial Ajustes can re-open later: that one must not wipe the user's own data.
 */
const UNSEEN_TUTORIAL = { completed: null, replay: false };

/**
 * Single source of truth for the seven persisted collections, the user preferences
 * (greeting name, preferred calendar) and the notification permission state.
 * Screens consume it through `useAppData()`.
 */
export function AppDataProvider({ children }) {
  const activities = usePersistentCollection(KEYS.activities);
  const events = usePersistentCollection(KEYS.events);
  const birthdays = usePersistentCollection(KEYS.birthdays);
  const notes = usePersistentCollection(KEYS.notes);
  const habits = usePersistentCollection(KEYS.habits);
  const expenses = usePersistentCollection(KEYS.expenses);
  const routines = useRoutineCollection();

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [permission, setPermission] = useState(UNKNOWN_PERMISSION);
  const [tutorial, setTutorial] = useState(UNSEEN_TUTORIAL);
  const [userName, setUserNameState] = useState('');
  const [tabConfig, setTabConfigState] = useState(DEFAULT_TAB_CONFIG);

  useEffect(() => {
    let alive = true;
    loadValue(KEYS.onboarding, false).then((stored) => {
      if (!alive) return;
      setTutorial({ completed: Boolean(stored), replay: false });
    }).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  // The preferred name and the tab layout are read once, next to the settings, because
  // Ajustes and the dashboard need all three hydrated before the first paint of interest.
  useEffect(() => {
    let alive = true;
    (async () => {
      const [stored, savedName, storedTabs] = await Promise.all([
        loadValue(KEYS.settings, DEFAULT_SETTINGS),
        loadValue(KEYS.userName, ''),
        loadValue(KEYS.tabConfig, null),
      ]);
      if (!alive) return;

      const next = stored && typeof stored === 'object' ? { ...DEFAULT_SETTINGS, ...stored } : DEFAULT_SETTINGS;
      setSettings(next);
      setSettingsLoaded(true);

      // v1.0 stored the name inside the settings blob; adopt it once as the canonical one.
      const name = String(savedName || '').trim() || String(next.displayName || '').trim();
      if (name) {
        setUserNameState(name);
        if (!savedName) saveValue(KEYS.userName, name);
      }

      if (storedTabs) setTabConfigState(normalizeTabConfig(storedTabs));
    })().catch(() => undefined);
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
  }, []);

  /** Preferred name for the dashboard greeting (also written by the first-run tutorial). */
  const setUserName = useCallback((value) => {
    const next = String(value ?? '').trim();
    setUserNameState(next);
    saveValue(KEYS.userName, next);
  }, []);

  /** Tab order and visibility (Ajustes › Personalizar Navegación). */
  const setTabConfig = useCallback((next) => {
    const normalized = normalizeTabConfig(next);
    setTabConfigState(normalized);
    saveValue(KEYS.tabConfig, normalized);
    return normalized;
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

    // Permission is often flipped from the OS settings screen (the "Activa los
    // avisos" card sends people there), so re-read it whenever the app returns.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && active) refreshPermission();
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, [refreshPermission]);

  // Re-arm reminders that Android may have dropped (reboot, app update) or that
  // were saved before permission was granted. Runs once per session, after
  // hydration, and retries when permission flips to granted.
  const resyncedOnce = useRef(false);
  const pendingRef = useRef({ events: [], birthdays: [], notes: [], activities: [], routines: [] });

  useEffect(() => {
    pendingRef.current = { events: events.items, birthdays: birthdays.items, notes: notes.items, activities: activities.items, routines: routines.items };
  });

  const allHydrated =
    activities.hydrated &&
    events.hydrated &&
    birthdays.hydrated &&
    notes.hydrated &&
    habits.hydrated &&
    expenses.hydrated;
  const allCollectionsHydrated = allHydrated && routines.hydrated;
  const storageRecoveryError = [activities, events, birthdays, notes, habits, expenses].some((collection) => collection.recoveryError) || routines.restoreRecoveryError;

  /** Wipes every local collection (used by Ajustes › Borrar datos). */
  const clearAllData = useCallback(async () => routines.runExclusive(async ({ items: currentRoutines, setSnapshot }) => withCollectionLock(async () => {
    const empty = [];
    const entries = [KEYS.activities, KEYS.events, KEYS.birthdays, KEYS.notes, KEYS.habits, KEYS.expenses, KEYS.routines]
      .map((key) => ({ key, value: JSON.stringify(empty) }));
    await persistRestoreSnapshot(entries);
    await Promise.all(currentRoutines.map((item) => Notif.cancelAlarm(item.alarmNotificationId)));
    activities.replaceAll(empty);
    events.replaceAll(empty);
    birthdays.replaceAll(empty);
    notes.replaceAll(empty);
    habits.replaceAll(empty);
    expenses.replaceAll(empty);
    setSnapshot(empty);
    return { dataCleared: true };
  })), [activities, events, birthdays, notes, habits, expenses, routines]);

  /** Persists a validated restore snapshot and updates memory only after verification. */
  const restoreBackup = useCallback(
    async (backup = {}) => routines.runExclusive(async ({ items: currentRoutines, setSnapshot }) => withCollectionLock(async () => {
      if (routines.recoveryError && !Array.isArray(backup.routines)) {
        throw new Error('RESTORE_ROUTINES_UNAVAILABLE');
      }
      if (validateBackup({ app: 'NexusDay', collections: backup }) !== null) {
        throw new Error('RESTORE_INVALID_SNAPSHOT');
      }
      const sourceCollections = completeBackupCollections(backup, {
        activities: backup.activities ?? await loadJSON(KEYS.activities),
        events: backup.events ?? await loadJSON(KEYS.events),
        birthdays: backup.birthdays ?? await loadJSON(KEYS.birthdays),
        notes: backup.notes ?? await loadJSON(KEYS.notes),
        habits: backup.habits ?? await loadJSON(KEYS.habits),
        expenses: backup.expenses ?? await loadJSON(KEYS.expenses),
        routines: currentRoutines,
      });
      // Los arrays locales son la fuente de verdad: `events.items` (por ejemplo) sigue
      // apuntando al render anterior hasta que React procesa el `setItems` nuevo. Se
      // elimina `notificationId` explícitamente para que `resyncReminders` genere
      // recordatorios válidos sobre los datos restaurados en este mismo dispositivo.
      const restoredActivities = sourceCollections.activities.map((item) => ({ ...item, notificationId: null }));
      const restoredEvents = sourceCollections.events.map((item) => ({ ...item, notificationId: null, alarmNotificationId: null }));
      const restoredBirthdays = sourceCollections.birthdays.map((item) => ({ ...item, notificationId: null, alarmNotificationId: null, alarmTime: item.alarmTime || '09:00' }));
      const restoredNotes = sourceCollections.notes.map((item) => ({ ...item, notificationId: null, alarmNotificationId: null }));
      const restoredHabits = sourceCollections.habits.map((item) => ({ ...item, notificationId: null }));
      const restoredExpenses = sourceCollections.expenses.map((item) => ({ ...item, notificationId: null }));
      const restoredRoutines = sourceCollections.routines.map((item) => ({ ...item, alarmNotificationId: null }));

      // Un array puede estar vacío y el `Array.isArray` distingue un resultado válido de
      // una colección ausente: `replaceAll([])` limpia los registros anteriores.
      const nextSettings = backup.settings ? { ...settings, ...backup.settings } : null;
      const nextUserName = typeof backup.userName === 'string' ? backup.userName.trim() : null;
      const nextTabConfig = backup.tabConfig ? normalizeTabConfig(backup.tabConfig) : null;
      const entries = [
        [KEYS.activities, restoredActivities],
        [KEYS.events, restoredEvents],
        [KEYS.birthdays, restoredBirthdays],
        [KEYS.notes, restoredNotes],
        [KEYS.habits, restoredHabits],
        [KEYS.expenses, restoredExpenses],
        [KEYS.routines, restoredRoutines],
      ].map(([key, value]) => ({ key, value: JSON.stringify(value) }));
      if (nextSettings) entries.push({ key: KEYS.settings, value: JSON.stringify(nextSettings) });
      if (nextUserName !== null) entries.push({ key: KEYS.userName, value: JSON.stringify(nextUserName) });
      if (nextTabConfig) entries.push({ key: KEYS.tabConfig, value: JSON.stringify(nextTabConfig) });

      await persistRestoreSnapshot(entries);
      await Promise.all(currentRoutines.map((item) => Notif.cancelAlarm(item.alarmNotificationId)));

      activities.replaceAll(restoredActivities);
      events.replaceAll(restoredEvents);
      birthdays.replaceAll(restoredBirthdays);
      notes.replaceAll(restoredNotes);
      habits.replaceAll(restoredHabits);
      expenses.replaceAll(restoredExpenses);
      setSnapshot(restoredRoutines);
      if (nextSettings) setSettings(nextSettings);
      if (nextUserName !== null) setUserNameState(nextUserName);
      if (nextTabConfig) setTabConfigState(nextTabConfig);

      // `resyncReminders` se ejecuta sobre los datos reales restaurados. Un fallo aquí no
      // revierte la restauración de datos.
      let scheduledRoutineAlarmIds = [];
      try {
        const patches = await resyncReminders({
          events: restoredEvents,
          birthdays: restoredBirthdays,
          notes: restoredNotes,
          habits: restoredHabits,
          activities: restoredActivities,
          routines: restoredRoutines,
        });
        scheduledRoutineAlarmIds = patches.routinePatches?.map((patch) => patch.alarmNotificationId).filter(Boolean) || [];
        for (const [key, updates] of [
          [KEYS.events, patches.eventPatches], [KEYS.birthdays, patches.birthdayPatches],
          [KEYS.habits, patches.habitPatches], [KEYS.activities, patches.activityPatches],
        ]) {
          if (!updates.length) continue;
          const ids = new Map(updates.map(patch => [patch.id, patch.notificationId]));
          await mutateLockedCollection(key, items => items.map(item =>
            ids.has(item.id) ? { ...item, notificationId: ids.get(item.id) } : item
          ));
        }
        for (const [key, updates] of [[KEYS.events, patches.eventAlarmPatches], [KEYS.birthdays, patches.birthdayAlarmPatches], [KEYS.notes, patches.noteAlarmPatches]]) {
          if (!updates?.length) continue;
          const ids = new Map(updates.map((patch) => [patch.id, patch.alarmNotificationId]));
          const source = key === KEYS.events ? restoredEvents : key === KEYS.birthdays ? restoredBirthdays : restoredNotes;
          const next = source.map((item) => ids.has(item.id) ? { ...item, alarmNotificationId: ids.get(item.id) } : item);
          const committed = await mutateLockedCollection(key, () => next);
          if (!committed) throw new Error('RESTORE_ALARM_PATCH_FAILED');
          // The storage listener normally publishes this too; explicitly publish the exact
          // committed snapshot so React cannot lag behind when a restore is already hydrated.
          if (key === KEYS.events) events.replaceAll(next);
          else if (key === KEYS.birthdays) birthdays.replaceAll(next);
          else notes.replaceAll(next);
        }
        if (patches.routinePatches?.length) {
          const alarmIds = new Map(patches.routinePatches.map((patch) => [patch.id, patch.alarmNotificationId]));
          const patchedRoutines = restoredRoutines.map((item) => (
            alarmIds.has(item.id) ? { ...item, alarmNotificationId: alarmIds.get(item.id) } : item
          ));
          await mutateLockedCollection(KEYS.routines, () => patchedRoutines);
          setSnapshot(patchedRoutines);
        }
        return { dataRestored: true, notificationsRecreated: patches.failures.length === 0 };
      } catch (error) {
        void error;
        await Promise.all(scheduledRoutineAlarmIds.map((id) => Notif.cancelAlarm(id)));
        return { dataRestored: true, notificationsRecreated: false };
      }
    })),
    [activities, events, birthdays, notes, habits, expenses, settings, routines],
  );

  // The guide only changes its own completion flag.
  const finishTutorial = useCallback(async () => {
    await saveValue(KEYS.onboarding, true);
    setTutorial({ completed: true, replay: false });
  }, []);

  /** Ajustes › "Ver el tutorial otra vez": show the slides again, keeping the data. */
  const replayTutorial = useCallback(() => {
    setTutorial({ completed: false, replay: true });
  }, []);

  useEffect(() => {
    if (!allCollectionsHydrated) return;
    if (!permission.granted) {
      // Permission revoked mid-session cancels everything, so allow one more
      // pass if it is granted again before the app closes.
      resyncedOnce.current = false;
      return;
    }
    if (resyncedOnce.current) return;
    resyncedOnce.current = true;

    let active = true;
    // 350 ms de gracia: las ediciones en cascada re-entran a este effect y un
    // re-arranque inmediato cancelaría y reprogramaría avisos sin necesidad.
    // El cleanup cancela el timer si el contexto cambia antes de tiempo.
    const timer = setTimeout(() => {
      resyncReminders({ ...pendingRef.current, habits: habits.items }).then(
        async ({ eventPatches, birthdayPatches, eventAlarmPatches = [], birthdayAlarmPatches = [], noteAlarmPatches = [], habitPatches, activityPatches = [], routinePatches = [] }) => {
          if (!active) return;
          eventPatches.forEach(({ id, notificationId }) => events.update(id, { notificationId }));
          birthdayPatches.forEach(({ id, notificationId }) => birthdays.update(id, { notificationId }));
          habitPatches.forEach(({ id, notificationId }) => habits.update(id, { notificationId }));
          activityPatches.forEach(({ id, notificationId }) => activities.update(id, { notificationId }));
          eventAlarmPatches.forEach(({ id, alarmNotificationId }) => events.update(id, { alarmNotificationId }));
          birthdayAlarmPatches.forEach(({ id, alarmNotificationId }) => birthdays.update(id, { alarmNotificationId }));
          noteAlarmPatches.forEach(({ id, alarmNotificationId }) => notes.update(id, { alarmNotificationId }));
          for (const { id, alarmNotificationId } of routinePatches) {
            const linked = await routines.update(id, { alarmNotificationId });
            if (!linked?.ok && alarmNotificationId) await Notif.cancelAlarm(alarmNotificationId);
          }
        },
      );
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [allCollectionsHydrated, permission.granted, events, birthdays, notes, habits, activities, routines]);

  const value = useMemo(
    () => ({
      hydrated: allCollectionsHydrated && settingsLoaded,
      storageRecoveryError,

      onboardingCompleted: tutorial.completed,
      tutorialReplay: tutorial.replay,
      finishTutorial,
      replayTutorial,

      userName,
      setUserName,
      tabConfig,
      setTabConfig,

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

      routines: routines.items,
      routinesHydrated: routines.hydrated,
      routinesRecoveryError: routines.recoveryError,
      routinesBusy: routines.busy,
      createRoutine: routines.create,
      updateRoutine: routines.update,
      removeRoutine: routines.remove,
      toggleRoutineCompletion: routines.toggleCompletion,

      settings,
      settingsLoaded,
      updateSettings,
      clearAllData,
      restoreBackup,

      permission,
      refreshPermission,
      requestNotifications,
      notificationsSupported: Notif.isSupported(),
    }),
    [
      allCollectionsHydrated,
      storageRecoveryError,
      activities,
      events,
      birthdays,
      notes,
      habits,
      expenses,
      routines,
      settings,
      settingsLoaded,
      updateSettings,
      clearAllData,
      restoreBackup,
      tutorial,
      finishTutorial,
      replayTutorial,
      userName,
      setUserName,
      tabConfig,
      setTabConfig,
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
