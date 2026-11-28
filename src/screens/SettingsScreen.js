import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, Image, Linking, Modal, Pressable, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { themedStyles, colors, radius, spacing, typography } from '../theme/theme';
import { ACCENT_THEMES, getAccentTheme, resolveAccent, resolvePreviewAccent } from '../theme/accents';
import { SELECTABLE_SURFACE_MODES } from '../theme/surfaces';
import { isLockedTab, tabByName } from '../navigation/tabMetadata';
import { navigateToRoute } from '../navigation/navigateToRoute';
import { DEFAULT_TAB_CONFIG, moveTab, setTabHidden } from '../services/tabs';
import {
  authorizeGlobalPrivacyChange,
  authorizePrivateAction,
  describeCapability,
  describePrivacyFailure,
} from '../services/privacy';
import { PRIVATE_ACTIONS, filterDiscoverableRecords } from '../services/privacyPolicy';
import { useAccentTheme } from '../context/ThemeContext';
import { useAppData } from '../context/AppDataContext';
import { Card, Notice, Pill, PrimaryButton, Screen, SectionTitle, Stat, TextButton } from '../components/ui/primitives';
import { DeveloperModeScreen } from './DeveloperModeScreen';
import { isDevModeEnabled } from '../services/devMode';
import { TextField } from '../components/ui/inputs';
import { ConfirmSheet } from '../components/ui/Sheet';
import { Switch, SwitchRow } from '../components/ui/Switch';
import { Accordion } from '../components/ui/Accordion';
import { HeaderIconButton } from '../components/ui/HeaderIconButton';
import { Icon } from '../components/Icon';
import { initials } from '../utils/initials';
import { tap as tapHaptic, select as selectHaptic, success as successHaptic } from '../services/haptics';
import {
  FOLDERS,
  clearFolder,
  describePickStatus,
  describeShareStatus,
  formatBytes,
  isAvailable as filesAvailable,
  listFolder,
  pickAndImport,
  readText,
  shareText,
  totalSize,
} from '../services/files';
import {
  describeAudioStatus,
  getMicrophonePermission,
  requestMicrophonePermission,
} from '../services/audio';
import { BACKUP_COLLECTIONS, backupRequiresPrivateAuthorization, isPartialHistoricalBackup, prepareBackupImport, runBackupExport } from '../services/backupRestore';
import { ALARM_CHANNEL_ID, getExactAlarmPermission } from '../services/notifications';

const PERMISSION_TONE = { granted: 'accent', unknown: 'neutral', denied: 'warning' };

function backupValidationMessage(code) {
  if (code === 'unsupported-schema') return 'Esta copia usa una versión que NexusDay no puede restaurar.';
  if (code === 'missing-collection') return 'La copia está incompleta y no se aplicó.';
  if (code === 'duplicate-id') return 'La copia contiene registros duplicados y no se aplicó.';
  if (code === 'invalid-collection' || code === 'invalid-record') return 'La estructura de la copia no es válida y no se aplicó.';
  return 'El archivo no es una copia válida de NexusDay.';
}

/** Nombre configurado en app.json (la app se puede renombrar sin tocar la copia). */
const APP_NAME = Constants.expoConfig?.name || 'NexusDay';
const NEX_THEME_MATERIALS = require('../../assets/nex/u11/settings/theme-materials.jpg');
const NEX_LOCAL_PRIVACY = require('../../assets/nex/u11/settings/local-privacy.jpg');

function permissionPill(permission, labels) {
  if (!permission) return <Pill label="Consultando⬦" />;
  if (permission.status === 'unknown') return <Pill label="Sin consultar" />;
  if (permission.status === 'unsupported') return <Pill label="No disponible" />;
  const tone = PERMISSION_TONE[permission.status] || 'warning';
  const label = permission.granted ? labels.granted : permission.canAskAgain ? labels.missing : labels.blocked;
  return <Pill label={label} tone={tone} />;
}

/** Formatea la fecha de la ?ltima copia exportada. */
function formatBackupDate(timestamp) {
  if (!timestamp) return 'Nunca';
  const d = new Date(Number(timestamp));
  if (Number.isNaN(d.getTime())) return 'Nunca';
  const date = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${date} · ${time}`;
}

function ThemePreview({ mode, accent }) {
  const tokens = mode.tokens;
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.surfacePreview, { backgroundColor: tokens.background, borderColor: tokens.border }]}
    >
      {mode.id === 'nex' ? (
        <Image
          source={require('../../assets/nex/decor/nex-decor-ring.png')}
          accessible={false}
          pointerEvents="none"
          resizeMode="contain"
          style={styles.previewNexRing}
        />
      ) : null}
      <View style={[styles.previewHeader, { backgroundColor: tokens.elevated }]}>
        <View style={[styles.previewDot, { backgroundColor: accent }]} />
        <View style={[styles.previewHeaderLine, { backgroundColor: tokens.text }]} />
        <View style={[styles.previewHeaderTrailing, { backgroundColor: tokens.textMuted }]} />
      </View>
      <View style={[styles.previewPanel, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
        <View style={[styles.previewLine, { backgroundColor: tokens.textSecondary }]} />
        <View style={styles.previewContentRow}>
          <View style={[styles.previewLineShort, { backgroundColor: tokens.textMuted }]} />
          <View style={[styles.previewAction, { backgroundColor: accent }]} />
        </View>
      </View>
    </View>
  );
}

function SettingsSection({ title, icon, count, right }) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionIcon} accessible={false}>
        <Icon name={icon} size={17} color={colors.accent} />
      </View>
      <View style={styles.sectionHeadingTitle}>
        <SectionTitle title={title} count={count} right={right} variant="editorial" />
      </View>
    </View>
  );
}

export default function SettingsScreen({ navigation }) {
  const { accentId, setAccentId, surfaceId, setSurfaceId } = useAccentTheme();
  const {
    activities,
    events,
    birthdays,
    notes,
    habits,
    expenses,
    routines,
    routinesRecoveryError,
    settings,
    updateSettings,
    userName,
    setUserName,
    clearAllData,
    restoreBackup,
    replayTutorial,
    tabConfig,
    setTabConfig,
    permission,
    requestNotifications,
    notificationsSupported,
    hydrated,
  } = useAppData();
  const [exactAlarm, setExactAlarm] = useState(null);
  const refreshExactAlarm = useCallback(async () => setExactAlarm(await getExactAlarmPermission()), []);
  useEffect(() => {
    Promise.resolve().then(refreshExactAlarm);
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') refreshExactAlarm(); });
    return () => subscription.remove();
  }, [refreshExactAlarm]);
  const askExactAlarm = () => Alert.alert('Alarmas exactas', 'Permite este acceso para intentar entregar alarmas a la hora elegida. Sin él, Android puede retrasarlas.', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Abrir ajustes', onPress: async () => { await getExactAlarmPermission({ request: true }); refreshExactAlarm(); } },
  ]);

  // What the phone can authenticate with (biometric enrolled or device passcode only).
  const [privacyLabel, setPrivacyLabel] = useState('Consultando⬦');
  const [privacyNotice, setPrivacyNotice] = useState(null);



  // `nameDraft` stays null until the user types, so the persisted name appears as soon as
  // the context hydrates without an effect that mirrors state into state.
  const [nameDraft, setNameDraft] = useState(null);
  const [careerDraft, setCareerDraft] = useState(null);
  const [micPermission, setMicPermission] = useState(null);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [confirmPrivateExport, setConfirmPrivateExport] = useState(null);
  const [wipeBusy, setWipeBusy] = useState(false);
  // JSON ya parseado y validado, esperando la confirmación explícita antes de restaurar.
  const [confirmImport, setConfirmImport] = useState(null);
  const [notice, setNotice] = useState(null);
  const [info, setInfo] = useState(null);
  const [showDevLab, setShowDevLab] = useState(false);

  const name = nameDraft ?? userName ?? '';
  const setName = setNameDraft;
  const career = careerDraft ?? settings?.career ?? '';
  const setCareer = setCareerDraft;

  const publicNotes = filterDiscoverableRecords(notes);
  const publicExpenses = filterDiscoverableRecords(expenses);
  const hasPrivateRecords = publicNotes.length !== notes.length || publicExpenses.length !== expenses.length;

  // expo-file-system's folder helpers are synchronous, so they are read once and refreshed
  // explicitly (cleanup button) instead of on every render.
  const [storage, setStorage] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const label = await describeCapability();
      if (alive) setPrivacyLabel(label);
    })();
    return () => {
      alive = false;
    };
  }, []);

  /** Fires the native prompt once, so the user can verify the lock before relying on it. */
  const testPrivacy = async () => {
    const result = await authorizePrivateAction({
      record: { private: true },
      action: PRIVATE_ACTIONS.open,
      privacyEnabled: true,
      promptMessage: 'Prueba el desbloqueo de NexusDay',
      onAuthorized: () => {},
    });
    setPrivacyNotice(result.ok ? 'Autenticación correcta.' : describePrivacyFailure(result.reason));
  };

  const changePrivacyEnabled = async (value) => {
    const result = await authorizeGlobalPrivacyChange({
      currentValue: settings?.privacyEnabled !== false,
      nextValue: value,
      promptMessage: 'Autoriza desactivar la protección de privacidad',
      onAuthorized: () => updateSettings({ privacyEnabled: value }),
    });
    setPrivacyNotice(result.ok ? null : describePrivacyFailure(result.reason));
  };

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
    })();
    return () => {
      alive = false;
    };
  }, [refreshStorage]);

  /**
   * Writes the name to its single source of truth and echoes it into the settings blob.
   *
   * `setUserName` is what the dashboard greeting reads and what the tutorial writes, so
   * saving here keeps both in sync; `updateSettings` is kept only for the v1.0 records that
   * still carry `displayName` (the context adopts it once on first launch).
   */
  const saveName = () => {
    const next = name.trim();
    setUserName(next);
    updateSettings({ displayName: next, career: career.trim() });
    setInfo(next ? `Listo, te voy a saludar como ${next}.` : 'Se quitó el nombre del saludo.');
  };

  /** Guarda solo la carrera/ocupación, sin tocar el nombre del saludo. */
  const saveCareer = () => {
    updateSettings({ career: career.trim() });
    setInfo(career.trim() ? 'Carrera guardada.' : 'Se quitó la carrera.');
  };

  const performBackupExport = useCallback(async (payload, privateExportConfirmed = false) => {
    const result = await runBackupExport({
      payload,
      privateExportConfirmed,
      authorize: authorizePrivateAction,
      writeBackup: (authorizedPayload) => shareText({
        folder: FOLDERS.exports,
        name: `nexusday-copia-${new Date().toISOString().slice(0, 10)}.json`,
        text: JSON.stringify(authorizedPayload, null, 2),
        dialogTitle: 'Exportar copia de seguridad',
      }),
    });
    if (result.status === 'confirmation-required') {
      setConfirmPrivateExport(payload);
      return;
    }
    if (result.status === 'authorization-denied') {
      setNotice(describePrivacyFailure(result.reason));
      return;
    }
    const problem = describeShareStatus(result.status);
    if (problem) {
      setNotice(problem);
      return;
    }
    if (result.status === 'shared') {
      updateSettings({ lastBackupAt: Date.now() });
      successHaptic();
      setInfo('Copia exportada: el menú de compartir quedó abierto para guardarla donde quieras.');
    }
    refreshStorage();
  }, [refreshStorage, updateSettings]);

  /** Prepara schema 2; el servicio no escribe hasta resolver confirmacion y autenticacion. */
  const exportBackup = useCallback(async () => {
    if (routinesRecoveryError) {
      setNotice('No se puede exportar una copia completa mientras las rutinas guardadas no se puedan leer.');
      return;
    }
    tapHaptic();
    await performBackupExport({
      app: 'NexusDay',
      schema: 2,
      exportedAt: Date.now(),
      collections: { activities, events, birthdays, notes, habits, expenses, routines },
      settings: settings || {},
      userName,
      tabConfig,
    });
  }, [
    activities,
    events,
    birthdays,
    notes,
    habits,
    expenses,
    routines,
    routinesRecoveryError,
    settings,
    userName,
    tabConfig,
    performBackupExport,
  ]);

  const confirmExportWithPrivateData = useCallback(async () => {
    const payload = confirmPrivateExport;
    if (!payload) return;
    setConfirmPrivateExport(null);
    await performBackupExport(payload, true);
  }, [confirmPrivateExport, performBackupExport]);

  /**
   * Elige un .json, valida su integridad y solo entonces pide confirmación. Restaurar
   * sobrescribe todo, así que el usuario tiene que decirlo explícitamente.
   */
  const startImport = useCallback(async () => {
    if (!hydrated) {
      setInfo('Espera a que NexusDay termine de cargar tus datos antes de restaurar.');
      return;
    }
    tapHaptic();
    const picked = await pickAndImport({
      type: 'application/json',
      folder: FOLDERS.exports,
      prefix: 'copia',
    });
    const prepared = prepareBackupImport(picked, (uri) => readText(uri));
    if (prepared.status === 'cancel') return;
    const problem = describePickStatus(picked.status);
    if (problem) {
      setNotice(problem);
      return;
    }
    if (prepared.status === 'invalid-json') {
      setNotice('El archivo no se pudo leer como JSON. Elige una copia exportada desde NexusDay.');
      return;
    }
    if (prepared.status !== 'ready') {
      setNotice(backupValidationMessage(prepared.error));
      return;
    }
    setConfirmImport(prepared.backup);
  }, [hydrated]);

  /** Aplica la copia ya confirmada y refresca todo lo derivado (storage, avisos). */
  const applyImport = async () => {
    if (!confirmImport) return;
    if (!hydrated) {
      setInfo('Espera a que NexusDay termine de cargar tus datos antes de restaurar.');
      return;
    }
    const collections = confirmImport.collections || {};
    const total = BACKUP_COLLECTIONS.reduce((sum, name) => sum + (collections[name]?.length || 0), 0);
    let result = null;
    let authorization;
    try {
      authorization = await authorizePrivateAction({
        record: {
          private: backupRequiresPrivateAuthorization({
            collections,
            currentPrivacyEnabled: settings?.privacyEnabled,
            settings: confirmImport.settings,
            currentHasPrivateRecords: hasPrivateRecords,
          }),
        },
        action: PRIVATE_ACTIONS.delete,
        privacyEnabled: true,
        promptMessage: 'Autoriza restaurar datos protegidos',
        onAuthorized: async () => {
          result = await restoreBackup({
            activities: collections.activities,
            events: collections.events,
            birthdays: collections.birthdays,
            notes: collections.notes,
            habits: collections.habits,
            expenses: collections.expenses,
            routines: collections.routines,
            settings: confirmImport.settings,
            userName: confirmImport.userName,
            tabConfig: confirmImport.tabConfig,
          });
        },
      });
    } catch (error) {
      setInfo(error?.code === 'RESTORE_RECOVERY_REQUIRED'
        ? 'La restauración quedó interrumpida. Reinicia NexusDay para intentar recuperar los datos anteriores.'
        : 'No se pudo completar la restauración. Los datos anteriores se conservaron si fue posible. Puedes volver a intentarlo.');
      return;
    }
    if (!authorization.ok) {
      setNotice(describePrivacyFailure(authorization.reason));
      return;
    }
    setConfirmImport(null);
    successHaptic();
    refreshStorage();
    if (result === false) {
      setInfo('No se pudieron restaurar los datos. Inténtalo de nuevo.');
      return;
    }
    if (result && result.dataRestored && result.notificationsRecreated === false) {
      setInfo(`Datos restaurados con ${total} registros. Los recordatorios no se pudieron reprogramar automáticamente.`);
      return;
    }
    setInfo(`Copia restaurada con ${total} registros.`);
  };

  /** "Sincronizar ahora": exporta la copia .json y sella la fecha del último respaldo. */

  const askNotifications = async () => {
    await requestNotifications();
    setInfo('Estado de avisos actualizado.');
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
    setInfo('Se borraron los archivos exportados (copias .json).');
  };

  const wipe = async () => {
    if (wipeBusy) return;
    setWipeBusy(true);
    try {
      const result = await authorizePrivateAction({
        record: { private: hasPrivateRecords },
        action: PRIVATE_ACTIONS.delete,
        privacyEnabled: true,
        promptMessage: 'Autoriza borrar los datos protegidos',
        onAuthorized: async () => { await clearAllData(); },
      });
      if (!result.ok) setNotice(describePrivacyFailure(result.reason));
      else {
        setConfirmWipe(false);
        setInfo('Se borraron las colecciones y rutinas persistidas. Los archivos locales y respaldos exportados se conservaron.');
      }
    } catch {
      setInfo('No se pudieron borrar los datos. No se confirmó el borrado; vuelve a intentarlo.');
    } finally {
      setWipeBusy(false);
    }
  };

  const appVersion = Constants.expoConfig?.version || '1.0.0';
  const storageTotal = storage ? storage.attachments + storage.recordings + storage.exports : 0;
  const showNavigationCustomization = false;
  const totalItems =
    activities.length + events.length + birthdays.length + publicNotes.length + habits.length + publicExpenses.length + routines.length;
  const selectedSurfaceLabel = SELECTABLE_SURFACE_MODES.find((mode) => mode.id === surfaceId)?.label || 'Blanco y negro';
  const selectedAccentLabel = getAccentTheme(accentId).label;

  return (
    <>
      <Screen
        title="Ajustes"
        subtitle="Tu espacio, a tu manera."
        headerLeft={
          <HeaderIconButton
            icon="chevronLeft"
            label="Volver a la sección anterior"
            onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigateToRoute(navigation, 'Inicio'))}
          />
        }
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

        <View style={styles.identityHero}>
          {surfaceId === 'nex' ? (
            <Image
              source={require('../../assets/nex/decor/nex-decor-halo.png')}
              accessible={false}
              pointerEvents="none"
              resizeMode="contain"
              style={styles.identityHalo}
            />
          ) : null}
          <View style={styles.identityEyebrow}>
            <Icon name="settings" size={14} color={colors.accent} />
            <Text style={styles.identityEyebrowText}>TU ESPACIO PERSONAL</Text>
          </View>
          <Text style={styles.identityTitle}>A tu manera.</Text>
          <Text style={styles.identityDescription}>
            Ajusta la apariencia y las preferencias que acompañan tu día.
          </Text>
          <View style={styles.identitySummary}>
            <View style={[styles.identityAccentDot, { backgroundColor: colors.accent }]} />
            <Text style={styles.identitySummaryText}>
              {selectedSurfaceLabel} · {selectedAccentLabel}
            </Text>
          </View>
        </View>

        <SettingsSection title="Perfil personal" icon="user" />
        <Card style={styles.card}>
          <View style={styles.profileRow}>
            <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
              <Text style={[styles.avatarText, { color: colors.accentInk }]}>{initials(name, 'N')}</Text>
            </View>
            <View style={styles.profileBody}>
              <Text style={typography.bodyStrong} numberOfLines={1}>
                {name.trim() || 'Sin nombre aún'}
              </Text>
              <Text style={typography.caption} numberOfLines={1}>
                {career.trim() || 'Agrega tu carrera u ocupación'}
              </Text>
              <View style={styles.pillWrap}>
                <Pill label={`${publicNotes.length} notas`} />
                <Pill label={`${events.length} eventos`} />
                <Pill label={`${habits.length} hábitos`} />
              </View>
            </View>
          </View>

          <Text style={typography.caption}>
            Tu nombre personaliza el saludo; nombre y ocupación se guardan solo en este dispositivo.
          </Text>
          <TextField label="¿Cómo te llamo?" value={name} onChangeText={setName} placeholder="Tu nombre" maxLength={20} onSubmitEditing={saveName} />
          <TextField label="Carrera u ocupación" value={career} onChangeText={setCareer} placeholder="Ej. Ingeniería en Sistemas" maxLength={40} onSubmitEditing={saveCareer} />
          <TextButton label="Guardar perfil" onPress={saveName} />
        </Card>

        <SettingsSection title="Apariencia y personalización" icon="palette" />
        <Card style={styles.appearanceCard}>
          <View style={styles.appearanceIntro}>
            <View style={styles.appearanceIntroCopy}>
              <Text style={styles.appearanceKicker}>IDENTIDAD VISUAL</Text>
              <Text style={styles.appearanceTitle}>Elige tu ambiente</Text>
              <Text style={typography.caption}>
                Cambia la superficie y el acento sin perder tus preferencias guardadas.
              </Text>
            </View>
            {surfaceId === 'nex' ? (
              <View style={styles.appearanceMark} accessible={false}>
                <Image
                  source={require('../../assets/nex/decor/nex-decor-arc.png')}
                  accessible={false}
                  resizeMode="contain"
                  style={styles.appearanceArc}
                />
                <Icon name="zap" size={19} color={colors.accent} />
              </View>
            ) : null}
          </View>

          {surfaceId === 'nex' ? (
            <View style={styles.settingsArtworkRow}>
              <Image source={NEX_THEME_MATERIALS} style={styles.settingsArtwork} resizeMode="cover" accessible={false} importantForAccessibility="no" />
              <Text style={[typography.caption, styles.settingsArtworkCaption]}>Materiales de la identidad Nex, con controles y texto nativos.</Text>
            </View>
          ) : null}

          <Text style={styles.fieldLabel}>Tema</Text>
          <Text style={typography.caption}>
            {surfaceId === 'mono'
              ? 'Tu tema anterior se conserva hasta que elijas Blanco, Oscuro o Nex.'
              : 'Previsualizaciones reales de las tres apariencias.'}
          </Text>
          <View style={styles.surfaceRow} accessibilityRole="radiogroup">
            {SELECTABLE_SURFACE_MODES.map((mode) => {
              const selected = mode.id === surfaceId;
              return (
                <Pressable
                  key={mode.id}
                  accessible
                  onPress={() => {
                    if (mode.id !== surfaceId) selectHaptic();
                    setSurfaceId(mode.id);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${mode.label}. ${mode.hint}`}
                  accessibilityHint="Aplica esta apariencia en toda NexusDay."
                  style={({ pressed }) => [
                    styles.surfaceCard,
                    selected ? [styles.surfaceCardSelected, { borderColor: colors.accent }] : null,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <ThemePreview
                    mode={mode}
                    accent={resolvePreviewAccent(getAccentTheme(accentId), mode.id, surfaceId).accent}
                  />
                  <View style={styles.surfaceChoiceTop}>
                    <Text style={styles.surfaceLabel}>{mode.label}</Text>
                    {selected ? (
                      <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.choiceCheck, { backgroundColor: colors.accent }]}>
                        <Icon name="check" size={13} color={colors.accentInk} />
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.appearanceDivider} />
          <View style={styles.accentHeading}>
            <View style={styles.accentHeadingCopy}>
              <Text style={styles.fieldLabel}>Color de acento</Text>
              <Text style={typography.caption}>Se aplica a acciones, selección y detalles.</Text>
            </View>
            <Pill label={selectedAccentLabel} tone="accent" />
          </View>
          <View style={styles.accentGrid} accessibilityRole="radiogroup">
            {ACCENT_THEMES.map((option) => {
              const preview = resolveAccent(option, surfaceId);
              const selected = option.id === accentId;
              return (
                <Pressable
                  key={option.id}
                  accessible
                  onPress={() => {
                    if (option.id !== accentId) selectHaptic();
                    setAccentId(option.id);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${option.label}. ${option.hint}`}
                  accessibilityHint="Aplica este color en toda NexusDay."
                  style={({ pressed }) => [
                    styles.accentOption,
                    selected ? [styles.accentOptionSelected, { borderColor: preview.accent }] : null,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <View style={[styles.accentSwatch, { backgroundColor: preview.accent }]}>
                    {selected ? <Icon name="check" size={17} color={preview.accentInk} /> : null}
                  </View>
                  <Text style={styles.accentLabel}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.appearanceDivider} />
          <SwitchRow
            title="Reducir animaciones"
            hint="Desactiva la transición al abrir y cerrar secciones."
            value={settings?.reduceMotion === true}
            onValueChange={(value) => updateSettings({ reduceMotion: value })}
          />
        </Card>
        {showNavigationCustomization ? (
          <>
        <Accordion title="Personalizar navegación" subtitle="Muestra y ordena las solapas principales." icon="menu">
          <Text style={typography.caption}>
            Reordena las solapas con las flechas y apaga las que no uses. Inicio y Ajustes quedan fijos con
            candado: son la única forma de volver atrás y de deshacer estos cambios. Las ocultas siguen
            accesibles desde la búsqueda global de Inicio.
          </Text>

          {tabConfig.order.map((name, index) => {
            const tab = tabByName(name);
            const locked = isLockedTab(name);
            const hidden = tabConfig.hidden.includes(name);
            if (!tab) return null;
            return (
              <View key={name} style={styles.tabRow}>
                <Text style={[typography.caption, styles.tabIndex]}>{index + 1}</Text>
                <View style={styles.tabBody}>
                  <View style={styles.tabTitleRow}>
                    {locked ? <Text style={styles.lockGlyph}>ðŸ”’</Text> : null}
                    <Text style={typography.bodyStrong} numberOfLines={1}>
                      {tab.label}
                    </Text>
                  </View>
                  <Text style={typography.caption} numberOfLines={1}>
                    {locked
                      ? 'Fija · siempre visible'
                      : hidden
                        ? 'Oculta · se abre desde la búsqueda'
                        : 'Visible en la barra'}
                  </Text>
                </View>
                <View style={styles.tabArrows}>
                  <TextButton
                    label="Subir"
                    tone="ghost"
                    disabled={locked || index === 0}
                    onPress={() => setTabConfig(moveTab(tabConfig, name, -1))}
                    style={styles.arrow}
                  />
                  <TextButton
                    label="Bajar"
                    tone="ghost"
                    disabled={locked || index === tabConfig.order.length - 1}
                    onPress={() => setTabConfig(moveTab(tabConfig, name, 1))}
                    style={styles.arrow}
                  />
                </View>
                <Switch
                  value={!hidden}
                  disabled={locked}
                  onValueChange={(show) => setTabConfig(setTabHidden(tabConfig, name, !show))}
                  label={locked ? `${tab.label} es permanente` : `Mostrar ${tab.label}`}
                />
              </View>
            );
          })}

          <TextButton label="Restablecer barra" tone="ghost" onPress={() => setTabConfig(DEFAULT_TAB_CONFIG)} />
        </Accordion>
          </>
        ) : null}


        <SettingsSection title="Notificaciones y permisos" icon="bell" />
        <Card style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={styles.rowBody}>
              <Text style={typography.bodyStrong}>Notificaciones</Text>
              <Text style={typography.caption}>Avisos de eventos, clases y cumpleaños.</Text>
            </View>
            <View style={styles.permissionRight}>
              {permissionPill(
                notificationsSupported
                  ? { status: permission.checked ? permission.status : 'unknown', granted: permission.granted, canAskAgain: permission.canAskAgain }
                  : { status: 'unsupported', granted: false, canAskAgain: false },
                { granted: 'Activo', missing: 'Inactivo', blocked: 'Bloqueado' },
              )}
              {notificationsSupported && !permission.granted ? (
                <TextButton label="Permitir" tone="ghost" onPress={askNotifications} />
              ) : null}
            </View>
          </View>
        <Accordion title="Permiso del micrófono" subtitle="Acceso para grabar notas de voz." icon="mic" defaultOpen>
          <View style={styles.rowBetween}>
            <View style={styles.rowBody}>
              <Text style={typography.bodyStrong}>Micrófono</Text>
              <Text style={typography.caption}>Necesario para las notas de voz.</Text>
            </View>
            <View style={styles.permissionRight}>
              {permissionPill(micPermission, { granted: 'Activo', missing: 'Inactivo', blocked: 'Bloqueado' })}
              {!micPermission?.granted ? (
                <TextButton label="Permitir" tone="ghost" onPress={askMicrophone} />
              ) : null}
            </View>
          </View>
        </Accordion>
        </Card>

        <SettingsSection title="Alarmas y notificaciones" icon="clock" />
        <Card style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={styles.rowBody}>
              <Text style={typography.bodyStrong}>Alarmas exactas</Text>
              <Text style={typography.caption}>Android puede entregar alarmas aproximadas si este acceso está desactivado.</Text>
            </View>
            <View style={styles.permissionRight}>
              {permissionPill(exactAlarm, { granted: 'Activo', missing: 'Inactivo', blocked: 'Bloqueado' })}
              {exactAlarm && !exactAlarm.granted ? <TextButton label="Configurar" tone="ghost" onPress={askExactAlarm} /> : null}
            </View>
          </View>
          <Text style={typography.caption}>Canal: {ALARM_CHANNEL_ID} · Sonido predeterminado y vibración configurados por Android.</Text>
          <TextButton label="Abrir ajustes de notificaciones" tone="ghost" onPress={() => Linking.openSettings()} />
        </Card>

        <SettingsSection title="Privacidad y seguridad" icon="shieldCheck" />


        <Accordion title="Desbloqueo biométrico" subtitle={privacyLabel} icon="shieldCheck">
          {privacyNotice ? <Notice text={privacyNotice} /> : null}
          {surfaceId === 'nex' ? (
            <Image source={NEX_LOCAL_PRIVACY} style={styles.privacyArtwork} resizeMode="cover" accessible={false} importantForAccessibility="no" />
          ) : null}
          <View style={styles.privateRow}>
            <View style={styles.privateBody}>
              <Text style={typography.bodyStrong}>Pedir huella, rostro o PIN</Text>
              <Text style={styles.privateHint}>Al abrir notas y gastos marcados como privados.</Text>
            </View>
            <Switch
              value={settings?.privacyEnabled !== false}
              onValueChange={changePrivacyEnabled}
              label="Desbloqueo biométrico"
              hideLabel
            />
          </View>
          <View style={styles.actions}>
            <PrimaryButton label="Probar autenticación" onPress={testPrivacy} style={styles.actionButton} />
          </View>
        </Accordion>


        <SettingsSection title="Widget Android: Mi horario" icon="schedule" />
        <Card style={styles.card}>
          <SwitchRow
            title="Mostrar nombres de clases"
            hint="Desactivado por defecto. Solo comparte nombres y horas del horario; nunca notas ni otros datos."
            value={settings?.scheduleWidgetShowDetails === true}
            onValueChange={(value) => updateSettings({ scheduleWidgetShowDetails: value })}
          />
          <Text style={typography.caption}>
            Añádelo manteniendo pulsada la pantalla de inicio de Android y eligiendo Widgets › NexusDay › Mi horario. Se actualiza al abrir la app y al editar el horario; Android puede retrasar las actualizaciones si NexusDay está cerrado.
          </Text>
        </Card>

        <SettingsSection title="Tutorial y ayuda" icon="info" />
        <Card style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={styles.rowBody}>
              <Text style={typography.bodyStrong}>Tutorial de {APP_NAME}</Text>
              <Text style={typography.caption}>Cinco pasos visuales para practicar las funciones principales sin tocar tus datos.</Text>
            </View>
            <Pill label="5 pasos" tone="accent" />
          </View>
          <TextButton label="Ver el tutorial otra vez" onPress={replayTutorial} />
          <Text style={typography.caption}>
            Repetirlo no borra nada: solo vuelve a mostrar las diapositivas.
          </Text>
        </Card>

        <SettingsSection title="Datos y respaldos" icon="folder" count={totalItems} />
        <Card style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={typography.small}>Última copia exportada</Text>
            <Text style={[typography.small, styles.strong]}>{formatBackupDate(settings?.lastBackupAt)}</Text>
          </View>
          <View style={styles.statsRow}>
            <Stat value={formatBytes(storage?.attachments || 0)} label="Adjuntos" />
            <Stat value={formatBytes(storage?.recordings || 0)} label="Notas de voz" />
            <Stat value={formatBytes(storageTotal)} label="Peso total" />
          </View>
          <View style={styles.pillWrap}>
            <Pill label={`${activities.length} actividades`} />
            <Pill label={`${events.length} eventos`} />
            <Pill label={`${birthdays.length} cumpleaños`} />
            <Pill label={`${publicNotes.length} notas`} />
            <Pill label={`${habits.length} hábitos`} />
            <Pill label={`${publicExpenses.length} gastos`} />
            <Pill label={`${routines.length} rutinas`} />
          </View>
          <Text style={typography.caption}>
            Todo se guarda en el teléfono con AsyncStorage: no hay cuentas ni servidores. Los adjuntos
            y las notas de voz viven en el almacenamiento interno de la app.
          </Text>
          <View style={styles.actions}>
            <PrimaryButton label="Exportar copia (.json)" onPress={exportBackup} style={styles.actionButton} />
            <PrimaryButton label="Importar copia" onPress={startImport} style={styles.actionButton} />
            <TextButton label="Limpiar exportados" tone="ghost" onPress={clearExports} />
            <TextButton label="Recalcular" tone="ghost" onPress={refreshStorage} />
          </View>
          <Text style={typography.caption}>
            La copia .json junta las siete colecciones, tu perfil y la barra de solapas: guárdala en Drive,
            en tu computadora o donde quieras. Es un archivo legible y puede contener información sensible.
            Importarla reemplaza los datos actuales y pide confirmación.
          </Text>
          <Text style={typography.caption}>
            Borrar colecciones vacía actividades, eventos, cumpleaños, notas, hábitos, gastos y rutinas persistidas.
            Conserva perfil y ajustes, adjuntos, notas de voz y respaldos .json exportados.
          </Text>
          <TextButton label="Borrar colecciones y rutinas" tone="danger" onPress={() => setConfirmWipe(true)} />
        </Card>



        <SettingsSection title="Acerca de NexusDay" icon="info" />
        <Card style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={styles.rowBody}>
              <Text style={typography.bodyStrong}>{APP_NAME}</Text>
              <Text style={typography.caption}>{`Versión ${appVersion} · Expo SDK 58`}</Text>
            </View>
            <Pill label="Local-first" tone="accent" />
          </View>
          <Text style={[typography.caption, styles.aboutText]}>
            La grabación de voz y los avisos usan módulos nativos, así que la app necesita una
            versión de desarrollo (npx expo run:android o eas build --profile development) para esas funciones.
          </Text>
        </Card>

        {__DEV__ && isDevModeEnabled() ? (
          <>
            <SettingsSection title="Entorno de desarrollo" icon="zap" />
            <Card style={styles.card}>
              <View style={styles.rowBetween}>
                <View style={styles.rowBody}>
                  <Text style={typography.bodyStrong}>Laboratorio de desarrollo</Text>
                  <Text style={typography.caption}>Acceso aislado solo en builds de desarrollo.</Text>
                </View>
                <Pill label="DEV" tone="accent" />
              </View>
              <PrimaryButton label="Abrir laboratorio" onPress={() => setShowDevLab(true)} style={styles.actionButton} />
            </Card>
          </>
        ) : null}
      </Screen>

      {__DEV__ && isDevModeEnabled() ? (
        <Modal visible={showDevLab} animationType="slide" onRequestClose={() => setShowDevLab(false)}>
          <View style={{ flex: 1, backgroundColor: colors.background }}>
            <Pressable onPress={() => setShowDevLab(false)} style={{ padding: 16 }}>
              <Text style={typography.bodyStrong}>← Volver a Ajustes</Text>
            </Pressable>
            <DeveloperModeScreen />
          </View>
        </Modal>
      ) : null}

      <ConfirmSheet
        visible={confirmWipe}
        onClose={() => setConfirmWipe(false)}
        onConfirm={wipe}
        title="¿Borrar colecciones y rutinas?"
        message="Se vaciarán actividades, eventos, cumpleaños, notas, hábitos, gastos y rutinas persistidas. No se borrarán tu perfil y ajustes, adjuntos, notas de voz ni respaldos .json exportados. Esta acción no se puede deshacer."
        confirmLabel="Sí, borrar colecciones"
      />

      <ConfirmSheet
        visible={Boolean(confirmPrivateExport)}
        onClose={() => setConfirmPrivateExport(null)}
        onConfirm={confirmExportWithPrivateData}
        title="¿Exportar datos privados?"
        message="Esta copia JSON contiene notas o gastos privados en texto legible. Si continúas, NexusDay solicitará autenticación antes de crear el archivo. Guárdalo en un lugar seguro."
        confirmLabel="Continuar y autenticar"
      />

      <ConfirmSheet
        visible={Boolean(confirmImport)}
        onClose={() => setConfirmImport(null)}
        onConfirm={applyImport}
        title="¿Restaurar esta copia?"
        message={isPartialHistoricalBackup(confirmImport)
          ? 'Esta copia historica no incluye todas las colecciones. Las colecciones omitidas conservaran sus datos actuales. Los adjuntos y grabaciones locales pueden no estar incluidos en otro dispositivo.'
          : 'Estas seguro? Los datos actuales seran reemplazados. Los adjuntos y grabaciones locales pueden no estar incluidos al restaurar en otro dispositivo.'}
        confirmLabel="Sí, restaurar"
      />
    </>
  );
}

const styles = themedStyles({
  noticeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  card: { gap: spacing.md },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionHeadingTitle: { flex: 1, minWidth: 0 },
  identityHero: {
    minHeight: 190,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.elevated,
  },
  identityHalo: { position: 'absolute', width: 240, height: 120, top: -8, right: -35, opacity: 0.72 },
  identityEyebrow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  identityEyebrowText: { ...typography.overline, color: colors.accent, letterSpacing: 1.1 },
  identityTitle: { ...typography.display, fontSize: 32, lineHeight: 38, color: colors.text },
  identityDescription: { ...typography.subtitle, maxWidth: 290, flexShrink: 1 },
  identitySummary: {
    alignSelf: 'flex-start',
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  identityAccentDot: { width: 9, height: 9, borderRadius: radius.pill },
  identitySummaryText: { ...typography.label, color: colors.text },
  appearanceCard: { gap: spacing.lg, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.elevated },
  appearanceIntro: { minHeight: 86, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  appearanceIntroCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  appearanceKicker: { ...typography.overline, color: colors.accent, letterSpacing: 0.9 },
  appearanceTitle: { ...typography.title, color: colors.text },
  appearanceMark: {
    width: 60,
    height: 60,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  appearanceArc: { position: 'absolute', width: 86, height: 42, opacity: 0.8 },
  settingsArtworkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, overflow: 'hidden', borderRadius: radius.md },
  settingsArtwork: { width: 106, height: 70, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  settingsArtworkCaption: { flex: 1 },
  privacyArtwork: { width: '100%', height: 116, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  accentHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm },
  accentHeadingCopy: { flex: 1, minWidth: 150, gap: 2 },
  accentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  accentOption: {
    flexGrow: 1,
    flexBasis: '29%',
    minWidth: 66,
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  accentOptionSelected: { borderWidth: 2, backgroundColor: colors.accentSoft },
  accentSwatch: { width: 28, height: 28, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  accentLabel: { ...typography.caption, color: colors.text, textAlign: 'center' },
  appearanceDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  rowBetween: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowBody: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  actionButton: { flex: 0, alignSelf: 'flex-start', paddingHorizontal: spacing.xl },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  strong: { fontWeight: '700', color: colors.text },

  // Perfil enriquecido.
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 24, fontWeight: '800', letterSpacing: 0.5 },
  profileBody: { flex: 1, gap: 3 },

  // Permisos (dentro del acordeón).
  permissionRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  aboutText: { lineHeight: 17 },
  pressed: { opacity: 0.7 },
  choiceCheck: { width: 22, height: 22, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  // Tres opciones en una fila mantienen visible la elección completa en teléfonos estrechos.
  surfaceRow: { flexDirection: 'row', flexWrap: 'nowrap', gap: spacing.xs },
  surfaceCard: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
    padding: spacing.xs,
    borderWidth: 1.5,
    borderRadius: radius.md,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  surfaceCardSelected: { borderWidth: 2, borderColor: colors.accent, backgroundColor: colors.accentSoft },
  surfacePreview: {
    height: 88,
    overflow: 'hidden',
    gap: 5,
    padding: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.sm,
    position: 'relative',
  },
  previewNexRing: { position: 'absolute', width: 76, height: 56, top: 9, right: -18, opacity: 0.62 },
  previewHeader: { height: 15, borderRadius: radius.sm, paddingHorizontal: spacing.xs, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  previewDot: { width: 7, height: 7, borderRadius: radius.pill },
  previewHeaderLine: { width: '34%', height: 5, borderRadius: radius.pill },
  previewHeaderTrailing: { width: 14, height: 5, borderRadius: radius.pill, marginLeft: 'auto' },
  previewPanel: { flex: 1, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: spacing.xs, paddingVertical: spacing.xs, justifyContent: 'space-between', zIndex: 1 },
  previewLine: { width: '62%', height: 5, borderRadius: radius.pill },
  previewContentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  previewLineShort: { width: '38%', height: 5, borderRadius: radius.pill },
  previewAction: { width: '30%', height: 9, borderRadius: radius.pill },
  surfaceChoiceTop: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  surfaceLabel: { ...typography.label, fontSize: 13, color: colors.text, textAlign: 'center', flexShrink: 1 },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  tabIndex: { width: 18, textAlign: 'center' },
  tabBody: { flex: 1, gap: 1 },
  tabArrows: { flexDirection: 'row', alignItems: 'center' },
  arrow: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  privateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    // Wraps to a column on narrow phones so the two-line hint and the switch never
    // end up sharing one cramped line.
    flexWrap: 'wrap',
  },
  privateBody: { flex: 1, gap: 2 },
  // The long sentences of the security block wrap under the switch instead of colliding
  // with it: the row is `column` on narrow screens, so the copy always has the full width.
  privateHint: { lineHeight: 17, flexShrink: 1 },
  tabTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  lockGlyph: { fontSize: 11 },
});
