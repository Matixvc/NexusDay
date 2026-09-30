import { useState } from 'react';
import { Text, View } from 'react-native';
import { themedStyles, colors, radius, spacing, typography } from '../../theme/theme';
import { formatTime, parseTime, shiftTime } from '../../utils/dates';
import { Chip, ChipScroller } from './primitives';
import { StepButton } from './inputs';

const PRESETS = ['07:00', '08:30', '10:00', '12:00', '14:00', '16:30', '19:00', '21:00'];

/**
 * Time picker built from a stepper + presets.
 *
 * Deliberately avoids `@react-native-community/datetimepicker`: that module
 * needs native code, so it would not run in Expo Go and would force a
 * development build for no real benefit here.
 */
export function TimeField({ label = 'Hora', value, onChange, minuteStep = 5, hint }) {
  const [open, setOpen] = useState(false);
  const { hour, minute } = parseTime(value);
  const normalized = formatTime(value);

  const bump = (delta) => onChange(shiftTime(value, delta));

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={typography.overline}>{label}</Text>
        <Text style={[styles.toggle, typography.tabular]} onPress={() => setOpen((prev) => !prev)}>
          {open ? 'Ocultar' : 'Ajustar'}
        </Text>
      </View>

      <View style={styles.displayRow}>
        <Text style={[styles.display, typography.tabular]}>{normalized}</Text>
        <View style={styles.quickRow}>
          <StepButton sign="−" onPress={() => bump(-minuteStep)} />
          <StepButton sign="+" onPress={() => bump(minuteStep)} />
        </View>
      </View>

      {open ? (
        <View style={styles.panel}>
          <View style={styles.column}>
            <Text style={styles.columnLabel}>Hora</Text>
            <StepButton sign="+" onPress={() => bump(60)} />
            <View style={styles.columnValue}>
              <Text style={[styles.columnNumber, typography.tabular]}>{String(hour).padStart(2, '0')}</Text>
            </View>
            <StepButton sign="−" onPress={() => bump(-60)} />
          </View>

          <View style={styles.column}>
            <Text style={styles.columnLabel}>Minutos</Text>
            <StepButton sign="+" onPress={() => bump(minuteStep)} />
            <View style={styles.columnValue}>
              <Text style={[styles.columnNumber, typography.tabular]}>{String(minute).padStart(2, '0')}</Text>
            </View>
            <StepButton sign="−" onPress={() => bump(-minuteStep)} />
          </View>

          <Text style={styles.tip}>
            {`±${minuteStep} min · la hora da vuelta sobre sí misma (23:59 → 00:00)`}
          </Text>
        </View>
      ) : null}

      <ChipScroller contentContainerStyle={styles.presets}>
        {PRESETS.map((preset) => (
          <Chip key={preset} label={preset} compact selected={preset === normalized} onPress={() => onChange(preset)} />
        ))}
      </ChipScroller>

      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = themedStyles({
  wrap: { gap: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggle: { fontSize: 12.5, fontWeight: '700', color: colors.accent, paddingVertical: 2 },
  displayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  display: { fontSize: 30, lineHeight: 36, fontWeight: '700', color: colors.text, letterSpacing: -0.5 },
  quickRow: { flexDirection: 'row', gap: spacing.sm },
  panel: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  column: { alignItems: 'center', gap: spacing.sm, minWidth: 84 },
  columnLabel: { fontSize: 10.5, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: colors.textMuted },
  columnValue: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  columnNumber: { fontSize: 19, fontWeight: '700', color: colors.text },
  tip: { flex: 1, fontSize: 11.5, lineHeight: 16, color: colors.textMuted, paddingTop: spacing.md },
  presets: { paddingTop: spacing.xs },
  hint: { fontSize: 11.5, lineHeight: 16, color: colors.textMuted },
});
