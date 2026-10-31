import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Screen, Card, Pill, SectionTitle, PrimaryButton } from '../components/ui/primitives';
import { themedStyles, colors, radius, spacing, typography } from '../theme/theme';
import { useTheme } from '../context/ThemeContext';
import { isDevModeEnabled, DEV_NAMESPACE, devSaveJSON, devLoadJSON, devRemoveKey, devCreateId, devClearAll, devKey } from '../services/devMode';
import * as Notif from '../services/notifications';
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

const NOTIFICATION_TESTS = [
  { id: 'compatibility', name: 'Compatibilidad y permiso real' },
  { id: 'permission-request', name: 'Solicitud de permiso' },
  { id: 'schedule-5s', name: 'Programación a 5 segundos' },
  { id: 'pending-contains-5s', name: 'Pendientes incluyen ID de 5s' },
  { id: 'schedule-60s', name: 'Programación a 60 segundos' },
  { id: 'cancel-60s', name: 'Cancelación de 60 segundos' },
  { id: 'pending-no-60s', name: 'Pendientes sin ID cancelado' },
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
  const operationLock = useRef(false);

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
    if (operationLock.current) return;
    operationLock.current = true;
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
      operationLock.current = false;

      setOverall(allPassed ? 'success' : 'error');
      setLastRun(new Date());
    }

  };

  const runNotificationTests = async () => {
    if (!isDevModeEnabled()) {
      Alert.alert('Modo desarrollador desactivado', 'No se pueden ejecutar pruebas.');
      return;
    }
    if (operationLock.current) return;
    operationLock.current = true;
    setRunning(true);
    setOverall('running');
    setTestResults(NOTIFICATION_TESTS.map((t) => ({ ...t, status: 'pending', message: 'Pendiente', time: null })));
    const execute = async (id, task) => {
      updateStep(id, { status: 'running', message: 'Ejecutando…' });
      try {
        await task();
      } catch (error) {
        allPassed = false;
        updateStep(id, { status: 'error', message: error?.message || 'Error', time: nowTime() });
        throw error;
      }
    };

    let allPassed = true;
    const labIds = [];

    const cancelLabId = async (id) => {
      try {
        const pending = await Notifications.getAllScheduledNotificationsAsync();
        const exists = Array.isArray(pending) && pending.some((n) => n?.identifier === id);
        if (!exists) return true;
        const ok = await Notif.cancel(id);
        if (!ok) console.warn('[devMode] cancel returned false for', id);
        return ok;
      } catch (error) {
        console.error('[devMode] cancel failed for', id, error);
        return false;
      }
    };

    let previousIds = [];
    try {
      previousIds = (await devLoadJSON('notif_lab_ids', [])) || [];
      if (!Array.isArray(previousIds)) previousIds = [];
    } catch (error) {
      console.error('[devMode] could not load previous notif ids', error);
      previousIds = [];
    }
    for (const id of previousIds) {
      if (typeof id === 'string' && id.length > 0) {
        await cancelLabId(id);
      }
    }

    let id5 = null;
    let id60 = null;

    try {
      await execute('compatibility', async () => {
        const supported = Notif.isSupported();
        if (!supported) throw new Error('Plataforma no soportada para notificaciones');
        const perm = await Notif.getPermissionStatus();
        updateStep('compatibility', { status: 'success', message: `Soportado: sí, permiso: ${perm.status}`, time: nowTime() });
      });

      await execute('permission-request', async () => {
        const current = await Notif.getPermissionStatus();
        if (current.granted) {
          updateStep('permission-request', { status: 'success', message: 'Permiso ya concedido', time: nowTime() });
          return;
        }
        const req = await Notif.requestPermission();
        if (!req.granted) throw new Error('Permiso denegado por el usuario');
        updateStep('permission-request', { status: 'success', message: 'Permiso concedido', time: nowTime() });
      });
      await execute('schedule-5s', async () => {
        const date = new Date(Date.now() + 5000);
        const result = await Notif.scheduleAt({
          title: 'NexusDay Lab',
          body: 'Prueba de notificación a 5 segundos',
          date,
          data: { source: 'nexusday', lab: true, kind: 'lab-5s' },
        });
        if (result.status !== 'scheduled' || !result.id) {
          throw new Error(`Programación falló: ${result.status || 'sin estado'}`);
        }
        id5 = result.id;
        await devSaveJSON('notif_lab_5s', id5);
        labIds.push(id5);
        await devSaveJSON('notif_lab_ids', labIds);
        updateStep('schedule-5s', { status: 'success', message: `ID: ${id5}`, time: nowTime() });
      });

      await execute('pending-contains-5s', async () => {
        if (!id5) throw new Error('No hay ID de 5s');
        const pending = await Notifications.getAllScheduledNotificationsAsync();
        const ids = Array.isArray(pending) ? pending.map((n) => n?.identifier) : [];
        if (!ids.includes(id5)) throw new Error('El ID de 5s no aparece en pendientes');
        updateStep('pending-contains-5s', { status: 'success', message: 'ID encontrado en pendientes', time: nowTime() });
      });

      await execute('schedule-60s', async () => {
        const date = new Date(Date.now() + 60000);
        const result = await Notif.scheduleAt({
          title: 'NexusDay Lab',
          body: 'Prueba de notificación a 60 segundos',
          date,
          data: { source: 'nexusday', lab: true, kind: 'lab-60s' },
        });
        if (result.status !== 'scheduled' || !result.id) {
          throw new Error(`Programación falló: ${result.status || 'sin estado'}`);
        }
        id60 = result.id;
        await devSaveJSON('notif_lab_60s', id60);
        labIds.push(id60);
        await devSaveJSON('notif_lab_ids', labIds);
        updateStep('schedule-60s', { status: 'success', message: `ID: ${id60}`, time: nowTime() });
      });

      await execute('cancel-60s', async () => {
        if (!id60) throw new Error('No hay ID de 60s');
        const ok = await Notif.cancel(id60);
        if (!ok) throw new Error('cancel devolvió false');
        updateStep('cancel-60s', { status: 'success', message: 'Cancelación confirmada', time: nowTime() });
      });

      await execute('pending-no-60s', async () => {
        if (!id60) throw new Error('No hay ID de 60s');
        const pending = await Notifications.getAllScheduledNotificationsAsync();
        const ids = Array.isArray(pending) ? pending.map((n) => n?.identifier) : [];
        if (ids.includes(id60)) throw new Error('El ID cancelado sigue pendiente');
        updateStep('pending-no-60s', { status: 'success', message: 'ID cancelado ausente', time: nowTime() });
      });
    } catch (_error) {
      // Errores ya registrados por paso.
    } finally {
      for (const id of labIds) {
        try {
          await cancelLabId(id);
        } catch (cleanupError) {
          console.error('[devMode] cleanup cancel failed', cleanupError);
          allPassed = false;
        }
      }
      const tempKeys = ['notif_lab_5s', 'notif_lab_60s', 'notif_lab_ids'];
      for (const key of tempKeys) {
        try {
          await devRemoveKey(key);
        } catch (cleanupError) {
          console.error('[devMode] cleanup key failed', key, cleanupError);
          allPassed = false;
        }
      }
      setRunning(false);
      operationLock.current = false;

      setOverall(allPassed ? 'success' : 'error');
      setLastRun(new Date());
    }

  };

  const handleClearLab = () => {
    if (!isDevModeEnabled()) return;
    if (operationLock.current) return;
    Alert.alert(
      'Limpiar laboratorio',
      'Se eliminarán únicamente las claves que comienzan con @nexusday/dev/. ¿Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpiar',
          style: 'destructive',
          onPress: async () => {
            if (operationLock.current) return;
            operationLock.current = true;
            setClearing(true);
            const cancelErrors = [];
            try {
              // Recuperar primero los IDs de pruebas de notificaciones.
              let labIds = [];
              try {
                labIds = (await devLoadJSON('notif_lab_ids', [])) || [];
                if (!Array.isArray(labIds)) labIds = [];
              } catch (error) {
                console.error('[devMode] could not load notif_lab_ids', error);
                cancelErrors.push(error);
                labIds = [];
              }
              // Cancelar exclusivamente esos IDs.
              for (const id of labIds) {
                if (typeof id !== 'string' || id.length === 0) continue;
                try {
                  const pending = await Notifications.getAllScheduledNotificationsAsync();
                  const exists = Array.isArray(pending) && pending.some((n) => n?.identifier === id);
                  if (!exists) continue;
                  const ok = await Notif.cancel(id);
                  if (!ok) {
                    const err = new Error(`cancel devolvió false para ${id}`);
                    console.error('[devMode]', err.message);
                    cancelErrors.push(err);
                  }
                } catch (error) {
                  console.error('[devMode] cancel failed for', id, error);
                  cancelErrors.push(error);
                }
              }
              if (cancelErrors.length > 0) {
                Alert.alert('Advertencia', 'Algunas cancelaciones de notificaciones de prueba fallaron. Se continuará con la limpieza.');
              }
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
              operationLock.current = false;

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
           <Pill label={Constants.appOwnership === 'expo' ? 'Expo Go' : 'Development Build'} tone={Constants.appOwnership === 'expo' ? 'warning' : 'accent'} />
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
              <PrimaryButton label={running ? 'Ejecutando…' : 'Ejecutar pruebas'} onPress={runStorageTests} disabled={running || clearing} style={styles.actionButton} />
              <PrimaryButton label={clearing ? 'Limpiando…' : 'Limpiar laboratorio'} onPress={handleClearLab} disabled={running || clearing} style={styles.actionButton} />
            </View>
          ) : null}
           {category.id === 'notifications' ? (
             <View style={styles.storageActions}>
               <PrimaryButton label={running ? 'Ejecutando…' : 'Ejecutar pruebas'} onPress={runNotificationTests} disabled={running || clearing} style={styles.actionButton} />
               <PrimaryButton label={clearing ? 'Limpiando…' : 'Limpiar laboratorio'} onPress={handleClearLab} disabled={running || clearing} style={styles.actionButton} />
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
