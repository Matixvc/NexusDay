import { categoryOf, formatMoney, sumAmounts } from '../utils/money';
import { formatDateShort, formatTime } from '../utils/dates';
import { buildDashboard, habitStreak } from './dashboard';

/**
 * Nexus AI — local, offline assistant.
 *
 * There is no API key in this project and no network call is made: the assistant is a
 * small intent matcher that answers with the data already stored on the device. That keeps
 * it instant, private and dependency-free; the UI states this explicitly.
 */

export const ASSISTANT_SUGGESTIONS = [
  '¿Qué tengo hoy?',
  '¿Cuánto gasté este mes?',
  '¿Qué hábitos me faltan?',
  '¿Cuántas notas tengo?',
  '¿Quién cumple años pronto?',
  '¿Cómo programo un recordatorio?',
];

/** Lowercase, sin acentos ni signos: así "¿Cuánto GASTÉ hoy?" y "cuanto gaste hoy" coinciden. */
export function normalizeQuestion(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const has = (text, words) => words.some((word) => text.includes(word));

function bullets(lines) {
  return lines.filter(Boolean).join('\n');
}

function listHabits(habits) {
  return bullets(habits.map((habit) => `· ${habit.emoji || '•'} ${habit.name}`));
}

const INTENTS = [
  {
    id: 'today',
    match: (text) =>
      has(text, ['hoy', 'ahora', 'proximo', 'proxima', 'siguiente', 'agenda', 'horario', 'tengo', 'clase']),
    answer: ({ dashboard }) => {
      if (!dashboard.nextUp.length) {
        return {
          title: 'Hoy estás libre',
          body: `No quedan actividades para hoy (${dashboard.weekdayLabel}). Buen momento para adelantar notas o cargar un gasto.`,
          route: 'Horario',
          routeLabel: 'Abrir horario',
        };
      }
      const first = dashboard.nextUp[0];
      return {
        title: dashboard.nextUp.length === 1 ? 'Tenés una cosa por delante' : `Tenés ${dashboard.nextUp.length} cosas por delante`,
        body: bullets(dashboard.nextUp.map((item) => `· ${item.time} — ${item.title} (${item.detail})`)),
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
        title: `Llevás ${formatMoney(dashboard.spentMonth)} este mes`,
        body: bullets([
          `· Hoy: ${formatMoney(dashboard.spentToday)} en ${dashboard.todayExpenses.length} movimiento(s).`,
          top ? `${categoryOf(top[0]).emoji} Donde más gastás: ${top[0]} (${formatMoney(top[1])}).` : null,
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
    answer: ({ dashboard, habits }) => {
      if (!habits.length) {
        return {
          title: 'Todavía no cargaste hábitos',
          body: 'Creá tus rutinas en Hábitos para marcarlas por día y ver la racha.',
          route: 'Hábitos',
          routeLabel: 'Abrir hábitos',
        };
      }
      const best = habits
        .map((habit) => ({ habit, streak: habitStreak(habit) }))
        .sort((a, b) => b.streak - a.streak)[0];
      return {
        title: dashboard.pendingHabits.length
          ? `Te faltan ${dashboard.pendingHabits.length} hábito(s) hoy`
          : 'Hábitos al día ✅',
        body: bullets([
          dashboard.pendingHabits.length ? listHabits(dashboard.pendingHabits) : `Marcaste los ${habits.length}.`,
          best && best.streak > 0 ? `· Mejor racha: ${best.habit.name} con ${best.streak} día(s).` : null,
        ]),
        route: 'Hábitos',
        routeLabel: 'Abrir hábitos',
      };
    },
  },
  {
    id: 'notes',
    match: (text) => has(text, ['nota', 'notas', 'apunte', 'lista', 'escribi']),
    answer: ({ dashboard, notes }) => {
      const latest = notes.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
      return {
        title: `Tenés ${dashboard.notesCount} nota(s)`,
        body: bullets([
          `· Fijadas arriba: ${dashboard.pinnedNotes}.`,
          latest ? `· Última editada: “${latest.title}”.` : null,
          '· Al editar una nota podés grabar audio o adjuntar un documento.',
        ]),
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
          body: 'No hay aniversarios en los próximos 30 días. Cargalos en Cumpleaños para recibir el aviso.',
          route: 'Cumpleaños',
          routeLabel: 'Abrir cumpleaños',
        };
      }
      return {
        title: `${next.emoji || '🎂'} ${next.name} cumple en ${next.inDays} día(s)`,
        body: bullets([
          `· Fecha: ${formatDateShort(next.dateKey)} a las ${formatTime(next.time || '09:00')}.`,
          next.daysBefore ? `· Aviso programado ${next.daysBefore} día(s) antes.` : '· Sin aviso previo programado.',
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
        '· Agenda: creá o editá un evento y elegí el aviso en “¿Cuándo te aviso?”.',
        '· Horario y Cumpleaños tienen su propio campo de aviso.',
        '· Si el sistema los bloqueó, activalos en Ajustes › Notificaciones.',
      ]),
      route: 'Ajustes',
      routeLabel: 'Abrir ajustes',
    }),
  },
  {
    id: 'calendar',
    match: (text) => has(text, ['calendario', 'sincroniz', 'ics', 'exportar']),
    answer: () => ({
      title: 'Calendario del teléfono',
      body: bullets([
        '· En Agenda tocá “Añadir al calendario” para copiar tus eventos.',
        '· Cada evento recuerda su id, así que se actualiza en vez de duplicarse.',
        '· También podés exportar todo como archivo .ics y abrirlo en cualquier app.',
      ]),
      route: 'Agenda',
      routeLabel: 'Abrir agenda',
    }),
  },
];

/** Resolves `{ id, question, title, body, route, routeLabel }`; never throws. */
export function answerQuestion(question, data = {}) {
  const text = normalizeQuestion(question);
  if (!text) return null;

  try {
    const dashboard = buildDashboard(data);
    const intent = INTENTS.find((item) => item.match(text));
    if (intent) {
      return { id: intent.id, question: String(question), ...intent.answer({ ...data, dashboard, text }) };
    }
    return {
      id: 'fallback',
      question: String(question),
      title: 'Puedo ayudarte con tus datos del app',
      body: bullets(['Probá con alguna de estas preguntas:', ...ASSISTANT_SUGGESTIONS.map((item) => `· ${item}`)]),
      route: null,
      routeLabel: null,
    };
  } catch (error) {
    console.warn('[assistant] could not answer', error);
    return {
      id: 'error',
      question: String(question),
      title: 'No pude leer tus datos',
      body: 'Volvé a intentar en unos segundos.',
      route: null,
      routeLabel: null,
    };
  }
}

