import * as Haptics from 'expo-haptics';

/**
 * Subtle haptic feedback (`expo-haptics`, SDK 57).
 *
 * Two rules shape this module:
 *
 * 1. **Never throw.** Haptics are decoration, so a device without a vibrator, a simulator or
 *    an environment where the native module is missing must never break a user action. The
 *    same `isAvailable()` probe the audio and file services use decides once whether the
 *    module can be reached, and every call is a no-op afterwards.
 * 2. **Never await.** `impactAsync()` returns a promise that resolves after the taptic
 *    engine is done. Awaiting it inside a press handler would delay the UI by a frame, so
 *    the calls are fired and forgotten; the `.catch` only exists to swallow the rejection.
 *
 * The vocabulary is intentionally small and mapped to meaning:
 *
 * | Function | Style | Used by |
 * |---|---|---|
 * | `tap()` | `ImpactFeedbackStyle.Light` | primary buttons, card presses |
 * | `select()` | `selectionAsync` | picking a day, a chip, a category |
 * | `success()` | `NotificationFeedbackType.Success` | a habit completed, data saved |
 * | `warning()` | `NotificationFeedbackType.Warning` | deleting something, losing a streak |
 * | `swipe()` | `ImpactFeedbackStyle.Medium` | a swipe action firing on a `SwipeRow` |
 */

/** True when the native module is reachable (needs a dev build; false on web/simulators). */
export function isAvailable() {
  try {
    return typeof Haptics?.impactAsync === 'function';
  } catch {
    return false;
  }
}

const fire = (run) => {
  if (!isAvailable()) return;
  try {
    const result = run();
    if (result && typeof result.catch === 'function') result.catch(() => {});
  } catch {
    // A device without a vibrator simply does not answer; that is not an error.
  }
};

/** Light impact: the generic "this registered" tap. */
export function tap() {
  fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/** Selection tick: a discrete choice changed (a day, a chip, a category). */
export function select() {
  fire(() => Haptics.selectionAsync());
}

/** Medium impact: a slide reached its action threshold. */
export function swipe() {
  fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

/** Success notification: a task got completed. */
export function success() {
  fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** Warning notification: a destructive or undoable-because-it-matters action. */
export function warning() {
  fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}
