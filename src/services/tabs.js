import { DEFAULT_TAB_ORDER, HOME_TAB, SETTINGS_TAB } from '../navigation/tabs';

/** The tabs the user may neither reorder nor hide. */
const LOCKED = [HOME_TAB, SETTINGS_TAB];

const isLocked = (name) => LOCKED.includes(name);

/**
 * Tab layout preferences (Ajustes › Personalizar Navegación).
 *
 * `{ order, hidden }` is stored as one small object under `@nexusday/v1/tab_config`. Hidden
 * tabs are *not* unregistered: they stay in the navigator so the global search can open them
 * (`navigate` would fail on a route the navigator does not know), the bar simply stops
 * showing them and offers a one-tap way to bring them back.
 *
 * `order` and `hidden` are **independent** and must be treated as such: the navigator only
 * has to be rebuilt when the *order* changes, because `BottomTabBar` already filters the
 * visible routes on every render. That separation is what lets toggling a switch not throw
 * the user out of the screen they are on.
 */

export const DEFAULT_TAB_CONFIG = { order: [...DEFAULT_TAB_ORDER], hidden: [] };

/** Repairs whatever came out of storage: unknown names, duplicates, missing tabs, Inicio. */
export function normalizeTabConfig(stored) {
  const order = [];
  const hidden = [];
  const source = Array.isArray(stored?.order) ? stored.order : [];
  const hiddenSource = Array.isArray(stored?.hidden) ? stored.hidden : [];

  source.forEach((name) => {
    if (DEFAULT_TAB_ORDER.includes(name) && !order.includes(name)) order.push(name);
  });
  DEFAULT_TAB_ORDER.forEach((name) => {
    if (!order.includes(name)) order.push(name);
  });
  // Inicio is always the first tab, even if the stored order says otherwise.
  const homeAt = order.indexOf(HOME_TAB);
  if (homeAt > 0) order.splice(0, 0, order.splice(homeAt, 1)[0]);
  // A locked tab can never be hidden, even if an old backup says so.
  hiddenSource.forEach((name) => {
    if (!isLocked(name) && DEFAULT_TAB_ORDER.includes(name) && !hidden.includes(name)) hidden.push(name);
  });

  return { order, hidden };
}

export function visibleTabs(config) {
  const normalized = normalizeTabConfig(config);
  return normalized.order.filter((name) => !normalized.hidden.includes(name));
}

export function isVisible(config, name) {
  return !normalizeTabConfig(config).hidden.includes(name);
}

/** Moves a tab one slot up (-1) or down (+1). Inicio and Ajustes never move. */
export function moveTab(config, name, direction) {
  const { order, hidden } = normalizeTabConfig(config);
  if (isLocked(name)) return { order, hidden };

  const from = order.indexOf(name);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= order.length) return { order, hidden };
  // Inicio owns the first slot: no other tab can take it away.
  if (to === order.indexOf(HOME_TAB)) return { order, hidden };

  order.splice(to, 0, order.splice(from, 1)[0]);
  return { order, hidden };
}

export function setTabHidden(config, name, hiddenFlag) {
  const { order, hidden } = normalizeTabConfig(config);
  if (isLocked(name)) return { order, hidden };
  const nextHidden = hiddenFlag
    ? Array.from(new Set([...hidden, name]))
    : hidden.filter((item) => item !== name);
  return { order, hidden: nextHidden };
}

export function toggleTabHidden(config, name) {
  return setTabHidden(config, name, !normalizeTabConfig(config).hidden.includes(name));
}

/**
 * Signature of the **order only**: the navigator must be rebuilt when this changes, and
 * only then. Visibility changes are rendered by `BottomTabBar` on the fly.
 */
export function tabOrderSignature(config) {
  return normalizeTabConfig(config).order.join('>');
}

/** Full signature (order + visibility), for callers that genuinely need both. */
export function tabSignature(config) {
  const { order, hidden } = normalizeTabConfig(config);
  return `${order.join('>')}|${hidden.join('>')}`;
}
