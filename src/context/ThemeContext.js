import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_ACCENT_ID, getAccentTheme, isAccentId } from '../theme/accents';
import { applyAccent } from '../theme/theme';
import { KEYS, loadValue, saveValue } from '../services/storage';

const ThemeContext = createContext(null);

/**
 * Accent theme (Ajustes › Tema).
 *
 * The palette lives in the shared `colors` object and in the registered style sheets, so
 * `applyAccent` repaints both in place. What React needs afterwards is a re-render, and
 * that is what `revision` is for: the app shell uses it as a `key` so the tree remounts
 * with the new accent (the previous tab is restored right after).
 */
export function ThemeProvider({ children }) {
  const [accentId, setAccentIdState] = useState(DEFAULT_ACCENT_ID);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const stored = await loadValue(KEYS.accent, DEFAULT_ACCENT_ID);
      if (!alive || !isAccentId(stored)) return;
      applyAccent(stored);
      setAccentIdState(stored);
      setRevision((value) => value + 1);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const setAccentId = useCallback((nextId) => {
    const next = isAccentId(nextId) ? nextId : DEFAULT_ACCENT_ID;
    applyAccent(next);
    setAccentIdState(next);
    setRevision((value) => value + 1);
    saveValue(KEYS.accent, next);
  }, []);

  const value = useMemo(
    () => ({ accentId, setAccentId, revision, theme: getAccentTheme(accentId) }),
    [accentId, setAccentId, revision],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAccentTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAccentTheme must be used inside <ThemeProvider>');
  }
  return context;
}