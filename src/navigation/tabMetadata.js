import { PRIMARY_TABS } from './primaryTabs';

/** Route labels and lock rules without importing screens or the navigator catalog. */
export const TAB_METADATA = [
  ...PRIMARY_TABS.map((tab) => ({ ...tab, locked: tab.name === 'Inicio' })),
  { name: 'Horario', label: 'Horario', glyph: 'schedule' },
  { name: 'CumpleaÃ±os', label: 'Cumple', glyph: 'birthdays' },
  { name: 'HÃ¡bitos', label: 'HÃ¡bitos', glyph: 'habit' },
  { name: 'Gastos', label: 'Gastos', glyph: 'money' },
  { name: 'Nexus AI', label: 'Nexus AI', glyph: 'ai' },
  { name: 'Ajustes', label: 'Ajustes', glyph: 'settings', locked: true },
];

export const LOCKED_TAB_NAMES = TAB_METADATA.filter((tab) => tab.locked).map((tab) => tab.name);

export function isLockedTab(name) {
  return LOCKED_TAB_NAMES.includes(name);
}

export function tabByName(name) {
  return TAB_METADATA.find((tab) => tab.name === name) || null;
}
