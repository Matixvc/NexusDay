import { Pressable, Text, TextInput, View } from 'react-native';
import { themedStyles, colors, palette, radius, spacing, typography } from '../../theme/theme';

export function Field({ label, children, hint }) {
  return (
    <View style={styles.field}>
      <Text style={typography.overline}>{label}</Text>
      {children}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
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
  style,
}) {
  return (
    <Field label={label}>
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
        style={[styles.input, style]}
        selectionColor={colors.accent}
        cursorColor={colors.accent}
      />
    </Field>
  );
}

export function TextArea({ label, value, onChangeText, placeholder, minHeight = 96, autoFocus }) {
  return (
    <Field label={label}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline
        textAlignVertical="top"
        autoFocus={autoFocus}
        style={[styles.input, styles.textArea, { minHeight }]}
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
              style={({ pressed }) => [
                styles.swatch,
                { backgroundColor: color },
                selected ? styles.swatchSelected : null,
                pressed ? styles.pressed : null,
              ]}
            >
              {selected ? <Text style={styles.swatchCheck}>✓</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </Field>
  );
}

/** Small +/- control. Avoids an icon-font dependency entirely. */
export function StepButton({ sign = '+', onPress, disabled, size = 40 }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => [
        styles.stepButton,
        { width: size, height: size },
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
  hint: { fontSize: 11.5, lineHeight: 16, color: colors.textMuted },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.text,
    minHeight: 46,
  },
  textArea: { paddingTop: spacing.md, paddingBottom: spacing.md, lineHeight: 21 },
  trigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, alignItems: 'center' },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchSelected: { borderWidth: 2, borderColor: colors.text },
  swatchCheck: { fontSize: 14, fontWeight: '800', color: 'rgba(0,0,0,0.65)' },
  stepButton: {
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepSign: { color: colors.text, fontWeight: '600', lineHeight: undefined },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.6 },
  divider: { height: 1, backgroundColor: colors.border },
});
