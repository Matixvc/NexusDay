import { memo, useEffect, useMemo } from 'react';
import { Animated, PanResponder, Pressable, Text, View } from 'react-native';
import { themedStyles, colors, radius, spacing, typography } from '../../theme/theme';
import { useSwipeLockActions } from '../../context/SwipeLockContext';
import { swipe as swipeHaptic } from '../../services/haptics';

/**
 * Swipe-to-action row.
 *
 * The hard part of this component is *not* the animation, it is winning the gesture
 * against the horizontal pager that moves between sections. `react-native-pager-view` is a
 * native view with its own gesture recogniser, so a JS responder alone is not enough: the
 * row also takes a lock that the navigator honours by disabling `swipeEnabled`
 * (`SwipeLockContext`). Four rules keep the arbitration predictable:
 *
 * - **The row never asks for the responder on touch start** (`onStartShouldSet*` are
 *   `false`), so a plain tap still reaches the `Pressable` children underneath.
 * - **`activeOffsetX` (8 px)** — the row claims the gesture as soon as the finger has moved
 *   8 px *horizontally*, in **any** direction. It is not restricted to the old edge strips,
 *   which made swiping feel broken whenever the finger landed mid-card.
 * - **`failOffsetY` (12 px)** — if the movement is clearly vertical the row bails out and
 *   gives the gesture back, so the list still scrolls normally.
 * - **Once claimed it never gives up** — `onPanResponderTerminationRequest` returns `false`,
 *   the lock is held until release, and the row springs back when the threshold is missed.
 *
 * `onMoveShouldSetPanResponderCapture` is used (not `onMoveShouldSetPanResponder`) so the
 * decision happens *before* the children: a nested `Pressable` or a text selection can no
 * longer swallow the drag.
 */

const ACTIVE_OFFSET_X = 8; // px of horizontal travel that arms the row
const FAIL_OFFSET_Y = 12; // px of vertical travel that hands the gesture to the list
const ACTION_WIDTH = 96; // px that must be travelled to fire the action
const MAX_TRAVEL = 108;

function SwipeRow({ leftAction, rightAction, children, style, disabled, onAction }) {
  const translateX = useMemo(() => new Animated.Value(0), []);
  const { acquireSwipe } = useSwipeLockActions();

  const { panHandlers, settle } = useMemo(() => {
    // Per-responder mutable state. It lives *inside* the memo on purpose: it is only ever
    // meaningful while one finger is down, and keeping it here means no ref is read during
    // render (which the React Compiler rejects). `release` is the idempotent unlock the
    // lock hands back on grant.
    const gesture = { release: null };

    /** Gives the gesture back to the pager and springs the row to centre. */
    const settle = () => {
      if (gesture.release) {
        gesture.release();
        gesture.release = null;
      }
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        speed: 20,
        bounciness: 4,
      }).start();
    };

    const responder = PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (event, move) => {
        if (disabled) return false;
        // Vertical intent is checked first: bail out so a vertical scroll is never hijacked.
        if (Math.abs(move.dy) > FAIL_OFFSET_Y && Math.abs(move.dy) > Math.abs(move.dx)) return false;
        return Math.abs(move.dx) > ACTIVE_OFFSET_X;
      },
      // Keep the gesture even if the pager (or any parent) asks for it back.
      onPanResponderTerminationRequest: () => false,
      // Block the native side too: this is what actually stops the pager's own recogniser.
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: () => {
        gesture.release = acquireSwipe();
      },
      onPanResponderMove: (event, move) => {
        // Rubber-band past MAX_TRAVEL so the row feels like it resists instead of stopping.
        const raw = move.dx;
        const over = Math.abs(raw) - MAX_TRAVEL;
        const base = Math.max(-MAX_TRAVEL, Math.min(MAX_TRAVEL, raw));
        const damped = over > 0 ? Math.sign(raw) * Math.min(over * 0.35, MAX_TRAVEL * 0.35) : 0;
        translateX.setValue(base + damped);
      },
      onPanResponderRelease: (event, move) => {
        const dx = move.dx;
        let fired = false;

        if (dx > ACTION_WIDTH && leftAction?.onPress) {
          leftAction.onPress();
          fired = true;
        } else if (dx < -ACTION_WIDTH && rightAction?.onPress) {
          rightAction.onPress();
          fired = true;
        }

        if (fired) {
          swipeHaptic();
          onAction?.();
        }
        settle();
      },
      onPanResponderTerminate: settle,
    });

    return { panHandlers: responder.panHandlers, settle };
  }, [acquireSwipe, disabled, leftAction, onAction, rightAction, translateX]);

  // A row that becomes disabled must not stay stuck open, and the lock must not leak if
  // the component unmounts in the middle of a gesture.
  useEffect(() => {
    if (disabled) settle();
  }, [disabled, settle]);

  useEffect(() => settle, [settle]);

  return (
    <View style={[styles.wrap, style]}>
      {leftAction || rightAction ? (
        <>
          {leftAction ? <Action side="left" {...leftAction} /> : null}
          {rightAction ? <Action side="right" {...rightAction} /> : null}
        </>
      ) : null}

      <Animated.View style={[styles.content, { transform: [{ translateX }] }]} {...panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

function Action({ side, label, color, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.action, side === 'left' ? styles.actionLeft : styles.actionRight, { backgroundColor: color }]}
    >
      <Text style={[styles.actionLabel, { color: colors.accentInk }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export default memo(SwipeRow);

const styles = themedStyles({
  wrap: { position: 'relative', justifyContent: 'center' },
  content: { width: '100%' },
  action: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: ACTION_WIDTH,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  actionLeft: {
    left: 0,
    alignItems: 'flex-start',
    borderTopLeftRadius: radius.lg,
    borderBottomLeftRadius: radius.lg,
  },
  actionRight: {
    right: 0,
    alignItems: 'flex-end',
    borderTopRightRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  actionLabel: { ...typography.caption, color: colors.text, fontWeight: '800' },
});
