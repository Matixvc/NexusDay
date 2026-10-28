import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { themedStyles, colors, radius, spacing, typography } from '../theme/theme';
import { useAppData } from '../context/AppDataContext';
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
import { TimeField } from '../components/ui/TimeField';
import { ConfirmSheet, OptionSheet, Sheet } from '../components/ui/Sheet';
import { Switch } from '../components/ui/Switch';
import { CLASS_REMINDERS, syncClassReminder } from '../services/reminders';
import { blankNote } from '../services/notes';
import { tap as tapHaptic, select as selectHaptic, success as successHaptic, warning as warningHaptic } from '../services/haptics';
import {
  WEEKDAYS,
  formatDateLong,
  formatDuration,
  formatTime,
  minutesBetween,
  todayKey,
  weekdayIndex,
} from '../utils/dates';

const BLANK = () => ({ title: '', start: '09:00', end: '10:00', location: '', color: colors.accent, leadMinutes: -1 });

function durationOf(activity) {
  return minutesBetween(activity.start, activity.end);
}

function minutesOf(value) {
  const [hour, minute] = value.split(':').map(Number);
  return (hour || 0) * 60 + (minute || 0);
}

export default function ScheduleScreen({ navigation }) {
  const { activities, addActivity, updateActivity, removeActivity, addNote, addEvent } = useAppData();

  const todayIndex = weekdayIndex(new Date());
  const [day, setDay] = useState(todayIndex);
  const [sheet, setSheet] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [notice, setNotice] = useState(null);
  // El "Centro de Asignatura": al tocar una materia se abre este sheet con las 4 acciones
  // directas en lugar del formulario de edición. Guarda solo el id y la actividad se deriva
  // siempre de `activities` abajo, para que el sheet refleje al instante un cambio (suspender,
  // cambiar el aviso) sin copias obsoletas.
  const [hubId, setHubId] = useState(null);
  const hub = hubId ? activities.find((a) => a.id === hubId) || null : null;
  const [leadSheetOpen, setLeadSheetOpen] = useState(false);

  const dayLabel = WEEKDAYS[day].long;
  const isToday = day === todayIndex;

  const dayActivities = useMemo(
    () =>
      activities
        .filter((item) => item.day === day)
        .slice()
        .sort((a, b) => a.start.localeCompare(b.start)),
    [activities, day],
  );

  const dayMinutes = dayActivities.reduce((total, item) => total + Math.max(0, durationOf(item)), 0);
  const weekMinutes = activities.reduce((total, item) => total + Math.max(0, durationOf(item)), 0);

  const upcoming = useMemo(() => {
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    return activities
      .filter((item) => item.day === todayIndex)
      .slice()
      .sort((a, b) => a.start.localeCompare(b.start))
      .find((item) => minutesOf(item.start) >= minutes);
  }, [activities, todayIndex]);

  const upcomingIn = useMemo(() => {
    if (!upcoming) return null;
    const now = new Date();
    const diff = minutesOf(upcoming.start) - (now.getHours() * 60 + now.getMinutes());
    if (diff <= 0) return null;
    if (diff < 60) return `en ${diff} min`;
    const hours = Math.floor(diff / 60);
    const rest = diff % 60;
    return rest ? `en ${hours} h ${rest} min` : `en ${hours} h`;
  }, [upcoming]);

  const openCreate = () => setSheet({ mode: 'create', values: { ...BLANK() } });

  const openEdit = (item) =>
    setSheet({
      mode: 'edit',
      id: item.id,
      values: {
        title: item.title,
        start: item.start,
        end: item.end,
        location: item.location || '',
        color: item.color || colors.accent,
        leadMinutes: item.leadMinutes ?? -1,
      },
    });

  const setValue = (patch) => setSheet((prev) => ({ ...prev, values: { ...prev.values, ...patch } }));

  const invalidTitle = !sheet?.values.title.trim();
  const invalidRange = sheet ? minutesBetween(sheet.values.start, sheet.values.end) <= 0 : false;
  const canSave = Boolean(sheet) && !invalidTitle && !invalidRange;

  const save = () => {
    const { mode, id, values } = sheet;
    const payload = {
      title: values.title.trim(),
      start: formatTime(values.start),
      end: formatTime(values.end),
      location: values.location.trim(),
      color: values.color,
      leadMinutes: values.leadMinutes ?? -1,
    };

    // El recordatorio de clase se reprograma junto con el dato (one-shot a la próxima
    // ocurrencia no suspendida); la actividad previa se cancela para no dejar huérfanas.
    if (mode === 'edit') {
      updateActivity(id, payload);
      syncClassReminder({ id, ...payload, suspended: activities.find((a) => a.id === id)?.suspended }, activities.find((a) => a.id === id)?.notificationId);
    } else {
      const created = addActivity({ day, ...payload, suspended: {}, notificationId: null });
      if (created?.leadMinutes && created.leadMinutes !== -1) {
        syncClassReminder(created, null).then(({ notificationId }) => {
          if (notificationId) updateActivity(created.id, { notificationId });
        });
      }
    }

    setSheet(null);
  };

  /** Fecha concreta (YYYY-MM-DD) de la sesión de `day` dentro de la semana en curso. */
  const sessionDateKey = (dayIndex) => {
    const base = new Date();
    const diff = (dayIndex - todayIndex + 7) % 7;
    base.setDate(base.getDate() + diff);
    return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;
  };

  /**
   * Suspende (o reactiva) la sesión de un día concreto. Marca `suspended[fecha]`, atenúa la
   * tarjeta en la grilla y reprograma el recordatorio, que saltará esa fecha. Háptica de
   * aviso para que la suspensión se sienta como una acción con peso.
   */
  const toggleSuspend = (item, dateKey) => {
    const suspended = { ...(item.suspended || {}) };
    if (suspended[dateKey]) delete suspended[dateKey];
    else suspended[dateKey] = true;
    updateActivity(item.id, { suspended });
    warningHaptic();
    syncClassReminder({ ...item, suspended }, item.notificationId).then(({ notificationId }) => {
      updateActivity(item.id, { notificationId });
    });
  };

  /** Cambia el aviso previo de la clase y reprograma su recordatorio one-shot. */
  const changeLead = (item, leadMinutes) => {
    updateActivity(item.id, { leadMinutes });
    selectHaptic();
    syncClassReminder({ ...item, leadMinutes }, item.notificationId).then(({ notificationId, notice: warn }) => {
      updateActivity(item.id, { notificationId });
      if (warn) setNotice(warn);
    });
  };

  /** a) Crear Nota de Clase: nota nueva etiquetada con el nombre de la asignatura. */
  const createClassNote = (item) => {
    const note = addNote({
      ...blankNote(item.color || colors.accent),
      title: `Nota de clase · ${item.title}`,
      tags: [item.title],
    });
    setHubId(null);
    successHaptic();
    navigation.navigate('Notas', { focusId: note.id });
  };

  /** b) Agendar Evaluación: evento en la Agenda vinculado al ramo. */
  const scheduleEvaluation = (item) => {
    const event = addEvent({
      title: `Evaluación: ${item.title}`,
      dateKey: sessionDateKey(item.day),
      time: item.start,
      notes: `Evaluación de ${item.title}.`,
      color: item.color || colors.accent,
      leadMinutes: 1440,
      category: 'Examen',
      notificationId: null,
    });
    setHubId(null);
    successHaptic();
    navigation.navigate('Agenda', { focusId: event.id });
  };

  return (
    <>
      <Screen
        title="Horario"
        subtitle={formatDateLong(todayKey())}
        headerRight={<Pill label={`${activities.length} actividades`} />}
      >
        <View style={styles.statsRow}>
          <Stat value={dayActivities.length} label={dayLabel} />
          <Stat value={formatDuration(dayMinutes)} label="En el día" accent={colors.accent} />
          <Stat value={formatDuration(weekMinutes)} label="En la semana" />
        </View>

        <ChipScroller>
          {WEEKDAYS.map((option, index) => (
            <Chip
              key={option.long}
              label={index === todayIndex ? `Hoy · ${option.short}` : option.short}
              selected={index === day}
              onPress={() => setDay(index)}
            />
          ))}
        </ChipScroller>

        {isToday && upcoming && upcomingIn ? (
          <Card accent={upcoming.color}>
            <Text style={typography.overline}>Siguiente</Text>
            <Text style={[typography.title, styles.upcomingTitle]} numberOfLines={1}>
              {upcoming.title}
            </Text>
            <Text style={typography.small}>
              {`${formatTime(upcoming.start)} · ${upcomingIn}`}
              {upcoming.location ? ` · ${upcoming.location}` : ''}
            </Text>
          </Card>
        ) : null}

        <SectionTitle title={dayLabel} count={dayActivities.length} />

        {notice ? (
          <View style={styles.noticeRow}>
            <Notice text={notice} tone="danger" />
            <TextButton label="OK" tone="ghost" onPress={() => setNotice(null)} />
          </View>
        ) : null}

        {dayActivities.length === 0 ? (
          <EmptyState
            emoji="🗓️"
            title={`Nada el ${dayLabel.toLowerCase()}`}
            hint="Agrega una materia, un turno o un entrenamiento y se repite todas las semanas en este día."
          />
        ) : (
          dayActivities.map((item) => {
            const sessionKey = sessionDateKey(item.day);
            const isSuspended = Boolean(item.suspended?.[sessionKey]);
            return (
              <Card
                key={item.id}
                accent={item.color}
                onPress={() => {
                  tapHaptic();
                  setHubId(item.id);
                }}
                dimmed={isSuspended}
                style={styles.activityCard}
              >
                <View style={styles.activityRow}>
                  <View style={styles.timeColumn}>
                    <Text style={[styles.timeValue, typography.tabular]}>{formatTime(item.start)}</Text>
                    <Text style={[styles.timeValue, typography.tabular, styles.timeMuted]}>
                      {formatTime(item.end)}
                    </Text>
                  </View>
                  <View style={styles.activityBody}>
                    <Text style={typography.bodyStrong} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Text style={[typography.small, styles.meta]} numberOfLines={1}>
                      {formatDuration(Math.max(0, durationOf(item)))}
                      {item.location ? ` · ${item.location}` : ''}
                    </Text>
                    {isSuspended ? (
                      <View style={styles.suspendedRow}>
                        <Pill label="Suspendida hoy" tone="warning" />
                        <TextButton
                          label="Reactivar"
                          tone="ghost"
                          onPress={() => toggleSuspend(item, sessionKey)}
                        />
                      </View>
                    ) : null}
                  </View>
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
        title={sheet?.mode === 'edit' ? 'Editar actividad' : 'Nueva actividad'}
        subtitle={
          sheet?.mode === 'edit'
            ? 'Se repite todos los días seleccionados.'
            : `Se repite todos los ${WEEKDAYS[day].long.toLowerCase()}.`
        }
        footer={
          <>
            {sheet?.mode === 'edit' ? (
              <TextButton
                label="Eliminar"
                tone="danger"
                onPress={() => {
                  setConfirmId(sheet.id);
                  setSheet(null);
                }}
              />
            ) : null}
            <PrimaryButton label="Guardar" onPress={save} disabled={!canSave} />
          </>
        }
      >
        {sheet ? (
          <>
            <TextField
              label="Nombre"
              value={sheet.values.title}
              onChangeText={(text) => setValue({ title: text })}
              placeholder="Ej. Cálculo I"
              autoFocus
              maxLength={60}
            />
            <TimeField label="Comienza" value={sheet.values.start} onChange={(start) => setValue({ start })} />
            <TimeField
              label="Termina"
              value={sheet.values.end}
              onChange={(end) => setValue({ end })}
              hint={
                invalidRange
                  ? 'El fin debe ser posterior al inicio.'
                  : `Duración: ${formatDuration(Math.max(0, minutesBetween(sheet.values.start, sheet.values.end)))}`
              }
            />
            <TextField
              label="Lugar (opcional)"
              value={sheet.values.location}
              onChangeText={(text) => setValue({ location: text })}
              placeholder="Ej. Aula B-204"
              maxLength={40}
            />
            <ColorPicker value={sheet.values.color} onChange={(color) => setValue({ color })} />
          </>
        ) : null}
      </Sheet>

      {/* Centro de Asignatura: 4 acciones directas al tocar una materia en la grilla. */}
      <Sheet
        visible={Boolean(hub)}
        onClose={() => setHubId(null)}
        title={hub?.title}
        subtitle={
          hub
            ? `${WEEKDAYS[hub.day]?.long ?? ''} · ${formatTime(hub.start)}–${formatTime(hub.end)}${
                hub.location ? ` · ${hub.location}` : ''
              }`
            : undefined
        }
      >
        {hub ? (
          <View style={styles.hubList}>
            <HubAction
              glyph="📝"
              label="Crear Nota de Clase"
              hint="Abre una nota ya etiquetada con esta asignatura."
              onPress={() => createClassNote(hub)}
            />
            <HubAction
              glyph="📌"
              label="Agendar Evaluación / Fecha importante"
              hint="Crea un evento en la Agenda vinculado a este ramo."
              onPress={() => scheduleEvaluation(hub)}
            />

            <View style={styles.hubSwitchRow}>
              <View style={styles.hubSwitchBody}>
                <Text style={typography.bodyStrong}>Suspender clase de hoy</Text>
                <Text style={typography.caption}>
                  {hub.suspended?.[sessionDateKey(hub.day)]
                    ? 'Hoy no hay clase y se canceló su aviso.'
                    : 'Marca la sesión de hoy como suspendida.'}
                </Text>
              </View>
              <Switch
                value={Boolean(hub.suspended?.[sessionDateKey(hub.day)])}
                onValueChange={() => toggleSuspend(hub, sessionDateKey(hub.day))}
                label="Suspender clase de hoy"
                hideLabel
              />
            </View>

            <Pressable
              onPress={() => {
                setLeadSheetOpen(true);
              }}
              style={({ pressed }) => [styles.hubAction, pressed ? styles.pressed : null]}
            >
              <Text style={styles.hubGlyph}>🔔</Text>
              <View style={styles.hubBody}>
                <Text style={typography.bodyStrong}>Notificación de clase</Text>
                <Text style={typography.caption}>
                  {CLASS_REMINDERS.find((option) => option.value === (hub.leadMinutes ?? -1))?.label ?? 'Desactivado'}
                </Text>
              </View>
            </Pressable>

            <HubAction
              glyph="✏️"
              label="Editar datos de la asignatura"
              hint="Cambiar nombre, hora, lugar o color."
              tone="ghost"
              onPress={() => {
                const target = hub;
                setHubId(null);
                openEdit(target);
              }}
            />
          </View>
        ) : null}
      </Sheet>

      <OptionSheet
        visible={leadSheetOpen}
        onClose={() => setLeadSheetOpen(false)}
        title="Aviso de la clase"
        options={CLASS_REMINDERS}
        value={hub?.leadMinutes ?? -1}
        onSelect={(leadMinutes) => {
          if (hub) changeLead(hub, leadMinutes);
        }}
      />

      <ConfirmSheet
        visible={Boolean(confirmId)}
        onClose={() => setConfirmId(null)}
        onConfirm={() => confirmId && removeActivity(confirmId)}
        title="¿Eliminar actividad?"
        message="Desaparece del horario semanal. Esta acción no se puede deshacer."
      />
    </>
  );
}

/**
 * Una acción del Centro de Asignatura: una fila con icono, título y una línea de ayuda.
 * `tone="ghost"` la dibuja como acción secundaria (la de "Editar datos").
 */
function HubAction({ glyph, label, hint, onPress, tone }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.hubAction, tone === 'ghost' ? styles.hubActionGhost : null, pressed ? styles.pressed : null]}
    >
      <Text style={styles.hubGlyph}>{glyph}</Text>
      <View style={styles.hubBody}>
        <Text style={typography.bodyStrong}>{label}</Text>
        {hint ? <Text style={typography.caption}>{hint}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = themedStyles({
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  noticeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  upcomingTitle: { marginTop: 2 },
  activityCard: { paddingVertical: spacing.md },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  timeColumn: { width: 52, gap: 2 },
  timeValue: { fontSize: 14.5, fontWeight: '700', color: colors.text },
  timeMuted: { fontSize: 12.5, fontWeight: '500', color: colors.textMuted },
  activityBody: { flex: 1, gap: 3 },
  meta: { fontSize: 12.5 },
  suspendedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },

  // Centro de Asignatura.
  hubList: { gap: spacing.sm },
  hubAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  hubActionGhost: { backgroundColor: 'transparent', borderStyle: 'dashed' },
  hubGlyph: { fontSize: 20, width: 26, textAlign: 'center' },
  hubBody: { flex: 1, gap: 2 },
  hubSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  hubSwitchBody: { flex: 1, gap: 2 },
  pressed: { opacity: 0.68 },
});
