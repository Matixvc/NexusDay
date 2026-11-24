import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { themedStyles, colors, radius, spacing, typography } from '../theme/theme';
import { ACCENT_THEMES, getAccentTheme, resolveAccent, resolvePreviewAccent } from '../theme/accents';
import { SURFACE_MODES, getSurfaceMode } from '../theme/surfaces';
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

const PERMISSION_TONE = { granted: 'accent', unknown: 'neutral', denied: 'warning' };

/** Las seis colecciones que una copia de seguridad debe (poder) traer. */
const BACKUP_COLLECTIONS = ['activities', 'events', 'birthdays', 'notes', 'habits', 'expenses'];

/**
 * Integridad del archivo elegido: `null` si es un respaldo utilizable, o el motivo concreto

 */
function validateBackup(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return 'El archivo no es una copia de seguridad válida.';
  }
  if (parsed.app !== 'NexusDay') {
    return 'Ese archivo no es una copia de NexusDay (falta la marca del documento).';
  }
  const collections = parsed.collections;
  if (!collections || typeof collections !== 'object' || Array.isArray(collections)) {
    return 'La copia no contiene colecciones.';
  }
  const present = BACKUP_COLLECTIONS.filter((name) => name in collections);
  if (!present.length) return 'La copia no contiene ninguna colección conocida.';
  const broken = present.find((name) => !Array.isArray(collections[name]));
  if (broken) return `La colección “${broken}” está dañada en el archivo.`;
  return null;
}

/** Nombre configurado en app.json (la app se puede renombrar sin tocar la copia). */
const APP_NAME = Constants.expoConfig?.name || 'NexusDay';

function permissionPill(permission, labels) {
  if (!permission) return <Pill label="Consultando⬦" />;
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

export default function SettingsScreen({ navigation }) {
  const { accentId, setAccentId, surfaceId, setSurfaceId } = useAccentTheme();
  const {
    activities,
    events,
    birthdays,
    notes,
    habits,
    expenses,
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
  } = useAppData();

  // What the phone can authenticate with (biometric enrolled or device passcode only).
  const [privacyLabel, setPrivacyLabel] = useState('Consultando⬦');
  const [privacyNotice, setPrivacyNotice] = useState(null);



  // `nameDraft` stays null until the user types, so the persisted name appears as soon as
  // the context hydrates without an effect that mirrors state into state.
  const [nameDraft, setNameDraft] = useState(null);
  const [careerDraft, setCareerDraft] = useState(null);
  const [micPermission, setMicPermission] = useState(null);
  const [confirmWipe, setConfirmWipe] = useState(false);
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

  /** Exporta una copia local y registra la fecha si el usuario la comparte. */
  const exportBackup = useCallback(async () => {
    tapHaptic();
    const payload = {
      app: 'NexusDay',
      schema: 1,
      exportedAt: Date.now(),
      collections: { activities, events, birthdays, notes, habits, expenses },
      settings: settings || {},
      userName,
      tabConfig,
    };
    const result = await shareText({
      folder: FOLDERS.exports,
      name: `nexusday-copia-${new Date().toISOString().slice(0, 10)}.json`,
      text: JSON.stringify(payload, null, 2),
      dialogTitle: 'Exportar copia de seguridad',
    });
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
  }, [
    activities,
    events,
    birthdays,
    notes,
    habits,
    expenses,
    settings,
    userName,
    tabConfig,
    updateSettings,
    refreshStorage,
  ]);

  /**
   * Elige un .json, valida su integridad y solo entonces pide confirmación. Restaurar
   * sobrescribe todo, así que el usuario tiene que decirlo explícitamente.
   */
  const startImport = useCallback(async () => {
    tapHaptic();
    const picked = await pickAndImport({
      type: 'application/json',
      folder: FOLDERS.exports,
      prefix: 'copia',
    });
    const problem = describePickStatus(picked.status);
    if (problem) {
      setNotice(problem);
      return;
    }
    if (picked.status === 'cancel') return;

    let parsed = null;
    try {
      parsed = JSON.parse(readText(picked.file.uri));
    } catch {
      setNotice('El archivo no se pudo leer como JSON. Elige una copia exportada desde NexusDay.');
      return;
    }
    const invalid = validateBackup(parsed);
    if (invalid) {
      setNotice(invalid);
      return;
    }
    setConfirmImport(parsed);
  }, []);

  /** Aplica la copia ya confirmada y refresca todo lo derivado (storage, avisos). */
  const applyImport = async () => {
    if (!confirmImport) return;
    const collections = confirmImport.collections || {};
    const total = BACKUP_COLLECTIONS.reduce((sum, name) => sum + (collections[name]?.length || 0), 0);
    const importedDisablesPrivacy =
      settings?.privacyEnabled !== false && confirmImport.settings?.privacyEnabled === false;
    let result = null;
    const authorization = await authorizePrivateAction({
      record: { private: hasPrivateRecords || importedDisablesPrivacy },
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
          settings: confirmImport.settings,
          userName: confirmImport.userName,
          tabConfig: confirmImport.tabConfig,
        });
      },
    });
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
    const result = await authorizePrivateAction({
      record: { private: hasPrivateRecords },
      action: PRIVATE_ACTIONS.delete,
      privacyEnabled: true,
      promptMessage: 'Autoriza borrar los datos protegidos',
      onAuthorized: () => {
        clearAllData();
        setInfo('Se borraron todas las colecciones locales.');
      },
    });
    if (!result.ok) setNotice(describePrivacyFailure(result.reason));
  };

  const appVersion = Constants.expoConfig?.version || '1.0.0';
  const storageTotal = storage ? storage.attachments + storage.recordings + storage.exports : 0;
  const showNavigationCustomization = false;
  const totalItems =
    activities.length + events.length + birthdays.length + publicNotes.length + habits.length + publicExpenses.length;

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


        <SectionTitle title="Perfil" />
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

          <TextField
            label="¿Cómo te llamo?"
            value={name}
            onChangeText={setName}
            placeholder="Tu nombre"
            maxLength={20}
            onSubmitEditing={saveName}
          />
          <TextField
            label="Carrera u ocupación"
            value={career}
            onChangeText={setCareer}
            placeholder="Ej. Ingeniería en Sistemas"
            maxLength={40}
            onSubmitEditing={saveCareer}
          />
          <TextButton label="Guardar perfil" onPress={saveName} />
        </Card>


        <SectionTitle title="Apariencia y personalización" />

        <Card style={styles.card}>
          <Text style={styles.fieldLabel}>Acento</Text>
          <Text style={typography.caption}>
            El acento tiñe botones, la solapa activa, los chips y el calendario. Se guarda en el
            dispositivo y se aplica al instante, con el mismo toque.
          </Text>
          <View style={styles.themeGrid}>
            {ACCENT_THEMES.map((option) => {
              // The preview shows the variant the accent actually takes on the current surface:
              // promising a mint chip and delivering a dark teal one would be a lie.
              const preview = resolveAccent(option, surfaceId);
              const selected = option.id === accentId;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => {
                    // El mismo toque que los demás selectores de Ajustes.
                    selectHaptic();
                    setAccentId(option.id);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${option.label}. ${option.hint}`}
                  style={({ pressed }) => [
                    styles.themeCard,
                    selected ? { borderColor: preview.accent } : null,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <View style={styles.themeSwatches}>
                    <View style={[styles.themeSwatch, { backgroundColor: preview.accent }]} />
                    <View style={[styles.themeSwatch, styles.themeSwatchAlt, { backgroundColor: preview.alt }]} />
                  </View>
                  <Text style={styles.themeLabel} numberOfLines={1}>
                    {option.label}
                  </Text>
                  <Text style={typography.caption} numberOfLines={2}>
                    {option.hint}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.fieldLabel}>Modo de pantalla</Text>
          <Text style={typography.caption}>
            Cuatro identidades compartidas para toda la app. Blanco y negro conserva el acento
            elegido para cuando vuelvas a Claro, Oscuro o Nex.
          </Text>
          <View style={styles.surfaceRow}>
            {SURFACE_MODES.map((mode) => {
              const selected = mode.id === surfaceId;
              return (
                <Pressable
                  key={mode.id}
                  onPress={() => {
                    // El mismo toque que el selector de acento.
                    selectHaptic();
                    setSurfaceId(mode.id);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${mode.label}. ${mode.hint}`}
                  style={({ pressed }) => [
                    styles.surfaceCard,
                    selected ? { borderColor: colors.accent } : null,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  {/* The miniature is painted with the *previewed* mode's own tokens, which is
                      the one place a colour may be read straight off the palette: it has to show
                      what the screen would look like, not what it currently looks like. */}
                  <View
                    style={[
                      styles.surfacePreview,
                      { backgroundColor: mode.tokens.background, borderColor: mode.tokens.border },
                    ]}
                  >
                    <View style={[styles.surfaceBar, { backgroundColor: mode.tokens.text }]} />
                    <View
                      style={[
                        styles.surfaceBar,
                        styles.surfaceBarShort,
                        { backgroundColor: resolvePreviewAccent(getAccentTheme(accentId), mode.id, surfaceId).accent },
                      ]}
                    />
                  </View>
                  <Text style={styles.surfaceLabel} numberOfLines={1}>
                    {mode.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={typography.caption}>{getSurfaceMode(surfaceId).hint}</Text>
        </Card>


        <Card style={styles.card}>
          <SwitchRow
            title="Reducir animaciones"
            hint="Desactiva la transición al abrir y cerrar secciones."
            value={settings?.reduceMotion === true}
            onValueChange={(value) => updateSettings({ reduceMotion: value })}
          />
        </Card>

        <SectionTitle title="Notificaciones" />
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
        </Card>

        <SectionTitle title="Privacidad y seguridad" />
        <Accordion title="Permisos del sistema" subtitle="Acceso al micrófono para grabar notas de voz." icon="mic" defaultOpen>
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

        <Accordion title="Desbloqueo biométrico" subtitle={privacyLabel} icon="shieldCheck">
          {privacyNotice ? <Notice text={privacyNotice} /> : null}
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


        <SectionTitle title="Datos y respaldos" count={totalItems} />
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
            La copia .json junta las seis colecciones, tu perfil y la barra de solapas: guárdala en Drive,
            en tu computadora o donde quieras. Importarla reemplaza los datos actuales y pide confirmación.
          </Text>
          <TextButton label="Borrar todos los datos" tone="danger" onPress={() => setConfirmWipe(true)} />
        </Card>

        {showNavigationCustomization ? (
          <>
        <SectionTitle title="Personalizar Navegación" count={tabConfig.order.length} />
        <Card style={styles.card}>
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
                    label="� "
                    tone="ghost"
                    disabled={locked || index === 0}
                    onPress={() => setTabConfig(moveTab(tabConfig, name, -1))}
                    style={styles.arrow}
                  />
                  <TextButton
                    label="� "
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
        </Card>
          </>
        ) : null}

        <SectionTitle title="Tutorial y ayuda" />
        <Card style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={styles.rowBody}>
              <Text style={typography.bodyStrong}>Tutorial de {APP_NAME}</Text>
              <Text style={typography.caption}>Cuatro pasos breves para volver a conocer NexusDay.</Text>
            </View>
            <Pill label="4 pasos" tone="accent" />
          </View>
          <TextButton label="Ver el tutorial otra vez" onPress={replayTutorial} />
          <Text style={typography.caption}>
            Repetirlo no borra nada: solo vuelve a mostrar las diapositivas.
          </Text>
        </Card>

        <SectionTitle title="Acerca de NexusDay" />
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
            <SectionTitle title="Entorno de desarrollo" />
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
        title="¿Borrar todos los datos?"
        message="¿Estás seguro de que quieres eliminar estos datos? Esta acción no se puede deshacer."
        confirmLabel="Sí, eliminar"
      />

      <ConfirmSheet
        visible={Boolean(confirmImport)}
        onClose={() => setConfirmImport(null)}
        onConfirm={applyImport}
        title="¿Restaurar esta copia?"
        message="¿Estás seguro? Los datos actuales se reemplazarán por los de la copia. Esta acción no se puede deshacer."
        confirmLabel="Sí, restaurar"
      />
    </>
  );
}

const styles = themedStyles({
  noticeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  card: { gap: spacing.md },
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
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  themeCard: {
    flexGrow: 1,
    flexBasis: '46%',
    gap: spacing.xs,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  themeSwatches: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 2 },
  themeSwatch: { width: 18, height: 18, borderRadius: radius.pill },
  themeSwatchAlt: { width: 10, height: 10 },
  themeLabel: { ...typography.bodyStrong, fontSize: 14, color: colors.text },
  // Dos columnas mantienen legibles las cuatro identidades incluso en un teléfono de 320 dp.
  surfaceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  surfaceCard: {
    flexGrow: 1,
    flexBasis: '46%',
    gap: spacing.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  surfacePreview: {
    height: 46,
    gap: spacing.xs,
    padding: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.sm,
  },
  surfaceBar: { height: 5, width: '70%', borderRadius: radius.pill },
  surfaceBarShort: { width: '42%' },
  surfaceLabel: { ...typography.bodyStrong, fontSize: 12.5, color: colors.text },
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
