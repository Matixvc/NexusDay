import { DEFAULT_ACCENT_ID, getAccentTheme, resolveAccent } from '../theme/accents';
import { getSurfaceMode, SELECTABLE_SURFACE_MODES } from '../theme/surfaces';

export const TUTORIAL_STEPS = [
  {
    key: 'welcome',
    icon: 'home',
    title: 'Tu día, con más claridad',
    objective: 'Reconocer dónde empieza tu jornada y cómo se organiza NexusDay.',
    body: 'Día a Día reúne tus clases, eventos cercanos y rutinas en una vista local.',
    points: ['Empieza en Día a Día para ver lo que viene.', 'Tus datos permanecen en este dispositivo.', 'Puedes repetir esta guía desde Ajustes.'],
    tip: 'La tarjeta de ejemplo siguiente es ficticia y no consulta tus registros.',
    demoId: 'welcome',
    field: true,
  },
  {
    key: 'day',
    icon: 'home',
    title: 'Organiza tu jornada',
    objective: 'Distinguir clases, rutinas personales y eventos en el mismo día.',
    body: 'Las clases conservan su horario; tus rutinas se repiten en los días elegidos.',
    points: ['Consulta la próxima clase y su cuenta regresiva.', 'Marca una rutina al completarla.', 'Abre Horario para revisar tu semana.'],
    tip: 'Para crear una rutina real: Inicio → Gestionar mi rutina → Crear rutina.',
    imageKey: 'day',
    demoId: 'routine',
  },
  {
    key: 'notes',
    icon: 'note',
    title: 'Guarda lo que importa',
    objective: 'Practicar una checklist y entender qué cambia al marcar una nota privada.',
    body: 'Crea notas de texto o checklist, encuéntralas con búsqueda y organízalas con etiquetas.',
    points: ['Marca y desmarca tareas.', 'Activa Privada para proteger el acceso.', 'El contenido privado no aparece en vistas previas públicas.'],
    tip: 'Para una nota real: Bloc de Notas → Crear nota. Esta práctica usa contenido de muestra.',
    imageKey: 'notes',
    demoId: 'notes',
  },
  {
    key: 'calendar',
    icon: 'calendar',
    title: 'Mira el mes, planea el día',
    objective: 'Elegir una fecha y leer la agenda que corresponde a ese día.',
    body: 'Calendario reúne eventos, clases y cumpleaños recurrentes.',
    points: ['Toca una fecha para abrir su agenda.', 'Los puntos indican fechas con actividad.', 'Los cumpleaños se repiten cada año.'],
    tip: 'En Calendario puedes crear eventos desde el botón Crear en Calendario.',
    imageKey: 'calendar',
    demoId: 'calendar',
  },
  {
    key: 'themes',
    icon: 'palette',
    title: 'Adáptalo a tu ambiente',
    objective: 'Comparar las superficies Blanco, Oscuro y Nex antes de elegir una.',
    body: 'Apariencia permite cambiar el tema y escoger uno de los acentos disponibles.',
    points: ['Las vistas previas muestran superficies reales.', 'Cambiar el tema no altera tus registros.', 'La prueba de esta pantalla no cambia tu preferencia.'],
    tip: 'Para aplicar un tema: Ajustes → Apariencia y personalización.',
    imageKey: 'themes',
    demoId: 'themes',
  },
  {
    key: 'privacy',
    icon: 'shieldCheck',
    title: 'Protege y conserva tus datos',
    objective: 'Saber dónde encontrar privacidad, respaldos, widgets y ayuda.',
    body: 'Las notas privadas requieren autorización según tu configuración. Los respaldos se administran en el dispositivo.',
    points: ['Exporta una copia antes de cambiar de dispositivo.', 'Los adjuntos pueden depender de archivos locales.', 'Añade Mi horario desde Widgets en el launcher Android.'],
    tip: 'La demostración no solicita permisos ni crea una copia. Los widgets requieren una compilación Android compatible.',
    imageKey: 'privacy',
    demoId: 'first-steps',
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

export const TUTORIAL_HELP_ITEMS = [
  { title: 'Crear una rutina', detail: 'Inicio → Gestionar mi rutina → Crear rutina. Elige días y, si quieres, una hora.' },
  { title: 'Crear una nota', detail: 'Bloc de Notas → Crear nota. Puedes escribir texto, elegir checklist y marcar Privada.' },
  { title: 'Consultar el calendario', detail: 'Calendario → toca un día para leer la agenda de esa fecha.' },
  { title: 'Personalizar el tema', detail: 'Ajustes → Apariencia y personalización → elige Blanco, Oscuro o Nex.' },
  { title: 'Exportar un respaldo', detail: 'Ajustes → Datos y respaldos → Exportar copia (.json).' },
  { title: 'Añadir Mi horario', detail: 'En Android, mantén pulsada la pantalla de inicio → Widgets → NexusDay → Mi horario.' },
];

export function toggleTutorialChecklistItem(items, id) {
  if (!items.some((item) => item.id === id)) return items;
  return items.map((item) => (item.id === id ? { ...item, done: !item.done } : item));
}

export function getTutorialAgenda(dayId) {
  return TUTORIAL_CALENDAR_DAYS.find((day) => day.id === dayId)?.agenda || [];
}
