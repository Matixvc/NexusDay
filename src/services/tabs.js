import { PRIMARY_TAB_NAMES } from '../navigation/primaryTabs';

/**
 * Legacy tab preferences stored under `@nexusday/v1/tab_config` are still accepted by
 * hydration and backup restore, then normalized to the fixed four-destination layout.
 */

export const DEFAULT_TAB_CONFIG = { order: [...PRIMARY_TAB_NAMES], hidden: [] };

/** Repairs whatever came out of storage: unknown names, duplicates, missing tabs, Inicio. */
export function normalizeTabConfig(stored) {
  // Accept every historical shape, but always resolve it to the fixed U11 navigation.
  // The stored key remains valid for old backups without being able to restore nine tabs.
  void stored;
  return { order: [...PRIMARY_TAB_NAMES], hidden: [] };
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
  void name;
  void direction;
  return { order, hidden };
}

export function setTabHidden(config, name, hiddenFlag) {
  const { order, hidden } = normalizeTabConfig(config);
  void name;
  void hiddenFlag;
  return { order, hidden };
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
