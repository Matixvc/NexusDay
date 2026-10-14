import { categoryOf, formatMoney, sumAmounts } from '../utils/money';
import { WEEKDAYS, formatDateShort, formatTime } from '../utils/dates';
import { fuzzyFind, normalizeText, plural } from '../utils/text';
import { buildDashboard, habitStreak, isActivitySuspended } from './dashboard';
import { checklistSummary, collectTags } from './notes';

/**
 * Nexus AI — local, offline assistant.
 *
 * There is no API key in this project and no network call is made: the assistant is a
 * small intent matcher that answers with the data already stored on the device. That keeps
 * it instant, private and dependency-free; the UI states this explicitly.
 *
 * Its scope is the app itself: notes, agenda, schedule, birthdays, habits and expenses.
 * Anything outside that scope is not answered, it is reoriented towards what the device
 * *can* do — see `APP_KEYWORDS` and the `offtopic` answer below.
 */

export const ASSISTANT_SUGGESTIONS = [
  '¿Qué tengo hoy?',
  '¿Cuánto gasté este mes?',
  '¿Qué hábitos me faltan?',
  '¿Cuántas notas tengo?',
  '¿Quién cumple años pronto?',
  '¿Cómo programo un aviso?',
  'Crea una nota de la reunión',
];

/**
 * Words that mark a question as being about this app. Used only to tell "I did not
 * understand" apart from "that is out of scope", so it can be generous.
 */
export const APP_KEYWORDS = [
  'hoy', 'agenda', 'horario', 'clase', 'actividad', 'nota', 'notas', 'apunte', 'lista',
  'gasto', 'gastos', 'gaste', 'plata', 'dinero', 'presupuesto', 'precio', 'cuanto',
  'habito', 'habitos', 'racha', 'rutina', 'cumple', 'cumpleanos', 'regalo', 'evento',
  'eventos', 'recorda', 'recordar', 'recordatorio', 'aviso', 'notificacion', 'calendario',
  'sincroniz', 'exportar', 'copia', 'respaldo', 'etiquet', 'checklist', 'suspend', 'pendiente',
  'tema', 'color', 'acento', 'audio', 'voz', 'adjunto',
  'busca', 'buscar', 'encuentra', 'tengo', 'proximo', 'proxima', 'siguiente', 'resumen',
];

/** Lowercase, sin acentos ni signos: así "¿Cuánto GASTÉ hoy?" y "cuanto gaste hoy" coinciden. */
export function normalizeQuestion(text) {
  return normalizeText(text);
}

const has = (text, words) => words.some((word) => text.includes(word));

function bullets(lines) {
  return lines.filter(Boolean).join('\n');
}

function listHabits(habits) {
  return bullets(habits.map((habit) => `· ${habit.emoji || '•'} ${habit.name}`));
}

/**
 * Palabras de la pregunta que pueden ser el nombre de algo. Sin esta lista, "hoy" o
 * "hábito" pasarían el filtro difuso y podrían "encontrar" un hábito al azar.
 */
const STOP_WORDS = new Set([
  'que', 'como', 'cuanto', 'cuanta', 'cuantos', 'cuantas', 'cuales', 'cual', 'quien', 'quienes',
  'donde', 'cuando', 'tengo', 'tenes', 'tienes', 'hay', 'hoy', 'ayer', 'manana', 'mis', 'mi',
  'habito', 'habitos', 'racha', 'rutina', 'faltan', 'nota', 'notas', 'apunte', 'apuntes',
  'lista', 'listas', 'etiqueta', 'etiquetas', 'clase', 'clases', 'asignatura', 'materia',
  'agenda', 'evento', 'eventos', 'gasto', 'gastos', 'dime', 'decime', 'puedes', 'pode',
  'sabes', 'hacer', 'muestra', 'muestro', 'resumen', 'escribi', 'cuenta', 'cuantas',
]);

function candidateWords(text) {
  return normalizeQuestion(text)
    .split(' ')
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
}

/** Elemento cuyo nombre coincida (aproximado) con alguna palabra de la pregunta, o `null`. */
function fuzzyNameIn(text, items = [], key) {
  return candidateWords(text).map((word) => fuzzyFind(word, items, { key })).find(Boolean) || null;
}

/** Resumen "3/5 tareas listas" de una nota checklist (vacío si no lo es). */
function checklistLine(note) {
  if (!note || note.kind !== 'checklist') return null;
  const { done, total } = checklistSummary(note.items);
  return `${done}/${total} ${total === 1 ? 'tarea lista' : 'tareas listas'}`;
}

/** Chips que la pantalla ofrece dentro de la burbuja: tachar un hábito o un ítem de lista. */
function pendingCheckActions(note, limit = 4) {
  if (!note || note.kind !== 'checklist') return [];
  return (Array.isArray(note.items) ? note.items : [])
    .filter((item) => !item.done && item.text)
    .slice(0, limit)
    .map((item) => ({ kind: 'checkitem', noteId: note.id, itemId: item.id, label: `✓ ${item.text}` }));
}

/** Respuesta para "¿Qué notas tengo en #Estudio?" — búsqueda por etiqueta con tolerancia. */
function answerByTag(tag, notes) {
  const labels = collectTags(notes);
  const target = fuzzyFind(tag, labels) || `#${tag}`;
  const key = normalizeText(target);
  const matches = notes.filter((note) =>
    (Array.isArray(note.tags) ? note.tags : []).some((value) => normalizeText(value) === key),
  );
  const lines = matches.slice(0, 5).map((note) => {
    const summary = checklistLine(note);
    if (summary) return `· ${note.title || 'Lista sin título'} — ${summary}.`;
    const preview = String(note.body || '').replace(/\s+/g, ' ').trim();
    return `· ${note.title || 'Nota sin título'}${preview ? ` — ${preview.slice(0, 60)}` : ''}`;
  });
  return {
    id: 'tag',
    title: matches.length ? `Notas con ${target}` : `No hay notas con ${target}`,
    body: bullets([
      ...lines,
      matches.length > 5 ? `· …y ${matches.length - 5} más.` : null,
      matches.length
        ? null
        : '· Crea una nota y agrégale esa etiqueta desde el editor para encontrarla acá.',
    ]),
    actions: matches.find((note) => note.kind === 'checklist') ? pendingCheckActions(matches.find((note) => note.kind === 'checklist'), 3) : [],
    route: 'Notas',
    routeLabel: 'Abrir notas',
  };
}

const INTENTS = [
  {
    id: 'today',
    match: (text) =>
      has(text, ['hoy', 'ahora', 'proximo', 'proxima', 'siguiente', 'agenda', 'horario', 'tengo', 'clase']),
    answer: ({ dashboard, activities = [], text }) => {
      // "¿Qué tengo de Cálculo?" — el nombre de la asignatura manda sobre el resumen general.
      const named = fuzzyNameIn(text, activities, (item) => item.title);
      if (named) {
        const runsToday = dashboard.todayActivities.some((item) => item.id === named.id);
        const suspendedToday = runsToday && isActivitySuspended(named, dashboard.today);
        return {
          title: `${named.title}`,
          body: bullets([
            runsToday && !suspendedToday
              ? `· Hoy: ${formatTime(named.start)} a ${formatTime(named.end)}${named.location ? ` · ${named.location}` : ''}.`
              : null,
            suspendedToday ? '· Hoy está suspendida ⏸️: no cuenta entre tus pendientes.' : null,
            !runsToday
              ? `· ${WEEKDAYS[Number(named.day)]?.long || 'Sin día'}: ${formatTime(named.start)} a ${formatTime(named.end)}.`
              : null,
          ]),
          route: 'Horario',
          routeLabel: 'Abrir horario',
        };
      }
      const suspendedLines = dashboard.suspendedToday.map(
        (item) => `· ⏸️ ${item.title} — suspendida hoy, no cuenta en el pendiente.`,
      );
      if (!dashboard.nextUp.length) {
        return {
          title: 'Hoy estás libre',
          body: bullets([
            `No quedan actividades para hoy (${dashboard.weekdayLabel}). Buen momento para adelantar notas o registrar un gasto.`,
            ...suspendedLines,
          ]),
          route: 'Horario',
          routeLabel: 'Abrir horario',
        };
      }
      const first = dashboard.nextUp[0];
      return {
        title: dashboard.nextUp.length === 1 ? 'Tienes una cosa por delante' : `Tienes ${dashboard.nextUp.length} cosas por delante`,
        body: bullets([...dashboard.nextUp.map((item) => `· ${item.time} — ${item.title} (${item.detail})`), ...suspendedLines]),
        route: first.kind === 'event' ? 'Agenda' : 'Horario',
        routeLabel: first.kind === 'event' ? 'Abrir agenda' : 'Abrir horario',
      };
    },
  },
  {
    id: 'money',
    match: (text) => has(text, ['gasto', 'gaste', 'gastos', 'plata', 'dinero', 'presupuesto']),
    answer: ({ dashboard, expenses }) => {
      const byCategory = expenses.reduce((acc, item) => {
        const key = item.category || 'Otros';
        acc[key] = (acc[key] || 0) + (Number(item.amount) || 0);
        return acc;
      }, {});
      const top = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
      return {
        title: `Llevas ${formatMoney(dashboard.spentMonth)} este mes`,
        body: bullets([
          `· Hoy: ${formatMoney(dashboard.spentToday)} en ${plural(dashboard.todayExpenses.length, 'movimiento')}.`,
          top ? `${categoryOf(top[0]).emoji} Donde más gastas: ${top[0]} (${formatMoney(top[1])}).` : null,
          `· Total registrado: ${formatMoney(sumAmounts(expenses))}.`,
        ]),
        route: 'Gastos',
        routeLabel: 'Abrir gastos',
      };
    },
  },
  {
    id: 'habits',
    match: (text) => has(text, ['habito', 'habitos', 'racha', 'rutina', 'ejercicio', 'agua']),
    answer: ({ dashboard, habits, text }) => {
      if (!habits.length) {
        return {
          title: 'Todavía no registraste hábitos',
          body: 'Crea tus rutinas en Hábitos para marcarlas por día y ver la racha.',
          route: 'Hábitos',
          routeLabel: 'Abrir hábitos',
        };
      }
      // "¿Cómo va el hábito calclo?" — tolerancia a tipeos sobre el nombre real.
      const named = fuzzyNameIn(text, habits, (habit) => habit.name);
      if (named) {
        const streak = habitStreak(named);
        const doneToday = Array.isArray(named.marks) && named.marks.includes(dashboard.today);
        return {
          title: `${named.emoji || '•'} ${named.name}`,
          body: bullets([
            doneToday ? '· Hoy tachado ✅.' : '· Hoy todavía sin marcar.',
            streak > 0 ? `· Racha: ${plural(streak, 'día')} en curso.` : '· Sin racha activa todavía.',
          ]),
          actions: doneToday ? [] : [{ kind: 'habit', id: named.id, label: `✓ Completar ${named.name}` }],
          route: 'Hábitos',
          routeLabel: 'Abrir hábitos',
        };
      }
      const best = habits
        .map((habit) => ({ habit, streak: habitStreak(habit) }))
        .sort((a, b) => b.streak - a.streak)[0];
      return {
        title: dashboard.pendingHabits.length
          ? dashboard.pendingHabits.length === 1
            ? 'Te falta 1 hábito hoy'
            : `Te faltan ${plural(dashboard.pendingHabits.length, 'hábito')} hoy`
          : 'Hábitos al día ✅',
        body: bullets([
          dashboard.pendingHabits.length ? listHabits(dashboard.pendingHabits) : `Marcaste los ${habits.length}.`,
          best && best.streak > 0 ? `· Mejor racha: ${best.habit.name} con ${plural(best.streak, 'día')}.` : null,
        ]),
        actions: dashboard.pendingHabits
          .slice(0, 4)
          .map((habit) => ({ kind: 'habit', id: habit.id, label: `✓ Completar ${habit.name}` })),
        route: 'Hábitos',
        routeLabel: 'Abrir hábitos',
      };
    },
  },
  {
    id: 'notes',
    match: (text) => has(text, ['nota', 'notas', 'apunte', 'lista', 'escribi', 'etiquet']),
    answer: ({ dashboard, notes, text }) => {
      // Una nota concreta ("¿cómo va la lista de compras?") se responde con su progreso.
      const named = fuzzyNameIn(text, notes, (note) => note.title);
      if (named && named.title) {
        const summary = checklistLine(named);
        const lines = summary
          ? [`· Lista: ${summary}.`, ...pendingCheckActions(named, 6).map((action) => `· ☐ ${action.label.slice(2)}`)]
          : [`· ${String(named.body || 'Sin texto todavía.').slice(0, 140)}`];
        if (Array.isArray(named.tags) && named.tags.length) lines.push(`· Etiquetas: ${named.tags.join(' · ')}.`);
        return {
          title: `“${named.title}”`,
          body: bullets(lines),
          actions: pendingCheckActions(named),
          route: 'Notas',
          routeLabel: 'Abrir notas',
        };
      }
      const latest = notes.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
      const checklists = notes.filter((note) => note.kind === 'checklist').slice(0, 3);
      const firstWithWork = notes.find((note) => note.kind === 'checklist');
      return {
        title: dashboard.notesCount ? `Tienes ${plural(dashboard.notesCount, 'nota')}` : 'Todavía no tienes notas',
        body: bullets([
          `· Fijadas arriba: ${dashboard.pinnedNotes}.`,
          latest ? `· Última editada: “${latest.title}”.` : null,
          ...checklists.map((note) => `· “${note.title || 'Lista sin título'}” — ${checklistLine(note)}.`),
          collectTags(notes).length ? '· Busca por etiqueta: “¿Qué notas tengo en #Estudio?”.' : null,
          '· Al editar una nota puedes grabar audio o adjuntar un documento.',
        ]),
        actions: pendingCheckActions(firstWithWork, 3),
        route: 'Notas',
        routeLabel: 'Abrir notas',
      };
    },
  },
  {
    id: 'birthdays',
    match: (text) => has(text, ['cumple', 'cumpleanos', 'cumpleanios', 'regalo', 'anos']),
    answer: ({ dashboard }) => {
      const next = dashboard.upcomingBirthdays[0];
      if (!next) {
        return {
          title: 'Sin cumpleaños a la vista',
          body: 'No hay aniversarios en los próximos 30 días. Regístralos en Cumpleaños para recibir el aviso.',
          route: 'Cumpleaños',
          routeLabel: 'Abrir cumpleaños',
        };
      }
      return {
        title: `${next.emoji || '🎂'} ${next.name} ${next.inDays === 0 ? 'cumple hoy 🎉' : `cumple en ${plural(next.inDays, 'día')}`}`,
        body: bullets([
          `· Fecha: ${formatDateShort(next.dateKey)} a las ${formatTime(next.time || '09:00')}.`,
          next.daysBefore ? `· Aviso programado ${plural(next.daysBefore, 'día')} antes.` : '· Sin aviso previo programado.',
        ]),
        route: 'Cumpleaños',
        routeLabel: 'Abrir cumpleaños',
      };
    },
  },
  {
    id: 'reminders',
    match: (text) => has(text, ['recorda', 'recordar', 'recordatorio', 'avisame', 'aviso', 'notificacion']),
    answer: () => ({
      title: 'Así se programan los avisos',
      body: bullets([
        '· Agenda: crea o edita un evento y elige el aviso en “¿Cuándo te aviso?”.',
        '· Horario y Cumpleaños tienen su propio campo de aviso.',
        '· Si el sistema los bloqueó, actívalos en Ajustes › Notificaciones.',
      ]),
      route: 'Agenda',
      routeLabel: 'Abrir agenda',
    }),
  },
  {
    id: 'calendar',
    match: (text) => has(text, ['calendario', 'sincroniz', 'exportar', 'copia', 'respaldo']),
    answer: () => ({
      title: 'Copias y calendario',
      body: bullets([
        '· NexusDay no escribe en la agenda del teléfono: los eventos viven solo en la app.',
        '· En Ajustes › Gestión de Datos puedes exportar una copia .json con todo y restaurarla después.',
        '· Los avisos se programan desde Agenda, Horario y Cumpleaños.',
      ]),
      route: 'Ajustes',
      routeLabel: 'Abrir ajustes',
    }),
  },
];

/** Resolves `{ id, question, title, body, route, routeLabel }`; never throws. */
export function answerQuestion(question, data = {}) {
  const text = normalizeQuestion(question);
  if (!text) return null;

  try {
    // "¿Qué notas tengo en #Estudio?" — la etiqueta decide antes que cualquier otro intent.
    const hashtag = String(question).match(/#([\p{L}\p{N}_-]+)/u);
    if (hashtag && Array.isArray(data.notes)) {
      return { question: String(question), ...answerByTag(hashtag[1], data.notes) };
    }

    const dashboard = buildDashboard(data);
    const intent = INTENTS.find((item) => item.match(text));
    if (intent) {
      return { id: intent.id, question: String(question), ...intent.answer({ ...data, dashboard, text }) };
    }

    // Out of scope: no internet, no general knowledge. Answer with what the device can do.
    if (!has(text, APP_KEYWORDS)) {
      return {
        id: 'offtopic',
        question: String(question),
        title: 'Eso está fuera de NexusDay',
        body: bullets([
          'Soy el asistente de este teléfono: no tengo internet ni conocimiento general.',
          'Lo que sí hago es leer y escribir tus datos guardados:',
          '· Y cumplo órdenes: “crea una nota de la reunión”, “gasté 1.250 en comida”.',
          '· Notas con voz y adjuntos · Agenda y calendario · Horario semanal',
          '· Hábitos y rachas · Gastos por categoría · Cumpleaños y avisos',
          '· Y el tema de acento que eliges en Ajustes.',
        ]),
        route: 'Inicio',
        routeLabel: 'Ir al inicio',
      };
    }

    return {
      id: 'fallback',
      question: String(question),
      title: 'Puedo ayudarte con tus datos de la app',
      body: bullets(['Prueba con alguna de estas preguntas:', ...ASSISTANT_SUGGESTIONS.map((item) => `· ${item}`)]),
      route: null,
      routeLabel: null,
    };
  } catch (error) {
    console.warn('[assistant] could not answer', error);
    return {
      id: 'error',
      question: String(question),
      title: 'No pude leer tus datos',
      body: 'Vuelve a intentar en unos segundos.',
      route: null,
      routeLabel: null,
    };
  }
}

