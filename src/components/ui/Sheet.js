import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { themedStyles, colors, layout, radius, spacing, typography } from '../../theme/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TextButton } from './primitives';

/**
 * Bottom sheet used for every create/edit form and every confirmation.
 * Replaces native action sheets so the look stays identical on iOS/Android
 * and so no extra dependency is needed.
 *
 * The container adds `insets.bottom` so the footer buttons stay above the Android
 * navigation bar and the iOS home indicator (the app runs edge-to-edge).
 */
export function Sheet({ visible, onClose, title, subtitle, children, scrollable = true, footer }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, { paddingBottom: spacing.xl + insets.bottom }]}>
            <View style={styles.grabber} />
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={typography.title} numberOfLines={1}>
                  {title}
                </Text>
                {subtitle ? (
                  <Text style={[typography.subtitle, styles.subtitle]} numberOfLines={2}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              <TextButton label="Cerrar" tone="ghost" onPress={onClose} />
            </View>
            {scrollable ? (
              <ScrollView
                style={styles.body}
                contentContainerStyle={styles.bodyContent}
                showsVerticalScrollIndicator={false}
                bounces={false}
                keyboardShouldPersistTaps="handled"
              >
                {children}
              </ScrollView>
            ) : (
              <View style={styles.bodyContent}>{children}</View>
            )}
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/** Destructive confirmation rendered as a sheet (no Alert cross-platform quirks). */
export function ConfirmSheet({ visible, onClose, onConfirm, title, message, confirmLabel = 'Eliminar' }) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title} subtitle={message} scrollable={false}>
      <View style={styles.confirmRow}>
        <TextButton label="Cancelar" tone="ghost" onPress={onClose} style={styles.confirmButton} />
        <Pressable
          onPress={() => {
            onConfirm();
            onClose();
          }}
          style={({ pressed }) => [styles.confirmButton, styles.destructive, pressed ? styles.pressed : null]}
        >
          <Text style={[typography.bodyStrong, { color: colors.danger }]} numberOfLines={1}>
            {confirmLabel}
          </Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

/** Simple single-choice list inside a sheet (reminder lead, emoji, filters). */
export function OptionSheet({ visible, onClose, title, options, value, onSelect }) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <View style={styles.optionList}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={String(option.value)}
              onPress={() => {
                onSelect(option.value);
                onClose();
              }}
              style={({ pressed }) => [styles.option, selected ? styles.optionSelected : null, pressed ? styles.pressed : null]}
            >
              <Text style={[typography.body, selected ? { color: colors.accent, fontWeight: '700' } : null]}>
                {option.label}
              </Text>
              {selected ? <Text style={[typography.bodyStrong, { color: colors.accent }]}>✓</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = themedStyles({
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  backdropTouch: { ...StyleSheet.absoluteFillObject },
  sheet: {
    backgroundColor: colors.elevated,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderTopWidth: 1,
    borderColor: colors.border,
    maxHeight: '88%',
    paddingHorizontal: layout.gutter,
    paddingBottom: spacing.xl,
  },
  grabber: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfacePlus,
    marginTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  headerText: { flex: 1 },
  subtitle: { marginTop: 2 },
  body: { flexGrow: 0 },
  bodyContent: { gap: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
  },
  confirmRow: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.md },
  confirmButton: { flex: 1, alignItems: 'center' },
  destructive: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
  },
  optionList: { gap: spacing.sm, paddingVertical: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
  },
  optionSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  pressed: { opacity: 0.7 },
});
