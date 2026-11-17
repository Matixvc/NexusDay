import { Pressable } from 'react-native';
import { Icon } from '../Icon';
import { themedStyles, colors, radius } from '../../theme/theme';

/** Compact 48 dp header action with an explicit accessibility label. */
export function HeaderIconButton({ icon, label, onPress, disabled = false }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      android_ripple={{ color: colors.accentSoft, borderless: true }}
      style={({ pressed }) => [styles.button, disabled ? styles.disabled : null, pressed && !disabled ? styles.pressed : null]}
    >
      <Icon name={icon} size={21} color={colors.text} strokeWidth={2.2} />
    </Pressable>
  );
}

const styles = themedStyles({
  button: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  disabled: { opacity: 0.42 },
});
