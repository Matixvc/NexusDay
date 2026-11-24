import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { themedStyles, colors, layout, radius, spacing, typography } from '../theme/theme';
import { useAppData } from '../context/AppDataContext';
import {
  Card,
  Pill,
  PrimaryButton,
  SectionTitle,
  TextButton,
} from '../components/ui/primitives';
import { SearchField, SearchResults } from '../components/ui/SearchField';
import { buildDashboard } from '../services/dashboard';
import { searchEverything } from '../services/search';
import { formatDateShort, formatTime, relativeDayLabel } from '../utils/dates';
import { Icon } from '../components/Icon';
import { HeaderIconButton } from '../components/ui/HeaderIconButton';
import { AppHeader } from '../components/ui/AppHeader';

/** Nombre configurado en app.json, para que los textos sigan un rename sin tocar código. */
const APP_NAME = Constants.expoConfig?.name || 'NexusDay';

export default function HomeScreen({ navigation }) {
  const {
    activities,
    events,
    birthdays,
    notes,
    settings,
    userName,
    permission,
    requestNotifications,
    notificationsSupported,
  } = useAppData();

  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const data = useMemo(
    () => buildDashboard({ activities, events, birthdays, notes }),
    [activities, events, birthdays, notes],
  );

  // Real-time: the three primary domains reachable from the dashboard, ranked by relevance.
  const search = useMemo(
    () => searchEverything(query, { notes, events, activities }),
    [query, notes, events, activities],
  );
  const searching = query.trim().length > 0;

  const showPermissionCard = notificationsSupported && permission.checked && !permission.granted;
  // v1.1 name (written by the tutorial) wins; the v1.0 profile field stays as a fallback.
  const name = (userName || settings?.displayName || '').trim();
  const greeting = name ? `¡Hola, ${name}!` : data.greeting;
  const currentTime = `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;
  const remainingClasses = data.todayActivities.filter((item) => String(item.end || item.start) > currentTime);
  const scheduleItems = (remainingClasses.length ? remainingClasses : data.todayActivities).slice(0, 3);
  const upcomingEvents = data.upcomingEvents.slice(0, 3);

  /** One tap: jump to the section and let it highlight the exact item. */
  const openResult = useCallback(
    (item) => {
      setQuery('');
      navigation.navigate(item.route, { focusId: item.id });
    },
    [navigation],
  );

  // Stable navigators for the one-off buttons below. The access grid does not use a callback
  // at all: `QuickCard` navigates by itself, so a fresh arrow on every render would only
  // defeat its memoisation.
  const goToAgenda = useCallback(() => navigation.navigate('Agenda'), [navigation]);
  const goToSettings = useCallback(() => navigation.navigate('Ajustes'), [navigation]);

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
        <AppHeader
          title={greeting}
          subtitle={data.dateLabel}
          variant="large"
          headerRight={<HeaderIconButton icon="settings" label="Abrir Ajustes" onPress={goToSettings} />}
        />
        {searching ? null : <Text style={[typography.overline, styles.eyebrow]}>DÍA A DÍA</Text>}

        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar notas, clases o eventos..."
        />

        {searching ? (
          <SearchResults
            items={search.items}
            total={search.total}
            query={search.query}
            onSelect={openResult}
          />
        ) : (
          <>
          <View style={styles.scheduleCard}>
            <View style={styles.scheduleHeading}>
              <View style={styles.scheduleTitleWrap}>
                <Text style={[typography.overline, styles.scheduleKicker]}>TU SEMANA, EN CONTEXTO</Text>
                <Text style={[typography.h2, styles.scheduleTitle]} accessibilityRole="header">Horario · {data.weekdayLabel}</Text>
              </View>
              <Pressable onPress={() => navigation.navigate('Horario')} accessibilityRole="button" accessibilityLabel="Abrir horario semanal" style={styles.scheduleLink}>
                <Icon name="arrow-up-right" size={20} color={colors.accent} />
              </Pressable>
            </View>

            {activities.length === 0 ? (
              <View style={styles.scheduleEmpty}>
                <Icon name="calendar" size={24} color={colors.accent} />
                <View style={styles.scheduleEmptyCopy}>
                  <Text style={typography.bodyStrong}>Tu semana está libre</Text>
                  <Text style={typography.small}>Agrega tus clases para tenerlas a mano cada día.</Text>
                </View>
                <TextButton label="Configurar" onPress={() => navigation.navigate('Horario')} />
              </View>
            ) : data.todayActivities.length === 0 && data.suspendedToday.length > 0 ? (
              <View style={styles.scheduleEmpty}>
                <Icon name="pause" size={24} color={colors.accent} />
                <View style={styles.scheduleEmptyCopy}>
                  <Text style={typography.bodyStrong}>Clases suspendidas hoy</Text>
                  <Text style={typography.small}>El horario semanal conserva tus clases; puedes reactivarlas desde aquí.</Text>
                </View>
                <TextButton label="Ver" onPress={() => navigation.navigate('Horario')} />
              </View>
            ) : data.todayActivities.length === 0 ? (
              <View style={styles.scheduleEmpty}>
                <Icon name="sun" size={24} color={colors.accent} />
                <View style={styles.scheduleEmptyCopy}>
                  <Text style={typography.bodyStrong}>Sin clases hoy</Text>
                  <Text style={typography.small}>Tu próximo día de clases sigue en el horario semanal.</Text>
                </View>
              </View>
            ) : (
              <View style={styles.classList}>
                {scheduleItems.map((item, index) => {
                  const inProgress = item.start <= currentTime && String(item.end || item.start) > currentTime;
                  const finished = !remainingClasses.length;
                  return (
                    <View key={item.id} style={[styles.classRow, index ? styles.classDivider : null]}>
                      <View style={styles.classTime}>
                        <Text style={[typography.tabular, styles.classTimeText]}>{item.start}</Text>
                        <Text style={typography.caption}>{item.end}</Text>
                      </View>
                      <View style={[styles.classMarker, { backgroundColor: item.color || colors.accent }]} />
                      <View style={styles.classCopy}>
                        <Text style={typography.bodyStrong} numberOfLines={1}>{item.title}</Text>
                        <Text style={typography.caption} numberOfLines={1}>{item.location || 'Clase'}</Text>
                      </View>
                      {inProgress ? <Pill label="En curso" tone="accent" /> : finished ? null : index === 0 ? <Pill label="Siguiente" tone="accent" /> : null}
                    </View>
                  );
                })}
                <TextButton label="Ver horario semanal" onPress={() => navigation.navigate('Horario')} />
              </View>
            )}
          </View>

          <SectionTitle title="Próximos eventos" count={upcomingEvents.length} right={<TextButton label="Ver calendario" onPress={goToAgenda} />} />

          {upcomingEvents.length === 0 ? (
            <View style={styles.eventsEmpty}>
              <Text style={typography.small}>No tienes eventos próximos en la agenda.</Text>
            </View>
          ) : upcomingEvents.map((item) => (
            <Card key={item.id} accent={item.color} onPress={goToAgenda} style={styles.nextCard}>
              <View style={styles.nextRow}>
                <Text style={[styles.nextTime, typography.tabular]}>{item.dateKey === data.today ? formatTime(item.time) : formatDateShort(item.dateKey)}</Text>
                <View style={styles.nextBody}>
                  <Text style={typography.bodyStrong} numberOfLines={1}>{item.title}</Text>
                  <Text style={typography.caption} numberOfLines={1}>{relativeDayLabel(item.dateKey)}</Text>
                </View>
                <Icon name="chevron-right" size={18} color={colors.textMuted} />
              </View>
            </Card>
          ))}

          {showPermissionCard ? (
            <Card accent={colors.warning}>
              <Text style={typography.bodyStrong}>
                {permission.canAskAgain ? 'Activa los avisos' : 'Avisos bloqueados'}
              </Text>
              <Text style={[typography.small, styles.bannerText]}>
                {permission.canAskAgain
                  ? 'Con permisos la app te recuerda tus eventos, clases y cumpleaños.'
                  : `Actívalos desde Ajustes → Aplicaciones → ${APP_NAME} → Notificaciones.`}
              </Text>
              <View style={styles.bannerActions}>
                <PrimaryButton label="Permitir avisos" onPress={requestNotifications} style={styles.bannerButton} />
                <TextButton label="Ver ajustes" tone="ghost" onPress={goToSettings} />
              </View>
            </Card>
          ) : null}

          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = themedStyles({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: layout.gutter,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },

  eyebrow: { color: colors.accent, letterSpacing: 1.2, marginTop: -spacing.sm },
  scheduleCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    overflow: 'hidden',
  },
  scheduleHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  scheduleTitleWrap: { flex: 1, gap: spacing.xs },
  scheduleKicker: { color: colors.accent, letterSpacing: 0.9 },
  scheduleTitle: { color: colors.text },
  scheduleLink: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  scheduleEmpty: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  scheduleEmptyCopy: { flex: 1, gap: spacing.xs },
  classList: { gap: spacing.sm },
  classRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  classDivider: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  classTime: { width: 48, alignItems: 'flex-start', gap: 1 },
  classTimeText: { color: colors.accent },
  classMarker: { width: 3, height: 38, borderRadius: radius.pill },
  classCopy: { flex: 1, gap: 2 },
  eventsEmpty: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt },
  bannerText: { marginTop: 4, lineHeight: 18 },
  bannerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  bannerButton: { flex: 0, alignSelf: 'flex-start', paddingHorizontal: spacing.xl },

  nextCard: { paddingVertical: spacing.md },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  nextTime: { fontSize: 15.5, fontWeight: '700', color: colors.text, width: 54 },
  nextBody: { flex: 1, gap: 2 },

  pressed: { opacity: 0.7 },
  bannerCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
});
