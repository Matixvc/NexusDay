/**
 * Money helpers for the quick expenses tracker.
 *
 * The app formats amounts the way the app is written (es-AR): `$ 1.234,56`, but
 * `parseAmount` accepts whatever the keyboard produces (`.` or `,` as separator)
 * so a decimal pad and a regular keyboard both work.
 */

export const EXPENSE_CATEGORIES = [
  { id: 'Comida', emoji: '🍔', color: '#f59e0b' },
  { id: 'Transporte', emoji: '🚌', color: '#38bdf8' },
  { id: 'Estudio', emoji: '📚', color: '#8b5cf6' },
  { id: 'Ocio', emoji: '🎮', color: '#ec4899' },
  { id: 'Casa', emoji: '🏠', color: '#4fd1c5' },
  { id: 'Otros', emoji: '✨', color: '#94a3b8' },
];

export function categoryOf(id) {
  return EXPENSE_CATEGORIES.find((item) => item.id === id) || EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];
}

function groupThousands(whole) {
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** `1850` -> `$ 1.850`; `1850.5` -> `$ 1.850,50` (decimals are dropped when they are `.00`). */
export function formatMoney(value, { currency = '$', decimals = 2 } = {}) {
  const amount = Number(value) || 0;
  const sign = amount < 0 ? '-' : '';
  const [whole, cents] = Math.abs(amount).toFixed(decimals).split('.');
  const grouped = groupThousands(whole);
  const showCents = decimals > 0 && cents && cents !== '0'.repeat(decimals);
  return `${sign}${currency} ${grouped}${showCents ? `,${cents}` : ''}`;
}

/** Best-effort numeric parse of a free-text amount. Never throws, never returns NaN. */
export function parseAmount(input) {
  const raw = String(input ?? '').replace(/[^\d.,-]/g, '');
  if (!raw) return 0;

  const lastComma = raw.lastIndexOf(',');
  const lastDot = raw.lastIndexOf('.');
  let normalized = raw;

  if (lastComma >= 0 && lastDot >= 0) {
    // The right-most separator is the decimal one: 1.234,56 -> 1234.56
    normalized = lastComma > lastDot ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
  } else if (lastComma >= 0) {
    const decimals = raw.length - lastComma - 1;
    normalized = decimals > 0 && decimals <= 2 ? raw.replace(',', '.') : raw.replace(/,/g, '');
  } else if (lastDot >= 0) {
    const decimals = raw.length - lastDot - 1;
    normalized = decimals > 0 && decimals <= 2 ? raw : raw.replace(/\./g, '');
  }

  const value = Number(normalized);
  return Number.isFinite(value) ? value : 0;
}

export function sumAmounts(items = []) {
  return items.reduce((total, item) => total + (Number(item?.amount) || 0), 0);
}
