import { Pressable, Text, TextInput, View } from 'react-native';
import { themedStyles, colors, palette, radius, spacing, typography } from '../../theme/theme';
import { Icon } from '../Icon';

export function Field({ label, children, hint, error }) {
  return (
    <View style={styles.field}>
      <Text style={typography.overline}>{label}</Text>
      {children}
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  autoFocus,
  maxLength,
  keyboardType,
  returnKeyType = 'next',
  onSubmitEditing,
  hint,
  error,
  disabled = false,
  style,
}) {
  return (
    <Field label={label} hint={hint} error={error}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoFocus={autoFocus}
        maxLength={maxLength}
        keyboardType={keyboardType}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        editable={!disabled}
        accessibilityState={{ disabled }}
        style={[styles.input, error ? styles.inputError : null, disabled ? styles.disabled : null, style]}
        selectionColor={colors.accent}
        cursorColor={colors.accent}
      />
    </Field>
  );
}

export function TextArea({ label, value, onChangeText, placeholder, minHeight = 96, autoFocus, hint, error, disabled = false, style }) {
  return (
    <Field label={label} hint={hint} error={error}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline
        textAlignVertical="top"
        autoFocus={autoFocus}
        editable={!disabled}
        accessibilityState={{ disabled }}
        style={[styles.input, styles.textArea, error ? styles.inputError : null, disabled ? styles.disabled : null, { minHeight }, style]}
        selectionColor={colors.accent}
        cursorColor={colors.accent}
      />
    </Field>
  );
}

/** Round swatch row — palette comes from the theme so sheets stay short. */
export function ColorPicker({ label = 'Color', value, onChange, options = palette }) {
  return (
    <Field label={label}>
      <View style={styles.swatchRow}>
        {options.map((color) => {
          const selected = color === value;
          return (
            <Pressable
              key={color}
              onPress={() => onChange(color)}
              accessibilityRole="radio"
              accessibilityLabel={`${label}: ${color}`}
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                styles.swatch,
                { backgroundColor: color },
                selected ? styles.swatchSelected : null,
                pressed ? styles.pressed : null,
              ]}
            >
              {selected ? <Icon name="check" size={18} color={colors.accentInk} /> : null}
            </Pressable>
          );
        })}
      </View>
    </Field>
  );
}

/** Small +/- control. Avoids an icon-font dependency entirely. */
export function StepButton({ sign = '+', onPress, disabled, size = 40, accessibilityLabel }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || (sign === '+' ? 'Aumentar valor' : 'Reducir valor')}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed }) => [
        styles.stepButton,
        { width: Math.max(size, 48), height: Math.max(size, 48) },
        disabled ? styles.disabled : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <Text style={[styles.stepSign, { fontSize: size * 0.5 }]}>{sign}</Text>
    </Pressable>
  );
}

/** Read-only row that opens a picker sheet when tapped. */
export function PickerTrigger({ label, value, placeholder, onPress, trailing }) {
  const filled = value != null && value !== '';
  return (
    <Field label={label}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: filled ? String(value) : placeholder || 'Sin seleccionar' }}
        style={({ pressed }) => [styles.input, styles.trigger, pressed ? styles.pressed : null]}
      >
        <Text
          style={[typography.body, filled ? { color: colors.text, fontWeight: '600' } : { color: colors.textMuted }]}
          numberOfLines={1}
        >
          {filled ? value : placeholder || 'Elegir…'}
        </Text>
        {trailing}
      </Pressable>
    </Field>
  );
}

export function Divider({ style }) {
  return <View style={[styles.divider, style]} />;
}

const styles = themedStyles({
  field: { gap: spacing.sm },
  hint: { ...typography.caption, color: colors.textMuted },
  error: { ...typography.caption, color: colors.danger },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.text,
    minHeight: 52,
  },
  inputError: { borderColor: colors.danger, borderWidth: 2 },
  textArea: { paddingTop: spacing.md, paddingBottom: spacing.md, lineHeight: 21 },
  trigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, alignItems: 'center' },
  swatch: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchSelected: { borderWidth: 2, borderColor: colors.text },
  stepButton: {
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepSign: { fontFamily: typography.body.fontFamily, color: colors.text, fontWeight: '600', lineHeight: undefined },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.6 },
  divider: { height: 1, backgroundColor: colors.border },
});
