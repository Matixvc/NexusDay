import { useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { themedStyles, colors, radius, spacing, typography } from '../theme/theme';
import { useAppData } from '../context/AppDataContext';
import { navigateToRoute } from '../navigation/navigateToRoute';
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
import { TimeField } from '../components/ui/TimeField';
import { ConfirmSheet, Sheet } from '../components/ui/Sheet';
import { Switch } from '../components/ui/Switch';
import { syncClassReminder } from '../services/reminders';
import { ALARM_LEAD_PRESETS, cancelAlarm, getExactAlarmPermission, normalizeAlarmLead } from '../services/notifications';
import { timeInputError, timeRangeError } from '../services/timeInput';
import { blankNote } from '../services/notes';
import { tap as tapHaptic, success as successHaptic, warning as warningHaptic } from '../services/haptics';
import {
  WEEKDAYS,
  formatDateLong,
  formatDuration,
  formatTime,
  minutesBetween,
  todayKey,
  weekdayIndex,
} from '../utils/dates';
import { Icon } from '../components/Icon';
import { HeaderIconButton } from '../components/ui/HeaderIconButton';

const BLANK = () => ({
  title: '', start: '09:00', end: '10:00', location: '', color: colors.mint,
  alarmEnabled: false, leadMinutes: -1, customLead: '',
});

const ALARM_LABELS = new Map([[15, '15 min'], [30, '30 min'], [60, '1 h'], [120, '2 h']]);

function alarmLeadLabel(value) {
  if (value == null || value === -1) return 'Desactivada';
  return ALARM_LABELS.get(value) || `${value} min antes`;
}

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
  const [permissionSheetOpen, setPermissionSheetOpen] = useState(false);
  const [exactAlarmPermission, setExactAlarmPermission] = useState({ status: 'checking', granted: false });
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  // El "Centro de Asignatura": al tocar una materia se abre este sheet con las 4 acciones
  // directas en lugar del formulario de edición. Guarda solo el id y la actividad se deriva
  // siempre de `activities` abajo, para que el sheet refleje al instante un cambio (suspender,
  // cambiar el aviso) sin copias obsoletas.
  const [hubId, setHubId] = useState(null);
  const hub = hubId ? activities.find((a) => a.id === hubId) || null : null;
  const focusId = useFocusId();
  const [handledFocusId, setHandledFocusId] = useState(null);

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

  const refreshExactPermission = async () => {
    const result = await getExactAlarmPermission();
    setExactAlarmPermission(result);
    return result;
  };

  const openCreate = () => {
    refreshExactPermission();
    setSheet({ mode: 'create', values: { ...BLANK() } });
  };

  const openEdit = (item) => {
    refreshExactPermission();
    const leadMinutes = item.leadMinutes ?? -1;
    setSheet({
      mode: 'edit',
      id: item.id,
      values: {
        title: item.title,
        start: item.start,
        end: item.end,
        location: item.location || '',
        color: item.color || colors.accent,
        alarmEnabled: leadMinutes !== -1,
        leadMinutes,
        customLead: ALARM_LEAD_PRESETS.includes(leadMinutes) ? '' : String(leadMinutes > 0 ? leadMinutes : ''),
      },
    });
  };

  const focusedActivity = focusId ? activities.find((item) => item.id === focusId) : null;
  if (!focusId && handledFocusId) setHandledFocusId(null);
  if (focusedActivity && handledFocusId !== focusId) {
    setHandledFocusId(focusId);
    setDay(focusedActivity.day);
    setHubId(focusedActivity.id);
  }

  const setValue = (patch) => setSheet((prev) => (
    prev ? { ...prev, values: { ...prev.values, ...patch } } : prev
  ));

  const invalidTitle = !sheet?.values.title.trim();
  const invalidTime = sheet ? Boolean(timeInputError(sheet.values.start) || timeInputError(sheet.values.end)) : false;
  const invalidRange = sheet ? Boolean(timeRangeError(sheet.values.start, sheet.values.end)) : false;
  const invalidAlarm = Boolean(sheet?.values.alarmEnabled && !normalizeAlarmLead(sheet.values.leadMinutes));
  const canSave = Boolean(sheet) && !invalidTitle && !invalidTime && !invalidRange && !invalidAlarm && !saving;

  const save = async () => {
    if (!canSave || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setNotice(null);
    const { mode, id, values } = sheet;
    const payload = {
      title: values.title.trim(),
      start: formatTime(values.start),
      end: formatTime(values.end),
      location: values.location.trim(),
      color: values.color,
      leadMinutes: values.alarmEnabled ? values.leadMinutes : -1,
    };

    // El recordatorio de clase se reprograma junto con el dato (one-shot a la próxima
    // ocurrencia no suspendida); la actividad previa se cancela para no dejar huérfanas.
    try {
      let activity;
      let previousNotificationId = null;
      if (mode === 'edit') {
        const previous = activities.find((item) => item.id === id);
        if (!previous || !await updateActivity(id, { ...payload, notificationId: null })) {
          setNotice('No se pudo guardar la actividad.');
          return;
        }
        previousNotificationId = previous.notificationId;
        activity = { ...previous, ...payload, notificationId: null };
      } else {
        activity = await addActivity({ day, ...payload, suspended: {}, notificationId: null });
        if (!activity) { setNotice('No se pudo guardar la actividad.'); return; }
      }

      const alarm = await syncClassReminder(activity, previousNotificationId);
      if (alarm.notificationId && !await updateActivity(activity.id, { notificationId: alarm.notificationId })) {
        await cancelAlarm(alarm.notificationId);
        setNotice('La clase se guardó, pero la alarma no pudo vincularse. Se reintentará al abrir la app.');
        return;
      }
      if (alarm.notice) setNotice(alarm.notice);
      setSheet(null);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
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
  const toggleSuspend = async (item, dateKey) => {
    const suspended = { ...(item.suspended || {}) };
    if (suspended[dateKey]) delete suspended[dateKey];
    else suspended[dateKey] = true;
    if (!await updateActivity(item.id, { suspended, notificationId: null })) {
      setNotice('No se pudo cambiar la suspensión.');
      return;
    }
    warningHaptic();
    const alarm = await syncClassReminder({ ...item, suspended }, item.notificationId);
    if (alarm.notificationId && !await updateActivity(item.id, { notificationId: alarm.notificationId })) {
      await cancelAlarm(alarm.notificationId);
      setNotice('La suspensión se guardó; la alarma se reintentará al abrir la app.');
    } else if (alarm.notice) setNotice(alarm.notice);
  };

  const toggleAlarm = (enabled) => {
    if (!enabled) {
      setValue({ alarmEnabled: false, leadMinutes: -1 });
      return;
    }
    if (exactAlarmPermission.granted) {
      setValue({ alarmEnabled: true, leadMinutes: 15 });
      return;
    }
    setPermissionSheetOpen(true);
  };

  const continueAlarmSetup = async () => {
    const permission = await getExactAlarmPermission({ request: true });
    setExactAlarmPermission(permission);
    setValue({ alarmEnabled: true, leadMinutes: 15 });
  };

  const removeClass = async () => {
    const item = activities.find((activity) => activity.id === confirmId);
    if (!item) return;
    if (!await removeActivity(item.id)) {
      setNotice('No se pudo eliminar la actividad.');
      return;
    }
    await cancelAlarm(item.notificationId);
    setHubId(null);
  };

  /** a) Crear Nota de Clase: nota nueva etiquetada con el nombre de la asignatura. */
  const createClassNote = async (item) => {
    const note = await addNote({
      ...blankNote(item.color || colors.accent),
      title: `Nota de clase · ${item.title}`,
      tags: [item.title],
    });
    if (!note) { setNotice('No se pudo guardar. Inténtalo de nuevo.'); return; }
    setHubId(null);
    successHaptic();
    navigateToRoute(navigation, 'Notas', { focusId: note.id });
  };

  /** b) Agendar Evaluación: evento en la Agenda vinculado al ramo. */
  const scheduleEvaluation = async (item) => {
    const event = await addEvent({
      title: `Evaluación: ${item.title}`,
      dateKey: sessionDateKey(item.day),
      time: item.start,
      notes: `Evaluación de ${item.title}.`,
      color: item.color || colors.accent,
      leadMinutes: 1440,
      category: 'Examen',
      notificationId: null,
    });
    if (!event) { setNotice('No se pudo guardar. Inténtalo de nuevo.'); return; }
    setHubId(null);
    successHaptic();
    navigateToRoute(navigation, 'Agenda', { focusId: event.id });
  };

  return (
    <>
      <Screen
        title="Horario"
        subtitle={formatDateLong(todayKey())}
        headerLeft={
          <HeaderIconButton
            icon="chevronLeft"
            label="Volver a Día a Día"
            onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigateToRoute(navigation, 'Inicio'))}
          />
        }
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
            <View style={styles.alarmBlock}>
              <View style={styles.alarmHeading}>
                <View style={styles.alarmCopy}>
                  <Text style={typography.bodyStrong}>Alarma</Text>
                  <Text style={typography.caption}>Sonido y vibración antes de esta clase semanal.</Text>
                </View>
                <Switch
                  value={sheet.values.alarmEnabled}
                  onValueChange={toggleAlarm}
                  label="Activar alarma de clase"
                  hideLabel
                />
              </View>
              {sheet.values.alarmEnabled ? (
                <>
                  <Text style={[typography.caption, exactAlarmPermission.granted ? styles.exactStatus : styles.approximateStatus]}>
                    {exactAlarmPermission.granted
                      ? 'Alarma exacta permitida por Android.'
                      : 'Aviso aproximado: Android puede entregarlo con retraso.'}
                  </Text>
                  <View style={styles.alarmOptions}>
                    {ALARM_LEAD_PRESETS.map((minutes) => (
                      <Chip
                        key={minutes}
                        label={ALARM_LABELS.get(minutes)}
                        selected={sheet.values.leadMinutes === minutes}
                        onPress={() => setValue({ leadMinutes: minutes, customLead: '' })}
                        compact
                      />
                    ))}
                    <Chip
                      label="Personalizada"
                      selected={!ALARM_LEAD_PRESETS.includes(sheet.values.leadMinutes)}
                      onPress={() => {
                        const custom = normalizeAlarmLead(sheet.values.customLead) || 45;
                        setValue({ leadMinutes: custom, customLead: String(custom) });
                      }}
                      compact
                    />
                  </View>
                  {!ALARM_LEAD_PRESETS.includes(sheet.values.leadMinutes) ? (
                    <TextField
                      label="Minutos antes"
                      value={sheet.values.customLead}
                      onChangeText={(text) => setValue({ customLead: text, leadMinutes: normalizeAlarmLead(text) })}
                      placeholder="Ej. 45"
                      keyboardType="number-pad"
                      maxLength={5}
                      error={invalidAlarm ? 'Usa un número entero entre 1 y 10080.' : undefined}
                    />
                  ) : null}
                </>
              ) : null}
            </View>
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
              glyph="file-text"
              label="Crear Nota de Clase"
              hint="Abre una nota ya etiquetada con esta asignatura."
              onPress={() => createClassNote(hub)}
            />
            <HubAction
              glyph="map-pin"
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
                const target = hub;
                setHubId(null);
                openEdit(target);
              }}
              style={({ pressed }) => [styles.hubAction, pressed ? styles.pressed : null]}
            >
              <Icon name="bell" size={20} color={colors.textSecondary} />
              <View style={styles.hubBody}>
                <Text style={typography.bodyStrong}>Alarma de clase</Text>
                <Text style={typography.caption}>
                  {alarmLeadLabel(hub.leadMinutes)}
                </Text>
              </View>
            </Pressable>

            <HubAction
              glyph="edit"
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

      <ConfirmSheet
        visible={Boolean(confirmId)}
        onClose={() => setConfirmId(null)}
        onConfirm={removeClass}
        title="¿Eliminar actividad?"
        message="Desaparece del horario semanal. Esta acción no se puede deshacer."
      />
      <Sheet
        visible={permissionSheetOpen}
        onClose={() => setPermissionSheetOpen(false)}
        title="Permitir alarmas exactas"
        subtitle="Android controla este permiso. Si lo omites, la alarma seguirá disponible, pero puede sonar con retraso."
        scrollable={false}
      >
        <View style={styles.permissionActions}>
          <TextButton label="Cancelar" tone="ghost" onPress={() => setPermissionSheetOpen(false)} />
          <PrimaryButton
            label="Continuar"
            onPress={async () => {
              setPermissionSheetOpen(false);
              await continueAlarmSetup();
            }}
          />
        </View>
      </Sheet>
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
      <Icon name={glyph} size={20} color={colors.textSecondary} />
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
  alarmBlock: { gap: spacing.sm, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  alarmHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  alarmCopy: { flex: 1, gap: 2 },
  alarmOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  exactStatus: { color: colors.mint },
  approximateStatus: { color: colors.amber },
  permissionActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },

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
