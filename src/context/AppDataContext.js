import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { KEYS, loadValue, saveValue } from '../services/storage';
import { usePersistentCollection } from '../hooks/usePersistentCollection';
import { DEFAULT_TAB_CONFIG, normalizeTabConfig } from '../services/tabs';
import * as Notif from '../services/notifications';
import { subscribeToNotificationActions } from '../services/notifications';
import { resyncReminders } from '../services/reminders';
import { todayKey } from '../utils/dates';
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

const DEFAULT_SETTINGS = { displayName: '', career: '', privacyEnabled: true };

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
  const [userName, setUserNameState] = useState('');
  const [tabConfig, setTabConfigState] = useState(DEFAULT_TAB_CONFIG);

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
    })();
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

    // Permission is often flipped from the OS settings screen (the "Activa los
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
  const pendingRef = useRef({ events: [], birthdays: [], activities: [] });

  useEffect(() => {
    pendingRef.current = { events: events.items, birthdays: birthdays.items, activities: activities.items };
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
   * Ajustes › "Importar copia de seguridad": reemplaza cada colección y los ajustes por los
   * del archivo. Solo se llega acá tras validar el JSON y pasar el ConfirmSheet, porque aquí
   * no hay vuelta atrás: lo anterior queda descartado (y persistido) en el mismo instante.
   */
  const restoreBackup = useCallback(
    async (backup = {}) => {
      // Los arrays locales son la fuente de verdad: `events.items` (por ejemplo) sigue
      // apuntando al render anterior hasta que React procesa el `setItems` nuevo. Se
      // elimina `notificationId` explícitamente para que `resyncReminders` genere
      // recordatorios válidos sobre los datos restaurados en este mismo dispositivo.
      const restoredActivities = (backup.activities || []).map((item) => ({ ...item, notificationId: null }));
      const restoredEvents = (backup.events || []).map((item) => ({ ...item, notificationId: null }));
      const restoredBirthdays = (backup.birthdays || []).map((item) => ({ ...item, notificationId: null }));
      const restoredNotes = (backup.notes || []).map((item) => ({ ...item, notificationId: null }));
      const restoredHabits = (backup.habits || []).map((item) => ({ ...item, notificationId: null }));
      const restoredExpenses = (backup.expenses || []).map((item) => ({ ...item, notificationId: null }));

      // Un array puede estar vacío y el `Array.isArray` distingue un resultado válido de
      // una colección ausente: `replaceAll([])` limpia los registros anteriores.
      if (Array.isArray(backup.activities)) activities.replaceAll(restoredActivities);
      if (Array.isArray(backup.events)) events.replaceAll(restoredEvents);
      if (Array.isArray(backup.birthdays)) birthdays.replaceAll(restoredBirthdays);
      if (Array.isArray(backup.notes)) notes.replaceAll(restoredNotes);
      if (Array.isArray(backup.habits)) habits.replaceAll(restoredHabits);
      if (Array.isArray(backup.expenses)) expenses.replaceAll(restoredExpenses);

      if (backup.settings && typeof backup.settings === 'object') updateSettings(backup.settings);
      if (typeof backup.userName === 'string') setUserName(backup.userName);
      if (backup.tabConfig) setTabConfig(backup.tabConfig);

      // `resyncReminders` se ejecuta sobre los datos reales restaurados. Un fallo aquí no
      // revierte la restauración de datos.
      try {
        const patches = await resyncReminders({
          events: restoredEvents,
          birthdays: restoredBirthdays,
          habits: restoredHabits,
          activities: restoredActivities,
        });
        patches.eventPatches.forEach(({ id, notificationId }) => events.update(id, { notificationId }));
        patches.birthdayPatches.forEach(({ id, notificationId }) => birthdays.update(id, { notificationId }));
        patches.habitPatches.forEach(({ id, notificationId }) => habits.update(id, { notificationId }));
        patches.activityPatches.forEach(({ id, notificationId }) => activities.update(id, { notificationId }));
        return { dataRestored: true, notificationsRecreated: true };
      } catch (error) {
        console.warn('[restoreBackup] could not resync reminders', error);
        return { dataRestored: true, notificationsRecreated: false };
      }
    },
    [activities, events, birthdays, notes, habits, expenses, updateSettings, setUserName, setTabConfig],
  );

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
    // 350 ms de gracia: las ediciones en cascada re-entran a este effect y un
    // re-arranque inmediato cancelaría y reprogramaría avisos sin necesidad.
    // El cleanup cancela el timer si el contexto cambia antes de tiempo.
    const timer = setTimeout(() => {
      resyncReminders({ ...pendingRef.current, habits: habits.items }).then(
        ({ eventPatches, birthdayPatches, habitPatches, activityPatches = [] }) => {
          if (!active) return;
          eventPatches.forEach(({ id, notificationId }) => events.update(id, { notificationId }));
          birthdayPatches.forEach(({ id, notificationId }) => birthdays.update(id, { notificationId }));
          habitPatches.forEach(({ id, notificationId }) => habits.update(id, { notificationId }));
          activityPatches.forEach(({ id, notificationId }) => activities.update(id, { notificationId }));
        },
      );
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [allHydrated, permission.granted, events, birthdays, habits, activities]);

  /** Mantiene el estado en memoria sincronizado cuando el usuario actúa desde una notificación
   * (✓ Completar / ⏱ Posponer). `notifications.js` ya escribe a AsyncStorage; este effect se
   * encarga de que lo que se ve en pantalla se actualice al instante sin reiniciar la app.
   * No procesa acciones hasta que todas las colecciones estén hidratadas, para no escribir
   * sobre datos de semilla en lugar de los datos reales del usuario. */
  useEffect(() => {
    if (!allHydrated) return;
    const unsubscribe = subscribeToNotificationActions((action) => {
      if (action.type === 'habit-complete') {
        const today = todayKey();
        habits.update(action.itemId, {
          marks: (() => {
            const current = habits.items.find((h) => h.id === action.itemId);
            const marks = Array.isArray(current?.marks) ? current.marks : [];
            if (marks.includes(today)) return marks;
            return [...marks, today].sort();
          })(),
          notificationId: null,
        });
      } else if (action.type === 'reminder-id') {
        // Actualizar el notificationId en la colección correspondiente
        const collections = [events, birthdays, habits];
        for (const collection of collections) {
          const item = collection.items.find((i) => i.id === action.itemId);
          if (item) {
            collection.update(action.itemId, { notificationId: action.notificationId });
            break;
          }
        }
      }
    });
    return unsubscribe;
  }, [allHydrated, events, birthdays, habits]);

  const value = useMemo(
    () => ({
      hydrated: allHydrated,

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
