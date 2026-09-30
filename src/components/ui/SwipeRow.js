import { useCallback, useEffect, useMemo } from 'react';
import { Animated, PanResponder, Pressable, Text, View } from 'react-native';
import { themedStyles, colors, radius, spacing, typography } from '../../theme/theme';

/**
 * Swipe-to-action row.
 *
 * The trick is *not* competing with the horizontal pager that moves between sections:
 *
 * - The gesture is only considered when it starts inside the `EDGE` strip of the row, so a
 *   drag anywhere else belongs to the pager (or to a vertical scroll) and is never stolen:
 *   this row is not even consulted for those touches.
 * - Inside that strip the row still needs `THRESHOLD` px of mostly-horizontal movement
 *   (`dx` clearly bigger than `dy`) before it claims the responder.
 * - Once claimed, `onPanResponderTerminationRequest` returns `false` and the row keeps the
 *   gesture until release, animating back to centre when the action was not reached.
 *
 * The per-gesture bookkeeping lives in the closure built by the same memo as the responder
 * (and is therefore per row, not shared), because the React compiler rules forbid mutating
 * refs while rendering.
 */

const EDGE = 34; // px strip on each side that arms the row
const THRESHOLD = 24; // px of horizontal travel before the row takes over
const RATIO = 1.5; // how much more horizontal than vertical the travel must be
const ACTION_WIDTH = 96; // px that must be travelled to fire the action
const MAX_TRAVEL = 108;

export function SwipeRow({ leftAction, rightAction, children, style, disabled }) {
  const translateX = useMemo(() => new Animated.Value(0), []);

  const reset = useCallback(() => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      speed: 20,
      bounciness: 4,
    }).start();
  }, [translateX]);

  const { panHandlers, onTouchStart, onLayout } = useMemo(() => {
    // Fresh per responder instance: only meaningful while one finger is down.
    const gesture = { width: 0, start: null };

    const responder = PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (event, move) => {
        if (disabled) return false;
        const start = gesture.start;
        if (!start || !gesture.width) return false;
        const armed = start.x <= EDGE || start.x >= start.width - EDGE;
        if (!armed) return false;
        return Math.abs(move.dx) > THRESHOLD && Math.abs(move.dx) > Math.abs(move.dy) * RATIO;
      },
      // Keep the gesture even if the pager asks for it back.
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderMove: (event, move) => {
        translateX.setValue(Math.max(-MAX_TRAVEL, Math.min(MAX_TRAVEL, move.dx)));
      },
      onPanResponderRelease: (event, move) => {
        if (move.dx > ACTION_WIDTH && leftAction?.onPress) {
          leftAction.onPress();
          reset();
          return;
        }
        if (move.dx < -ACTION_WIDTH && rightAction?.onPress) {
          rightAction.onPress();
          reset();
          return;
        }
        reset();
      },
      onPanResponderTerminate: reset,
    });

    return {
      panHandlers: responder.panHandlers,
      onTouchStart: (event) => {
        gesture.start = { x: event.nativeEvent?.locationX ?? 0, width: gesture.width };
      },
      onLayout: (event) => {
        gesture.width = event.nativeEvent.layout.width;
      },
    };
  }, [disabled, leftAction, rightAction, reset, translateX]);

  useEffect(() => {
    if (disabled) Animated.timing(translateX, { toValue: 0, duration: 120, useNativeDriver: true }).start();
  }, [disabled, translateX]);

  return (
    <View style={[styles.wrap, style]} onLayout={onLayout} onTouchStart={onTouchStart} {...panHandlers}>
      {leftAction || rightAction ? (
        <>
          {leftAction ? <Action side="left" {...leftAction} /> : null}
          {rightAction ? <Action side="right" {...rightAction} /> : null}
        </>
      ) : null}

      <Animated.View style={[styles.content, { transform: [{ translateX }] }]}>{children}</Animated.View>
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

const styles = themedStyles({
  wrap: { position: 'relative', justifyContent: 'center' },
  content: { width: '100%' },
  spacer: { width: 1, height: 1 },
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
