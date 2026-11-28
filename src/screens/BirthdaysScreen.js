import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { themedStyles, colors, radius, spacing, typography } from '../theme/theme';
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
import { ConfirmSheet } from '../components/ui/Sheet';
import { BirthdayEditor } from '../components/BirthdayEditor';
import { TabBadge } from '../navigation/BottomTabBar';
import {
  birthdayLeadLabel,
  blankBirthday,
  deleteBirthdayRecord,
  saveBirthdayRecord,
} from '../services/birthdays';
import { ageOn, daysUntilYearly, formatDateMedium, fromDateKey, nextYearlyOccurrence } from '../utils/dates';
import { plural } from '../utils/text';

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

  const openCreate = () => setSheet({ mode: 'create', values: blankBirthday(colors.amber) });

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

  const save = async () => {
    if (!sheet || saving || !sheet.values.name.trim()) return;

    setSaving(true);
    const result = await saveBirthdayRecord({
      mode: sheet.mode,
      id: sheet.id,
      values: sheet.values,
      addBirthday,
      updateBirthday,
    });
    setSaving(false);
    setNotice(result.notice);
    if (result.status !== 'write-failed') setSheet(null);
  };

  const confirmDelete = async () => {
    await deleteBirthdayRecord({ id: confirmId, birthdays, removeBirthday });
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

      <BirthdayEditor
        sheet={sheet}
        saving={saving}
        onClose={() => setSheet(null)}
        onChange={setValue}
        onSave={save}
        onRequestDelete={(id) => {
          setConfirmId(id);
          setSheet(null);
        }}
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
            {armed ? <Pill label={`🔔 ${birthdayLeadLabel(item.daysBefore)}`} tone="accent" /> : null}
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


