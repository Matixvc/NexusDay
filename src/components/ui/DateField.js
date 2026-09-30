import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { themedStyles, colors, radius, spacing, typography } from '../../theme/theme';
import {
  MONTHS,
  addDaysToKey,
  fromDateKey,
  pad2,
  relativeDayLabel,
  todayKey,
} from '../../utils/dates';
import { Chip, ChipScroller } from './primitives';

const HEADERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const CELL = 40;

function monthMatrix(year, month) {
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/**
 * Inline month calendar (Monday-first) used inside sheets.
 * Also avoids `@react-native-community/datetimepicker` so everything keeps
 * running in Expo Go — a plain month grid is enough for these forms.
 */
export function DateField({ label = 'Fecha', value, onChange, quick = true }) {
  const [anchor, setAnchor] = useState(() => {
    const d = fromDateKey(value || todayKey());
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [open, setOpen] = useState(false);

  // Re-center the grid when the field is opened with a different date (e.g. a
  // new sheet). React's "adjust state during render" pattern: cheaper and less
  // error-prone than an effect that syncs props into state.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    if (value) {
      const d = fromDateKey(value);
      setAnchor({ year: d.getFullYear(), month: d.getMonth() });
    }
  }

  const cells = useMemo(() => monthMatrix(anchor.year, anchor.month), [anchor]);
  const today = todayKey();

  const shiftMonth = (delta) => {
    setAnchor(({ year, month }) => {
      const next = month + delta;
      if (next < 0) return { year: year - 1, month: 11 };
      if (next > 11) return { year: year + 1, month: 0 };
      return { year, month: next };
    });
  };

  const pick = (key) => {
    onChange(key);
    setOpen(false);
  };

  const rows = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  const selectedDate = fromDateKey(value || today);

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={typography.overline}>{label}</Text>
        <Text style={[styles.toggle, typography.tabular]} onPress={() => setOpen((prev) => !prev)}>
          {open ? 'Ocultar' : 'Cambiar'}
        </Text>
      </View>

      <Pressable style={({ pressed }) => [styles.display, pressed ? styles.pressed : null]} onPress={() => setOpen(true)}>
        <View style={styles.dayBadge}>
          <Text style={[styles.badgeDay, typography.tabular]}>{selectedDate.getDate()}</Text>
          <Text style={styles.badgeMonth}>{MONTHS[selectedDate.getMonth()].slice(0, 3)}</Text>
        </View>
        <Text style={styles.displayText}>{relativeDayLabel(value || today)}</Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      {quick ? (
        <ChipScroller contentContainerStyle={styles.quickRow}>
          <Chip label="Hoy" compact selected={value === today} onPress={() => pick(today)} />
          <Chip
            label="Mañana"
            compact
            selected={value === addDaysToKey(today, 1)}
            onPress={() => pick(addDaysToKey(today, 1))}
          />
          <Chip
            label="En una semana"
            compact
            selected={value === addDaysToKey(today, 7)}
            onPress={() => pick(addDaysToKey(today, 7))}
          />
        </ChipScroller>
      ) : null}

      {open ? (
        <View style={styles.calendar}>
          <View style={styles.monthRow}>
            <Pressable
              onPress={() => shiftMonth(-1)}
              hitSlop={8}
              style={({ pressed }) => [styles.nav, pressed ? styles.pressed : null]}
            >
              <Text style={styles.navLabel}>‹</Text>
            </Pressable>
            <Text style={[typography.bodyStrong, styles.monthLabel]}>
              {`${MONTHS[anchor.month]} ${anchor.year}`}
            </Text>
            <Pressable
              onPress={() => shiftMonth(1)}
              hitSlop={8}
              style={({ pressed }) => [styles.nav, pressed ? styles.pressed : null]}
            >
              <Text style={styles.navLabel}>›</Text>
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {HEADERS.map((header, index) => (
              <Text key={`${header}-${index}`} style={styles.weekHeader}>
                {header}
              </Text>
            ))}
          </View>

          {rows.map((row, rowIndex) => (
            <View key={`row-${rowIndex}`} style={styles.weekRow}>
              {row.map((day, colIndex) => {
                if (day == null) return <View key={`empty-${colIndex}`} style={styles.cell} />;
                const key = `${anchor.year}-${pad2(anchor.month + 1)}-${pad2(day)}`;
                const selected = key === value;
                const isToday = key === today;
                return (
                  <Pressable
                    key={key}
                    onPress={() => pick(key)}
                    style={({ pressed }) => [
                      styles.cell,
                      selected ? styles.cellSelected : null,
                      isToday && !selected ? styles.cellToday : null,
                      pressed ? styles.pressed : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.cellText,
                        typography.tabular,
                        selected ? styles.cellTextSelected : null,
                        isToday && !selected ? styles.cellTextToday : null,
                      ]}
                    >
                      {day}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = themedStyles({
  wrap: { gap: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggle: { fontSize: 12.5, fontWeight: '700', color: colors.accent, paddingVertical: 2 },
  display: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  dayBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDay: { fontSize: 17, fontWeight: '800', color: colors.accent, lineHeight: 20 },
  badgeMonth: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.8, color: colors.accent, textTransform: 'uppercase' },
  displayText: { ...typography.body, flex: 1 },
  chevron: { color: colors.textMuted, fontSize: 14 },
  quickRow: { paddingTop: spacing.xs },
  calendar: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: spacing.sm },
  monthLabel: { fontSize: 14.5, textTransform: 'capitalize' },
  nav: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  navLabel: { color: colors.accent, fontSize: 24, lineHeight: 26, fontWeight: '600' },
  weekRow: { flexDirection: 'row' },
  weekHeader: {
    width: CELL,
    textAlign: 'center',
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.textMuted,
    paddingBottom: spacing.xs,
  },
  cell: {
    width: CELL,
    height: CELL,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  cellSelected: { backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent },
  cellToday: { borderWidth: 1, borderColor: colors.borderStrong },
  cellText: { fontSize: 14, fontWeight: '500', color: colors.text },
  cellTextSelected: { color: colors.accent, fontWeight: '800' },
  cellTextToday: { color: colors.accent, fontWeight: '700' },
  pressed: { opacity: 0.65 },
});

