import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
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
import { ColorPicker, PickerTrigger, TextField } from '../components/ui/inputs';
import { DateField } from '../components/ui/DateField';
import { TimeField } from '../components/ui/TimeField';
import { ConfirmSheet, OptionSheet, Sheet } from '../components/ui/Sheet';
import { TabBadge } from '../navigation/BottomTabBar';
import { BIRTHDAY_LEADS, dropReminder, syncBirthdayReminder } from '../services/reminders';
import { ageOn, daysUntilYearly, formatDateMedium, fromDateKey, nextYearlyOccurrence } from '../utils/dates';
import { plural } from '../utils/text';

const EMOJIS = ['🎂', '🎉', '🎈', '🎁', '⭐', '🌟', '🎧', '⚽', '📚', '🐱', '🐶', '✈️'];

const BLANK = () => ({
  name: '',
  emoji: '🎂',
  dateKey: '2000-01-01',
  time: '09:00',
  daysBefore: 0,
  color: colors.accent,
  notificationId: null,
});

function leadLabel(daysBefore) {
  const option = BIRTHDAY_LEADS.find((item) => item.value === daysBefore);
  return option ? option.label : 'El mismo día';
}

/** Age the person turns on their next birthday. */
function turnsNext(dateKey) {
  const birth = fromDateKey(dateKey);
  return ageOn(dateKey, nextYearlyOccurrence(birth.getMonth(), birth.getDate()));
}

function countdown(days) {
  if (days === 0) return '¡Hoy!';
  if (days === 1) return 'Mañana';
  if (days < 31) return `En ${days} días`;
  const months = Math.floor(days / 30);
  return `En ${months} ${months === 1 ? 'mes' : 'meses'}`;
}

export default function BirthdaysScreen({ navigation }) {
  const {
    birthdays,
    addBirthday,
    updateBirthday,
    removeBirthday,
    permission,
    requestNotifications,
    notificationsSupported,
  } = useAppData();

  const [sheet, setSheet] = useState(null);
  const [leadSheetOpen, setLeadSheetOpen] = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [saving, setSaving] = useState(false);

  const sorted = useMemo(
    () =>
      birthdays
        .map((item) => {
          const birth = fromDateKey(item.dateKey);
          const days = daysUntilYearly(birth.getMonth(), birth.getDate());
          const nextDate = nextYearlyOccurrence(birth.getMonth(), birth.getDate());
          return { ...item, days, turns: ageOn(item.dateKey, nextDate) };
        })
        .sort((a, b) => a.days - b.days),
    [birthdays],
  );

  const soon = sorted.filter((item) => item.days <= 7);
  const today = sorted.filter((item) => item.days === 0);
  const next = sorted[0];

  // The material-top-tabs API expects a function returning the badge element, so the
  // count stays inside the custom bar instead of a plain badge string.
  useEffect(() => {
    navigation.setOptions({
      tabBarBadge: soon.length ? () => <TabBadge count={soon.length} /> : undefined,
    });
  }, [navigation, soon.length]);

  const openCreate = () => setSheet({ mode: 'create', values: BLANK() });

  const openEdit = (item) =>
    setSheet({
      mode: 'edit',
      id: item.id,
      values: {
        name: item.name,
        emoji: item.emoji || '🎂',
        dateKey: item.dateKey,
        time: item.time || '09:00',
        daysBefore: item.daysBefore ?? 0,
        color: item.color || colors.accent,
        notificationId: item.notificationId || null,
      },
    });

  const setValue = (patch) => setSheet((prev) => ({ ...prev, values: { ...prev.values, ...patch } }));

  const canSave = Boolean(sheet) && !saving && Boolean(sheet.values.name.trim());

  const save = async () => {
    if (!canSave) return;
    const { mode, id, values } = sheet;
    const payload = {
      name: values.name.trim(),
      emoji: values.emoji,
      dateKey: values.dateKey,
      time: values.time,
      daysBefore: values.daysBefore,
      color: values.color,
    };

    setSaving(true);
    const result = await syncBirthdayReminder(payload, values.notificationId);
    setSaving(false);

    if (mode === 'edit') updateBirthday(id, { ...payload, notificationId: result.notificationId });
    else addBirthday({ ...payload, notificationId: result.notificationId });

    setNotice(result.notice);
    setSheet(null);
  };

  const confirmDelete = async () => {
    const target = birthdays.find((item) => item.id === confirmId);
    if (target) await dropReminder(target);
    removeBirthday(confirmId);
    setConfirmId(null);
  };

  return (
    <>
      <Screen
        title="Cumpleaños"
        subtitle="Se repiten cada año, con aviso anticipado."
        headerRight={<Pill label={plural(birthdays.length, 'cumpleaños')} />}
      >
        {notice ? (
          <View style={styles.noticeRow}>
            <Notice text={notice} tone="danger" />
            <TextButton label="OK" tone="ghost" onPress={() => setNotice(null)} />
          </View>
        ) : null}

        {notificationsSupported && permission.checked && !permission.granted && permission.canAskAgain ? (
          <Card accent={colors.warning}>
            <Text style={typography.bodyStrong}>Activa los avisos</Text>
            <Text style={[typography.small, styles.bannerText]}>
              Los cumpleaños se guardan igual, pero sin permiso no te llega el aviso anticipado.
            </Text>
            <View style={styles.bannerActions}>
              <PrimaryButton label="Permitir avisos" onPress={requestNotifications} style={styles.bannerButton} />
            </View>
          </Card>
        ) : null}

        <View style={styles.statsRow}>
          <Stat value={birthdays.length} label="en total" />
          <Stat value={soon.length} label="próximos 7 días" accent={colors.accent} />
          <Stat value={today.length} label="hoy" accent={today.length ? colors.warning : undefined} />
        </View>

        {next ? (
          <Card accent={next.color} onPress={() => openEdit(next)} style={styles.nextCard}>
            <Text style={typography.overline}>El que sigue</Text>
            <View style={styles.nextRow}>
              <Text style={styles.nextEmoji}>{next.emoji || '🎂'}</Text>
              <View style={styles.nextBody}>
                <Text style={typography.title} numberOfLines={1}>
                  {next.name}
                </Text>
                <Text style={typography.small}>{`${countdown(next.days)} · cumple ${next.turns}`}</Text>
              </View>
              <Pill label={`${next.days} d`} tone={next.days <= 7 ? 'accent' : 'neutral'} />
            </View>
          </Card>
        ) : null}

        <SectionTitle title="Todos" count={sorted.length} right={<TextButton label="+ Nuevo" onPress={openCreate} />} />

        {sorted.length === 0 ? (
          <EmptyState
            emoji="🎂"
            title="Sin cumpleaños aún"
            hint="Registra fechas y elige con cuántos días de anticipación quieres que te avise."
          />
        ) : (
          sorted.map((item) => <BirthdayRow key={item.id} item={item} onPress={() => openEdit(item)} />)
        )}
      </Screen>

      <Fab onPress={openCreate} />

      <Sheet
        visible={Boolean(sheet)}
        onClose={() => setSheet(null)}
        title={sheet?.mode === 'edit' ? 'Editar cumpleaños' : 'Nuevo cumpleaños'}
        subtitle="El aviso se repite todos los años en la fecha elegida."
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
            <PrimaryButton label={saving ? 'Guardando…' : 'Guardar'} onPress={save} disabled={!canSave} />
          </>
        }
      >
        {sheet ? (
          <>
            <TextField
              label="Nombre"
              value={sheet.values.name}
              onChangeText={(name) => setValue({ name })}
              placeholder="Ej. Camila"
              autoFocus
              maxLength={40}
            />
            <View style={styles.field}>
              <Text style={typography.overline}>Emoji</Text>
              <ChipScroller>
                {EMOJIS.map((emoji) => (
                  <Chip
                    key={emoji}
                    label={emoji}
                    compact
                    selected={sheet.values.emoji === emoji}
                    onPress={() => setValue({ emoji })}
                  />
                ))}
              </ChipScroller>
            </View>
            <DateField
              label="Fecha de nacimiento"
              value={sheet.values.dateKey}
              onChange={(dateKey) => setValue({ dateKey })}
              quick={false}
            />
            <Text style={styles.birthdayHint}>
              {`Cumple ${turnsNext(sheet.values.dateKey)} años el ${formatDateMedium(sheet.values.dateKey)}.`}
            </Text>
            <TimeField
              label="Hora del aviso"
              value={sheet.values.time}
              onChange={(time) => setValue({ time })}
              minuteStep={30}
            />
            <PickerTrigger
              label="Cuándo avisar"
              value={leadLabel(sheet.values.daysBefore)}
              onPress={() => setLeadSheetOpen(true)}
              trailing={sheet.values.notificationId ? <Text style={styles.armed}>● programado</Text> : null}
            />
            <ColorPicker value={sheet.values.color} onChange={(color) => setValue({ color })} />
          </>
        ) : null}
      </Sheet>

      <OptionSheet
        visible={leadSheetOpen}
        onClose={() => setLeadSheetOpen(false)}
        title="¿Cuándo te aviso?"
        options={BIRTHDAY_LEADS}
        value={sheet?.values.daysBefore}
        onSelect={(daysBefore) => setValue({ daysBefore })}
      />

      <ConfirmSheet
        visible={Boolean(confirmId)}
        onClose={() => setConfirmId(null)}
        onConfirm={confirmDelete}
        title="¿Eliminar cumpleaños?"
        message="Se borra de la lista y se cancela su aviso anual."
      />
    </>
  );
}

function BirthdayRow({ item, onPress }) {
  const isToday = item.days === 0;
  const soonish = item.days <= 7;
  const armed = Boolean(item.notificationId);

  return (
    <Card accent={item.color} onPress={onPress} style={styles.row}>
      <View style={styles.rowInner}>
        <View style={[styles.avatar, { backgroundColor: `${item.color || colors.accent}22` }]}>
          <Text style={styles.avatarEmoji}>{item.emoji || '🎂'}</Text>
        </View>
        <View style={styles.rowBody}>
          <Text style={typography.bodyStrong} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[typography.small, styles.rowMeta]} numberOfLines={1}>
            {`${formatDateMedium(item.dateKey)} · cumple ${item.turns}`}
          </Text>
          <View style={styles.pillRow}>
            <Pill label={countdown(item.days)} tone={isToday ? 'warning' : soonish ? 'accent' : 'neutral'} />
            {armed ? <Pill label={`🔔 ${leadLabel(item.daysBefore)}`} tone="accent" /> : null}
            {!armed ? <Pill label="sin aviso" /> : null}
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = themedStyles({
  noticeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  bannerText: { marginTop: 4, lineHeight: 18 },
  bannerActions: { marginTop: spacing.md, flexDirection: 'row' },
  bannerButton: { flex: 0, alignSelf: 'flex-start', paddingHorizontal: spacing.xl },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  nextCard: { gap: 2 },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs },
  nextEmoji: { fontSize: 28 },
  nextBody: { flex: 1, gap: 2 },
  field: { gap: spacing.sm },
  birthdayHint: { fontSize: 12, lineHeight: 17, color: colors.textMuted },
  armed: { fontSize: 11, fontWeight: '700', color: colors.accent },
  row: { paddingVertical: spacing.md },
  rowInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 21 },
  rowBody: { flex: 1, gap: 3 },
  rowMeta: { fontSize: 12.5 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 2 },
});


