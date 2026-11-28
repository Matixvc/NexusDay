import { memo, useEffect, useState } from 'react';
import { Animated, Image, Pressable, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { Pill, SectionTitle, TextButton } from '../../components/ui/primitives';
import { dailyCommitmentSummary, formatTimeUntil } from '../../services/dashboard';
import { themedStyles, colors, radius, spacing, typography } from '../../theme/theme';
import { formatDateShort, formatTime, relativeDayLabel } from '../../utils/dates';

function timeRange(item) {
  if (!item?.startTime) return 'Sin hora';
  return item.endTime ? `${formatTime(item.startTime)}–${formatTime(item.endTime)}` : formatTime(item.startTime);
}

function ActivityIdentity({ item, compact = false }) {
  return (
    <View style={[styles.activityIdentity, compact ? styles.activityIdentityCompact : null]}>
      <View style={[styles.activityIcon, { backgroundColor: item.color || colors.accentSoft }]}>
        <Icon name={item.kind === 'event' ? 'calendar' : item.kind === 'routine' ? 'checkCircle' : 'clock'} size={16} color={colors.text} />
      </View>
      <View style={styles.activityCopy}>
        <Text style={compact ? typography.bodyStrong : typography.title}>{item.title}</Text>
        <Text style={typography.caption}>{item.typeLabel} · {timeRange(item)}{item.detail ? ` · ${item.detail}` : ''}</Text>
      </View>
    </View>
  );
}

export const CurrentActivitySection = memo(function CurrentActivitySection({ current, concurrent = [], dayState, weekdayLabel, todayCommitments, artwork, onOpenSchedule }) {
  const emptyCopy = {
    unconfigured: ['Tu día empieza aquí', 'Configura tu horario o una rutina para construir tu primera agenda.'],
    free: ['Hoy tienes espacio', 'No hay actividades programadas para este día.'],
    suspended: ['Horario en pausa', 'Las actividades de hoy están suspendidas; tu horario semanal se conserva.'],
    finished: ['Agenda completada', 'Las actividades con hora de hoy ya terminaron.'],
    active: ['Entre actividades', 'Revisa lo que viene después o avanza una rutina.'],
  }[dayState] || ['Tu día', 'Revisa tu agenda.'];

  return (
    <View style={styles.nowSection}>
      <View style={styles.nowHeader}>
        <View>
          <Text style={[typography.overline, styles.sectionKicker]}>AHORA</Text>
          <Text style={typography.h2} accessibilityRole="header">Mi día</Text>
          <Text style={typography.caption}>{dailyCommitmentSummary(weekdayLabel, todayCommitments)}</Text>
        </View>
        <TextButton label="Ver horario" tone="ghost" onPress={onOpenSchedule} />
      </View>
      <View style={[styles.nowSurface, current ? styles.nowSurfaceActive : null]}>
        {artwork ? <Image source={artwork} style={styles.nowArtwork} resizeMode="cover" accessible={false} importantForAccessibility="no" /> : null}
        <View style={styles.nowContent}>
          {current ? (
            <>
              <Pill label="En curso" tone="accent" style={styles.nowPill} />
              <ActivityIdentity item={current} />
              <Text style={[typography.bodyStrong, styles.countdown]}>{formatTimeUntil(current.minutesRemaining)?.replace(/^En /, 'Termina en ') || 'Finaliza ahora'}</Text>
            </>
          ) : (
            <View style={styles.emptyNow}>
              <Icon name={dayState === 'finished' ? 'checkCircle' : 'calendar'} size={24} color={colors.accent} />
              <View style={styles.activityCopy}>
                <Text style={typography.title}>{emptyCopy[0]}</Text>
                <Text style={typography.small}>{emptyCopy[1]}</Text>
              </View>
            </View>
          )}
        </View>
      </View>
      {concurrent.length ? (
        <View style={styles.concurrentGroup}>
          <Text style={typography.caption}>También en curso</Text>
          {concurrent.map((item) => (
            <View key={item.id} style={styles.concurrentRow}>
              <ActivityIdentity item={item} compact />
              <Pill label="En curso" tone="accent" />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
});

export const TimedAgendaSection = memo(function TimedAgendaSection({ items = [], today, onOpenItem, timeColumnWidth = 66 }) {
  return (
    <View style={styles.section}>
      <SectionTitle title="Después" count={items.length} variant="editorial" />
      {items.length ? (
        <View style={styles.timeline}>
          {items.slice(0, 6).map((item, index) => (
            <Pressable
              key={item.id}
              onPress={() => onOpenItem(item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.typeLabel} ${item.title}, ${item.dateKey === today ? timeRange(item) : `${relativeDayLabel(item.dateKey)}, ${formatDateShort(item.dateKey)}, ${timeRange(item)}`}`}
              accessibilityHint={item.kind === 'event' ? 'Abre este evento en su fecha.' : 'Abre el horario semanal.'}
              style={({ pressed }) => [styles.timelineRow, index ? styles.timelineDivider : null, pressed ? styles.pressed : null]}
            >
              <View style={[styles.timelineTime, { width: timeColumnWidth }]}>
                <Text style={[typography.tabular, styles.timelineTimeText]}>{item.dateKey === today ? formatTime(item.startTime) : formatDateShort(item.dateKey)}</Text>
                <Text style={typography.caption}>{item.dateKey === today ? item.endTime ? formatTime(item.endTime) : item.typeLabel : formatTime(item.startTime)}</Text>
              </View>
              <View style={[styles.timelineMarker, { backgroundColor: item.color || colors.accent }]} />
              <ActivityIdentity item={item} compact />
              {item.minutesUntil != null ? <Pill label={formatTimeUntil(item.minutesUntil) || 'Ahora'} tone="neutral" /> : null}
              <Icon name="chevronRight" size={18} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.lightEmpty}>
          <Icon name="clock" size={20} color={colors.accent} />
          <Text style={typography.small}>No quedan actividades con hora. Tu agenda sigue disponible abajo.</Text>
        </View>
      )}
    </View>
  );
});

function RoutineActionRow({ item, pending, reduceMotion, onToggle }) {
  const [accentOpacity] = useState(() => new Animated.Value(item.completed ? 1 : 0));
  useEffect(() => {
    const target = item.completed ? 1 : 0;
    if (reduceMotion) {
      accentOpacity.setValue(target);
      return;
    }
    Animated.timing(accentOpacity, { toValue: target, duration: 150, useNativeDriver: true }).start();
  }, [accentOpacity, item.completed, reduceMotion]);

  const action = item.completed ? 'Deshacer' : 'Completar';
  return (
    <View style={styles.anytimeRow}>
      <Animated.View pointerEvents="none" style={[styles.completionAccent, { opacity: accentOpacity }]} />
      <ActivityIdentity item={item} compact />
      <Pressable
        onPress={() => onToggle(item)}
        disabled={pending}
        accessibilityRole="checkbox"
        accessibilityLabel={`${action} rutina ${item.title}`}
        accessibilityHint="Guarda el cambio en este dispositivo."
        accessibilityState={{ checked: Boolean(item.completed), busy: Boolean(pending), disabled: Boolean(pending) }}
        hitSlop={4}
        style={({ pressed }) => [styles.routineAction, item.completed ? styles.routineActionDone : null, pressed && !pending ? styles.pressed : null]}
      >
        <Icon name={item.completed ? 'check' : 'checkCircle'} size={19} color={item.completed ? colors.accentInk : colors.accent} />
        <Text style={[typography.label, item.completed ? styles.routineActionDoneText : styles.routineActionText]}>{pending ? 'Guardando…' : item.completed ? 'Completada · Deshacer' : 'Completar'}</Text>
      </Pressable>
    </View>
  );
}

export const AnytimeSection = memo(function AnytimeSection({ items = [], pendingIds, reduceMotion, onToggleRoutine, onOpenSchedule, onManageRoutines }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <SectionTitle title="En cualquier momento" count={items.length} variant="editorial" />
        <TextButton label="Gestionar rutinas" tone="ghost" onPress={onManageRoutines} />
      </View>
      {items.length ? (
        <View style={styles.anytimeList}>
          {items.map((item) => item.kind === 'routine' ? (
            <RoutineActionRow
              key={item.id}
              item={item}
              pending={pendingIds.has(item.sourceId)}
              reduceMotion={reduceMotion}
              onToggle={onToggleRoutine}
            />
          ) : (
            <Pressable key={item.id} onPress={onOpenSchedule} accessibilityRole="button" accessibilityLabel={`${item.typeLabel} ${item.title}, sin hora`} style={({ pressed }) => [styles.anytimeRow, pressed ? styles.pressed : null]}>
              <ActivityIdentity item={item} compact />
              <Pill label="Sin hora" tone="neutral" />
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.lightEmpty}>
          <Icon name="checkCircle" size={20} color={colors.accent} />
          <Text style={typography.small}>No hay rutinas ni actividades sin hora para hoy.</Text>
        </View>
      )}
    </View>
  );
});

const styles = themedStyles({
  section: { gap: spacing.md },
  sectionKicker: { color: colors.accent, letterSpacing: 1.1 },
  nowSection: { gap: spacing.md },
  nowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  nowSurface: { minHeight: 132, borderRadius: radius.xl, backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  nowSurfaceActive: { borderColor: colors.accent },
  nowArtwork: { width: '100%', height: 72, backgroundColor: colors.surfaceAlt },
  nowContent: { padding: spacing.lg, gap: spacing.sm },
  nowPill: { alignSelf: 'flex-start' },
  countdown: { color: colors.accent },
  emptyNow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  activityIdentity: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  activityIdentityCompact: { gap: spacing.sm },
  activityIcon: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  activityCopy: { flex: 1, minWidth: 0, gap: 2 },
  sectionHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  concurrentGroup: { padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt, gap: spacing.sm },
  concurrentRow: { minHeight: 52, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  timeline: { borderRadius: radius.lg, backgroundColor: colors.elevated, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  timelineRow: { minHeight: 68, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  timelineDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  timelineTime: { width: 66, flexShrink: 0, gap: 1 },
  timelineTimeText: { color: colors.accent },
  timelineMarker: { width: 3, height: 36, borderRadius: radius.pill },
  lightEmpty: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt },
  anytimeList: { borderRadius: radius.lg, backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  anytimeRow: { minHeight: 68, position: 'relative', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  completionAccent: { position: 'absolute', left: 0, top: spacing.sm, bottom: spacing.sm, width: 3, borderRadius: radius.pill, backgroundColor: colors.accent },
  routineAction: { minWidth: 116, minHeight: 48, borderRadius: radius.pill, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.accentSoft },
  routineActionDone: { backgroundColor: colors.accent, borderColor: colors.accent },
  routineActionText: { color: colors.accent },
  routineActionDoneText: { color: colors.accentInk },
  pressed: { opacity: 0.7 },
});
