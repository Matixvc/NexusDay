/** Fixed primary navigation contract, independent from persisted preferences and screens. */
export const PRIMARY_TABS = [
  { name: 'Nex AI', label: 'Nex AI', glyph: 'ai' },
  { name: 'Inicio', label: 'Día a Día', glyph: 'home' },
  { name: 'Notas', label: 'Bloc de Notas', glyph: 'note' },
  { name: 'Agenda', label: 'Calendario', glyph: 'calendar' },
];

export const PRIMARY_TAB_NAMES = PRIMARY_TABS.map((tab) => tab.name);
