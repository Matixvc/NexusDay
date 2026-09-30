import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { themedStyles, colors, radius, spacing, typography } from '../theme/theme';
import { useAppData } from '../context/AppDataContext';
import { useFocusId } from '../hooks/useFocusId';
import {
  Card,
  Chip,
  ChipScroller,
  EmptyState,
  Fab,
  Notice,
  Pill,
  PrimaryButton,
  Screen,
  SectionTitle,
  Stat,
  TextButton,
} from '../components/ui/primitives';
import { ColorPicker, TextField } from '../components/ui/inputs';
import { ConfirmSheet, OptionSheet, Sheet } from '../components/ui/Sheet';
import { HABIT_REMINDERS, dropReminder, syncHabitReminder } from '../services/reminders';
import { habitStreak, lastDays, pendingHabits } from '../services/dashboard';
import { WEEKDAYS, fromDateKey, todayKey, weekdayIndex } from '../utils/dates';

const EMOJIS = ['💧', '📚', '🏃', '🧘', '🥗', '😴', '✍️', '🎯'];
const BLANK = { name: '', emoji: '💧', color: colors.accent };

export default function HabitsScreen() {
  const { habits, addHabit, updateHabit, removeHabit } = useAppData();
  const [sheet, setSheet] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [reminderId, setReminderId] = useState(null);
  const [notice, setNotice] = useState(null);
  // Highlighted by the global search for a few seconds.
  const focusId = useFocusId();

  const today = todayKey();
  const week = useMemo(() => lastDays(7, today), [today]);
  const pending = pendingHabits(habits, today);
  const bestStreak = habits.reduce((max, habit) => Math.max(max, habitStreak(habit, today)), 0);

  const openCreate = () => setSheet({ mode: 'create', values: { ...BLANK } });

  const openEdit = (habit) =>
    setSheet({
      mode: 'edit',
      id: habit.id,
      values: { name: habit.name || '', emoji: habit.emoji || '💧', color: habit.color || colors.accent },
    });

  const setValue = (patch) => setSheet((prev) => ({ ...prev, values: { ...prev.values, ...patch } }));

  /** Ticking any day can be undone with another tap, so no confirmation is needed. */
  const toggleDay = (habit, dateKey) => {
    const marks = Array.isArray(habit.marks) ? habit.marks : [];
    const isMarking = !marks.includes(dateKey);
    const next = isMarking ? [...marks, dateKey] : marks.filter((item) => item !== dateKey);
    const patch = { marks: next.sort() };

    // Ticking today retires the daily nudge: there is nothing left to remind about.
    if (isMarking && dateKey === today) {
      patch.notificationId = null;
      dropReminder(habit);
    }

    updateHabit(habit.id, patch);
  };

  /** Arms (or clears) the daily reminder, whose notification carries the app actions. */
  const chooseReminder = async (value) => {
    const habit = habits.find((item) => item.id === reminderId);
    if (!habit) return;
    const result = await syncHabitReminder({ ...habit, remindAt: value }, habit.notificationId);
    updateHabit(habit.id, { remindAt: value, notificationId: result.notificationId });
    setNotice(result.notice);
  };

  const canSave = Boolean(sheet) && Boolean(sheet.values.name.trim());

  const save = () => {
    if (!canSave) return;
    const { mode, id, values } = sheet;
    const payload = { name: values.name.trim(), emoji: values.emoji, color: values.color };
    if (mode === 'edit') updateHabit(id, payload);
    else addHabit({ ...payload, marks: [] });
    setSheet(null);
  };

  return (
    <>
      <Screen
        title="Hábitos"
        subtitle="Marcá cada día y mirá cómo crece la racha."
        headerRight={<Pill label={`${habits.length} hábitos`} />}
      >
        <View style={styles.statsRow}>
          <Stat value={habits.length} label="En total" />
          <Stat value={habits.length - pending.length} label="Hechos hoy" accent={colors.accent} />
          <Stat value={bestStreak} label="Mejor racha" />
        </View>

        {notice ? <Notice text={notice} tone="danger" /> : null}

        <SectionTitle
          title="Pendientes de hoy"
          count={pending.length}
          right={<TextButton label="+ Nuevo" onPress={openCreate} />}
        />

        {habits.length === 0 ? (
          <EmptyState
            emoji="🌱"
            title="Todavía no hay hábitos"
            hint="Sumá uno (agua, lectura, ejercicio) y marcalo cada día desde acá."
          />
        ) : (
          habits.map((habit) => {
            const marks = Array.isArray(habit.marks) ? habit.marks : [];
            const doneToday = marks.includes(today);
            return (
              <Card
                key={habit.id}
                accent={habit.color}
                style={[styles.habitCard, focusId === habit.id ? styles.focused : null]}
              >
                <View style={styles.habitRow}>
                  <View style={[styles.badge, { borderColor: habit.color, backgroundColor: `${habit.color}22` }]}>
                    <Text style={styles.badgeEmoji}>{habit.emoji || '✅'}</Text>
                  </View>
                  <View style={styles.habitBody}>
                    <Text style={typography.bodyStrong} numberOfLines={1}>
                      {habit.name}
                    </Text>
                    <Text style={typography.caption}>
                      {`Racha: ${habitStreak(habit, today)} día(s) · Semana: ${week.filter((key) => marks.includes(key)).length}/7`}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => toggleDay(habit, today)}
                    accessibilityRole="button"
                    accessibilityLabel={doneToday ? `Desmarcar ${habit.name}` : `Marcar ${habit.name}`}
                    style={({ pressed }) => [
                      styles.toggle,
                      doneToday ? { backgroundColor: habit.color } : null,
                      pressed ? styles.pressed : null,
                    ]}
                  >
                    <Text style={[styles.toggleGlyph, doneToday ? styles.toggleGlyphDone : null]}>
                      {doneToday ? '✓' : '+'}
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.weekRow}>
                  {week.map((key) => {
                    const marked = marks.includes(key);
                    return (
                      <Pressable
                        key={key}
                        onPress={() => toggleDay(habit, key)}
                        style={styles.weekCell}
                        accessibilityRole="button"
                        accessibilityLabel={`${habit.name} ${key}`}
                      >
                        <Text style={styles.weekLabel}>
                          {WEEKDAYS[weekdayIndex(fromDateKey(key))].short.slice(0, 1)}
                        </Text>
                        <View
                          style={[
                            styles.weekDot,
                            marked ? { backgroundColor: habit.color, borderColor: habit.color } : null,
                          ]}
                        />
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.reminderRow}>
                  <Text style={typography.caption} numberOfLines={1}>
                    {habit.remindAt ? `⏰ Aviso diario a las ${habit.remindAt}` : '⏰ Sin aviso diario'}
                  </Text>
                  <TextButton
                    label={habit.remindAt ? 'Cambiar' : 'Activar'}
                    tone="ghost"
                    onPress={() => setReminderId(habit.id)}
                  />
                </View>

                <View style={styles.habitActions}>
                  <TextButton label="Editar" tone="ghost" onPress={() => openEdit(habit)} />
                  <TextButton label="Borrar" tone="danger" onPress={() => setConfirmId(habit.id)} />
                </View>
              </Card>
            );
          })
        )}
      </Screen>

      <Fab onPress={openCreate} />

      <Sheet
        visible={Boolean(sheet)}
        onClose={() => setSheet(null)}
        title={sheet?.mode === 'edit' ? 'Editar hábito' : 'Nuevo hábito'}
        subtitle="Se guarda en el dispositivo y se repite todos los días."
        footer={<PrimaryButton label="Guardar" onPress={save} disabled={!canSave} />}
      >
        {sheet ? (
          <>
            <TextField
              label="Nombre"
              value={sheet.values.name}
              onChangeText={(name) => setValue({ name })}
              placeholder="Ej. Caminar 30 minutos"
              autoFocus
              maxLength={40}
            />
            <ChipScroller>
              {EMOJIS.map((emoji) => (
                <Chip
                  key={emoji}
                  label={emoji}
                  selected={sheet.values.emoji === emoji}
                  onPress={() => setValue({ emoji })}
                />
              ))}
            </ChipScroller>
            <ColorPicker value={sheet.values.color} onChange={(color) => setValue({ color })} />
          </>
        ) : null}
      </Sheet>

      <ConfirmSheet
        visible={Boolean(confirmId)}
        onClose={() => setConfirmId(null)}
        onConfirm={() => confirmId && removeHabit(confirmId)}
        title="¿Borrar hábito?"
        message="Se pierde el historial de marcas de este hábito."
      />

      <OptionSheet
        visible={Boolean(reminderId)}
        onClose={() => setReminderId(null)}
        title="Aviso diario"
        options={HABIT_REMINDERS}
        value={habits.find((item) => item.id === reminderId)?.remindAt ?? null}
        onSelect={chooseReminder}
      />

    </>
  );
}

const styles = themedStyles({
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  habitCard: { gap: spacing.md },
  habitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  badge: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeEmoji: { fontSize: 20 },
  habitBody: { flex: 1, gap: 2 },
  toggle: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surfacePlus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleGlyph: { fontSize: 20, fontWeight: '800', color: colors.textSecondary },
  toggleGlyphDone: { color: colors.accentInk },
  pressed: { opacity: 0.65 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  weekCell: { alignItems: 'center', gap: 4 },
  weekLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted },
  weekDot: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  habitActions: { flexDirection: 'row', justifyContent: 'flex-end', marginRight: -spacing.md },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: spacing.md,
  },
  // Used by the global search to point at the matched item.
  focused: { borderColor: colors.accent, borderWidth: 1.5 },
});
