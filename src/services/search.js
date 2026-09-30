import { normalizeText, oneLine } from '../utils/text';
import { formatMoney, categoryOf } from '../utils/money';
import { formatDateShort, relativeDayLabel } from '../utils/dates';
import { habitStreak } from './dashboard';

/**
 * Global search behind the field in the dashboard.
 *
 * One pass over the four collections the dashboard can reach (notes, events, habits and
 * expenses), scored so the most obvious match comes first: a title that starts with the
 * query beats one that merely contains it, and newer items win ties.
 */
export const SEARCH_SOURCES = {
  note: { route: 'Notas', label: 'Nota', icon: '📝' },
  event: { route: 'Agenda', label: 'Evento', icon: '🗓️' },
  habit: { route: 'Hábitos', label: 'Hábito', icon: '💪' },
  expense: { route: 'Gastos', label: 'Gasto', icon: '💰' },
};

/** `{ hit, score }` for one candidate, or `null` when it does not match. */
function score(haystacks, needle) {
  let best = null;
  haystacks.forEach(({ text, weight }, index) => {
    const value = normalizeText(text);
    if (!value || !needle) return;
    const position = value.indexOf(needle);
    if (position < 0) return;
    // Earlier fields matter more (title before body) and a prefix match beats a mid-word one.
    const score = (value.startsWith(needle) ? 1000 : 600) - Math.min(position, 200) - weight * 50 - index * 10;
    if (!best || score > best.score) best = { hit: String(text ?? ''), score };
  });
  return best;
}

/** Everything the dashboard can find, already ordered and capped. */
export function searchEverything(
  query,
  { notes = [], events = [], habits = [], expenses = [], limit = 8 } = {},
) {
  const needle = normalizeText(query);
  if (!needle) return { query: '', items: [], total: 0, byType: {} };

  const candidates = [];

  notes.forEach((note) => {
    const match = score(
      [
        { text: note.title, weight: 0 },
        { text: note.body, weight: 1 },
      ],
      needle,
    );
    if (!match) return;
    candidates.push({
      type: 'note',
      id: note.id,
      route: SEARCH_SOURCES.note.route,
      typeLabel: SEARCH_SOURCES.note.label,
      icon: SEARCH_SOURCES.note.icon,
      title: note.title || 'Sin título',
      subtitle: oneLine(note.body, 72) || 'Nota sin contenido',
      color: note.color,
      recency: note.updatedAt || note.createdAt || 0,
      score: match.score,
    });
  });

  events.forEach((event) => {
    const match = score(
      [
        { text: event.title, weight: 0 },
        { text: event.notes, weight: 1 },
        { text: event.dateKey, weight: 2 },
      ],
      needle,
    );
    if (!match) return;
    candidates.push({
      type: 'event',
      id: event.id,
      route: SEARCH_SOURCES.event.route,
      typeLabel: SEARCH_SOURCES.event.label,
      icon: SEARCH_SOURCES.event.icon,
      title: event.title,
      subtitle: `${formatDateShort(event.dateKey)} · ${event.time || 'sin hora'}`,
      color: event.color,
      recency: event.dateKey || '',
      score: match.score,
    });
  });

  habits.forEach((habit) => {
    const match = score([{ text: habit.name, weight: 0 }], needle);
    if (!match) return;
    const streak = habitStreak(habit);
    candidates.push({
      type: 'habit',
      id: habit.id,
      route: SEARCH_SOURCES.habit.route,
      typeLabel: SEARCH_SOURCES.habit.label,
      icon: SEARCH_SOURCES.habit.icon,
      title: habit.name,
      subtitle: streak ? `Racha de ${streak} día(s)` : 'Sin racha todavía',
      color: habit.color,
      recency: '',
      score: match.score,
    });
  });

  expenses.forEach((expense) => {
    const category = categoryOf(expense.category);
    const match = score(
      [
        { text: expense.note, weight: 0 },
        { text: expense.category, weight: 1 },
        { text: String(expense.amount ?? ''), weight: 2 },
      ],
      needle,
    );
    if (!match) return;
    candidates.push({
      type: 'expense',
      id: expense.id,
      route: SEARCH_SOURCES.expense.route,
      typeLabel: SEARCH_SOURCES.expense.label,
      icon: category.emoji || SEARCH_SOURCES.expense.icon,
      title: expense.note || category.id,
      subtitle: `${formatMoney(expense.amount)} · ${relativeDayLabel(expense.dateKey)}`,
      color: category.color,
      recency: expense.dateKey || '',
      score: match.score,
    });
  });

  candidates.sort((a, b) => b.score - a.score || String(b.recency).localeCompare(String(a.recency)));

  const byType = candidates.reduce((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1;
    return acc;
  }, {});

  return { query: String(query), items: candidates.slice(0, limit), total: candidates.length, byType };
}
