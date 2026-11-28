import AssistantScreen from '../screens/AssistantScreen';
import BirthdaysScreen from '../screens/BirthdaysScreen';
import CalendarScreen from '../screens/CalendarScreen';
import ExpensesScreen from '../screens/ExpensesScreen';
import HabitsScreen from '../screens/HabitsScreen';
import HomeScreen from '../screens/HomeScreen';
import NotesScreen from '../screens/NotesScreen';
import NexAiPreviewScreen from '../screens/NexAiPreviewScreen';
import ScheduleScreen from '../screens/ScheduleScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { PRIMARY_TABS } from './primaryTabs';
export { PRIMARY_TABS, PRIMARY_TAB_NAMES } from './primaryTabs';

const PRIMARY_SCREENS = {
  'Nex AI': NexAiPreviewScreen,
  Inicio: HomeScreen,
  Notas: NotesScreen,
  Agenda: CalendarScreen,
};

/**
 * Every section of the app, in the default order.
 *
 * Keeping the historical catalog intact preserves route names used by search, reminders and
 * older backups. `PRIMARY_TAB_NAMES` below decides which entries appear in the bottom bar.
 */
export const TABS = [
  ...PRIMARY_TABS.map((tab) => ({ ...tab, component: PRIMARY_SCREENS[tab.name], locked: tab.name === 'Inicio' })),
  { name: 'Horario', label: 'Horario', glyph: 'schedule', component: ScheduleScreen },
  { name: 'Cumpleaños', label: 'Cumple', glyph: 'birthdays', component: BirthdaysScreen },
  { name: 'Hábitos', label: 'Hábitos', glyph: 'habit', component: HabitsScreen },
  { name: 'Gastos', label: 'Gastos', glyph: 'money', component: ExpensesScreen },
  { name: 'Nexus AI', label: 'Nexus AI', glyph: 'ai', component: AssistantScreen },
  { name: 'Ajustes', label: 'Ajustes', glyph: 'settings', component: SettingsScreen, locked: true },
];

/** Inicio stays the initial page and remains the way back into the app. */
export const HOME_TAB = 'Inicio';

/** Settings can never be hidden either: it is the only way to undo a tab change. */
export const SETTINGS_TAB = TABS[TABS.length - 1].name;

/** Tabs that the navigation customization cannot reorder or hide. */
export const LOCKED_TABS = TABS.filter((tab) => tab.locked).map((tab) => tab.name);

export function isLockedTab(name) {
  return LOCKED_TABS.includes(name);
}

export const DEFAULT_TAB_ORDER = TABS.map((tab) => tab.name);

export function tabByName(name) {
  return TABS.find((tab) => tab.name === name) || null;
}

export const TAB_NAMES = DEFAULT_TAB_ORDER;
