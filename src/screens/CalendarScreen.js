import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { calendarTheme, colors, spacing, typography } from '../theme/theme';
import { useAppData } from '../context/AppDataContext';
import {
  Card,
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
import { EVENT_REMINDERS, dropReminder, syncEventReminder } from '../services/reminders';
import * as CalendarSync from '../services/calendar';
import { describeShareStatus } from '../services/files';
import {
  compareDateTime,
  daysFromToday,
  formatDateLong,
  formatTime,
  relativeDayLabel,
  todayKey,
} from '../utils/dates';

const BLANK = () => ({
  title: '',
  dateKey: todayKey(),
  time: '18:00',
  notes: '',
  leadMinutes: 30,
  color: colors.accent,
  notificationId: null,
  calendarEventId: null,
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
    permission,
    requestNotifications,
    notificationsSupported,
  } = useAppData();

  const today = todayKey();
  const calendarAvailable = CalendarSync.isAvailable();
  const [selected, setSelected] = useState(today);
  const [sheet, setSheet] = useState(null);
  const [leadSheetOpen, setLeadSheetOpen] = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [info, setInfo] = useState(null);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const marks = useMemo(() => buildMarks(events, selected), [events, selected]);

  const dayEvents = useMemo(
    () => events.filter((event) => event.dateKey === selected).slice().sort(compareDateTime),
    [events, selected],
  );

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

  /** Agenda items that never made it to the device calendar (created before the bridge, or skipped). */
  const pendingSync = useMemo(() => events.filter((event) => !event.calendarEventId), [events]);

  const openCreate = useCallback(() => setSheet({ mode: 'create', values: BLANK() }), []);

  const openEdit = useCallback((event) => {
    setSheet({
      mode: 'edit',
      id: event.id,
      values: {
        title: event.title,
        dateKey: event.dateKey,
        time: event.time,
        notes: event.notes || '',
        leadMinutes: event.leadMinutes ?? -1,
        color: event.color || colors.accent,
        notificationId: event.notificationId || null,
        calendarEventId: event.calendarEventId || null,
      },
    });
  }, []);

  const setValue = useCallback(
    (patch) => setSheet((prev) => ({ ...prev, values: { ...prev.values, ...patch } })),
    [],
  );

  const canSave = Boolean(sheet) && !saving && Boolean(sheet.values.title.trim());

  const save = async () => {
    if (!canSave) return;
    const { mode, id, values } = sheet;
    const payload = {
      title: values.title.trim(),
      dateKey: values.dateKey,
      time: values.time,
      notes: values.notes.trim(),
      leadMinutes: values.leadMinutes,
      color: values.color,
    };

    setSaving(true);
    const result = await syncEventReminder(payload, values.notificationId);

    const stored =
      mode === 'edit'
        ? { id, ...payload }
        : addEvent({ ...payload, notificationId: result.notificationId, calendarEventId: null });
    if (mode === 'edit') updateEvent(id, { ...payload, notificationId: result.notificationId });
    else setSelected(values.dateKey);

    // The agenda is the source of truth; the device event is a mirror that may fail
    // (permissions, no accounts) without losing anything locally.
    const synced = await CalendarSync.syncEvent({
      ...payload,
      id: stored.id,
      calendarEventId: values.calendarEventId || null,
    });
    if (synced.calendarEventId && synced.calendarEventId !== values.calendarEventId) {
      updateEvent(stored.id, { calendarEventId: synced.calendarEventId });
    }

    setSaving(false);
    setNotice(result.notice || CalendarSync.describeCalendarStatus(synced.status, synced.canAskAgain));
    setSheet(null);
  };

  const confirmDelete = async () => {
    const target = events.find((event) => event.id === confirmId);
    if (target) {
      await dropReminder(target);
      if (target.calendarEventId) await CalendarSync.removeEvent(target);
    }
    removeEvent(confirmId);
    setConfirmId(null);
  };

  /** Bulk "añadir al calendario": pushes every agenda item the device does not know yet. */
  const pushToCalendar = async () => {
    setSyncing(true);
    const result = await CalendarSync.syncAllEvents(pendingSync);
    result.patches.forEach(({ id, calendarEventId }) => updateEvent(id, { calendarEventId }));
    const message = CalendarSync.describeSyncResult(result);
    if (result.status === 'ok') setInfo(message);
    else setNotice(message);
    setSyncing(false);
  };

  /** Offline fallback: hand the user an .ics they can import anywhere. */
  const exportICS = async () => {
    const result = await CalendarSync.shareAgendaICS(events, {
      name: 'agenda.ics',
      dialogTitle: 'Exportar agenda',
    });
    const message = describeShareStatus(result.status);
    if (message) setNotice(message);
  };

  const showPermissionCard = notificationsSupported && permission.checked && !permission.granted;

  return (
    <>
      <Screen
        title="Agenda"
        subtitle={formatDateLong(selected)}
        headerRight={<Pill label={`${events.length} eventos`} />}
      >
        {showPermissionCard ? (
          <Card accent={colors.warning}>
            <Text style={typography.bodyStrong}>
              {permission.canAskAgain ? 'Activá los recordatorios' : 'Recordatorios bloqueados'}
            </Text>
            <Text style={[typography.small, styles.bannerText]}>
              {permission.canAskAgain
                ? 'Sin permisos la agenda se guarda igual, pero no te avisa cuando se acerca un evento.'
                : 'Dalos desde Ajustes → Aplicaciones → AppMobile → Notificaciones para volver a usarlos.'}
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

        {notice || info ? (
          <View style={styles.noticeRow}>
            {notice ? <Notice text={notice} tone="danger" /> : null}
            {info ? <Notice text={info} tone="info" /> : null}
            <TextButton
              label="OK"
              tone="ghost"
              onPress={() => {
                setNotice(null);
                setInfo(null);
              }}
            />
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

        <View style={styles.statsRow}>
          <Stat value={dayEvents.length} label="ese día" />
          <Stat value={remindersArmed} label="con aviso" accent={colors.accent} />
          <Stat value={pastCount} label="pasados" />
        </View>

        <Card accent={colors.accent} style={styles.syncCard}>
          <Text style={typography.bodyStrong}>Calendario del teléfono</Text>
          <Text style={[typography.small, styles.syncText]}>
            {calendarAvailable && pendingSync.length
              ? `${pendingSync.length} evento(s) de la agenda todavía no están en tu calendario.`
              : calendarAvailable
                ? 'Toda la agenda ya está copiada a tu calendario.'
                : 'Este dispositivo no expone su calendario; siempre puedes exportar la agenda.'}
          </Text>
          <View style={styles.syncActions}>
            {calendarAvailable && pendingSync.length ? (
              <PrimaryButton
                label={syncing ? 'Añadiendo…' : 'Añadir al calendario'}
                onPress={pushToCalendar}
                disabled={syncing}
                style={styles.syncButton}
              />
            ) : null}
            <TextButton label="Exportar .ics" tone="ghost" onPress={exportICS} />
          </View>
        </Card>

        <SectionTitle
          title={relativeDayLabel(selected)}
          count={dayEvents.length}
          right={<TextButton label="+ Nuevo" onPress={openCreate} />}
        />

        {dayEvents.length === 0 ? (
          <EmptyState
            emoji="🌙"
            title="Día libre"
            hint="Toca + para agendar algo en esta fecha con su recordatorio."
          />
        ) : (
          dayEvents.map((event) => (
            <EventRow key={event.id} event={event} onPress={() => openEdit(event)} />
          ))
        )}

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
            <TimeField label="Hora" value={sheet.values.time} onChange={(time) => setValue({ time })} />
            <View style={styles.leadWrap}>
              <PickerTrigger
                label="Recordatorio"
                value={reminderLabel(sheet.values.leadMinutes)}
                onPress={() => setLeadSheetOpen(true)}
                trailing={
                  <Text style={styles.leadHint}>
                    {sheet.values.notificationId ? '● programado' : ''}
                  </Text>
                }
              />
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
        onSelect={(leadMinutes) => setValue({ leadMinutes })}
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
            {event.calendarEventId ? <Pill label="✓ en calendario" /> : null}
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  bannerText: { marginTop: 4, lineHeight: 18 },
  bannerActions: { marginTop: spacing.md, flexDirection: 'row' },
  bannerButton: { flex: 0, alignSelf: 'flex-start', paddingHorizontal: spacing.xl },
  noticeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  calendarCard: { paddingVertical: spacing.sm, marginBottom: spacing.sm },
  calendar: { backgroundColor: 'transparent' },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  syncCard: { gap: 6 },
  syncText: { lineHeight: 18 },
  syncActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  syncButton: { flex: 0, alignSelf: 'flex-start', paddingHorizontal: spacing.xl },
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
});

