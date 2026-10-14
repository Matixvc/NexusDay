import { uid } from '../utils/dates';

/**
 * Bloc de notas enriquecido: checklists, etiquetas y vistas.
 *
 * Data y funciones puras, sin React ni almacenamiento a propósito: `NotesScreen` (el editor y
 * la lista) y `ScheduleScreen` (la "Nota de Clase" etiquetada) leen de aquí, igual que el bloc
 * lee de `AppDataContext`. Nada de esto toca AsyncStorage — la pantalla es la dueña del dato.
 *
 * ### Modelo de nota
 * Una nota es de texto (`kind: 'text'`, con `body`) o de lista (`kind: 'checklist'`, con
 * `items: [{ id, text, done }]`). Ambas pueden llevar `tags: string[]`, donde viven las
 * etiquetas rápidas (`#Estudio`) y los nombres de asignatura (`Cálculo I`) sin distinguirlos:
 * para el filtro todas son etiquetas.
 */

/** Etiquetas rápidas ofrecidas en el editor. El nombre de asignatura se añade como etiqueta libre. */
export const QUICK_TAGS = [
  { id: 'estudio', label: '#Estudio', color: '#2979FF' },
  { id: 'ideas', label: '#Ideas', color: '#D500F9' },
  { id: 'importante', label: '#Importante', color: '#FF1744' },
  { id: 'personal', label: '#Personal', color: '#00E676' },
];

/** Modos de una nota. */
export const NOTE_KINDS = {
  text: 'text',
  checklist: 'checklist',
};

/** Una nota recién creada: texto por defecto, como siempre fue el bloc. */
export function blankNote(color) {
  const stamp = Date.now();
  return {
    kind: NOTE_KINDS.text,
    title: '',
    body: '',
    items: [],
    tags: [],
    color,
    pinned: false,
    createdAt: stamp,
    updatedAt: stamp,
  };
}

/** Un ítem de checklist con id propio (la tecla estable de React al reordenar o borrar). */
export function makeCheckItem(text) {
  return { id: uid('chk'), text: String(text ?? '').trim(), done: false };
}

/**
 * Marca o desmarca un ítum sin mutar la lista original: `updateNote` compara por identidad de
 * referencia, así que una lista nueva es lo que dispara el repintado de la tarjeta.
 */
export function toggleCheckItem(items, id) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => (item.id === id ? { ...item, done: !item.done } : item));
}

/** Cuántos ítems están completados y el total — la barra de progreso de la tarjeta. */
export function checklistSummary(items) {
  const list = Array.isArray(items) ? items : [];
  return { done: list.filter((item) => item.done).length, total: list.length };
}

/**
 * Una línea de vista previa para la tarjeta, sea texto o lista. Un checklist sin marcar
 * devuelve su primer pendiente; uno completo, un resumen de "todo listo".
 */
export function notePreview(note) {
  if (!note) return '';
  if (note.kind === NOTE_KINDS.checklist) {
    const items = Array.isArray(note.items) ? note.items : [];
    if (!items.length) return '';
    const { done, total } = checklistSummary(items);
    if (done === total) return `✓ ${total} ${total === 1 ? 'tarea lista' : 'tareas listas'}`;
    const next = items.find((item) => !item.done);
    return next ? next.text : '';
  }
  return String(note.body || '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Etiquetas únicas presentes en una lista de notas, conservando el orden de aparición y
 * poniendo primero las etiquetas rápidas conocidas (para que el filtro sea predecible).
 */
export function collectTags(notes = []) {
  const seen = new Set();
  notes.forEach((note) => {
    (Array.isArray(note.tags) ? note.tags : []).forEach((tag) => {
      const value = String(tag ?? '').trim();
      if (value) seen.add(value);
    });
  });
  const quick = QUICK_TAGS.map((tag) => tag.label).filter((label) => seen.has(label));
  const rest = [...seen].filter((label) => !quick.includes(label)).sort((a, b) => a.localeCompare(b));
  return [...quick, ...rest];
}

/** Alterna una etiqueta en el array de una nota (añadir o quitar), sin duplicados. */
export function toggleTag(tags, label) {
  const list = Array.isArray(tags) ? tags : [];
  const value = String(label ?? '').trim();
  if (!value) return list;
  return list.includes(value) ? list.filter((tag) => tag !== value) : [...list, value];
}
