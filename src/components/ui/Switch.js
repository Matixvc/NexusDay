import { memo, useEffect, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { themedStyles, colors, radius, spacing, typography } from '../../theme/theme';
import { select as selectHaptic } from '../../services/haptics';

/**
 * On/off switch drawn with plain views.
 *
 * `@react-native-community/switch` is not a dependency of this app and the native one does
 * not follow the accent colour, so the knob is animated with the built-in `Animated` API.
 *
 * `hideLabel` keeps `label` for the accessibility tree while taking the visible text out of
 * the row: used where a title right above already names the control, so the two never end up
 * competing for the same line of space.
 */
function Switch({ value, onValueChange, label, disabled, hideLabel }) {
  // `useState` with a lazy initializer keeps one stable Animated.Value without a ref.
  const [progress] = useState(() => new Animated.Value(value ? 1 : 0));

  useEffect(() => {
    Animated.timing(progress, {
      toValue: value ? 1 : 0,
      duration: 160,
      useNativeDriver: false,
    }).start();
  }, [progress, value]);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [2, 20] });
  const trackColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.surfacePlus, colors.accent],
  });

  const handlePress = () => {
    if (disabled) return;
    selectHaptic();
    onValueChange?.(!value);
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: Boolean(value), disabled: Boolean(disabled) }}
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [styles.hit, pressed && !disabled ? styles.pressed : null]}
    >
      <Animated.View style={[styles.track, { backgroundColor: trackColor }, disabled ? styles.disabled : null]}>
        <Animated.View style={[styles.knob, { transform: [{ translateX }] }]} />
      </Animated.View>
      {label && !hideLabel ? <Text style={typography.small}>{label}</Text> : null}
    </Pressable>
  );
}

/** Switch on the left of a row, with a title and a hint — the shape Ajustes uses. */
function SwitchRow({ title, hint, value, onValueChange, disabled, accessory }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowBody}>
        <Text style={typography.bodyStrong}>{title}</Text>
        {hint ? <Text style={typography.caption}>{hint}</Text> : null}
      </View>
      {accessory}
      <Switch value={value} onValueChange={onValueChange} label={title} disabled={disabled} hideLabel />
    </View>
  );
}

export { Switch, SwitchRow };

export default memo(Switch);

const styles = themedStyles({
  hit: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
  track: { width: 44, height: 26, borderRadius: radius.pill, justifyContent: 'center' },
  knob: { width: 22, height: 22, borderRadius: radius.pill, backgroundColor: colors.text },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowBody: { flex: 1, gap: 2 },
});
