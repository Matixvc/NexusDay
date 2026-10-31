import { useEffect, useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Screen, Card, Pill, SectionTitle, PrimaryButton } from '../components/ui/primitives';
import { themedStyles, colors, radius, spacing, typography } from '../theme/theme';
import { useTheme } from '../context/ThemeContext';
import { isDevModeEnabled, DEV_NAMESPACE, devSaveJSON, devLoadJSON, devRemoveKey, devCreateId, devClearAll, devKey } from '../services/devMode';
import { TestLog } from '../components/devMode/TestLog';

const CATEGORIES = [
  { id: 'notifications', name: 'Notificaciones', description: 'Permisos, canales y programación local.' },
  { id: 'security', name: 'Seguridad y privacidad', description: 'Biometría, bloqueo y datos protegidos.' },
  { id: 'storage', name: 'Almacenamiento', description: 'AsyncStorage, namespaces y limpieza de pruebas.' },
  { id: 'tasks', name: 'Tareas y hábitos', description: 'Colecciones, persistencia y sincronización.' },
  { id: 'calendar', name: 'Calendario', description: 'Eventos, fechas y recordatorios.' },
  { id: 'audio', name: 'Audio y vibración', description: 'Grabación, reproducción y feedback háptico.' },
  { id: 'navigation', name: 'Navegación', description: 'Rutas, pestañas y deep links.' },
  { id: 'theme', name: 'Temas', description: 'Acentos, superficies y repintado.' },
];

const STORAGE_TESTS = [
  { id: 'write', name: 'Escritura de prueba' },
  { id: 'read', name: 'Lectura de prueba' },
  { id: 'compare', name: 'Comparación profunda' },
  { id: 'remove', name: 'Eliminación de clave' },
  { id: 'verify-removed', name: 'Verificación de eliminación' },
  { id: 'no-leftovers', name: 'Sin claves de prueba restantes' },
  { id: 'v1-intact', name: 'Claves @nexusday/v1/ intactas' },
];

function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => deepEqual(a[key], b[key]));
}

function nowTime() {
  return new Date().toLocaleTimeString();
}

export function DeveloperModeScreen() {
  const theme = useTheme();
  const [status, setStatus] = useState({
    notifications: 'No comprobado',
    biometrics: 'No comprobado',
    storage: 'No comprobado',
  });
  const [testResults, setTestResults] = useState(STORAGE_TESTS.map((t) => ({ ...t, status: 'pending', message: 'Pendiente', time: null })));
  const [running, setRunning] = useState(false);
  const [overall, setOverall] = useState('idle');
  const [lastRun, setLastRun] = useState(null);
  const [clearing, setClearing] = useState(false);

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

  const updateStep = (id, patch) => {
    setTestResults((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const runStorageTests = async () => {
    if (!isDevModeEnabled()) {
      Alert.alert('Modo desarrollador desactivado', 'No se pueden ejecutar pruebas.');
      return;
    }
    if (running) return;
    setRunning(true);
    setOverall('running');
    setTestResults(STORAGE_TESTS.map((t) => ({ ...t, status: 'pending', message: 'Pendiente', time: null })));

    const tempName = `storage_${devCreateId()}`;
    const tempValue = { ok: true, n: 42, list: [1, 2, 3], nested: { a: 'x' } };
    const tempKey = devKey(tempName);

    let v1Before = [];
    let allPassed = true;
    try {
      v1Before = (await AsyncStorage.getAllKeys()).filter((k) => String(k).startsWith('@nexusday/v1/')).sort();
    } catch (_error) {
      v1Before = [];
    }

    const execute = async (id, task) => {
      updateStep(id, { status: 'running', message: 'Ejecutando…' });
      try {
        await task();
        updateStep(id, { status: 'success', message: 'Correcto', time: nowTime() });
      } catch (error) {
        allPassed = false;
        updateStep(id, { status: 'error', message: error?.message || 'Error', time: nowTime() });
        throw error;
      }
    };

    let writeOk = false;
    let readValue = null;

    try {
      await execute('write', async () => {
        await devSaveJSON(tempName, tempValue);
        writeOk = true;
      });

      await execute('read', async () => {
        if (!writeOk) throw new Error('La escritura no se completó');
        readValue = await devLoadJSON(tempName, null);
        if (readValue == null) throw new Error('No se pudo leer el valor');
      });

      await execute('compare', async () => {
        if (!deepEqual(readValue, tempValue)) throw new Error('El valor leído no coincide con el escrito');
      });

      await execute('remove', async () => {
        await devRemoveKey(tempName);
      });

      await execute('verify-removed', async () => {
        const after = await devLoadJSON(tempName, null);
        if (after !== null) throw new Error('La clave sigue existiendo');
        const keys = await AsyncStorage.getAllKeys();
        if (keys.includes(tempKey)) throw new Error('La clave sigue en AsyncStorage');
      });

      await execute('no-leftovers', async () => {
        const keys = await AsyncStorage.getAllKeys();
        const devKeys = keys.filter((k) => String(k).startsWith(DEV_NAMESPACE));
        // Solo nos aseguramos de que la clave temporal no quede.
        if (devKeys.includes(tempKey)) throw new Error('Quedó la clave de prueba');
      });

      await execute('v1-intact', async () => {
        const v1After = (await AsyncStorage.getAllKeys()).filter((k) => String(k).startsWith('@nexusday/v1/')).sort();
        if (!deepEqual(v1Before, v1After)) throw new Error('Las claves @nexusday/v1/ cambiaron');
      });
    } catch (_error) {
      // Los errores ya se registraron por paso.
    } finally {
      // Limpieza de seguridad de la clave temporal.
      try {
        await devRemoveKey(tempName);
      } catch (cleanupError) {
        console.error('[devMode] cleanup failed', cleanupError);
        allPassed = false;
        updateStep('verify-removed', { status: 'warning', message: 'Limpieza falló: ' + (cleanupError?.message || 'error') });
      }
      setRunning(false);
      setOverall(allPassed ? 'success' : 'error');
      setLastRun(new Date());
    }
  };

  const handleClearLab = () => {
    if (!isDevModeEnabled()) return;
    Alert.alert(
      'Limpiar laboratorio',
      'Se eliminarán únicamente las claves que comienzan con @nexusday/dev/. ¿Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpiar',
          style: 'destructive',
          onPress: async () => {
            setClearing(true);
            try {
              const ok = await devClearAll();
              const remaining = (await AsyncStorage.getAllKeys()).filter((k) => String(k).startsWith(DEV_NAMESPACE));
              if (ok && remaining.length === 0) {
                Alert.alert('Laboratorio limpio', 'Se eliminaron todas las claves de prueba.');
              } else {
                Alert.alert('Advertencia', 'La limpieza no se completó por completo.');
              }
            } catch (error) {
              Alert.alert('Error', error?.message || 'No se pudo limpiar el laboratorio.');
            } finally {
              setClearing(false);
            }
          },
        },
      ]
    );
  };

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
            <Text style={styles.statLabel}>Versión</Text>
            <Text style={styles.statValue}>{Constants.expoConfig?.version || 'No comprobado'}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Notificaciones</Text>
            <Text style={styles.statValue}>{status.notifications}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Biometría</Text>
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
          <Pill label="Módulos: operativos" tone="neutral" />
        </View>
      </Card>

      <SectionTitle title="Categorías de prueba" />
      {CATEGORIES.map((category) => (
        <Card key={category.id}>
          <Text style={styles.categoryName}>{category.name}</Text>
          <Text style={styles.categoryDescription}>{category.description}</Text>
          <View style={styles.categoryFooter}>
            <Pill label="Próximamente" tone="neutral" />
            <Text style={styles.placeholder}>Espacio reservado para botones de ejecución</Text>
          </View>
          {category.id === 'storage' ? (
            <View style={styles.storageActions}>
              <PrimaryButton label={running ? 'Ejecutando…' : 'Ejecutar pruebas'} onPress={runStorageTests} disabled={running} style={styles.actionButton} />
              <PrimaryButton label={clearing ? 'Limpiando…' : 'Limpiar laboratorio'} onPress={handleClearLab} disabled={clearing} style={styles.actionButton} />
            </View>
          ) : null}
        </Card>
      ))}

      <SectionTitle title="Registro de pruebas" />
      <Card>
        <TestLog entries={testResults} />
        {lastRun ? (
          <Text style={styles.lastRun}>Última ejecución: {lastRun.toLocaleString()}</Text>
        ) : null}
        {overall === 'success' ? <Text style={styles.overallSuccess}>Resultado general: Correcto</Text> : null}
        {overall === 'error' ? <Text style={styles.overallError}>Resultado general: Error</Text> : null}
      </Card>

      <SectionTitle title="Zona de limpieza" />
      <Card dimmed>
        <Text style={styles.cleanupTitle}>Limpieza de datos de prueba</Text>
        <Text style={styles.cleanupHint}>
          Solo elimina claves @nexusday/dev/. Requiere confirmación explícita.
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
  storageActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  lastRun: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },
  overallSuccess: { ...typography.bodyStrong, color: colors.accent, marginTop: spacing.xs },
  overallError: { ...typography.bodyStrong, color: colors.warning, marginTop: spacing.xs },
  cleanupTitle: { ...typography.bodyStrong, color: colors.text },
  cleanupHint: { ...typography.small, color: colors.textSecondary, marginTop: spacing.xs },
});
