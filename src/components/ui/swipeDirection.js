/** Horizontal travel needed before SwipeRow commits to one of its visible actions. */
export const SWIPE_ACTION_THRESHOLD = 112;

/** A positive drag reveals the left action; a negative drag reveals the right action. */
export function getSwipeActionSide(deltaX) {
  if (deltaX > SWIPE_ACTION_THRESHOLD) return 'left';
  if (deltaX < -SWIPE_ACTION_THRESHOLD) return 'right';
  return null;
}
