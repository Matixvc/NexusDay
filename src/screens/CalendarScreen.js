import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { themedStyles, calendarTheme, colors, radius, spacing, typography } from '../theme/theme';
import { useAppData } from '../context/AppDataContext';
import { useFocusId } from '../hooks/useFocusId';
import { HeaderIconButton } from '../components/ui/HeaderIconButton';
import { BirthdayEditor } from '../components/BirthdayEditor';
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
  TextButton,
} from '../components/ui/primitives';
import { ColorPicker, PickerTrigger, TextArea, TextField } from '../components/ui/inputs';
import { DateField } from '../components/ui/DateField';
import { TimeField } from '../components/ui/TimeField';
import { ConfirmSheet, OptionSheet, Sheet } from '../components/ui/Sheet';
import { SwitchRow } from '../components/ui/Switch';
import { EVENT_REMINDERS, dropReminder, syncEventReminder } from '../services/reminders';
import { EVENT_CATEGORIES, categoryOf } from '../services/eventCategories';
import {
  blankBirthday,
  deleteBirthdayRecord,
  saveBirthdayRecord,
} from '../services/birthdays';
import { buildCalendarMarks, buildDayAgenda, CALENDAR_FILTERS } from '../services/calendar';
import { plural } from '../utils/text';
import {
  formatDateLong,
  formatDuration,
  formatTime,
  isPastDateTime,
  minutesBetween,
  todayKey,
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

const CREATE_OPTIONS = [
  { value: 'event', label: 'Evento personal' },
  { value: 'birthday', label: 'Cumpleaños' },
];

function reminderLabel(leadMinutes) {
  const option = EVENT_REMINDERS.find((item) => item.value === leadMinutes);
  return option ? option.label : 'Sin aviso';
}

export default function CalendarScreen({ navigation }) {
  const {
    events,
    addEvent,
    updateEvent,
    removeEvent,
    activities,
    birthdays,
    addBirthday,
    updateBirthday,
    removeBirthday,
    permission,
    requestNotifications,
    notificationsSupported,
  } = useAppData();

  const today = todayKey();
  const [selected, setSelected] = useState(today);
  const [visibleYear, setVisibleYear] = useState(Number(today.slice(0, 4)));
  const [calendarRevision, setCalendarRevision] = useState(0);
  const [filter, setFilter] = useState('all');
  const [sheet, setSheet] = useState(null);
  const [birthdaySheet, setBirthdaySheet] = useState(null);
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [leadSheetOpen, setLeadSheetOpen] = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [birthdayConfirmId, setBirthdayConfirmId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [saving, setSaving] = useState(false);
  const [birthdaySaving, setBirthdaySaving] = useState(false);
  const focusId = useFocusId();
  const [handledFocusId, setHandledFocusId] = useState(null);

  const marks = useMemo(
    () =>
      buildCalendarMarks({
        events,
        birthdays,
        year: visibleYear,
        selectedKey: selected,
        filter,
        colors: { event: colors.accent, birthday: colors.warning },
      }),
    [birthdays, events, filter, selected, visibleYear],
  );

  /**
   * Agenda del día seleccionado: eventos, clases semanales y cumpleaños anuales ordenados
   * por hora. Una clase suspendida para esa fecha se omite, igual que en el Horario.
   */
  const dayTimeline = useMemo(
    () => buildDayAgenda({ dateKey: selected, events, activities, birthdays, filter }),
    [activities, birthdays, events, filter, selected],
  );

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

  const openBirthdayCreate = useCallback(
    () => setBirthdaySheet({ mode: 'create', values: blankBirthday(colors.accent, selected) }),
    [selected],
  );

  const openBirthdayEdit = useCallback((birthday) => {
    setBirthdaySheet({
      mode: 'edit',
      id: birthday.id,
      values: {
        name: birthday.name,
        emoji: birthday.emoji || '🎂',
        dateKey: birthday.dateKey,
        time: birthday.time || '09:00',
        daysBefore: birthday.daysBefore ?? 0,
        color: birthday.color || colors.accent,
        notificationId: birthday.notificationId || null,
      },
    });
  }, []);

  const setBirthdayValue = useCallback(
    (patch) => setBirthdaySheet((previous) => ({ ...previous, values: { ...previous.values, ...patch } })),
    [],
  );

  const goToday = useCallback(() => {
    const nextToday = todayKey();
    setSelected(nextToday);
    setVisibleYear(Number(nextToday.slice(0, 4)));
    setCalendarRevision((value) => value + 1);
  }, []);

  const focusedEvent = focusId ? events.find((item) => item.id === focusId) : null;
  if (!focusId && handledFocusId) setHandledFocusId(null);
  if (focusedEvent && handledFocusId !== focusId) {
    setHandledFocusId(focusId);
    setSelected(focusedEvent.dateKey || today);
    openEdit(focusedEvent);
  }

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

  const saveBirthday = async () => {
    if (!birthdaySheet || birthdaySaving || !birthdaySheet.values.name.trim()) return;
    setBirthdaySaving(true);
    const result = await saveBirthdayRecord({
      mode: birthdaySheet.mode,
      id: birthdaySheet.id,
      values: birthdaySheet.values,
      addBirthday,
      updateBirthday,
    });
    setBirthdaySaving(false);
    setNotice(result.notice);
    setBirthdaySheet(null);
  };

  const confirmDelete = async () => {
    const target = events.find((event) => event.id === confirmId);
    if (target) await dropReminder(target);
    removeEvent(confirmId);
    setConfirmId(null);
  };

  const confirmBirthdayDelete = async () => {
    await deleteBirthdayRecord({ id: birthdayConfirmId, birthdays, removeBirthday });
    setBirthdayConfirmId(null);
  };

  const showPermissionCard = notificationsSupported && permission.checked && !permission.granted;

  return (
    <>
      <Screen
        title="Calendario"
        subtitle={formatDateLong(selected)}
        headerRight={
          <View style={styles.headerActions}>
            <Pill label={plural(events.length + birthdays.length, 'fecha')} />
            <HeaderIconButton icon="settings" label="Abrir Ajustes" onPress={() => navigation.navigate('Ajustes')} />
          </View>
        }
      >
        {showPermissionCard ? (
          <Card accent={colors.warning}>
            <Text style={typography.bodyStrong}>
              {permission.canAskAgain ? 'Activa los recordatorios' : 'Recordatorios bloqueados'}
            </Text>
            <Text style={[typography.small, styles.bannerText]}>
              {permission.canAskAgain
                ? 'La agenda se guarda igual, pero sin permiso no avisa sobre eventos ni cumpleaños.'
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

        <View style={styles.filterBar}>
          <View style={styles.filters}>
            {CALENDAR_FILTERS.map((option) => (
              <Chip
                key={option.id}
                label={option.label}
                compact
                selected={filter === option.id}
                onPress={() => setFilter(option.id)}
              />
            ))}
          </View>
          <TextButton label="Hoy" tone="ghost" onPress={goToday} />
        </View>

        <Card style={styles.calendarCard}>
          <Calendar
            key={calendarRevision}
            current={selected}
            theme={calendarTheme}
            markingType="multi-dot"
            markedDates={marks}
            onDayPress={(day) => setSelected(day.dateString)}
            onMonthChange={(month) => setVisibleYear(month.year)}
            firstDay={1}
            hideExtraDays
            enableSwipeMonths
            style={styles.calendar}
          />
          <View style={styles.legend}>
            {filter === 'all' || filter === 'events' ? <LegendItem color={colors.accent} label="Eventos" /> : null}
            {filter === 'all' || filter === 'birthdays' ? (
              <LegendItem color={colors.warning} label="Cumpleaños" />
            ) : null}
            {filter === 'classes' ? <Text style={typography.caption}>Las clases aparecen en la agenda diaria.</Text> : null}
          </View>
        </Card>

        <SectionTitle
          title="Agenda del día"
          count={dayTimeline.length}
          right={<TextButton label="+ Crear" onPress={() => setCreateSheetOpen(true)} />}
        />

        {dayTimeline.length === 0 ? (
          <EmptyState
            emoji="🌙"
            title="Día libre"
            hint="No hay elementos de este tipo para la fecha seleccionada."
          />
        ) : (
          <View style={styles.timeline}>
            {dayTimeline.map((item) => (
              <TimelineRow
                key={item.id}
                item={item}
                onPress={
                  item.kind === 'event'
                    ? () => openEdit(item.source)
                    : item.kind === 'birthday'
                      ? () => openBirthdayEdit(item.source)
                      : () => navigation.navigate('Horario', { focusId: item.sourceId })
                }
              />
            ))}
          </View>
        )}

      </Screen>

      <Fab onPress={() => setCreateSheetOpen(true)} />

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

      <BirthdayEditor
        sheet={birthdaySheet}
        saving={birthdaySaving}
        onClose={() => setBirthdaySheet(null)}
        onChange={setBirthdayValue}
        onSave={saveBirthday}
        onRequestDelete={(id) => {
          setBirthdayConfirmId(id);
          setBirthdaySheet(null);
        }}
      />

      <OptionSheet
        visible={createSheetOpen}
        onClose={() => setCreateSheetOpen(false)}
        title="Crear en Calendario"
        options={CREATE_OPTIONS}
        value={null}
        onSelect={(kind) => {
          if (kind === 'birthday') openBirthdayCreate();
          else openCreate();
        }}
      />

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

      <ConfirmSheet
        visible={Boolean(birthdayConfirmId)}
        onClose={() => setBirthdayConfirmId(null)}
        onConfirm={confirmBirthdayDelete}
        title="¿Eliminar cumpleaños?"
        message="Se borra del calendario y se cancela su aviso anual."
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
  const isBirthday = item.kind === 'birthday';
  const category = item.kind === 'event' && item.category ? categoryOf(item.category) : null;
  const tint = item.color || colors.accent;
  const detail = isClass
    ? item.detail || 'Clase'
    : isBirthday
      ? item.detail
    : category
      ? `${category.emoji} ${category.label}`
      : item.detail || '';
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
            {isClass ? '📚 ' : isBirthday ? `${item.emoji} ` : ''}
            {item.title}
          </Text>
          {isClass ? <Pill label="clase" /> : null}
          {isBirthday ? <Pill label="cumpleaños" tone="warning" /> : null}
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

  return (
    <Pressable onPress={onPress} style={({ pressed }) => (pressed ? styles.pressed : null)}>
      {body}
    </Pressable>
  );
}

function LegendItem({ color, label }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={typography.caption}>{label}</Text>
    </View>
  );
}

const styles = themedStyles({
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  bannerText: { marginTop: 4, lineHeight: 18 },
  bannerActions: { marginTop: spacing.md, flexDirection: 'row' },
  bannerButton: { flex: 0, alignSelf: 'flex-start', paddingHorizontal: spacing.xl },
  noticeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  filterBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  filters: { flex: 1, minWidth: 230, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  calendarCard: { paddingVertical: spacing.sm, marginBottom: spacing.sm },
  calendar: { backgroundColor: 'transparent' },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg, paddingTop: spacing.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 8, height: 8, borderRadius: radius.pill },
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

