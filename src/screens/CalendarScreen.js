import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { themedStyles, calendarTheme, colors, radius, spacing, typography } from '../theme/theme';
import { useAppData } from '../context/AppDataContext';
import {
  Card,
  Chip,
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
import { ColorPicker, PickerTrigger, TextArea, TextField } from '../components/ui/inputs';
import { DateField } from '../components/ui/DateField';
import { TimeField } from '../components/ui/TimeField';
import { ConfirmSheet, OptionSheet, Sheet } from '../components/ui/Sheet';
import { SwitchRow } from '../components/ui/Switch';
import { EVENT_REMINDERS, dropReminder, syncEventReminder } from '../services/reminders';
import { EVENT_CATEGORIES, categoryOf } from '../services/eventCategories';
import { plural } from '../utils/text';
import {
  compareDateTime,
  daysFromToday,
  formatDateLong,
  formatDuration,
  formatTime,
  fromDateKey,
  isPastDateTime,
  minutesBetween,
  relativeDayLabel,
  todayKey,
  weekdayIndex,
} from '../utils/dates';

const BLANK = () => ({
  title: '',
  dateKey: todayKey(),
  time: '18:00',
  endTime: '19:00',
  notes: '',
  category: 'Personal',
  leadMinutes: -1,
  color: colors.accent,
  notificationId: null,
});

function reminderLabel(leadMinutes) {
  const option = EVENT_REMINDERS.find((item) => item.value === leadMinutes);
  return option ? option.label : 'Sin aviso';
}

/** Marking map for react-native-calendars: one dot per event colour on its day. */
function buildMarks(events, selectedKey) {
  const marks = {};
  events.forEach((event) => {
    if (!event.dateKey) return;
    const entry = marks[event.dateKey] || { dots: [] };
    if (entry.dots.length < 3) {
      entry.dots.push({ key: event.id, color: event.color || colors.accent, selectedColor: event.color || colors.accent });
    }
    marks[event.dateKey] = entry;
  });

  Object.keys(marks).forEach((key) => {
    const dots = marks[key].dots;
    marks[key] = {
      marked: dots.length > 0,
      dotColor: dots[0]?.color || colors.accent,
      dots,
      selected: key === selectedKey,
      disableTouchEvent: false,
    };
  });

  if (selectedKey && !marks[selectedKey]) marks[selectedKey] = { selected: true, dots: [] };
  return marks;
}

export default function CalendarScreen() {
  const {
    events,
    addEvent,
    updateEvent,
    removeEvent,
    activities,
    permission,
    requestNotifications,
    notificationsSupported,
  } = useAppData();

  const today = todayKey();
  const [selected, setSelected] = useState(today);
  const [sheet, setSheet] = useState(null);
  const [leadSheetOpen, setLeadSheetOpen] = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [saving, setSaving] = useState(false);

  const marks = useMemo(() => buildMarks(events, selected), [events, selected]);

  const dayEvents = useMemo(
    () => events.filter((event) => event.dateKey === selected).slice().sort(compareDateTime),
    [events, selected],
  );

  /**
   * Línea de tiempo del día seleccionado: los eventos de esa fecha y las clases del horario
   * semanal que caen ese día de la semana, fusionados y ordenados por hora. Una clase cuya
   * sesión de esa fecha está suspendida se omite, igual que en el Horario.
   */
  const dayTimeline = useMemo(() => {
    const dayOfWeek = weekdayIndex(fromDateKey(selected));
    const classes = activities
      .filter((activity) => Number(activity.day) === dayOfWeek)
      .filter((activity) => !activity.suspended?.[selected])
      .map((activity) => ({
        kind: 'class',
        id: `class-${activity.id}`,
        title: activity.title,
        time: activity.start,
        endTime: activity.end,
        location: activity.location,
        color: activity.color,
      }));
    const dated = dayEvents.map((event) => ({
      kind: 'event',
      id: `event-${event.id}`,
      event,
      title: event.title,
      time: event.time,
      endTime: event.endTime,
      notes: event.notes,
      category: event.category,
      color: event.color,
    }));
    return [...classes, ...dated].sort((a, b) => String(a.time).localeCompare(String(b.time)));
  }, [activities, dayEvents, selected]);

  const upcoming = useMemo(
    () =>
      events
        .filter((event) => compareDateTime(event, { dateKey: today, time: '23:59' }) >= 0)
        .slice()
        .sort(compareDateTime)
        .slice(0, 4),
    [events, today],
  );

  const pastCount = useMemo(
    () => events.filter((event) => daysFromToday(event.dateKey) < 0).length,
    [events],
  );

  const remindersArmed = useMemo(() => events.filter((event) => event.notificationId).length, [events]);

  /**
   * Opens the editor for a new event with the day currently shown in the grid already picked:
   * choosing a day and then being sent back to today meant typing the same date twice.
   */
  const openCreate = useCallback(
    () => setSheet({ mode: 'create', values: { ...BLANK(), dateKey: selected } }),
    [selected],
  );

  const openEdit = useCallback((event) => {
    setSheet({
      mode: 'edit',
      id: event.id,
      values: {
        title: event.title,
        dateKey: event.dateKey,
        time: event.time,
        endTime: event.endTime || '',
        notes: event.notes || '',
        category: event.category || 'Personal',
        leadMinutes: event.leadMinutes ?? -1,
        color: event.color || colors.accent,
        notificationId: event.notificationId || null,
      },
    });
  }, []);

  const setValue = useCallback(
    (patch) => setSheet((prev) => ({ ...prev, values: { ...prev.values, ...patch } })),
    [],
  );

  const canSave = Boolean(sheet) && !saving && Boolean(sheet.values.title.trim());

  // The moment the sheet points at, already gone by the clock? Nothing can be announced about
  // it, so the switch shows *why* it refuses to go on instead of scheduling a notification the
  // OS would drop on the floor.
  const momentIsPast = sheet ? isPastDateTime(sheet.values.dateKey, sheet.values.time) : false;
  const reminderOn = sheet ? !momentIsPast && (sheet.values.leadMinutes ?? -1) !== -1 : false;
  // Remembered so switching the warning back on restores the lead that was chosen instead of
  // silently downgrading everybody to 30 minutes.
  const lastLead = useRef(30);

  const setReminder = useCallback(
    (on) => {
      const current = sheet?.values.leadMinutes ?? -1;
      if (on) {
        setValue({ leadMinutes: current === -1 ? lastLead.current : current });
        return;
      }
      lastLead.current = current === -1 ? 30 : current;
      setValue({ leadMinutes: -1 });
    },
    [setValue, sheet?.values.leadMinutes],
  );

  const pickLead = useCallback(
    (leadMinutes) => {
      if (leadMinutes !== -1) lastLead.current = leadMinutes;
      setValue({ leadMinutes });
    },
    [setValue],
  );

  const save = async () => {
    if (!canSave) return;
    const { mode, id, values } = sheet;
    const category = categoryOf(values.category);
    // El color sigue a la categoría salvo que el usuario lo haya cambiado a mano; así la
    // línea de tiempo y los puntos del calendario pintan cada evento con el tono de su tipo.
    const color = values.color && values.color !== colors.accent ? values.color : category.color;
    const payload = {
      title: values.title.trim(),
      dateKey: values.dateKey,
      time: values.time,
      endTime: values.endTime || '',
      notes: values.notes.trim(),
      category: category.id,
      // Belt and braces with the switch above: an event edited into the past must not keep,
      // nor ask for, a reminder that can never fire.
      leadMinutes: isPastDateTime(values.dateKey, values.time) ? -1 : values.leadMinutes,
      color,
    };

    setSaving(true);
    const result = await syncEventReminder(payload, values.notificationId);

    if (mode === 'edit') {
      updateEvent(id, { ...payload, notificationId: result.notificationId });
    } else {
      addEvent({ ...payload, notificationId: result.notificationId });
      setSelected(values.dateKey);
    }

    setSaving(false);
    setNotice(result.notice);
    setSheet(null);
  };

  const confirmDelete = async () => {
    const target = events.find((event) => event.id === confirmId);
    if (target) await dropReminder(target);
    removeEvent(confirmId);
    setConfirmId(null);
  };

  const showPermissionCard = notificationsSupported && permission.checked && !permission.granted;

  return (
    <>
      <Screen
        title="Agenda"
        subtitle={formatDateLong(selected)}
        headerRight={<Pill label={plural(events.length, 'evento')} />}
      >
        {showPermissionCard ? (
          <Card accent={colors.warning}>
            <Text style={typography.bodyStrong}>
              {permission.canAskAgain ? 'Activa los recordatorios' : 'Recordatorios bloqueados'}
            </Text>
            <Text style={[typography.small, styles.bannerText]}>
              {permission.canAskAgain
                ? 'Sin permisos la agenda se guarda igual, pero no te avisa cuando se acerca un evento.'
                : 'Actívalos desde Ajustes → Aplicaciones → NexusDay → Notificaciones para volver a usarlos.'}
            </Text>
            {permission.canAskAgain ? (
              <View style={styles.bannerActions}>
                <PrimaryButton
                  label="Permitir avisos"
                  onPress={requestNotifications}
                  style={styles.bannerButton}
                />
              </View>
            ) : null}
          </Card>
        ) : null}

        {notice ? (
          <View style={styles.noticeRow}>
            <Notice text={notice} tone="danger" />
            <TextButton label="OK" tone="ghost" onPress={() => setNotice(null)} />
          </View>
        ) : null}

        <Card style={styles.calendarCard}>
          <Calendar
            theme={calendarTheme}
            markingType="multi-dot"
            markedDates={marks}
            onDayPress={(day) => setSelected(day.dateString)}
            firstDay={1}
            hideExtraDays
            enableSwipeMonths
            style={styles.calendar}
          />
        </Card>

        <SectionTitle
          title="Línea de tiempo del día"
          count={dayTimeline.length}
          right={<TextButton label="+ Nuevo" onPress={openCreate} />}
        />

        {dayTimeline.length === 0 ? (
          <EmptyState
            emoji="🌙"
            title="Día libre"
            hint="No hay clases ni eventos este día. Toca + para agendar algo con su recordatorio."
          />
        ) : (
          <View style={styles.timeline}>
            {dayTimeline.map((item) => (
              <TimelineRow
                key={item.id}
                item={item}
                onPress={item.kind === 'event' ? () => openEdit(item.event) : undefined}
              />
            ))}
          </View>
        )}

        <View style={styles.statsRow}>
          <Stat value={dayEvents.length} label="ese día" />
          <Stat value={remindersArmed} label="con aviso" accent={colors.accent} />
          <Stat value={pastCount} label="pasados" />
        </View>

        {upcoming.length > 0 ? <SectionTitle title="Se acercan" count={upcoming.length} /> : null}
        {upcoming.map((event) => (
          <EventRow key={`up-${event.id}`} event={event} showDay onPress={() => openEdit(event)} />
        ))}
      </Screen>

      <Fab onPress={openCreate} />

      <Sheet
        visible={Boolean(sheet)}
        onClose={() => setSheet(null)}
        title={sheet?.mode === 'edit' ? 'Editar evento' : 'Nuevo evento'}
        subtitle="Todo se guarda en el dispositivo; el aviso se programa aparte."
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
            <PrimaryButton
              label={saving ? 'Guardando…' : 'Guardar'}
              onPress={save}
              disabled={!canSave}
            />
          </>
        }
      >
        {sheet ? (
          <>
            <TextField
              label="Título"
              value={sheet.values.title}
              onChangeText={(text) => setValue({ title: text })}
              placeholder="Ej. Entrega del proyecto"
              autoFocus
              maxLength={60}
            />
            <DateField label="Día" value={sheet.values.dateKey} onChange={(dateKey) => setValue({ dateKey })} />
            <TimeField label="Hora de inicio" value={sheet.values.time} onChange={(time) => setValue({ time })} />
            <TimeField
              label="Hora de fin (opcional)"
              value={sheet.values.endTime || sheet.values.time}
              onChange={(endTime) => setValue({ endTime })}
              hint={
                sheet.values.endTime && minutesBetween(sheet.values.time, sheet.values.endTime) > 0
                  ? `Duración: ${formatDuration(minutesBetween(sheet.values.time, sheet.values.endTime))}`
                  : 'Opcional: cuánto dura el evento.'
              }
            />
            <View style={styles.categoryWrap}>
              <Text style={typography.overline}>Categoría</Text>
              <View style={styles.categoryRow}>
                {EVENT_CATEGORIES.map((option) => {
                  const selectedCat = (sheet.values.category || 'Personal') === option.id;
                  return (
                    <Chip
                      key={option.id}
                      label={`${option.emoji} ${option.label}`}
                      compact
                      color={option.color}
                      selected={selectedCat}
                      onPress={() => setValue({ category: option.id, color: option.color })}
                    />
                  );
                })}
              </View>
            </View>
            <View style={styles.leadWrap}>
              <SwitchRow
                title="Avisarme"
                value={reminderOn}
                onValueChange={setReminder}
                // A past moment cannot announce itself; saying so beats a switch that silently
                // refuses to move.
                disabled={momentIsPast || !notificationsSupported}
                hint={
                  !notificationsSupported
                    ? 'Este dispositivo no puede enviar notificaciones.'
                    : momentIsPast
                      ? 'La fecha ya pasó: elige una futura para poder avisar.'
                      : reminderOn
                        ? `Te aviso ${reminderLabel(sheet.values.leadMinutes).toLowerCase()}.`
                        : 'Sin aviso: el evento se guarda igual.'
                }
              />
              {reminderOn ? (
                <PickerTrigger
                  label="¿Cuánto antes?"
                  value={reminderLabel(sheet.values.leadMinutes)}
                  onPress={() => setLeadSheetOpen(true)}
                  trailing={
                    sheet.values.notificationId ? <Text style={styles.leadHint}>● programado</Text> : null
                  }
                />
              ) : null}
            </View>
            <TextArea
              label="Notas (opcional)"
              value={sheet.values.notes}
              onChangeText={(text) => setValue({ notes: text })}
              placeholder="Detalles, dirección, qué llevar…"
              minHeight={80}
            />
            <ColorPicker value={sheet.values.color} onChange={(color) => setValue({ color })} />
          </>
        ) : null}
      </Sheet>

      <OptionSheet
        visible={leadSheetOpen}
        onClose={() => setLeadSheetOpen(false)}
        title="¿Cuándo te aviso?"
        options={EVENT_REMINDERS}
        value={sheet?.values.leadMinutes}
        onSelect={pickLead}
      />

      <ConfirmSheet
        visible={Boolean(confirmId)}
        onClose={() => setConfirmId(null)}
        onConfirm={confirmDelete}
        title="¿Eliminar evento?"
        message="Se borra de la agenda y se cancela su recordatorio."
      />
    </>
  );
}

/**
 * Una fila de la Línea de Tiempo del Día: una clase del horario o un evento de la agenda,
 * con su hora a la izquierda y un punto de color que la conecta a la línea vertical. Las
 * clases no son pulsables (su edición vive en el Horario); los eventos abren su editor.
 */
function TimelineRow({ item, onPress }) {
  const isClass = item.kind === 'class';
  const category = !isClass && item.category ? categoryOf(item.category) : null;
  const tint = item.color || colors.accent;
  const detail = isClass
    ? item.location || 'Clase'
    : category
      ? `${category.emoji} ${category.label}`
      : item.notes || '';
  const timeRange = item.endTime && item.endTime !== item.time ? `${formatTime(item.time)}–${formatTime(item.endTime)}` : formatTime(item.time);

  const body = (
    <View style={styles.timelineRow}>
      <View style={styles.timelineTimeCol}>
        <Text style={[styles.timelineTime, typography.tabular]}>{formatTime(item.time)}</Text>
        {item.endTime && item.endTime !== item.time ? (
          <Text style={[styles.timelineEnd, typography.tabular]}>{formatTime(item.endTime)}</Text>
        ) : null}
      </View>
      <View style={styles.timelineTrack}>
        <View style={[styles.timelineDot, { backgroundColor: tint }]} />
        <View style={[styles.timelineLine, { borderColor: colors.border }]} />
      </View>
      <View style={styles.timelineBody}>
        <View style={styles.timelineTitleRow}>
          <Text style={typography.bodyStrong} numberOfLines={1}>
            {isClass ? '📚 ' : ''}
            {item.title}
          </Text>
          {isClass ? <Pill label="clase" /> : null}
        </View>
        {detail ? (
          <Text style={[typography.small, styles.timelineDetail]} numberOfLines={1}>
            {timeRange} · {detail}
          </Text>
        ) : (
          <Text style={[typography.small, styles.timelineDetail]} numberOfLines={1}>
            {timeRange}
          </Text>
        )}
      </View>
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => (pressed ? styles.pressed : null)}>
      {body}
    </Pressable>
  );
}

function EventRow({ event, onPress, showDay }) {
  const past = daysFromToday(event.dateKey) < 0;
  const armed = Boolean(event.notificationId);
  const wantsReminder = (event.leadMinutes ?? -1) !== -1;

  return (
    <Card accent={event.color} onPress={onPress} dimmed={past} style={styles.eventCard}>
      <View style={styles.eventRow}>
        <View style={styles.eventTime}>
          <Text style={[styles.eventHour, typography.tabular]}>{formatTime(event.time)}</Text>
          {showDay ? <Text style={styles.eventDay}>{relativeDayLabel(event.dateKey)}</Text> : null}
        </View>
        <View style={styles.eventBody}>
          <Text style={typography.bodyStrong} numberOfLines={2}>
            {event.title}
          </Text>
          {event.notes ? (
            <Text style={[typography.small, styles.eventNotes]} numberOfLines={2}>
              {event.notes}
            </Text>
          ) : null}
          <View style={styles.pillRow}>
            {showDay ? <Pill label={relativeDayLabel(event.dateKey)} tone={past ? 'neutral' : 'accent'} /> : null}
            {wantsReminder ? (
              <Pill
                label={`🔔 ${reminderLabel(event.leadMinutes)}`}
                tone={armed ? 'accent' : 'warning'}
              />
            ) : null}
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = themedStyles({
  bannerText: { marginTop: 4, lineHeight: 18 },
  bannerActions: { marginTop: spacing.md, flexDirection: 'row' },
  bannerButton: { flex: 0, alignSelf: 'flex-start', paddingHorizontal: spacing.xl },
  noticeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  calendarCard: { paddingVertical: spacing.sm, marginBottom: spacing.sm },
  calendar: { backgroundColor: 'transparent' },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  eventCard: { paddingVertical: spacing.md },
  eventRow: { flexDirection: 'row', gap: spacing.lg },
  eventTime: { width: 62, gap: 2 },
  eventHour: { fontSize: 15.5, fontWeight: '700', color: colors.text },
  eventDay: { fontSize: 11.5, fontWeight: '600', color: colors.textMuted },
  eventBody: { flex: 1, gap: 4 },
  eventNotes: { lineHeight: 18 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 2 },
  leadWrap: { gap: spacing.xs },
  leadHint: { fontSize: 11, fontWeight: '700', color: colors.accent },

  // Categorías del formulario.
  categoryWrap: { gap: spacing.sm },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },

  // Línea de tiempo del día.
  timeline: { gap: 0 },
  timelineRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'stretch' },
  timelineTimeCol: { width: 46, alignItems: 'flex-end', paddingTop: 2, gap: 1 },
  timelineTime: { fontSize: 13.5, fontWeight: '700', color: colors.text },
  timelineEnd: { fontSize: 11.5, fontWeight: '500', color: colors.textMuted },
  timelineTrack: { width: 12, alignItems: 'center', paddingTop: 6 },
  timelineDot: { width: 10, height: 10, borderRadius: radius.pill },
  timelineLine: { flex: 1, width: 2, borderLeftWidth: 1, borderStyle: 'dashed', marginTop: 2 },
  timelineBody: {
    flex: 1,
    gap: 2,
    paddingBottom: spacing.lg,
  },
  timelineTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  timelineDetail: { color: colors.textMuted },
  pressed: { opacity: 0.7 },
});

