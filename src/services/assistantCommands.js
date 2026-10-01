import { colors } from '../theme/theme';
import { EXPENSE_CATEGORIES, formatMoney, parseAmount } from '../utils/money';
import { WEEKDAYS, addDaysToKey, formatDateShort, pad2, todayKey } from '../utils/dates';

/**
 * Nexus AI — comandos que *hacen* algo.
 *
 * `assistant.js` lee los datos; este módulo es la otra mitad: reconoce una orden escrita
 * ("crea una nota de la reunión", "agenda el médico el martes a las 8:30", "gasté 12,50 en
 * comida") y la ejecuta sobre las colecciones de `AppDataContext`. La pantalla pasa los
 * escritores por parámetro, así que el parseo queda puro y se puede probar sin React.
 *
 * Regla de oro: si algo no está claro, no se escribe nada. Ante la duda el asistente responde
 * con lo que sabe hacer (`CAPABILITIES`) en vez de inventar una nota o un evento a medias.
 */

/** Lo que Nexus puede hacer solo, en el orden en que se ofrece en la ayuda. */
export const CAPABILITIES = [
  { verb: 'crea una nota de …', detail: 'la guarda en Notas al instante.' },
  { verb: 'agenda … el martes a las 8:30', detail: 'crea el evento en Agenda (sin aviso: eso lo activas tú).' },
  { verb: 'gasté 1.250 en comida', detail: 'registra el gasto con su categoría.' },
  { verb: 'pásame la agenda en .ics', detail: 'genera el archivo y te lo comparte.' },
  { verb: '¿qué tengo hoy?', detail: 'te lee la agenda y lo que sigue.' },
  { verb: '¿cuánto gasté este mes?', detail: 'suma tus gastos y dice en qué más vas.' },
  { verb: '¿qué hábitos me faltan?', detail: 'revisa las rachas del día.' },
];

/**
 * Like `normalizeText` but keeps `:` and `,`: without them "a las 18:00" collapses into
 * "a las 1800" and "12,50" into "1250", and the time/amount readers stop working.
 */
export function normalizeCommand(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[¿?¡!;()"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Verb lists for the matcher. They deliberately keep voseo forms (`anotate`, `creame`,
 * `agendame`, `pasame`, `podes`…): a person typing the way they speak has to be understood.
 * Only the *output* is standardized — every string the app writes back is neutral Spanish.
 */
const NOTE_VERBS = ['crea', 'crear', 'creame', 'nueva', 'nuevo', 'anota', 'anotar', 'anotate', 'anote', 'apunta', 'apuntar', 'apuntame', 'escribe', 'escribir', 'guarda', 'guardar'];
const NOTE_IMPLIED = ['anota', 'anotar', 'anotate', 'anote', 'apunta', 'apuntar', 'apuntame', 'escribe', 'escribir', 'guarda', 'guardar'];
const NOTE_NOUNS = ['nota', 'notas', 'apunte', 'apuntes', 'anotacion', 'anotaciones', 'memo', 'recordatorio'];
const EVENT_VERBS = ['agenda', 'agendar', 'agendame', 'agendemos', 'programa', 'programar', 'programame', 'recorda', 'recordar', 'recordame'];
const EXPENSE_HINTS = ['gaste', 'pague', 'compre', 'gasto'];

/** Words that mean "I am asking, not ordering". Never run a command on those. */
const QUESTION_LEADERS = ['que', 'cual', 'cuales', 'cuanto', 'cuanta', 'cuantos', 'como', 'quien', 'quienes', 'donde', 'cuando', 'tengo', 'hay', 'me', 'pode', 'puedo', 'sirve', 'significa'];

/** Words that are structure, not content: they never belong in a generated title. */
const SKIP = new Set([
  'y', 'por', 'favor', 'ok', 'dale', 'va', 'podes', 'puedes', 'podrias', 'podria', 'quiero', 'necesito',
  'me', 'creas', 'hagas', 'agregas', 'hay', 'que', 'de', 'del', 'la', 'el', 'los', 'las', 'una', 'un',
  'para', 'sobre', 'en', 'al', 'a', 'con', 'mi', 'se', 'segun', 'entre', 'hasta', 'desde', 'muy',
  'crea', 'crear', 'creame', 'nueva', 'nuevo', 'agrega', 'agregar', 'anade', 'anadir', 'gasto', 'gastos',
  'anota', 'anotar', 'anotate', 'anote', 'apunta', 'apuntar', 'apuntame', 'escribe', 'escribir', 'guarda',
  'guardar', 'agenda', 'agendar', 'agendame', 'programa', 'programar', 'programame', 'recorda', 'recordar',
  'recordame', 'nota', 'notas', 'apunte', 'apuntes', 'anotacion', 'recordatorio', 'memo', 'habito', 'dia',
  'fecha', 'hs', 'am', 'pm',
]);

/** Raw words paired with their normalized form: titles keep accents, matching stays simple. */
function tokenize(value) {
  return String(value ?? '')
    .split(/\s+/)
    .map((raw) => ({
      raw: raw.replace(/^[¿¡("']+/g, '').replace(/[.,;:!?)"'¡¿]+$/g, ''),
      word: normalizeCommand(raw).replace(/[.:]+$/, ''),
    }))
    .filter((part) => part.word.length > 0);
}

/** Words that only read well inside a title, never at the start or the end of one. */
const CONNECTORS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'con', 'para', 'por', 'en', 'a', 'un', 'una', 'que', 'mi']);

/** Index of the first known verb in the opening of the sentence, or `null`. */
function leadingVerb(parts, verbs) {
  for (let index = 0; index < Math.min(parts.length, 5); index += 1) {
    if (verbs.includes(parts[index].word)) return index;
  }
  return null;
}

/** Everything after the verb, minus structure words, capitalised — the title of the new item. */
function titleAfter(parts, verbIndex, extraDrop = []) {
  const drop = new Set(extraDrop);
  const kept = [];
  parts.forEach((part, position) => {
    if (position <= verbIndex || drop.has(part.word)) return;
    // "reunion de comite" keeps its "de"; "una nota de la reunion" must not start with one.
    if (SKIP.has(part.word) && !(CONNECTORS.has(part.word) && kept.length)) return;
    kept.push(part);
  });
  while (kept.length && (SKIP.has(kept[kept.length - 1].word) || CONNECTORS.has(kept[kept.length - 1].word))) kept.pop();
  const title = kept.map((part) => part.raw).join(' ').trim();
  return title ? `${title.charAt(0).toUpperCase()}${title.slice(1)}` : '';
}


/** Time can arrive as "a las 8:30", "8:30 hs" or "18 hs" — each needs its own shape. */
const TIME_LEAD = /(?:^|\s)(?:a\s+las?|a\s+la|las|alas)\s+(\d{1,2})(?::(\d{2}))?(?:\s*(?:hs|h\b))?/;
const TIME_COLON = /(?:^|\s)(\d{1,2}):(\d{2})/;
const TIME_SUFFIX = /(?:^|\s)(\d{1,2})\s*(?:hs|h\b)/;

const RELATIVE_DAYS = [
  { test: /\bpasado manana\b/, days: 2 },
  { test: /\bmanana\b/, days: 1 },
  { test: /\bhoy\b/, days: 0 },
];

/** `12/05` or `12/05/2026` → dateKey plus the words it consumed, rolling to next year when it already went by. */
function explicitDate(text) {
  const match = text.match(/(?:^|\s)(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?:\s|$)/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  if (!day || !month || day > 31 || month > 12) return null;
  const year = match[3] ? Number(match[3].length === 2 ? `20${match[3]}` : match[3]) : new Date().getFullYear();
  const key = `${year}-${pad2(month)}-${pad2(day)}`;
  const dateKey = !match[3] && key < todayKey() ? `${year + 1}-${pad2(month)}-${pad2(day)}` : key;
  return { dateKey, tokens: match[0].trim().split(' ') };
}

/** Next date (today included) matching a weekday named in the sentence. */
function weekdayDate(text) {
  for (const day of WEEKDAYS) {
    const long = day.long.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (!new RegExp(`\\b${long}\\b`).test(text)) continue;
    const today = todayKey();
    for (let offset = 0; offset < 7; offset += 1) {
      const candidate = addDaysToKey(today, offset);
      if (new Date(`${candidate}T00:00:00`).getDay() === day.dow) return { dateKey: candidate, tokens: [long] };
    }
    return { dateKey: today, tokens: [long] };
  }
  return null;
}

/** `{ time, tokens }`; `time` is `null` when the sentence carries no hour. */
function readTime(text) {
  const match = text.match(TIME_LEAD) || text.match(TIME_COLON) || text.match(TIME_SUFFIX);
  if (!match) return { time: null, tokens: [] };
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  if (!Number.isFinite(hour) || hour > 23 || minute > 59) return { time: null, tokens: [] };
  if (/\bde la tarde\b|\bde la noche\b/.test(text) && hour < 12) hour += 12;
  if (/\bde la manana\b/.test(text) && hour === 12) hour = 0;
  return { time: `${pad2(hour)}:${pad2(minute)}`, tokens: match[0].trim().split(' ') };
}

/** `{ dateKey, tokens }` — `tokens` are the words the date ate, so they stay out of the title. */
function readDate(text) {
  for (const entry of RELATIVE_DAYS) {
    const hit = entry.test.exec(text);
    if (hit) return { dateKey: addDaysToKey(todayKey(), entry.days), tokens: hit[0].trim().split(' ') };
  }
  return explicitDate(text) ?? weekdayDate(text) ?? { dateKey: null, tokens: [] };
}

/** Amount + category out of "gaste 1.250 en comida". */
function readExpense(text) {
  const match = text.match(/(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/);
  if (!match) return null;
  const amount = parseAmount(match[0]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const tail = text.slice(match.index + match[0].length);
  const category = EXPENSE_CATEGORIES.find((item) => {
    const id = item.id.toLowerCase();
    return tail.includes(id) || (id !== 'otros' && tail.includes(id.slice(0, 4)));
  });
  const words = tail.split(' ').filter((word) => {
    if (!word || SKIP.has(word) || /^[.,]/.test(word)) return false;
    return !EXPENSE_CATEGORIES.some((item) => word.startsWith(item.id.toLowerCase().slice(0, 4)));
  });
  const note = words.join(' ').trim();
  return {
    amount,
    category: category?.id ?? 'Otros',
    note: note ? `${note.charAt(0).toUpperCase()}${note.slice(1)}` : 'Anotado con Nexus AI',
  };
}

/** "pasame la agenda en ics": needs an action verb *and* a word pointing at the agenda. */
const EXPORT_ACTION = /\b(exporta|exportar|exportame|exportalo|comparte|compartir|pasame|mandame|manda|envia|enviar|genera|generar)\b/;
const AGENDA_WORDS = /\b(ics|agenda|calendario|eventos|mis eventos|mi dia)\b/;

/**
 * `detectCommand("agenda el médico el martes 8:30")` →
 * `{ type: 'create_event', payload: { title: 'Médico', dateKey: '2026-10-06', time: '08:30' } }`
 *
 * `null` when the sentence is a question, has no verb up front, or is too vague to write safely.
 */
export function detectCommand(raw) {
  const parts = tokenize(raw);
  const text = parts.map((part) => part.word).join(' ');
  if (parts.length < 2) return null;
  if (/\bque (podes|puedes|puede) hacer\b|\btus (funciones|capacidades|comandos|opciones)\b|\bque sabes hacer\b|\bayuda\b|\bayudame\b/.test(text)) {
    return { type: 'capabilities' };
  }
  if (QUESTION_LEADERS.includes(parts[0].word)) return null;

  // "gaste 12,50 en comida" — the amount decides: without one it is just a question about money.
  if (leadingVerb(parts, EXPENSE_HINTS) !== null || /\bnuevo gasto\b|\bregistra un gasto\b/.test(text)) {
    const expense = readExpense(text);
    if (expense) {
      return { type: 'create_expense', payload: { ...expense, dateKey: readDate(text).dateKey ?? todayKey() } };
    }
  }

  // Antes que el evento: "pasame la agenda" usa *agenda* como sustantivo, no como verbo.
  if (EXPORT_ACTION.test(text) && AGENDA_WORDS.test(text)) {
    return { type: 'export_ics' };
  }

  const eventIndex = leadingVerb(parts, EVENT_VERBS);
  if (eventIndex !== null) {
    const date = readDate(text);
    const clock = readTime(text);
    // The words that became the date/hour must not survive inside the title.
    const title = titleAfter(parts, eventIndex, [...date.tokens, ...clock.tokens]);
    if (!title) return null;
    return {
      type: 'create_event',
      payload: {
        title,
        // Hoy a las 9 is the honest default, and the answer says so; the sheet fixes it in two taps.
        dateKey: date.dateKey ?? todayKey(),
        time: clock.time ?? '09:00',
        guessedDate: !date.dateKey,
        guessedTime: !clock.time,
      },
    };
  }

  const noteIndex = leadingVerb(parts, NOTE_VERBS);
  if (noteIndex !== null) {
    const saysNote = NOTE_NOUNS.some((noun) => text.includes(noun));
    // "crea" alone is too generic; "anota/compra leche" is clearly a note.
    if (!saysNote && !NOTE_IMPLIED.includes(parts[noteIndex].word)) return null;
    const title = titleAfter(parts, noteIndex, NOTE_NOUNS);
    if (!title) return null;
    return { type: 'create_note', payload: { title } };
  }

  return null;
}

function cannot(what) {
  return {
    title: 'Eso no lo puedo hacer ahora',
    body: `Todavía no tengo acceso para ${what} desde el asistente.`,
    route: null,
    routeLabel: null,
  };
}

/**
 * Runs a detected command against the live collections.
 *
 * `writers` comes from `useAppData()` — `{ addNote, addEvent, addExpense, shareICS }` — which
 * keeps this module free of React and lets the screens show the result as a normal answer
 * bubble. `shareICS` is the only writer that resolves late (the system sheet closes when the
 * user is done), so callers `await applyCommand(...)`.
 */
export function applyCommand(command, writers = {}) {
  const payload = command?.payload ?? {};

  if (command?.type === 'capabilities') {
    return {
      title: 'Esto es lo que hago',
      body: CAPABILITIES.map((item) => `· ${item.verb} — ${item.detail}`).join('\n'),
      route: null,
      routeLabel: null,
    };
  }

  if (command?.type === 'export_ics') {
    if (!writers.shareICS) return cannot('exportar la agenda');
    // El sheet de compartir es del sistema: la pantalla devuelve la respuesta cuando se cierra.
    return writers.shareICS();
  }

  if (command?.type === 'create_note') {
    if (!writers.addNote) return cannot('crear notas');
    writers.addNote({
      title: payload.title,
      body: '',
      color: colors.accent,
      pinned: false,
      private: false,
      audio: null,
      attachment: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      idPrefix: 'nota',
    });
    return {
      title: 'Anotado ✅',
      body: `Guardé “${payload.title}” en Notas. Añade texto, audio o un documento desde ahí.`,
      route: 'Notas',
      routeLabel: 'Abrir notas',
    };
  }

  if (command?.type === 'create_event') {
    if (!writers.addEvent) return cannot('agendar eventos');
    writers.addEvent({
      title: payload.title,
      dateKey: payload.dateKey,
      time: payload.time,
      notes: '',
      // -1 = sin aviso. Programar un aviso que nadie pidió es exactamente lo que molesta.
      leadMinutes: -1,
      color: colors.accent,
      createdAt: Date.now(),
      idPrefix: 'ev',
    });
    const guessed = [
      payload.guessedDate && 'lo puse para hoy porque no indicaste el día',
      payload.guessedTime && 'a las 09:00 porque no indicaste el horario',
    ].filter(Boolean);
    return {
      title: 'Agendado 🗓️',
      body: `“${payload.title}” — ${formatDateShort(payload.dateKey)} a las ${payload.time}${guessed.length ? ` (${guessed.join(' y ')})` : ''}. Toca el evento para cambiar la hora o activar el aviso.`,
      route: 'Agenda',
      routeLabel: 'Abrir agenda',
    };
  }

  if (command?.type === 'create_expense') {
    if (!writers.addExpense) return cannot('registrar gastos');
    writers.addExpense({
      dateKey: payload.dateKey,
      amount: payload.amount,
      category: payload.category,
      note: payload.note,
      createdAt: Date.now(),
      idPrefix: 'gasto',
    });
    return {
      title: 'Gasto registrado 💸',
      body: `${formatMoney(payload.amount)} en ${payload.category}, ${formatDateShort(payload.dateKey)}. Lo ves en Gastos junto al resto del mes.`,
      route: 'Gastos',
      routeLabel: 'Abrir gastos',
    };
  }

  return null;
}

