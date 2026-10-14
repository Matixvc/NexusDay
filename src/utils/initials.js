/**
 * Iniciales de un nombre, para el avatar circular de Ajustes.
 *
 * Toma la primera letra de las dos primeras palabras con letras; un nombre de una sola
 * palabra devuelve solo su inicial. Siempre en mayúsculas y sin tildes, para que el avatar
 * sea estable sin importar cómo escribió la persona su nombre.
 */
export function initials(name, fallback = 'N') {
  const words = String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return fallback;
  const letters = words.slice(0, 2).map((word) => word[0]);
  return letters.join('').toUpperCase() || fallback;
}
