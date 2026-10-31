import { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Screen, Card, Pill, SectionTitle } from '../components/ui/primitives';
import { themedStyles, colors, radius, spacing, typography } from '../theme/theme';
import { useTheme } from '../context/ThemeContext';
import { isDevModeEnabled, DEV_NAMESPACE } from '../services/devMode';
import { TestLog } from '../components/devMode/TestLog';

const CATEGORIES = [
  { id: 'notifications', name: 'Notificaciones', description: 'Permisos, canales y programaciÃ³n local.' },
  { id: 'security', name: 'Seguridad y privacidad', description: 'BiometrÃ­a, bloqueo y datos protegidos.' },
  { id: 'storage', name: 'Almacenamiento', description: 'AsyncStorage, namespaces y limpieza de pruebas.' },
  { id: 'tasks', name: 'Tareas y hÃ¡bitos', description: 'Colecciones, persistencia y sincronizaciÃ³n.' },
  { id: 'calendar', name: 'Calendario', description: 'Eventos, fechas y recordatorios.' },
  { id: 'audio', name: 'Audio y vibraciÃ³n', description: 'GrabaciÃ³n, reproducciÃ³n y feedback hÃ¡ptico.' },
  { id: 'navigation', name: 'NavegaciÃ³n', description: 'Rutas, pestaÃ±as y deep links.' },
  { id: 'theme', name: 'Temas', description: 'Acentos, superficies y repintado.' },
];

export function DeveloperModeScreen() {
  const theme = useTheme();
  const [status, setStatus] = useState({
    notifications: 'No comprobado',
    biometrics: 'No comprobado',
    storage: 'No comprobado',
  });
  const [logs] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const next = { notifications: 'No comprobado', biometrics: 'No comprobado', storage: 'No comprobado' };
      try {
        const perm = await Notifications.getPermissionsAsync();
        next.notifications = perm?.granted ? 'Concedido' : 'No concedido';
      } catch (_error) {
        next.notifications = 'Error al consultar';
      }
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        next.biometrics = hasHardware ? (enrolled ? 'Disponible' : 'Sin huellas registradas') : 'Sin hardware';
      } catch (_error) {
        next.biometrics = 'Error al consultar';
      }
      try {
        const keys = await AsyncStorage.getAllKeys();
        const devKeys = keys.filter((key) => String(key).startsWith(DEV_NAMESPACE));
        next.storage = `${keys.length} claves (${devKeys.length} de prueba)`;
      } catch (_error) {
        next.storage = 'Error al consultar';
      }
      if (alive) setStatus(next);
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Screen title="Modo Desarrollador" subtitle="Entorno de pruebas aislado. Los datos reales no se modifican.">
      <View style={styles.headerBadge}>
        <Text style={styles.badgeText}>DEV</Text>
        <Text style={styles.badgeHint}>Solo disponible en builds de desarrollo</Text>
      </View>

      <Card>
        <SectionTitle title="Estado general" />
        <View style={styles.grid}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Plataforma</Text>
            <Text style={styles.statValue}>{Platform.OS}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>VersiÃ³n</Text>
            <Text style={styles.statValue}>{Constants.expoConfig?.version || 'No comprobado'}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Notificaciones</Text>
            <Text style={styles.statValue}>{status.notifications}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>BiometrÃ­a</Text>
            <Text style={styles.statValue}>{status.biometrics}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Almacenamiento</Text>
            <Text style={styles.statValue}>{status.storage}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Tema</Text>
            <Text style={styles.statValue}>{theme?.surface?.label || 'No comprobado'}</Text>
          </View>
        </View>
        <View style={styles.row}>
          <Pill label={isDevModeEnabled() ? 'Dev mode activo' : 'Dev mode inactivo'} tone={isDevModeEnabled() ? 'accent' : 'warning'} />
          <Pill label="MÃ³dulos: operativos" tone="neutral" />
        </View>
      </Card>

      <SectionTitle title="CategorÃ­as de prueba" />
      {CATEGORIES.map((category) => (
        <Card key={category.id}>
          <Text style={styles.categoryName}>{category.name}</Text>
          <Text style={styles.categoryDescription}>{category.description}</Text>
          <View style={styles.categoryFooter}>
            <Pill label="PrÃ³ximamente" tone="neutral" />
            <Text style={styles.placeholder}>Espacio reservado para botones de ejecuciÃ³n</Text>
          </View>
        </Card>
      ))}

      <SectionTitle title="Registro de pruebas" />
      <Card>
        <TestLog entries={logs} />
      </Card>

      <SectionTitle title="Zona de limpieza" />
      <Card dimmed>
        <Text style={styles.cleanupTitle}>Limpieza de datos de prueba</Text>
        <Text style={styles.cleanupHint}>
          La acciÃ³n de limpieza se implementarÃ¡ en una etapa posterior. AquÃ­ solo se reserva el espacio visual.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = themedStyles({
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  badgeText: {
    ...typography.title,
    color: colors.accentInk,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  badgeHint: { ...typography.small, color: colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stat: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  statLabel: { ...typography.caption, color: colors.textMuted },
  statValue: { ...typography.bodyStrong, fontSize: 14, color: colors.text },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  categoryName: { ...typography.bodyStrong, color: colors.text },
  categoryDescription: { ...typography.small, color: colors.textSecondary, marginTop: spacing.xs },
  categoryFooter: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  placeholder: { ...typography.caption, color: colors.textMuted },
  cleanupTitle: { ...typography.bodyStrong, color: colors.text },
  cleanupHint: { ...typography.small, color: colors.textSecondary, marginTop: spacing.xs },
});
