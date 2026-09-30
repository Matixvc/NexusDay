import { useMemo } from 'react';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { colors, layout, radius, shadow, spacing, typography } from '../theme/theme';
import { useAppData } from '../context/AppDataContext';
import {
  Card,
  EmptyState,
  Notice,
  Pill,
  PrimaryButton,
  SectionTitle,
  Stat,
  TextButton,
} from '../components/ui/primitives';
import { buildDashboard } from '../services/dashboard';
import { formatMoney } from '../utils/money';

/** `assets/welcome-bg.jpg` is the decorative hero of the dashboard. */
const WELCOME_BG = require('../../assets/welcome-bg.jpg');

/** Nombre configurado en app.json, para que los textos sigan un rename sin tocar código. */
const APP_NAME = Constants.expoConfig?.name || 'NexusDay';

/** Quick access cards: one tap opens the matching section of the swipeable pager. */
function buildQuickAccess(data) {
  return [
    { route: 'Horario', emoji: '📅', title: 'Horario semanal', hint: `${data.todayActivities.length} hoy`, color: colors.accent },
    { route: 'Notas', emoji: '📝', title: 'Bloc de notas', hint: `${data.notesCount} guardadas`, color: '#a3e635' },
    { route: 'Agenda', emoji: '🗓️', title: 'Calendario', hint: `${data.upcomingEvents.length} próximos`, color: '#8b5cf6' },
    {
      route: 'Cumpleaños',
      emoji: '🎂',
      title: 'Cumpleaños',
      hint: data.upcomingBirthdays.length ? `${data.upcomingBirthdays.length} cerca` : 'Sin avisos',
      color: '#ec4899',
    },
    {
      route: 'Hábitos',
      emoji: '💪',
      title: 'Hábitos',
      hint: data.pendingHabits.length ? `${data.pendingHabits.length} pendientes` : 'Todo al día',
      color: '#f59e0b',
    },
    { route: 'Gastos', emoji: '💰', title: 'Gastos rápidos', hint: formatMoney(data.spentToday), color: '#38bdf8' },
    { route: 'Nexus AI', emoji: '🤖', title: 'Nexus AI', hint: 'Asistente local', color: '#4fd1c5' },
    { route: 'Ajustes', emoji: '⚙️', title: 'Ajustes', hint: 'Permisos y datos', color: '#94a3b8' },
  ];
}

export default function HomeScreen({ navigation }) {
  const {
    activities,
    events,
    birthdays,
    notes,
    habits,
    expenses,
    settings,
    permission,
    requestNotifications,
    notificationsSupported,
  } = useAppData();

  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const data = useMemo(
    () => buildDashboard({ activities, events, birthdays, notes, habits, expenses }),
    [activities, events, birthdays, notes, habits, expenses],
  );

  const quickAccess = useMemo(() => buildQuickAccess(data), [data]);
  const cardWidth = (width - layout.gutter * 2 - spacing.md) / 2;
  const showPermissionCard = notificationsSupported && permission.checked && !permission.granted;
  const name = settings?.displayName?.trim();

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: spacing.xxxl + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ImageBackground source={WELCOME_BG} style={styles.hero} imageStyle={styles.heroImage} resizeMode="cover">
          <View style={styles.heroOverlay} />
          <View style={styles.heroBody}>
            <Text style={[typography.overline, styles.heroDate]} numberOfLines={1}>
              {data.dateLabel}
            </Text>
            <Text style={typography.display} numberOfLines={2}>
              {name ? `${data.greeting}, ${name}` : data.greeting}
            </Text>
            <Text style={[typography.small, styles.heroHint]} numberOfLines={2}>
              {data.nextUp.length
                ? `Tenés ${data.nextUp.length} cosa(s) por delante hoy.`
                : 'No tenés nada agendado por ahora.'}
            </Text>
            <View style={styles.heroPills}>
              <Pill label={`${data.todayActivities.length} en el horario`} tone="accent" />
              {data.pendingHabits.length ? (
                <Pill label={`${data.pendingHabits.length} hábito(s) pendiente(s)`} />
              ) : (
                <Pill label="Hábitos al día" />
              )}
            </View>
          </View>
        </ImageBackground>

        <View style={styles.statsRow}>
          <Stat value={formatMoney(data.spentToday)} label="Gastado hoy" accent={colors.accent} />
          <Stat value={data.notesCount} label="Notas" />
          <Stat value={data.pendingHabits.length} label="Pendientes" />
        </View>

        {showPermissionCard ? (
          <Card accent={colors.warning}>
            <Text style={typography.bodyStrong}>
              {permission.canAskAgain ? 'Activá los avisos' : 'Avisos bloqueados'}
            </Text>
            <Text style={[typography.small, styles.bannerText]}>
              {permission.canAskAgain
                ? 'Con permisos el app te recuerda tus eventos, clases y cumpleaños.'
                : `Dalos desde Ajustes → Aplicaciones → ${APP_NAME} → Notificaciones.`}
            </Text>
            <View style={styles.bannerActions}>
              <PrimaryButton label="Permitir avisos" onPress={requestNotifications} style={styles.bannerButton} />
              <TextButton label="Ver ajustes" tone="ghost" onPress={() => navigation.navigate('Ajustes')} />
            </View>
          </Card>
        ) : null}
        <SectionTitle
          title="Próximas actividades"
          count={data.nextUp.length}
          right={<TextButton label="Ver agenda" onPress={() => navigation.navigate('Agenda')} />}
        />

        {data.nextUp.length === 0 ? (
          <EmptyState
            emoji="☕"
            title="Nada por delante"
            hint="Agendá un evento o cargá una actividad en el horario y va a aparecer acá."
          />
        ) : (
          data.nextUp.map((item) => (
            <Card
              key={item.id}
              accent={item.color}
              onPress={() => navigation.navigate(item.kind === 'event' ? 'Agenda' : 'Horario')}
              style={styles.nextCard}
            >
              <View style={styles.nextRow}>
                <Text style={[styles.nextTime, typography.tabular]}>{item.time}</Text>
                <View style={styles.nextBody}>
                  <Text style={typography.bodyStrong} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={typography.caption} numberOfLines={1}>
                    {item.detail}
                  </Text>
                </View>
                <Pill
                  label={item.kind === 'event' ? 'Agenda' : 'Horario'}
                  tone={item.kind === 'event' ? 'accent' : 'neutral'}
                />
              </View>
            </Card>
          ))
        )}

        <SectionTitle title="Accesos rápidos" count={quickAccess.length} right={<Pill label="1 toque" />} />

        <View style={styles.grid}>
          {quickAccess.map((item) => (
            <QuickCard
              key={item.route}
              item={item}
              width={cardWidth}
              onPress={() => navigation.navigate(item.route)}
            />
          ))}
        </View>

        <Notice text="Deslizá a los costados para cambiar de sección, o tocá una tarjeta para ir directo." />
      </ScrollView>
    </View>
  );
}

function QuickCard({ item, width, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.hint}`}
      style={({ pressed }) => [styles.quickCard, { width }, pressed ? styles.pressed : null]}
    >
      <View style={[styles.quickIcon, { backgroundColor: `${item.color}22`, borderColor: item.color }]}>
        <Text style={styles.quickEmoji}>{item.emoji}</Text>
      </View>
      <Text style={typography.bodyStrong} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={typography.caption} numberOfLines={1}>
        {item.hint}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: layout.gutter, paddingBottom: spacing.xxxl, gap: spacing.lg },

  hero: {
    minHeight: 200,
    justifyContent: 'flex-end',
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  heroImage: { borderRadius: radius.xl },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6, 6, 8, 0.62)' },
  heroBody: { padding: spacing.lg, gap: spacing.sm },
  heroDate: { color: colors.accent },
  heroHint: { color: colors.textSecondary },
  heroPills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },

  statsRow: { flexDirection: 'row', gap: spacing.sm },
  bannerText: { marginTop: 4, lineHeight: 18 },
  bannerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  bannerButton: { flex: 0, alignSelf: 'flex-start', paddingHorizontal: spacing.xl },

  nextCard: { paddingVertical: spacing.md },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  nextTime: { fontSize: 15.5, fontWeight: '700', color: colors.text, width: 54 },
  nextBody: { flex: 1, gap: 2 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  quickCard: {
    ...shadow.card,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  pressed: { opacity: 0.7 },
  quickIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickEmoji: { fontSize: 20 },
});
