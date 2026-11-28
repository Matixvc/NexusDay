import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { AccessibilityInfo, AppState, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { themedStyles, colors, layout, spacing, typography } from '../theme/theme';
import { useAppData } from '../context/AppDataContext';
import {
  Card,
  Button,
  PrimaryButton,
  TextButton,
} from '../components/ui/primitives';
import { SearchField, SearchResults } from '../components/ui/SearchField';
import { buildDashboard, millisecondsToNextMinute } from '../services/dashboard';
import { searchEverything } from '../services/search';
import { HeaderIconButton } from '../components/ui/HeaderIconButton';
import { AppHeader } from '../components/ui/AppHeader';
import { useAccentTheme } from '../context/ThemeContext';
import { createRoutineToggleGuard, eventDestination } from '../services/homeActions';
import { success as successHaptic } from '../services/haptics';
import { AnytimeSection, CurrentActivitySection, TimedAgendaSection } from './home/DaySections';

/** Nombre configurado en app.json, para que los textos sigan un rename sin tocar código. */
const APP_NAME = Constants.expoConfig?.name || 'NexusDay';
const SCHEDULE_ART = require('../../assets/nex/schedule/nex-schedule-compact.jpg');
const FREE_DAY_ART = require('../../assets/nex/schedule/nex-schedule-free-day.jpg');
const NEX_HOME_ART = require('../../assets/nex/u11/backgrounds/nex-flow.jpg');

export default function HomeScreen({ navigation }) {
  const {
    activities,
    events,
    routines,
    birthdays,
    notes,
    settings,
    userName,
    permission,
    requestNotifications,
    notificationsSupported,
    toggleRoutineCompletion,
  } = useAppData();

  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const { surfaceId } = useAccentTheme();
  const [query, setQuery] = useState('');
  const [clockTimestamp, setClockTimestamp] = useState(() => Date.now());
  const [pendingRoutineIds, setPendingRoutineIds] = useState(() => new Set());
  const [routineFeedback, setRoutineFeedback] = useState(null);

  useFocusEffect(
    useCallback(() => {
      let timer;
      let disposed = false;
      const refreshClock = () => {
        if (disposed) return;
        const now = Date.now();
        setClockTimestamp(now);
        timer = setTimeout(refreshClock, millisecondsToNextMinute(now) + 20);
      };

      refreshClock();
      const subscription = AppState.addEventListener('change', (state) => {
        if (state !== 'active' || disposed) return;
        clearTimeout(timer);
        refreshClock();
      });

      return () => {
        disposed = true;
        clearTimeout(timer);
        subscription.remove();
      };
    }, []),
  );

  const data = useMemo(
    () => buildDashboard({ activities, events, birthdays, notes, routines, now: new Date(clockTimestamp) }),
    [activities, events, birthdays, notes, routines, clockTimestamp],
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
  const routineGuard = useMemo(() => createRoutineToggleGuard({
    toggleRoutineCompletion,
    onPendingChange: (id, pending) => setPendingRoutineIds((current) => {
      const next = new Set(current);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    }),
  }), [toggleRoutineCompletion]);

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
  const goToSettings = useCallback(() => navigation.navigate('Ajustes'), [navigation]);
  const goToSchedule = useCallback(() => navigation.navigate('Horario'), [navigation]);
  const goToRoutines = useCallback(() => navigation.navigate('Mi rutina'), [navigation]);
  const openDayItem = useCallback((item) => {
    if (item.kind === 'event') {
      const destination = eventDestination({ id: item.sourceId, dateKey: item.dateKey });
      navigation.navigate(destination.route, destination.params);
      return;
    }
    navigation.navigate('Horario', { focusId: item.sourceId });
  }, [navigation]);
  const toggleRoutineFromHome = useCallback(async (item) => {
    setRoutineFeedback(null);
    const result = await routineGuard.toggle(item.sourceId, data.today);
    if (result.status === 'busy') return;
    if (!result.ok) {
      const message = 'No se pudo guardar el cambio de rutina.';
      setRoutineFeedback(message);
      AccessibilityInfo.announceForAccessibility(message);
      return;
    }
    const message = result.status === 'completed' ? 'Rutina completada.' : 'Rutina pendiente otra vez.';
    setRoutineFeedback(message);
    successHaptic();
    AccessibilityInfo.announceForAccessibility(message);
  }, [data.today, routineGuard]);

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
          <Card variant="featured" style={styles.organizeCard} accessibilityLabel="Organizar mi día">
            <Text style={[typography.title, styles.organizeTitle]}>Organizar mi día</Text>
            <Text style={[typography.small, styles.organizeHint]}>Ajusta tu semana o tus rutinas desde un mismo lugar.</Text>
            <View style={styles.organizeActions}>
              <Button label="Mi horario semanal" icon="schedule" onPress={goToSchedule} style={styles.organizeButton} />
              <Button label="Mis rutinas" icon="checkCircle" variant="secondary" onPress={goToRoutines} style={styles.organizeButton} />
            </View>
          </Card>
          <CurrentActivitySection
            current={data.currentActivity}
            concurrent={data.concurrentActivities}
            dayState={data.dayState}
            weekdayLabel={data.weekdayLabel}
            todayCommitments={data.todayCommitments}
            artwork={surfaceId === 'nex'
              ? data.dayState === 'free' ? FREE_DAY_ART : data.currentActivity ? NEX_HOME_ART : SCHEDULE_ART
              : null}
            onOpenSchedule={goToSchedule}
            onManageRoutines={goToRoutines}
          />

          <TimedAgendaSection
            items={data.nextTimedItems}
            today={data.today}
            onOpenItem={openDayItem}
            timeColumnWidth={Math.ceil(66 * Math.max(1, Math.min(fontScale, 1.5)))}
          />

          <AnytimeSection
            items={data.anytimeItems}
            pendingIds={pendingRoutineIds}
            reduceMotion={settings?.reduceMotion === true}
            onToggleRoutine={toggleRoutineFromHome}
            onOpenSchedule={goToSchedule}
          />

          {routineFeedback ? (
            <Text style={[typography.caption, styles.routineFeedback]}>{routineFeedback}</Text>
          ) : null}

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
  routineFeedback: { color: colors.textSecondary, paddingHorizontal: spacing.xs },
  bannerText: { marginTop: 4, lineHeight: 18 },
  bannerActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  bannerButton: { flex: 0, alignSelf: 'flex-start', paddingHorizontal: spacing.xl },
  organizeCard: { borderColor: colors.violet, paddingVertical: spacing.lg },
  organizeTitle: { color: colors.text },
  organizeHint: { marginTop: spacing.xs, maxWidth: 360 },
  organizeActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  organizeButton: { flexGrow: 1, flexBasis: 150 },
});
