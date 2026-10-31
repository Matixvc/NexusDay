import { Pressable, Text, View } from 'react-native';
import { themedStyles, colors, radius, spacing, typography } from '../../theme/theme';

const STATUS_TONE = {
  idle: colors.textMuted,
  running: colors.warning,
  success: colors.success || colors.accent,
  warning: colors.warning,
  error: colors.danger || colors.warning,
};

export function TestButton({ label, onPress, status = 'idle', disabled = false, accessibilityLabel }) {
  const tone = STATUS_TONE[status] || STATUS_TONE.idle;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      style={({ pressed }) => [styles.button, pressed ? styles.pressed : null, disabled ? styles.disabled : null]}
    >
      <View style={[styles.dot, { backgroundColor: tone }]} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = themedStyles({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  dot: { width: 8, height: 8, borderRadius: radius.pill },
  label: { ...typography.small, color: colors.text },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
});
