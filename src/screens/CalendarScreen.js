import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { themedStyles, calendarTheme, colors, radius, spacing, typography } from '../theme/theme';
import { useAppData } from '../context/AppDataContext';
import { useFocusId } from '../hooks/useFocusId';
import { useSwipeLockActions } from '../context/SwipeLockContext';
import { useAccentTheme } from '../context/ThemeContext';
import { HeaderIconButton } from '../components/ui/HeaderIconButton';
import { Icon } from '../components/Icon';
import { BirthdayEditor } from '../components/BirthdayEditor';
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
import { buildCalendarMarks, buildDayAgenda, calendarEmptyState, CALENDAR_FILTERS, dateKeyInMonth, shiftCalendarMonth } from '../services/calendar';
import {
  formatDateLong,
  formatDateShort,
  formatDuration,
  formatMonthYear,
  formatTime,
  isPastDateTime,
  minutesBetween,
  todayKey,
  MONTHS,
  MONTHS_SHORT,
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
const EMPTY_CALENDAR_IMAGE = require('../../assets/nexusday-empty-calendar.png');
const NEX_BIRTHDAY_IMAGE = require('../../assets/nex/calendar/nex-birthday.jpg');
const NEX_U11_CALENDAR_IMAGE = require('../../assets/nex/u11/tutorial/tutorial-calendar.jpg');
const NEX_MONTH_ART = require('../../assets/nex/u11/backgrounds/nex-eclipse.jpg');

LocaleConfig.locales.nexusEs = {
  monthNames: MONTHS.map((name) => `${name[0].toUpperCase()}${name.slice(1)}`),
  monthNamesShort: MONTHS_SHORT.map((name) => `${name[0].toUpperCase()}${name.slice(1)}`),
  dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
  dayNamesShort: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
};
LocaleConfig.defaultLocale = 'nexusEs';

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
  const [visibleMonth, setVisibleMonth] = useState(`${today.slice(0, 7)}-01`);
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
  const { acquireSwipe } = useSwipeLockActions();
  const { revision: themeRevision, theme: activeAccent, surface: surfaceMode } = useAccentTheme();
  const { width, fontScale } = useWindowDimensions();
  const calendarSwipeRelease = useRef(null);
  const focusId = useFocusId();
  const [handledFocusId, setHandledFocusId] = useState(null);

  const marks = useMemo(
    () =>
      buildCalendarMarks({
        events,
        birthdays,
        year: Number(visibleMonth.slice(0, 4)),
        selectedKey: selected,
        filter,
        colors: { event: colors.accent, birthday: colors.warning },
      }),
    [birthdays, events, filter, selected, visibleMonth],
  );

  const calendarDisplayTheme = useMemo(() => {
    const scale = Math.max(1, Math.min(fontScale, 1.5));
    const dayStyles = calendarTheme['stylesheet.day.basic'];
    const surface = surfaceMode.tokens;
    return {
      ...calendarTheme,
      backgroundColor: surface.background,
      calendarBackground: surface.surface,
      textSectionTitleColor: surface.textMuted,
      textSectionTitleDisabledColor: surface.textMuted,
      dayTextColor: surface.text,
      textDisabledColor: surface.borderStrong,
      selectedDayTextColor: surface.text,
      todayTextColor: activeAccent.accent,
      arrowColor: activeAccent.accent,
      disabledArrowColor: surface.borderStrong,
      monthTextColor: surface.text,
      indicatorColor: activeAccent.accent,
      dotColor: activeAccent.accent,
      selectedDotColor: activeAccent.accent,
      textDayFontSize: Math.round(16 * scale),
      textDayHeaderFontSize: Math.round(11 * scale),
      'stylesheet.day.basic': {
        ...dayStyles,
        base: { ...dayStyles.base, minHeight: Math.round(44 * scale), aspectRatio: undefined },
        today: { ...dayStyles.today, borderWidth: 1, borderColor: activeAccent.accent },
        todayText: { color: activeAccent.accent, fontWeight: '700' },
        selected: { ...dayStyles.selected, backgroundColor: activeAccent.accentSoft, borderRadius: radius.md, borderColor: activeAccent.accent },
        selectedText: { ...dayStyles.selectedText, color: activeAccent.accent },
      },
    };
  }, [activeAccent, fontScale, surfaceMode]);

  /**
   * Agenda del día seleccionado: eventos, clases semanales y cumpleaños anuales ordenados
   * por hora. Una clase suspendida para esa fecha se omite, igual que en el Horario.
   */
  const dayTimeline = useMemo(
    () => buildDayAgenda({ dateKey: selected, events, activities, birthdays, filter }),
    [activities, birthdays, events, filter, selected],
  );
  const emptyAgenda = useMemo(() => calendarEmptyState(filter), [filter]);

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
    setVisibleMonth(`${nextToday.slice(0, 7)}-01`);
    setCalendarRevision((value) => value + 1);
  }, []);

  const changeMonth = useCallback((amount) => {
    const nextMonth = shiftCalendarMonth(visibleMonth, amount);
    setVisibleMonth(nextMonth);
    setSelected((dateKey) => dateKeyInMonth(dateKey, nextMonth));
    setCalendarRevision((value) => value + 1);
  }, [visibleMonth]);

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
  const beginCalendarTouch = useCallback(() => {
    calendarSwipeRelease.current?.();
    calendarSwipeRelease.current = acquireSwipe();
  }, [acquireSwipe]);
  const endCalendarTouch = useCallback((event) => {
    if (event?.nativeEvent?.touches?.length > 0) return;
    calendarSwipeRelease.current?.();
    calendarSwipeRelease.current = null;
  }, []);
  const cancelCalendarTouch = useCallback(() => {
    calendarSwipeRelease.current?.();
    calendarSwipeRelease.current = null;
  }, []);

  useEffect(() => () => {
    calendarSwipeRelease.current?.();
    calendarSwipeRelease.current = null;
  }, []);

  return (
    <>
      <Screen
        title="Calendario"
        subtitle={formatDateLong(selected)}
        headerRight={<HeaderIconButton icon="settings" label="Abrir Ajustes" onPress={() => navigation.navigate('Ajustes')} />}
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

        <Card style={[styles.calendarCard, width <= 374 ? styles.calendarCardCompact : null]}>
          <View
            style={styles.calendarTouchArea}
            onTouchStart={beginCalendarTouch}
            onTouchEnd={endCalendarTouch}
            onTouchCancel={cancelCalendarTouch}
          >
            <View style={styles.monthFocus}>
              <View style={styles.monthFocusCopy}>
                <Text style={styles.monthFocusKicker}>FECHA EN FOCO</Text>
                <Text style={styles.monthFocusDate} accessibilityLabel={formatDateLong(selected)}>{formatDateShort(selected)}</Text>
                <Text style={typography.caption}>{dayTimeline.length} {dayTimeline.length === 1 ? 'elemento' : 'elementos'} en agenda</Text>
              </View>
              {surfaceMode.id === 'nex' ? (
                <Image source={NEX_MONTH_ART} style={styles.monthArtwork} resizeMode="cover" accessible={false} importantForAccessibility="no" />
              ) : null}
            </View>
            <View style={styles.monthToolbar}>
              <Pressable
                onPress={() => changeMonth(-1)}
                accessibilityRole="button"
                accessibilityLabel="Mes anterior"
                hitSlop={4}
                style={({ pressed }) => [styles.monthButton, pressed ? styles.pressed : null]}
              >
                <Icon name="chevronLeft" size={21} color={colors.text} />
              </Pressable>
              <Text style={styles.monthTitle} accessibilityRole="header" accessibilityLabel={formatMonthYear(visibleMonth)}>
                {formatMonthYear(visibleMonth)}
              </Text>
              <Pressable
                onPress={() => changeMonth(1)}
                accessibilityRole="button"
                accessibilityLabel="Mes siguiente"
                hitSlop={4}
                style={({ pressed }) => [styles.monthButton, pressed ? styles.pressed : null]}
              >
                <Icon name="chevronRight" size={21} color={colors.text} />
              </Pressable>
            </View>
            <Calendar
              key={`${calendarRevision}-${themeRevision}-${fontScale}`}
              initialDate={visibleMonth}
              theme={calendarDisplayTheme}
              markingType="multi-dot"
              markedDates={marks}
              onDayPress={(day) => setSelected(day.dateString)}
              firstDay={1}
              hideExtraDays
              hideArrows
              renderHeader={() => null}
              enableSwipeMonths={false}
              style={styles.calendar}
            />
            <View style={styles.legend}>
              {filter === 'all' || filter === 'events' ? <LegendItem color={colors.accent} label="Eventos" /> : null}
              {filter === 'all' || filter === 'birthdays' ? (
                <LegendItem color={colors.warning} label="Cumpleaños" />
              ) : null}
              {filter === 'classes' ? <Text style={typography.caption}>Las clases aparecen en la agenda diaria.</Text> : null}
            </View>
          </View>
        </Card>

        <View style={styles.filterBar}>
          <ChipScroller style={styles.filters} contentContainerStyle={styles.filterContent}>
            {CALENDAR_FILTERS.map((option) => (
              <Chip
                key={option.id}
                label={option.label}
                compact
                selected={filter === option.id}
                onPress={() => setFilter(option.id)}
              />
            ))}
          </ChipScroller>
          <TextButton label="Hoy" tone="ghost" onPress={goToday} />
        </View>

        <SectionTitle
          title={`Agenda · ${formatDateShort(selected)}`}
          count={dayTimeline.length}
          variant="editorial"
        />

        {dayTimeline.length === 0 ? (
          <EmptyState
            image={surfaceMode.id === 'nex'
              ? filter === 'birthdays' ? NEX_BIRTHDAY_IMAGE : NEX_U11_CALENDAR_IMAGE
              : EMPTY_CALENDAR_IMAGE}
            icon="calendar"
            title={emptyAgenda.title}
            hint={emptyAgenda.hint}
          />
        ) : (
          <View style={styles.timeline}>
            {dayTimeline.map((item, index) => (
              <TimelineRow
                key={item.id}
                item={item}
                isLast={index === dayTimeline.length - 1}
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

      <Fab onPress={() => setCreateSheetOpen(true)} label="Crear en Calendario" />

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
function TimelineRow({ item, onPress, isLast }) {
  const isClass = item.kind === 'class';
  const isBirthday = item.kind === 'birthday';
  const category = item.kind === 'event' && item.category ? categoryOf(item.category) : null;
  const tint = item.color || colors.accent;
  const detail = isClass
    ? item.detail || 'Clase'
    : isBirthday
      ? ''
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
        {!isLast ? <View style={[styles.timelineLine, { borderColor: colors.border }]} /> : null}
      </View>
      <View style={styles.timelineBody}>
        <View style={styles.timelineTitleRow}>
          {isBirthday && item.emoji ? <Text style={styles.birthdayEmoji} accessible={false}>{item.emoji}</Text> : null}
          <Text style={typography.bodyStrong} numberOfLines={2}>{item.title}</Text>
          {isClass ? <Pill label="Clase" /> : null}
          {isBirthday ? <Pill label="Anual" tone="warning" /> : null}
          {category ? <Pill label={category.label} tone="accent" /> : null}
        </View>
        {detail ? (
          <Text style={[typography.small, styles.timelineDetail]} numberOfLines={1}>
            {detail}
          </Text>
        ) : isBirthday ? <Text style={[typography.caption, styles.timelineDetail]}>Cumpleaños · {timeRange}</Text> : null}
      </View>
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${isBirthday ? 'cumpleaños anual' : isClass ? 'clase' : category?.label || 'evento'}, ${timeRange}`}
      accessibilityHint={isClass ? 'Abrir esta clase en el horario' : isBirthday ? 'Editar cumpleaños' : 'Editar evento'}
      style={({ pressed }) => [styles.timelinePressable, pressed ? styles.pressed : null]}
    >
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
  bannerText: { marginTop: 4, lineHeight: 18 },
  bannerActions: { marginTop: spacing.md, flexDirection: 'row' },
  bannerButton: { flex: 0, alignSelf: 'flex-start', paddingHorizontal: spacing.xl },
  noticeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  filterBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  filters: { flex: 1, minWidth: 0 },
  filterContent: { gap: spacing.xs, paddingRight: spacing.sm },
  calendarCard: { paddingVertical: spacing.md, marginBottom: 0 },
  calendarCardCompact: { marginHorizontal: -spacing.md, paddingHorizontal: 0, borderRadius: radius.lg },
  calendarTouchArea: { gap: spacing.sm },
  monthFocus: { minHeight: 88, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  monthFocusCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  monthFocusKicker: { ...typography.overline, color: colors.accent, letterSpacing: 1 },
  monthFocusDate: { ...typography.h2, color: colors.text, textTransform: 'capitalize' },
  monthArtwork: { width: 92, height: 72, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  monthToolbar: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xs },
  monthButton: { width: 48, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  monthTitle: { flex: 1, textAlign: 'center', ...typography.h2, textTransform: 'capitalize' },
  calendar: { width: '100%', backgroundColor: 'transparent' },
  legend: { minHeight: 32, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.lg, paddingTop: spacing.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 8, height: 8, borderRadius: radius.pill },
  leadWrap: { gap: spacing.xs },
  leadHint: { fontSize: 11, fontWeight: '700', color: colors.accent },

  // Categorías del formulario.
  categoryWrap: { gap: spacing.sm },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },

  // Línea de tiempo del día.
  timeline: { gap: 0 },
  timelinePressable: { minHeight: 68, justifyContent: 'center' },
  timelineRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'stretch', paddingTop: spacing.sm },
  timelineTimeCol: { width: 50, alignItems: 'flex-end', paddingTop: 2, gap: 2 },
  timelineTime: { fontSize: 14, fontWeight: '700', color: colors.text },
  timelineEnd: { fontSize: 12, fontWeight: '500', color: colors.textMuted },
  timelineTrack: { width: 12, alignItems: 'center', paddingTop: 6 },
  timelineDot: { width: 10, height: 10, borderRadius: radius.pill },
  timelineLine: { flex: 1, minHeight: 44, width: 2, borderLeftWidth: 1, borderStyle: 'dashed', marginTop: 2 },
  timelineBody: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
  timelineTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs },
  birthdayEmoji: { fontSize: 18 },
  timelineDetail: { color: colors.textMuted },
  pressed: { opacity: 0.7 },
});

