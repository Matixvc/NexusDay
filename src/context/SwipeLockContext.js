import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

/**
 * Cross-component gesture arbitration between a `SwipeRow` and the horizontal pager.
 *
 * **Why this is needed.** `RootNavigator` is a `react-native-pager-view`, i.e. a *native*
 * view that owns its own scroll physics. A JS `PanResponder` can win the JS responder tree
 * — `onShouldBlockNativeResponder` even blocks the native side — but the pager keeps
 * translating the finger on its own once its native gesture recogniser has started. The only
 * reliable way to stop a tab from changing mid-swipe is to tell the pager to stop
 * accepting swipes while a row is taking over.
 *
 * **Why a context and not a prop.** The two parties are far apart in the tree: the row is
 * inside a screen rendered by the pager's page, and the pager is the ancestor that owns
 * `swipeEnabled`. Threading a callback through every screen would touch the navigation layer
 * for a purely local concern.
 *
 * **The contract.** A row acquires the lock the moment its gesture is *recognised* (not on
 * touch start, so a normal tap or a vertical scroll never disables paging) and releases it
 * on release/terminate. The pager therefore stays fully usable everywhere except over the
 * few pixels where a row is genuinely being dragged sideways.
 *
 * The ref counter (rather than a boolean) matters because several rows can be dragging in
 * the same frame; the lock is only released when the last one lets go.
 */

const SwipeLockContext = createContext({ locked: false, acquire: () => {}, release: () => {} });

export function SwipeLockProvider({ children }) {
  const [locked, setLocked] = useState(false);
  const count = useRef(0);

  /**
   * Takes the lock and returns an **idempotent** release.
   *
   * The idempotence is what lets the consumer store the returned function and call it from
   * several places (release, disable, unmount) without ever double-decrementing the counter,
   * which would leave the pager permanently frozen.
   */
  const acquire = useCallback(() => {
    count.current += 1;
    setLocked(true);

    let released = false;
    return () => {
      if (released) return;
      released = true;
      count.current = Math.max(0, count.current - 1);
      if (count.current === 0) setLocked(false);
    };
  }, []);

  const release = useCallback(() => {
    count.current = 0;
    setLocked(false);
  }, []);

  const value = useMemo(() => ({ locked, acquire, release }), [locked, acquire, release]);

  return <SwipeLockContext.Provider value={value}>{children}</SwipeLockContext.Provider>;
}

/**
 * Returns `{ locked, acquire, release }`.
 *
 * `useSwipeLock()` is the navigator-facing read: `swipeEnabled={!locked}`.
 * `useSwipeLockActions()` is the row-facing write.
 */
export function useSwipeLock() {
  const context = useContext(SwipeLockContext);
  if (!context) {
    throw new Error('useSwipeLock must be used inside <SwipeLockProvider>');
  }
  return context;
}

export function useSwipeLockActions() {
  const { acquire, release } = useSwipeLock();
  return { acquireSwipe: acquire, releaseSwipe: release };
}
