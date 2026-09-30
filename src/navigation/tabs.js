import AssistantScreen from '../screens/AssistantScreen';
import BirthdaysScreen from '../screens/BirthdaysScreen';
import CalendarScreen from '../screens/CalendarScreen';
import ExpensesScreen from '../screens/ExpensesScreen';
import HabitsScreen from '../screens/HabitsScreen';
import HomeScreen from '../screens/HomeScreen';
import NotesScreen from '../screens/NotesScreen';
import ScheduleScreen from '../screens/ScheduleScreen';
import SettingsScreen from '../screens/SettingsScreen';

/**
 * Every section of the app, in the default order.
 *
 * Keeping the catalog in one place is what makes the navigation customisable: the navigator
 * renders these screens in `tabConfig.order` and Ajustes reorders or hides them without
 * touching the navigator. `locked: true` marks the two tabs that can never be moved or
 * hidden: Inicio (the way back into the app) and Ajustes (the only way to undo any tab
 * change — hiding it would be a one-way door).
 */
export const TABS = [
  { name: 'Inicio', label: 'Inicio', glyph: 'home', component: HomeScreen, locked: true },
  { name: 'Horario', label: 'Horario', glyph: 'schedule', component: ScheduleScreen },
  { name: 'Agenda', label: 'Agenda', glyph: 'calendar', component: CalendarScreen },
  { name: 'Cumpleaños', label: 'Cumple', glyph: 'birthdays', component: BirthdaysScreen },
  { name: 'Notas', label: 'Notas', glyph: 'note', component: NotesScreen },
  { name: 'Hábitos', label: 'Hábitos', glyph: 'habit', component: HabitsScreen },
  { name: 'Gastos', label: 'Gastos', glyph: 'money', component: ExpensesScreen },
  { name: 'Nexus AI', label: 'Nexus AI', glyph: 'ai', component: AssistantScreen },
  { name: 'Ajustes', label: 'Ajustes', glyph: 'settings', component: SettingsScreen, locked: true },
];

/** The home tab can never be moved nor hidden: it is the way back into the app. */
export const HOME_TAB = TABS[0].name;

/** Settings can never be hidden either: it is the only way to undo a tab change. */
export const SETTINGS_TAB = TABS[TABS.length - 1].name;

/** The two tabs the user may not reorder or hide. */
export const LOCKED_TABS = TABS.filter((tab) => tab.locked).map((tab) => tab.name);

export function isLockedTab(name) {
  return LOCKED_TABS.includes(name);
}

export const DEFAULT_TAB_ORDER = TABS.map((tab) => tab.name);

export function tabByName(name) {
  return TABS.find((tab) => tab.name === name) || null;
}

export const TAB_NAMES = DEFAULT_TAB_ORDER;
