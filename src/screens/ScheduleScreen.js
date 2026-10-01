import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { themedStyles, colors, spacing, typography } from '../theme/theme';
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
import { ConfirmSheet, Sheet } from '../components/ui/Sheet';
import { nextDateKey, shareAgendaICS } from '../services/agendaExport';
import { describeShareStatus } from '../services/files';
import { plural } from '../utils/text';
import {
  WEEKDAYS,
  formatDateLong,
  formatDuration,
  formatTime,
  minutesBetween,
  todayKey,
  weekdayIndex,
} from '../utils/dates';

const BLANK = { title: '', start: '09:00', end: '10:00', location: '', color: colors.accent };

function durationOf(activity) {
  return minutesBetween(activity.start, activity.end);
}

function minutesOf(value) {
  const [hour, minute] = value.split(':').map(Number);
  return (hour || 0) * 60 + (minute || 0);
}

export default function ScheduleScreen() {
  const { activities, addActivity, updateActivity, removeActivity } = useAppData();

  const todayIndex = weekdayIndex(new Date());
  const [day, setDay] = useState(todayIndex);
  const [sheet, setSheet] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [info, setInfo] = useState(null);
  const [notice, setNotice] = useState(null);
  const [exporting, setExporting] = useState(false);

  /** Weeks of the weekly slot that go into the exported .ics file. */
  const exportWeeks = 4;

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

  const openCreate = () => setSheet({ mode: 'create', values: { ...BLANK } });

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
    };

    if (mode === 'edit') updateActivity(id, payload);
    else addActivity({ day, ...payload });

    setSheet(null);
  };

  /** The weekly slot expanded into concrete dates for the next `exportWeeks` weeks. */
  const concreteActivities = (weekCount = exportWeeks) => {
    const list = [];
    for (let week = 0; week < weekCount; week += 1) {
      const dateKey = nextDateKey(WEEKDAYS[day].dow, new Date(), week);
      dayActivities.forEach((item) => {
        list.push({
          id: `${item.id}-${dateKey}`,
          title: item.title,
          dateKey,
          time: item.start,
          endTime: item.end,
          location: item.location,
        });
      });
    }
    return list;
  };

  const exportICS = async () => {
    setExporting(true);
    const result = await shareAgendaICS(concreteActivities(), {
      name: `horario-${WEEKDAYS[day].short.toLowerCase()}.ics`,
      dialogTitle: 'Exportar el horario',
    });
    const message = describeShareStatus(result.status);
    if (message) setNotice(message);
    setExporting(false);
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

        {dayActivities.length ? (
          <Card accent={colors.accent} style={styles.syncCard}>
            <Text style={[typography.small, styles.syncText]}>
              {`Exporta ${plural(dayActivities.length, 'la actividad', 'las actividades')} de los ${dayLabel.toLowerCase()} de las próximas ${exportWeeks} semanas en un archivo .ics, para abrirlo donde quieras.`}
            </Text>
            <View style={styles.syncActions}>
              <PrimaryButton
                label={exporting ? 'Exportando…' : 'Exportar .ics'}
                onPress={exportICS}
                disabled={exporting}
                style={styles.syncButton}
              />
            </View>
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

        {dayActivities.length === 0 ? (
          <EmptyState
            emoji="🗓️"
            title={`Nada el ${dayLabel.toLowerCase()}`}
            hint="Agrega una materia, un turno o un entrenamiento y se repite todas las semanas en este día."
          />
        ) : (
          dayActivities.map((item) => (
            <Card key={item.id} accent={item.color} onPress={() => openEdit(item)} style={styles.activityCard}>
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
                </View>
                <TextButton label="Editar" tone="ghost" onPress={() => openEdit(item)} />
              </View>
            </Card>
          ))
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

const styles = themedStyles({
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  syncCard: { gap: 8 },
  syncText: { lineHeight: 18 },
  syncActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  syncButton: { flex: 0, alignSelf: 'flex-start', paddingHorizontal: spacing.xl },
  noticeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  upcomingTitle: { marginTop: 2 },
  activityCard: { paddingVertical: spacing.md },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  timeColumn: { width: 52, gap: 2 },
  timeValue: { fontSize: 14.5, fontWeight: '700', color: colors.text },
  timeMuted: { fontSize: 12.5, fontWeight: '500', color: colors.textMuted },
  activityBody: { flex: 1, gap: 3 },
  meta: { fontSize: 12.5 },
});
