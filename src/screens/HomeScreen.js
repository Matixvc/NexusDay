import { memo, useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { themedStyles, colors, layout, radius, spacing, typography } from '../theme/theme';
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
import { SearchField, SearchResults } from '../components/ui/SearchField';
import { buildDashboard } from '../services/dashboard';
import { searchEverything } from '../services/search';
import { tap as tapHaptic } from '../services/haptics';
import { formatMoney } from '../utils/money';
import { plural } from '../utils/text';
import { Icon } from '../components/Icon';

/** Nombre configurado en app.json, para que los textos sigan un rename sin tocar código. */
const APP_NAME = Constants.expoConfig?.name || 'NexusDay';

/**
 * Nombres de iconos de Lucide para las tarjetas de acceso rápido.
 * Se usa el componente Icon centralizado en lugar de emojis.
 */
const QUICK_ACCESS_ICONS = {
  Horario: 'schedule',
  Agenda: 'calendar',
  'Cumpleaños': 'birthdays',
  Notas: 'note',
  Hábitos: 'habit',
  Gastos: 'money',
  'Nexus AI': 'ai',
  Ajustes: 'settings',
};

/**
 * La línea resumen del banner. Se resuelve con frases completas en lugar de un
 * `1 cosa(s)`: así el número y el sustantivo siempre concuerdan.
 */
function commitmentSummary(count) {
  if (!count) return 'No tienes compromisos pendientes para hoy.';
  return `Tienes ${plural(count, 'compromiso pendiente', 'compromisos pendientes')} para hoy.`;
}

/**
 * Accesos rápidos: un toque abre la sección correspondiente del pager deslizable.
 * Los colores son moderados y se derivan del acento activo para no saturar la UI.
 */
function buildQuickAccess(data) {
  const accent = colors.accent;
  return [
    { route: 'Horario', icon: QUICK_ACCESS_ICONS.Horario, title: 'Horario semanal', hint: `${data.todayActivities.length} actividades hoy`, color: accent },
    { route: 'Agenda', icon: QUICK_ACCESS_ICONS.Agenda, title: 'Agenda', hint: 'Eventos y recordatorios', color: accent },
    { route: 'Cumpleaños', icon: QUICK_ACCESS_ICONS['Cumpleaños'], title: 'Cumpleaños', hint: 'Próximos cumpleaños', color: accent },
    { route: 'Notas', icon: QUICK_ACCESS_ICONS.Notas, title: 'Notas', hint: 'Texto, voz y adjuntos', color: accent },
    { route: 'Hábitos', icon: QUICK_ACCESS_ICONS.Hábitos, title: 'Hábitos', hint: 'Rachas y progreso', color: accent },
    { route: 'Gastos', icon: QUICK_ACCESS_ICONS.Gastos, title: 'Gastos', hint: 'Registro de gastos', color: accent },
    { route: 'Nexus AI', icon: QUICK_ACCESS_ICONS['Nexus AI'], title: 'Nexus AI', hint: 'Asistente local', color: accent },
    { route: 'Ajustes', icon: QUICK_ACCESS_ICONS.Ajustes, title: 'Ajustes', hint: 'Tema y preferencias', color: accent },
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
    userName,
    permission,
    requestNotifications,
    notificationsSupported,
  } = useAppData();

  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');

  const data = useMemo(
    () => buildDashboard({ activities, events, birthdays, notes, habits, expenses }),
    [activities, events, birthdays, notes, habits, expenses],
  );

  // Real-time: the four collections the dashboard can reach, ranked by relevance.
  const search = useMemo(
    () => searchEverything(query, { notes, events, habits, expenses }),
    [query, notes, events, habits, expenses],
  );
  const searching = query.trim().length > 0;

  const quickAccess = useMemo(() => buildQuickAccess(data), [data]);
  const cardWidth = (width - layout.gutter * 2 - spacing.md) / 2;
  const showPermissionCard = notificationsSupported && permission.checked && !permission.granted;
  // v1.1 name (written by the tutorial) wins; the v1.0 profile field stays as a fallback.
  const name = (userName || settings?.displayName || '').trim();
  const greeting = name ? `¡Hola, ${name}!` : data.greeting;

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
        {/* El héroe solo existe mientras se navega. Buscando, se oculta para que los resultados
            empiecen arriba sin competir con la imagen. */}
        {searching ? null : (
          <View style={styles.hero}>
            <View style={styles.heroBody}>
              <Text style={[typography.overline, styles.heroDate]} numberOfLines={1}>
                {data.dateLabel}
              </Text>
              <Text style={typography.display} numberOfLines={2}>
                {greeting}
              </Text>
              <Text style={[typography.small, styles.heroHint]} numberOfLines={3}>
                {name ? `${data.greeting}. ` : ''}
                {commitmentSummary(data.todayCommitments)}
              </Text>
              <View style={styles.heroPills}>
                <Pill label={`${data.todayActivities.length} en el horario`} tone="accent" />
                <Pill label={`${data.todayEvents.length} en la agenda`} tone="accent" />
                {data.pendingHabits.length ? (
                  <Pill label={plural(data.pendingHabits.length, 'hábito pendiente', 'hábitos pendientes')} />
                ) : (
                  <Pill label="Hábitos al día" />
                )}
              </View>
            </View>
          </View>
        )}

        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar notas, asignaturas, eventos o gastos..."
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
          {/* Orden del dashboard (pedido explícito):
              1º Barra de búsqueda global (arriba, ya renderizada)
              2º Accesos rápidos
              3º Próximas actividades / eventos
              4º Bloques de resumen: Gastado Hoy · Notas Fijas · Pendientes
            Lo que se usa todos los días queda arriba; las cifras, al final del scroll. */}
          <SectionTitle title="Accesos rápidos" count={quickAccess.length} right={<Pill label="1 toque" />} />

          <View style={styles.grid}>
            {quickAccess.map((item) => (
              <MemoQuickCard key={item.route} item={item} width={cardWidth} navigation={navigation} />
            ))}
          </View>

          <SectionTitle
            title="Próximas actividades"
            count={data.nextUp.length}
            right={<TextButton label="Ver agenda" onPress={goToAgenda} />}
          />

          {data.nextUp.length === 0 ? (
            <EmptyState
              emoji="☕"
              title="Nada por delante"
              hint="Agenda un evento o registra una actividad en el horario y va a aparecer aquí."
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

          <SectionTitle title="Resumen de hoy" />

          <View style={styles.statsRow}>
            <Stat value={formatMoney(data.spentToday)} label="Gastado hoy" accent={colors.accent} />
            <Stat value={data.pinnedNotes} label="Notas fijadas" />
            <Stat value={data.pendingHabits.length} label="Pendientes" />
          </View>

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

          <Notice text="Desliza a los costados para cambiar de sección, o toca una tarjeta para ir directo." />
          </>
        )}
      </ScrollView>
    </View>
  );
}

/**
 * One tile of the access grid.
 *
 * It receives the `navigation` object instead of an `onPress` callback on purpose: an
 * inline arrow would be a new function on every render and `memo` could never hit. With
 * `navigation` being stable, the eight tiles only reconcile when `item` or `width` changes.
 */
function QuickCard({ item, width, navigation }) {
  const handlePress = useCallback(() => {
    tapHaptic();
    navigation.navigate(item.route);
  }, [item.route, navigation]);

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.hint}`}
      style={({ pressed }) => [styles.quickCard, { width }, pressed ? styles.pressed : null]}
    >
      <View style={[styles.quickIcon, { borderColor: item.color }]}>
        <Icon name={item.icon} size={20} color={item.color} />
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

const MemoQuickCard = memo(QuickCard);

const styles = themedStyles({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: layout.gutter,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },

  hero: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    minHeight: 210,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  heroBody: { gap: spacing.sm },
  heroDate: { color: colors.accent, fontWeight: '700' },
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
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  pressed: { opacity: 0.7 },
  quickIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
});
