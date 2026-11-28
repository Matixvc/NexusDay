import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { themedStyles, colors, radius, spacing, typography } from '../../theme/theme';
import { formatTime, parseTime, shiftTime } from '../../utils/dates';
import { formatTimeInput, timeInputError } from '../../services/timeInput';
import { Chip, ChipScroller } from './primitives';
import { StepButton } from './inputs';

const PRESETS = ['07:00', '08:30', '10:00', '12:00', '14:00', '16:30', '19:00', '21:00'];

/** Shared 24-hour editor: direct typing first, visual controls as an alternative. */
export function TimeField({ label = 'Hora', value, onChange, minuteStep = 5, hint }) {
  const [open, setOpen] = useState(false);
  const error = timeInputError(value);
  const safeValue = error ? '09:00' : value;
  const { hour, minute } = parseTime(safeValue);

  const commit = (next) => onChange(formatTime(next));
  const bump = (delta) => commit(shiftTime(safeValue, delta));

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={typography.overline}>{label}</Text>
        <Pressable
          onPress={() => setOpen((previous) => !previous)}
          accessibilityRole="button"
          accessibilityLabel={`${open ? 'Ocultar' : 'Mostrar'} selector visual de ${label}`}
          accessibilityState={{ expanded: open }}
          style={styles.toggleButton}
        >
          <Text style={[styles.toggle, typography.tabular]}>{open ? 'Ocultar selector' : 'Usar selector'}</Text>
        </Pressable>
      </View>

      <View style={[styles.inputRow, error ? styles.inputRowError : null]}>
        <TextInput
          value={String(value ?? '')}
          onChangeText={(next) => onChange(formatTimeInput(next))}
          onBlur={() => { if (!error) commit(value); }}
          inputMode="numeric"
          keyboardType="number-pad"
          maxLength={5}
          placeholder="HH:mm"
          placeholderTextColor={colors.textMuted}
          returnKeyType="done"
          selectTextOnFocus
          accessibilityLabel={`${label}, formato 24 horas`}
          accessibilityHint="Escribe cuatro dígitos, por ejemplo 0930 para 09:30"
          accessibilityValue={{ text: error || String(value ?? '') }}
          style={[styles.input, typography.tabular]}
          selectionColor={colors.accent}
          cursorColor={colors.accent}
        />
        <View style={styles.quickRow}>
          <StepButton sign="−" onPress={() => bump(-minuteStep)} accessibilityLabel={`Restar ${minuteStep} minutos`} />
          <StepButton sign="+" onPress={() => bump(minuteStep)} accessibilityLabel={`Sumar ${minuteStep} minutos`} />
        </View>
      </View>

      {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}

      {open ? (
        <View style={styles.panel}>
          <View style={styles.column}>
            <Text style={styles.columnLabel}>Hora</Text>
            <StepButton sign="+" onPress={() => bump(60)} accessibilityLabel="Sumar una hora" />
            <View style={styles.columnValue}><Text style={[styles.columnNumber, typography.tabular]}>{String(hour).padStart(2, '0')}</Text></View>
            <StepButton sign="−" onPress={() => bump(-60)} accessibilityLabel="Restar una hora" />
          </View>
          <View style={styles.column}>
            <Text style={styles.columnLabel}>Minutos</Text>
            <StepButton sign="+" onPress={() => bump(minuteStep)} accessibilityLabel={`Sumar ${minuteStep} minutos`} />
            <View style={styles.columnValue}><Text style={[styles.columnNumber, typography.tabular]}>{String(minute).padStart(2, '0')}</Text></View>
            <StepButton sign="−" onPress={() => bump(-minuteStep)} accessibilityLabel={`Restar ${minuteStep} minutos`} />
          </View>
          <Text style={styles.tip}>Formato 24 horas · el selector vuelve de 23:59 a 00:00.</Text>
        </View>
      ) : null}

      {open ? (
        <ChipScroller contentContainerStyle={styles.presets}>
          {PRESETS.map((preset) => <Chip key={preset} label={preset} compact selected={preset === value} onPress={() => commit(preset)} />)}
        </ChipScroller>
      ) : null}
      {hint && !error ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = themedStyles({
  wrap: { gap: spacing.sm },
  headerRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  toggleButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.xs },
  toggle: { ...typography.label, fontSize: 12.5, color: colors.accent },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm },
  inputRowError: { borderColor: colors.danger, borderWidth: 2 },
  input: { flex: 1, minWidth: 96, minHeight: 52, paddingHorizontal: spacing.sm, ...typography.h2, color: colors.text, letterSpacing: 0.5 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  error: { ...typography.caption, color: colors.danger },
  panel: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, alignItems: 'flex-start', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  column: { alignItems: 'center', gap: spacing.sm, minWidth: 84 },
  columnLabel: { ...typography.overline, fontSize: 10.5, color: colors.textMuted },
  columnValue: { width: '100%', alignItems: 'center', justifyContent: 'center', minHeight: 48, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  columnNumber: { ...typography.h2, fontSize: 19, color: colors.text },
  tip: { ...typography.caption, flexGrow: 1, flexBasis: 120, color: colors.textMuted, paddingTop: spacing.md },
  presets: { paddingTop: spacing.xs },
  hint: { ...typography.caption, color: colors.textMuted },
});
