/**
 * Categorías (etiquetas) de los eventos de la Agenda.
 *
 * Data pura con un color por categoría, para que la tarjeta, el punto del calendario y la
 * línea de tiempo pinten el evento con el mismo tono sin repetir la paleta en cada pantalla.
 */

export const EVENT_CATEGORIES = [
  { id: 'Examen', label: 'Examen', emoji: '📝', color: '#FF1744' },
  { id: 'Entrega', label: 'Entrega', emoji: '📦', color: '#FFC400' },
  { id: 'Reunión', label: 'Reunión', emoji: '👥', color: '#2979FF' },
  { id: 'Médico', label: 'Médico', emoji: '🩺', color: '#00E676' },
  { id: 'Personal', label: 'Personal', emoji: '🙂', color: '#D500F9' },
];

/** Categoría por defecto cuando el evento no declara una. */
export const DEFAULT_CATEGORY = 'Personal';

/** Busca una categoría por id; cae en la por defecto si no existe. */
export function categoryOf(id) {
  return EVENT_CATEGORIES.find((category) => category.id === id) || EVENT_CATEGORIES.find((category) => category.id === DEFAULT_CATEGORY);
}
