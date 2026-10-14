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

/**
 * Tolera los errores de tipeo pequeños: distancia de edición entre dos textos ya
 * normalizados. Sirve para que "calclo" siga encontrando "Cálculo I" en el asistente.
 */
function editDistance(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  if (!a || !b) return Math.max(a.length, b.length);
  const rows = Array.from({ length: a.length + 1 }, (unused, row) => [row]);
  for (let col = 1; col <= b.length; col += 1) rows[0][col] = col;
  for (let row = 1; row <= a.length; row += 1) {
    for (let col = 1; col <= b.length; col += 1) {
      const cost = a[row - 1] === b[col - 1] ? 0 : 1;
      rows[row][col] = Math.min(rows[row - 1][col] + 1, rows[row][col - 1] + 1, rows[row - 1][col - 1] + cost);
    }
  }
  return rows[a.length][b.length];
}

/**
 * Mejor coincidencia aproximada dentro de una lista. Devuelve el candidato original
 * o `null` cuando nada se parece lo suficiente. La tolerancia crece con el largo del
 * texto para no aceptar "luz" como si fuera "club".
 */
export function fuzzyFind(query, candidates = [], { key = null } = {}) {
  const needle = normalizeText(query);
  if (!needle) return null;
  let best = null;
  let bestScore = null;
  candidates.forEach((candidate) => {
    const raw = typeof key === 'function' ? key(candidate) : key ? candidate?.[key] : candidate;
    const value = normalizeText(raw);
    if (!value) return;
    if (value.includes(needle) || needle.includes(value)) {
      const score = Math.abs(value.length - needle.length);
      if (bestScore === null || score < bestScore) {
        best = candidate;
        bestScore = score;
      }
      return;
    }
    const distance = editDistance(needle, value);
    const tolerance = value.length <= 4 ? 1 : value.length <= 8 ? 2 : 3;
    if (distance <= tolerance && (bestScore === null || distance < bestScore)) {
      best = candidate;
      bestScore = distance;
    }
  });
  return best;
}

/** Cuts a long body down to a single readable line. */
export function oneLine(text, max = 80) {
  const flat = String(text ?? '').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/**
 * `plural(1, 'día', 'días')` → `1 día`, `plural(3, 'día', 'días')` → `3 días`.
 *
 * Exists so the UI never shows `1 cosa(s)`: every count gets the noun it deserves. The third
 * argument may be omitted when adding an `s` is enough.
 */
export function plural(count, singular, pluralWord) {
  const total = Number(count) || 0;
  return `${total} ${total === 1 ? singular : pluralWord ?? `${singular}s`}`;
}
