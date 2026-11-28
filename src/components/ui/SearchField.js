import { Pressable, Text, TextInput, View } from 'react-native';
import { themedStyles, colors, radius, spacing, typography } from '../../theme/theme';
import { Glyph } from '../../navigation/TabGlyphs';
import { EmptyState, Pill } from './primitives';

/**
 * Global search field for the dashboard.
 *
 * Filtering happens on every keystroke (the caller owns the state), so the field stays a
 * dumb input plus a clear button; results are rendered by `SearchResults`.
 *
 * Accepts optional `error` and `helper` strings that render below the field. When `error`
 * is set it takes precedence over `helper`. Both are retrocompatible: omitting them keeps
 * the previous layout unchanged.
 */
export function SearchField({ value, onChangeText, placeholder = 'Buscar…', error, helper }) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.field}>
        <View style={styles.leading}>
          <Glyph name="search" color={colors.textMuted} />
        </View>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          selectionColor={colors.accent}
          cursorColor={colors.accent}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          accessibilityLabel={placeholder}
          accessibilityHint={error || helper}
        />
        {value ? (
          <Pressable
            onPress={() => onChangeText('')}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Limpiar búsqueda"
            style={({ pressed }) => [styles.clear, pressed ? styles.pressed : null]}
          >
            <Glyph name="close" color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helper ? (
        <Text style={styles.helperText}>{helper}</Text>
      ) : null}
    </View>
  );
}

/**
 * Results list. Each row carries the section it belongs to, so one tap is enough to land
 * on the item (`focusId`): the target screen highlights it for a few seconds.
 */
export function SearchResults({ items, total, query, onSelect }) {
  if (items.length === 0) {
    return (
      <EmptyState
        emoji="🔍"
        title="Sin coincidencias"
        hint={`No encontré nada para “${query}” en notas, eventos, hábitos ni gastos.`}
      />
    );
  }

  return (
    <View style={styles.results}>
      <Text style={typography.caption}>
        {total > items.length
          ? `Mostrando ${items.length} de ${total} resultados`
          : `${total} resultado${total === 1 ? '' : 's'}`}
      </Text>
      {items.map((item) => (
        <Pressable
          key={`${item.type}-${item.id}`}
          onPress={() => onSelect(item)}
          accessibilityRole="button"
          accessibilityLabel={`${item.typeLabel}: ${item.title}. ${item.subtitle}`}
          style={({ pressed }) => [styles.result, pressed ? styles.pressed : null]}
        >
          <View style={[styles.resultIcon, { backgroundColor: colors.surfaceAlt, borderColor: item.color }]}>
            <Text style={styles.resultEmoji}>{item.icon}</Text>
          </View>
          <View style={styles.resultBody}>
            <Text style={typography.bodyStrong} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={typography.caption} numberOfLines={1}>
              {item.subtitle}
            </Text>
          </View>
          <Pill label={item.typeLabel} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = themedStyles({
  wrapper: { gap: spacing.xs },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
  },
  // The leading slot is a fixed square that centres the glyph on both axes. A fixed width
  // alone left the magnifier riding high (it carries a negative offset in TabGlyphs), which
  // read as a stray dot detached from the field; centring the box removes any drift.
  leading: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  input: { ...typography.body, flex: 1, color: colors.text, minHeight: 52, paddingVertical: spacing.md },
  clear: { width: 48, height: 48, marginRight: -spacing.md, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.65 },
  errorText: { color: colors.danger, ...typography.caption, marginTop: spacing.xs },
  helperText: { color: colors.textMuted, ...typography.caption, marginTop: spacing.xs },

  results: { gap: spacing.sm },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  resultIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultEmoji: { fontFamily: typography.body.fontFamily, fontSize: 16 },
  resultBody: { flex: 1, gap: 2 },
});
