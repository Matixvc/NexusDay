import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { themedStyles, colors, radius, spacing, typography } from '../theme/theme';
import { ACCENT_THEMES, getAccentTheme, resolveAccent } from '../theme/accents';
import { SURFACE_MODES, getSurfaceMode } from '../theme/surfaces';
import { isLockedTab, tabByName } from '../navigation/tabs';
import { DEFAULT_TAB_CONFIG, moveTab, setTabHidden } from '../services/tabs';
import { authenticate, describeCapability, describePrivacyFailure } from '../services/privacy';
import { useAccentTheme } from '../context/ThemeContext';
import { useAppData } from '../context/AppDataContext';
import { Card, Notice, Pill, PrimaryButton, Screen, SectionTitle, Stat, TextButton } from '../components/ui/primitives';
import { TextField } from '../components/ui/inputs';
import { ConfirmSheet } from '../components/ui/Sheet';
import { Switch } from '../components/ui/Switch';
import { plural } from '../utils/text';
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

const PERMISSION_TONE = { granted: 'accent', unknown: 'neutral', denied: 'warning' };

/** Nombre configurado en app.json (la app se puede renombrar sin tocar la copia). */
const APP_NAME = Constants.expoConfig?.name || 'NexusDay';

function permissionPill(permission, labels) {
  if (!permission) return <Pill label="Consultando…" />;
  const tone = PERMISSION_TONE[permission.status] || 'warning';
  const label = permission.granted ? labels.granted : permission.canAskAgain ? labels.missing : labels.blocked;
  return <Pill label={label} tone={tone} />;
}

export default function SettingsScreen() {
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
    replayTutorial,
    tabConfig,
    setTabConfig,
    permission,
    refreshPermission,
    requestNotifications,
    notificationsSupported,
  } = useAppData();

  // What the phone can authenticate with (biometric enrolled or device passcode only).
  const [privacyLabel, setPrivacyLabel] = useState('Consultando…');
  const [privacyNotice, setPrivacyNotice] = useState(null);

  // The greeting reads `userName` (`@nexusday/v1/user_name`) — the very same value the
  // tutorial writes — so the field has to start from there and save back to there.
  // `nameDraft` stays null until the user types, so the persisted name appears as soon as
  // the context hydrates without an effect that mirrors state into state.
  const [nameDraft, setNameDraft] = useState(null);
  const [micPermission, setMicPermission] = useState(null);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [notice, setNotice] = useState(null);
  const [info, setInfo] = useState(null);

  const name = nameDraft ?? userName ?? '';
  const setName = setNameDraft;

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
    const result = await authenticate({ promptMessage: 'Prueba el desbloqueo de NexusDay' });
    setPrivacyNotice(result.ok ? 'Autenticación correcta.' : describePrivacyFailure(result.reason));
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
    updateSettings({ displayName: next });
    setInfo(next ? `Listo, te voy a saludar como ${next}.` : 'Se quitó el nombre del saludo.');
  };

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
    setInfo('Se borraron los archivos exportados (.ics).');
  };

  const wipe = () => {
    clearAllData();
    setInfo('Se borraron todas las colecciones locales.');
  };

  const appVersion = Constants.expoConfig?.version || '1.0.0';
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

        <SectionTitle title="Tema" count={ACCENT_THEMES.length + SURFACE_MODES.length} />
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
                  onPress={() => setAccentId(option.id)}
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
                    <View style={[styles.themeSwatch, styles.themeSwatchAlt, { backgroundColor: option.alt }]} />
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
            El fondo sobre el que se pinta todo lo demás. Negro puro deja los píxeles apagados en
            las pantallas AMOLED; claro es blanco real, con textos oscuros de verdad.
          </Text>
          <View style={styles.surfaceRow}>
            {SURFACE_MODES.map((mode) => {
              const selected = mode.id === surfaceId;
              return (
                <Pressable
                  key={mode.id}
                  onPress={() => setSurfaceId(mode.id)}
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
                        { backgroundColor: resolveAccent(getAccentTheme(accentId), mode.id).accent },
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
            Los adjuntos y las notas de voz viven en el almacenamiento interno de la app; los archivos exportados (.ics) son
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
            <Pill label={plural(activities.length, 'actividad')} />
            <Pill label={plural(events.length, 'evento')} />
            <Pill label={plural(birthdays.length, 'cumpleaños')} />
            <Pill label={plural(notes.length, 'nota')} />
            <Pill label={plural(habits.length, 'hábito')} />
            <Pill label={plural(expenses.length, 'gasto')} />
          </View>
          <Text style={typography.caption}>
            Todo se guarda en el teléfono con AsyncStorage: no hay cuentas, servidores ni sincronización en la nube.
          </Text>
          <TextButton label="Borrar todos los datos" tone="danger" onPress={() => setConfirmWipe(true)} />
        </Card>

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
                    {locked ? <Text style={styles.lockGlyph}>🔒</Text> : null}
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
                    label="↑"
                    tone="ghost"
                    disabled={locked || index === 0}
                    onPress={() => setTabConfig(moveTab(tabConfig, name, -1))}
                    style={styles.arrow}
                  />
                  <TextButton
                    label="↓"
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

        <SectionTitle title="Seguridad" />
        <Card style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={styles.rowBody}>
              <Text style={typography.bodyStrong}>Seguridad biométrica / PIN</Text>
              <Text style={typography.caption}>{privacyLabel}</Text>
            </View>
            <Pill label="Nativo" tone="accent" />
          </View>
          <View style={styles.privateRow}>
            <View style={styles.privateBody}>
              <Text style={typography.bodyStrong}>Pedir desbloqueo al abrir privados</Text>
              <Text style={[typography.caption, styles.privateHint]}>
                Las notas y los gastos marcados con 🔒 se abren solo después de la autenticación del sistema.
              </Text>
            </View>
              <Switch
                value={settings?.privacyEnabled !== false}
                onValueChange={(value) => updateSettings({ privacyEnabled: value })}
                // The title above already names the control; repeating it as visible text is
                // what made the row cramped. The label stays for screen readers.
                hideLabel
                label="Pedir desbloqueo al abrir privados"
              />
          </View>
          {privacyNotice ? <Notice text={privacyNotice} /> : null}
          <View style={styles.actions}>
            <PrimaryButton label="Probar autenticación" onPress={testPrivacy} style={styles.actionButton} />
          </View>
          <Text style={typography.caption}>
            Se usa la autenticación del propio teléfono (huella, Face ID o PIN): la app nunca guarda datos
            biométricos.
          </Text>
        </Card>

        <SectionTitle title="Ayuda" />
        <Card style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={styles.rowBody}>
              <Text style={typography.bodyStrong}>Tutorial de {APP_NAME}</Text>
              <Text style={typography.caption}>Las cinco pantallas del primer arranque, otra vez.</Text>
            </View>
            <Pill label="5 pasos" tone="accent" />
          </View>
          <TextButton label="Ver el tutorial otra vez" onPress={replayTutorial} />
          <Text style={typography.caption}>
            Repetirlo no borra nada: solo vuelve a mostrar las diapositivas.
          </Text>
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
            La grabación de voz y los avisos usan módulos nativos, así que la app necesita una
            versión de desarrollo (npx expo run:android o eas build --profile development) para esas funciones.
          </Text>
        </Card>
      </Screen>

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

const styles = themedStyles({
  noticeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  card: { gap: spacing.md },
  rowBetween: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowBody: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  actionButton: { flex: 0, alignSelf: 'flex-start', paddingHorizontal: spacing.xl },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
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
  // Surface picker: three miniature screens side by side, wide enough to read the label under
  // them and narrow enough to stay on one line on a 320 dp phone.
  surfaceRow: { flexDirection: 'row', gap: spacing.sm },
  surfaceCard: {
    flex: 1,
    minWidth: 92,
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
