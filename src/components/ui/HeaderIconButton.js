import { Pressable } from 'react-native';
import { Icon } from '../Icon';
import { themedStyles, colors, radius } from '../../theme/theme';

/** Compact 44 dp header action with an explicit accessibility label. */
export function HeaderIconButton({ icon, label, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      android_ripple={{ color: colors.accentSoft, borderless: true }}
      style={({ pressed }) => [styles.button, pressed ? styles.pressed : null]}
    >
      <Icon name={icon} size={21} color={colors.text} strokeWidth={2.2} />
    </Pressable>
  );
}

const styles = themedStyles({
  button: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
});
