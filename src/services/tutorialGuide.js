import { DEFAULT_ACCENT_ID, getAccentTheme, resolveAccent } from '../theme/accents';
import { getSurfaceMode, SELECTABLE_SURFACE_MODES } from '../theme/surfaces';

export const TUTORIAL_STEPS = [
  {
    key: 'welcome',
    eyebrow: 'BIENVENIDA',
    title: 'Tu día, en un solo lugar',
    body: 'NexusDay organiza tu jornada sin sacar tus datos del dispositivo.',
    imageKey: 'welcome',
    imageAlt: 'Nex, el personaje de NexusDay, presenta una jornada organizada.',
    demoId: 'welcome',
  },
  {
    key: 'day',
    eyebrow: 'DÍA A DÍA',
    title: 'Avanza a tu ritmo',
    body: 'Mira lo que viene y completa tus rutinas con un toque.',
    imageKey: 'day',
    imageAlt: 'Nex avanza entre bloques que representan actividades del día.',
    demoId: 'routine',
  },
  {
    key: 'notes',
    eyebrow: 'BLOC DE NOTAS',
    title: 'Captura y completa',
    body: 'Escribe ideas o convierte una nota en una checklist privada.',
    imageKey: 'notes',
    imageAlt: 'Nex junto a un cuaderno con tareas marcadas.',
    demoId: 'notes',
  },
  {
    key: 'calendar',
    eyebrow: 'CALENDARIO',
    title: 'Elige una fecha',
    body: 'Eventos, clases y cumpleaños aparecen juntos en cada día.',
    imageKey: 'calendar',
    imageAlt: 'Nex observa un calendario mensual con fechas destacadas.',
    demoId: 'calendar',
  },
  {
    key: 'personalize',
    eyebrow: 'A TU MANERA',
    title: 'Hazlo tuyo',
    body: 'Prueba Blanco, Oscuro y Nex. Esta vista previa no cambia tus ajustes.',
    imageKey: 'themes',
    imageAlt: 'Tres materiales visuales representan los temas Blanco, Oscuro y Nex.',
    demoId: 'themes',
  },
];

export const TUTORIAL_NOTE_ITEMS = [
  { id: 'water', text: 'Llevar botella', done: false },
  { id: 'review', text: 'Repasar apuntes', done: true },
];

export const TUTORIAL_CALENDAR_DAYS = [
  { id: 'monday', label: 'Lun', number: '11', agenda: [] },
  {
    id: 'tuesday', label: 'Mar', number: '12',
    agenda: [
      { id: 'demo-event', kind: 'event', title: 'Entrega de proyecto', time: '16:00' },
      { id: 'demo-birthday', kind: 'birthday', title: 'Cumpleaños de Alex', time: '19:00' },
    ],
  },
  { id: 'wednesday', label: 'Mié', number: '13', agenda: [] },
];

export const TUTORIAL_THEME_PREVIEWS = SELECTABLE_SURFACE_MODES.map((mode) => {
  const surface = getSurfaceMode(mode.id);
  const accent = resolveAccent(getAccentTheme(DEFAULT_ACCENT_ID), surface.id);
  return {
    id: surface.id,
    label: surface.label,
    colors: {
      background: surface.tokens.background,
      surface: surface.tokens.elevated,
      border: surface.tokens.border,
      text: surface.tokens.text,
      muted: surface.tokens.textSecondary,
      accent: accent.accent,
      accentInk: accent.accentInk,
    },
  };
});

export function toggleTutorialChecklistItem(items, id) {
  if (!items.some((item) => item.id === id)) return items;
  return items.map((item) => (item.id === id ? { ...item, done: !item.done } : item));
}

export function getTutorialAgenda(dayId) {
  return TUTORIAL_CALENDAR_DAYS.find((day) => day.id === dayId)?.agenda || [];
}

export function tutorialStepIndex(current, delta) {
  return Math.min(Math.max(current + delta, 0), TUTORIAL_STEPS.length - 1);
}
