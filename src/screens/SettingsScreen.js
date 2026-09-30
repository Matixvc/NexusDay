import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { spacing, typography } from '../theme/theme';
import { useAppData } from '../context/AppDataContext';
import { Card, Notice, Pill, PrimaryButton, Screen, SectionTitle, Stat, TextButton } from '../components/ui/primitives';
import { PickerTrigger, TextField } from '../components/ui/inputs';
import { ConfirmSheet, OptionSheet } from '../components/ui/Sheet';
import {
  FOLDERS,
  clearFolder,
  formatBytes,
  isAvailable as filesAvailable,
  listFolder,
  totalSize,
} from '../services/files';
import {
  describeAudioStatus,
  getMicrophonePermission,
  requestMicrophonePermission,
} from '../services/audio';
import {
  describeCalendarStatus,
  forgetCalendars,
  getPermission as getCalendarPermission,
  isAvailable as calendarAvailable,
  listCalendarOptions,
  requestPermission as requestCalendarPermission,
  setPreferredCalendar,
} from '../services/calendar';

const PERMISSION_TONE = { granted: 'accent', unknown: 'neutral', denied: 'warning' };

/** Nombre configurado en app.json (el app se puede renombrar sin tocar la copia). */
const APP_NAME = Constants.expoConfig?.name || 'NexusDay';

function permissionPill(permission, labels) {
  if (!permission) return <Pill label="Consultando…" />;
  const tone = PERMISSION_TONE[permission.status] || 'warning';
  const label = permission.granted ? labels.granted : permission.canAskAgain ? labels.missing : labels.blocked;
  return <Pill label={label} tone={tone} />;
}

export default function SettingsScreen() {
  const {
    activities,
    events,
    birthdays,
    notes,
    habits,
    expenses,
    settings,
    updateSettings,
    clearAllData,
    permission,
    refreshPermission,
    requestNotifications,
    notificationsSupported,
  } = useAppData();

  // `nameDraft` stays null until the user types, so the persisted name appears as soon as
  // AsyncStorage hydrates without an effect that mirrors state into state.
  const [nameDraft, setNameDraft] = useState(null);
  const [calendarPermission, setCalendarPermission] = useState(null);
  const [calendars, setCalendars] = useState([]);
  const [calendarSheetOpen, setCalendarSheetOpen] = useState(false);
  const [micPermission, setMicPermission] = useState(null);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [notice, setNotice] = useState(null);
  const [info, setInfo] = useState(null);

  const name = nameDraft ?? settings?.displayName ?? '';
  const setName = setNameDraft;

  // expo-file-system's folder helpers are synchronous, so they are read once and refreshed
  // explicitly (cleanup button) instead of on every render.
  const [storage, setStorage] = useState(null);

  const loadCalendar = useCallback(async () => {
    if (!calendarAvailable()) return;
    const [current, options] = await Promise.all([getCalendarPermission(), listCalendarOptions()]);
    setCalendarPermission(current);
    setCalendars(options);
  }, []);

  /** Async on purpose: keeps the size read out of the effect's synchronous body. */
  const refreshStorage = useCallback(async () => {
    if (!filesAvailable()) return;
    const usage = {
      attachments: totalSize(listFolder(FOLDERS.attachments)),
      recordings: totalSize(listFolder(FOLDERS.recordings)),
      exports: totalSize(listFolder(FOLDERS.exports)),
    };
    await Promise.resolve();
    setStorage(usage);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      await refreshStorage();
      const mic = await getMicrophonePermission();
      if (!alive) return;
      setMicPermission(mic);
      await loadCalendar();
    })();
    return () => {
      alive = false;
    };
  }, [loadCalendar, refreshStorage]);

  const saveName = () => {
    updateSettings({ displayName: name.trim() });
    setInfo(name.trim() ? `Listo, te voy a saludar como ${name.trim()}.` : 'Se quitó el nombre del saludo.');
  };

  const askNotifications = async () => {
    await requestNotifications();
    setInfo('Estado de avisos actualizado.');
  };

  const askCalendar = async () => {
    const result = await requestCalendarPermission();
    setCalendarPermission(result);
    if (result.granted) {
      forgetCalendars();
      await loadCalendar();
      setInfo('Acceso al calendario concedido.');
    } else {
      setNotice(describeCalendarStatus(result.status, result.canAskAgain));
    }
  };

  const chooseCalendar = (calendarId) => {
    setPreferredCalendar(calendarId);
    updateSettings({ preferredCalendarId: calendarId });
    const chosen = calendars.find((item) => item.id === calendarId);
    setInfo(chosen ? `Los eventos nuevos se van a guardar en ${chosen.title}.` : null);
  };

  const askMicrophone = async () => {
    const result = await requestMicrophonePermission();
    setMicPermission(result);
    const message = describeAudioStatus(result.status, result.canAskAgain);
    if (message) setNotice(message);
    else setInfo('Micrófono listo para grabar notas de voz.');
  };

  const clearExports = () => {
    clearFolder(FOLDERS.exports);
    refreshStorage();
    setInfo('Se borraron los archivos exportados (.ics).');
  };

  const wipe = () => {
    clearAllData();
    setInfo('Se borraron todas las colecciones locales.');
  };

  const appVersion = Constants.expoConfig?.version || '1.0.0';
  const preferred = calendars.find((item) => item.id === settings?.preferredCalendarId);
  const storageTotal = storage ? storage.attachments + storage.recordings + storage.exports : 0;
  const totalItems =
    activities.length + events.length + birthdays.length + notes.length + habits.length + expenses.length;

  return (
    <>
      <Screen
        title="Ajustes"
        subtitle={`Permisos, datos y respaldo de ${APP_NAME}.`}
        headerRight={<Pill label={`v${appVersion}`} />}
      >
        {notice ? (
          <View style={styles.noticeRow}>
            <Notice text={notice} tone="danger" />
            <TextButton label="OK" tone="ghost" onPress={() => setNotice(null)} />
          </View>
        ) : null}
        {info ? (
          <View style={styles.noticeRow}>
            <Notice text={info} />
            <TextButton label="OK" tone="ghost" onPress={() => setInfo(null)} />
          </View>
        ) : null}

        <SectionTitle title="Perfil" />
        <Card style={styles.card}>
          <TextField
            label="¿Cómo te llamo?"
            value={name}
            onChangeText={setName}
            placeholder="Tu nombre"
            maxLength={20}
            onSubmitEditing={saveName}
          />
          <TextButton label="Guardar saludo" onPress={saveName} />
        </Card>

        <SectionTitle title="Permisos" />
        <Card style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={styles.rowBody}>
              <Text style={typography.bodyStrong}>Notificaciones</Text>
              <Text style={typography.caption}>Avisos de eventos, clases y cumpleaños.</Text>
            </View>
            {permissionPill(
              notificationsSupported
                ? { status: permission.checked ? permission.status : 'unknown', granted: permission.granted, canAskAgain: permission.canAskAgain }
                : { status: 'unsupported', granted: false, canAskAgain: false },
              { granted: 'Activas', missing: 'Sin activar', blocked: 'Bloqueadas' },
            )}
          </View>
          <View style={styles.actions}>
            {notificationsSupported && !permission.granted ? (
              <PrimaryButton label="Permitir" onPress={askNotifications} style={styles.actionButton} />
            ) : null}
            <TextButton label="Revisar estado" tone="ghost" onPress={refreshPermission} />
          </View>
        </Card>

        <Card style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={styles.rowBody}>
              <Text style={typography.bodyStrong}>Calendario del teléfono</Text>
              <Text style={typography.caption}>Copia tus eventos a la app Calendario.</Text>
            </View>
            {permissionPill(
              calendarAvailable() ? calendarPermission : { status: 'unsupported', granted: false, canAskAgain: false },
              { granted: 'Conectado', missing: 'Sin permiso', blocked: 'Bloqueado' },
            )}
          </View>
          <PickerTrigger
            label="Calendario destino"
            value={preferred?.title}
            placeholder={calendarAvailable() ? 'Automático (recomendado)' : 'No disponible'}
            onPress={() => setCalendarSheetOpen(true)}
          />
          <View style={styles.actions}>
            {calendarAvailable() && !calendarPermission?.granted ? (
              <PrimaryButton label="Permitir acceso" onPress={askCalendar} style={styles.actionButton} />
            ) : null}
            <TextButton
              label="Recargar"
              tone="ghost"
              onPress={() => {
                forgetCalendars();
                loadCalendar();
              }}
            />
          </View>
        </Card>

        <Card style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={styles.rowBody}>
              <Text style={typography.bodyStrong}>Micrófono</Text>
              <Text style={typography.caption}>Necesario para las notas de voz.</Text>
            </View>
            {permissionPill(micPermission, { granted: 'Listo', missing: 'Sin permiso', blocked: 'Bloqueado' })}
          </View>
          <View style={styles.actions}>
            {!micPermission?.granted ? (
              <PrimaryButton label="Permitir" onPress={askMicrophone} style={styles.actionButton} />
            ) : null}
          </View>
        </Card>
        <SectionTitle title="Almacenamiento" count={formatBytes(storageTotal)} />
        <Card style={styles.card}>
          <View style={styles.statsRow}>
            <Stat value={formatBytes(storage?.attachments || 0)} label="Adjuntos" />
            <Stat value={formatBytes(storage?.recordings || 0)} label="Notas de voz" />
            <Stat value={formatBytes(storage?.exports || 0)} label="Exportados" />
          </View>
          <Text style={typography.caption}>
            Los adjuntos y las notas de voz viven en el sandbox del app; los archivos exportados (.ics) son
            temporales y se pueden borrar sin riesgo.
          </Text>
          <View style={styles.actions}>
            <PrimaryButton label="Limpiar exportados" onPress={clearExports} style={styles.actionButton} />
            <TextButton label="Recalcular" tone="ghost" onPress={refreshStorage} />
          </View>
        </Card>

        <SectionTitle title="Datos locales" count={totalItems} />
        <Card style={styles.card}>
          <View style={styles.pillWrap}>
            <Pill label={`${activities.length} actividades`} />
            <Pill label={`${events.length} eventos`} />
            <Pill label={`${birthdays.length} cumpleaños`} />
            <Pill label={`${notes.length} notas`} />
            <Pill label={`${habits.length} hábitos`} />
            <Pill label={`${expenses.length} gastos`} />
          </View>
          <Text style={typography.caption}>
            Todo se guarda en el teléfono con AsyncStorage: no hay cuentas, servidores ni sincronización en la nube.
          </Text>
          <TextButton label="Borrar todos los datos" tone="danger" onPress={() => setConfirmWipe(true)} />
        </Card>

        <SectionTitle title="Acerca de" />
        <Card style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={styles.rowBody}>
              <Text style={typography.bodyStrong}>{APP_NAME}</Text>
              <Text style={typography.caption}>{`Versión ${appVersion} · Expo SDK 57`}</Text>
            </View>
            <Pill label="Local-first" tone="accent" />
          </View>
          <Text style={[typography.caption, styles.aboutText]}>
            La grabación de voz, el calendario y los avisos usan módulos nativos, así que el app necesita una
            development build (npx expo run:android o eas build --profile development) para esas funciones.
          </Text>
        </Card>
      </Screen>

      <OptionSheet
        visible={calendarSheetOpen}
        onClose={() => setCalendarSheetOpen(false)}
        title="Calendario destino"
        options={[
          { label: 'Automático (recomendado)', value: '' },
          ...calendars.map((item) => ({
            label: item.primary ? `${item.title} · principal` : item.title,
            value: item.id,
          })),
        ]}
        value={settings?.preferredCalendarId || ''}
        onSelect={chooseCalendar}
      />

      <ConfirmSheet
        visible={confirmWipe}
        onClose={() => setConfirmWipe(false)}
        onConfirm={wipe}
        title="¿Borrar todos los datos?"
        message="Se eliminan actividades, eventos, cumpleaños, notas, hábitos y gastos guardados en el dispositivo."
        confirmLabel="Borrar todo"
      />
    </>
  );
}

const styles = StyleSheet.create({
  noticeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  card: { gap: spacing.md },
  rowBetween: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowBody: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  actionButton: { flex: 0, alignSelf: 'flex-start', paddingHorizontal: spacing.xl },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  aboutText: { lineHeight: 17 },
});
