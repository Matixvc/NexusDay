import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_ACCENT_ID, getAccentTheme, isAccentId, resolveAccent } from '../theme/accents';
import { DEFAULT_SURFACE_ID, getSurfaceMode, isSurfaceId } from '../theme/surfaces';
import { applyTheme } from '../theme/theme';
import { KEYS, loadValue, saveValue } from '../services/storage';

const ThemeContext = createContext(null);

/**
 * Accent theme + screen surface (Ajustes › Tema / Modo de pantalla).
 *
 * Two knobs decide the look. The accent (`accentId`) is what the UI tints itself with; the
 * surface (`surfaceId`) is what it is painted on — graphite, pure black or white. They travel
 * together on purpose: a light surface swaps the accent for its darker variant, because a mint
 * `#4fd1c5` label over `#ffffff` is unreadable. So `theme` below is always the trio *resolved
 * for the current surface*, never the raw entry from `ACCENT_THEMES`.
 *
 * `revision` exists because a theme cannot be applied to a StyleSheet after the fact. Each
 * screen builds its sheet once at import time with token values baked in; `applyTheme` repaints
 * those objects in place, but inline objects and arrays created during a render are copies that
 * keep the colour they were born with. The app shell keys the navigator on this counter, so the
 * tree remounts and every sheet is rebuilt from the current `colors` (the previous tab comes
 * back right after). It only ever changes *after* `applyTheme` has painted, which is what makes
 * the first tap enough: the press that picks the option is the press that shows it.
 */
export function ThemeProvider({ children }) {
  const [ids, setIds] = useState({ accentId: DEFAULT_ACCENT_ID, surfaceId: DEFAULT_SURFACE_ID });
  const [revision, setRevision] = useState(0);
  /** What is painted right now: `applyTheme` needs it before React re-renders. */
  const painted = useRef({ accentId: DEFAULT_ACCENT_ID, surfaceId: DEFAULT_SURFACE_ID });
  /** Set by the first user pick so hydration cannot step on a choice made while it was running. */
  const picked = useRef(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [accent, surface] = await Promise.all([
        loadValue(KEYS.accent, DEFAULT_ACCENT_ID),
        loadValue(KEYS.surface, DEFAULT_SURFACE_ID),
      ]);
      // `picked` is the whole fix for "the first tap does nothing": restoring the stored pair
      // used to land *after* an early tap and paint the old theme over the new one, so the
      // second tap looked like the only one that worked.
      if (!alive || picked.current) return;
      const wanted = {
        accentId: isAccentId(accent) ? accent : DEFAULT_ACCENT_ID,
        surfaceId: isSurfaceId(surface) ? surface : DEFAULT_SURFACE_ID,
      };
      // The default pair is already painted, and remounting the whole app to paint it again
      // would be the cost of a cold start with nothing stored.
      if (wanted.accentId === painted.current.accentId && wanted.surfaceId === painted.current.surfaceId) return;
      painted.current = applyTheme(wanted);
      setIds(painted.current);
      setRevision((value) => value + 1);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const setTheme = useCallback((patch) => {
    const next = {
      accentId: isAccentId(patch.accentId) ? patch.accentId : painted.current.accentId,
      surfaceId: isSurfaceId(patch.surfaceId) ? patch.surfaceId : painted.current.surfaceId,
    };
    if (next.accentId === painted.current.accentId && next.surfaceId === painted.current.surfaceId) return;
    picked.current = true;
    painted.current = applyTheme(next);
    setIds(painted.current);
    setRevision((value) => value + 1);
    saveValue(KEYS.accent, painted.current.accentId);
    saveValue(KEYS.surface, painted.current.surfaceId);
  }, []);

  const setAccentId = useCallback((accentId) => setTheme({ accentId }), [setTheme]);
  const setSurfaceId = useCallback((surfaceId) => setTheme({ surfaceId }), [setTheme]);

  const surface = getSurfaceMode(ids.surfaceId);
  const value = useMemo(
    () => ({
      theme: resolveAccent(getAccentTheme(ids.accentId), surface.id),
      accentId: ids.accentId,
      surfaceId: ids.surfaceId,
      surface,
      isDark: surface.dark,
      statusBar: surface.statusBar,
      revision,
      setTheme,
      setAccentId,
      setSurfaceId,
    }),
    [ids.accentId, ids.surfaceId, surface, revision, setTheme, setAccentId, setSurfaceId],
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

/** Same context, shorter name: it carries the surface and the status bar too, not just an accent. */
export const useTheme = useAccentTheme;
