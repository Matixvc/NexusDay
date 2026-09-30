import { DEFAULT_TAB_ORDER, HOME_TAB } from '../navigation/tabs';

/**
 * Tab layout preferences (Ajustes › Personalizar Navegación).
 *
 * `{ order, hidden }` is stored as one small object under `@nexusday/v1/tab_config`. Hidden
 * tabs are *not* unregistered: they stay in the navigator so the global search can open them
 * (`navigate` would fail on a route the navigator does not know), the bar simply stops
 * showing them and offers a one-tap way to bring them back.
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
  hiddenSource.forEach((name) => {
    if (name !== HOME_TAB && DEFAULT_TAB_ORDER.includes(name) && !hidden.includes(name)) hidden.push(name);
  });

  return { order, hidden };
}

export function visibleTabs(config) {
  const normalized = normalizeTabConfig(config);
  return normalized.order.filter((name) => !normalized.hidden.includes(name));
}

export function isVisible(config, name) {
  return !config.hidden.includes(name);
}

/** Moves a tab one slot up (-1) or down (+1). Inicio never moves. */
export function moveTab(config, name, direction) {
  const { order, hidden } = normalizeTabConfig(config);
  if (name === HOME_TAB) return { order, hidden };

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
  if (name === HOME_TAB) return { order, hidden };
  const nextHidden = hiddenFlag
    ? Array.from(new Set([...hidden, name]))
    : hidden.filter((item) => item !== name);
  return { order, hidden: nextHidden };
}

export function toggleTabHidden(config, name) {
  return setTabHidden(config, name, !config.hidden.includes(name));
}

/** Short signature used to rebuild the navigator only when the layout really changes. */
export function tabSignature(config) {
  const { order, hidden } = normalizeTabConfig(config);
  return `${order.join('>')}|${hidden.join('>')}`;
}
