/**
 * Lowercase, no accents and no punctuation: “Cálculo I” and “calculo” end up identical, so
 * a search or an intent match never trips over an accent or a question mark.
 */
export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when any of the words appears in the text (already normalized or not). */
export function hasAnyWord(text, words) {
  const haystack = normalizeText(text);
  return words.some((word) => haystack.includes(word));
}

/** Cuts a long body down to a single readable line. */
export function oneLine(text, max = 80) {
  const flat = String(text ?? '').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}
