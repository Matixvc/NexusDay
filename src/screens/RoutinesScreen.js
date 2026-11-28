import { useMemo, useRef, useState } from 'react';
import { Image, Keyboard, Pressable, Text, TextInput, View } from 'react-native';
import { Screen, Card, Button, Chip, Pill, SectionTitle, TextButton } from '../components/ui/primitives';
import { ConfirmSheet, Sheet } from '../components/ui/Sheet';
import { Switch } from '../components/ui/Switch';
import { Icon } from '../components/Icon';
import { useAppData } from '../context/AppDataContext';
import { colors, palette, radius, spacing, themedStyles, typography } from '../theme/theme';
import { ROUTINE_ICONS } from '../services/routines';
import { syncRoutineAlarm } from '../services/reminders';
import { ALARM_LEAD_PRESETS, cancelAlarm, getExactAlarmPermission, normalizeAlarmLead } from '../services/notifications';
import { timeInputError } from '../services/timeInput';
import { WEEKDAYS, todayKey } from '../utils/dates';

const EMPTY_FORM = { name: '', description: '', icon: 'checkCircle', color: colors.accent, weekdays: [], startTime: '', endTime: '', alarmEnabled: false, alarmLeadMinutes: null, alarmNotificationId: null, customAlarmLead: '' };
const ROUTINE_EMPTY_ART = require('../../assets/nex/u11/routines/routine-rhythm.jpg');
const ALARM_LABELS = new Map([[15, '15 min'], [30, '30 min'], [60, '1 h'], [120, '2 h']]);

function operationMessage(error) {
  if (error === 'duplicate-routine') return 'Ya existe una rutina igual con esos días y horario.';
  if (error === 'routine-not-found') return 'La rutina ya no está disponible. Actualiza la pantalla e inténtalo otra vez.';
  if (error === 'invalid-time') return 'Revisa las horas: el término debe ir después del inicio.';
  if (error === 'invalid-weekdays') return 'Elige al menos un día de repetición.';
  if (error === 'invalid-completed-date') return 'No se pudo validar el historial de fechas.';
  if (error === 'invalid-description') return 'Revisa la descripción de la rutina.';
  if (error === 'name-required') return 'Escribe un nombre para la rutina.';
  if (error === 'invalid-alarm-lead') return 'Revisa la anticipación de la alarma.';
  if (error === 'alarm-time-required') return 'Define una hora de inicio para activar la alarma.';
  return 'No se pudo guardar en este teléfono. Tus cambios anteriores siguen disponibles.';
}

export default function RoutinesScreen() {
  const {
    routines, routinesBusy, routinesHydrated, routinesRecoveryError, createRoutine, updateRoutine,
    removeRoutine, toggleRoutineCompletion,
  } = useAppData();
  const [form, setForm] = useState(null);
  const [formInitial, setFormInitial] = useState(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [removeId, setRemoveId] = useState(null);
  const [permissionSheetOpen, setPermissionSheetOpen] = useState(false);
  const [exactAlarmPermission, setExactAlarmPermission] = useState({ status: 'checking', granted: false });
  const descriptionRef = useRef(null);
  const startTimeRef = useRef(null);
  const endTimeRef = useRef(null);
  const customAlarmRef = useRef(null);
  const savingRef = useRef(false);
  const today = todayKey();
  const selectedRoutine = useMemo(() => routines.find((item) => item.id === removeId), [routines, removeId]);

  const refreshExactPermission = async () => {
    const result = await getExactAlarmPermission();
    setExactAlarmPermission(result);
    return result;
  };
  const openCreate = () => { setNotice(''); refreshExactPermission(); const values = { ...EMPTY_FORM, color: colors.accent }; setForm(values); setFormInitial(values); };
  const openEdit = (routine) => {
    setNotice('');
    refreshExactPermission();
    const values = {
      ...routine,
      startTime: routine.startTime || '',
      endTime: routine.endTime || '',
      alarmEnabled: routine.alarmLeadMinutes != null,
      customAlarmLead: ALARM_LEAD_PRESETS.includes(routine.alarmLeadMinutes) ? '' : String(routine.alarmLeadMinutes || ''),
    };
    setForm(values);
    setFormInitial(values);
  };
  const requestClose = () => {
    if (!form || JSON.stringify(form) === JSON.stringify(formInitial)) setForm(null);
    else setDiscardOpen(true);
  };
  const patchForm = (patch) => setForm((current) => current ? ({ ...current, ...patch }) : current);

  const save = async () => {
    if (routinesBusy || savingRef.current) return;
    if (form.alarmEnabled && !form.startTime) { setNotice('Define una hora de inicio para activar la alarma.'); return; }
    const lead = form.alarmEnabled ? normalizeAlarmLead(form.alarmLeadMinutes) : null;
    if (form.alarmEnabled && !lead) { setNotice('Usa una anticipación entre 1 y 10080 minutos.'); return; }
    savingRef.current = true;
    const previous = form.id ? routines.find((item) => item.id === form.id) : null;
    const payload = {
      name: form.name,
      description: form.description,
      icon: form.icon,
      color: form.color,
      weekdays: form.weekdays,
      startTime: form.startTime || null,
      endTime: form.endTime || null,
      enabled: form.enabled !== false,
      completedDates: form.completedDates || [],
      alarmLeadMinutes: lead,
      alarmNotificationId: null,
    };
    try {
      const result = form.id ? await updateRoutine(form.id, payload) : await createRoutine(payload);
      if (!result?.ok) { setNotice(operationMessage(result?.error)); return; }
      const alarm = await syncRoutineAlarm(result.item, previous?.alarmNotificationId);
      if (lead != null && !alarm.alarmNotificationId) {
        await updateRoutine(result.item.id, { alarmLeadMinutes: null, alarmNotificationId: null });
        setForm({ ...result.item, alarmEnabled: false, alarmLeadMinutes: null, alarmNotificationId: null, customAlarmLead: '' });
        setNotice(alarm.notice || 'La rutina se guardó, pero la alarma no pudo activarse.');
        return;
      }
      if (alarm.alarmNotificationId) {
        const linked = await updateRoutine(result.item.id, { alarmNotificationId: alarm.alarmNotificationId });
        if (!linked?.ok) {
          await cancelAlarm(alarm.alarmNotificationId);
          await updateRoutine(result.item.id, { alarmLeadMinutes: null, alarmNotificationId: null });
          setNotice('La rutina se guardó, pero la alarma no pudo vincularse y quedó desactivada.');
          return;
        }
      }
      setForm(null);
      setNotice(alarm.notice || (previous ? 'Rutina actualizada.' : 'Rutina creada.'));
    } finally {
      savingRef.current = false;
    }
  };

  const confirmRemove = async () => {
    if (!removeId || routinesBusy) return;
    const result = await removeRoutine(removeId);
    if (!result?.ok) setNotice(operationMessage(result?.error));
    else {
      await cancelAlarm(selectedRoutine?.alarmNotificationId);
      setNotice('Rutina eliminada.');
    }
    setRemoveId(null);
  };

  const toggleRoutineEnabled = async (routine) => {
    if (routinesBusy) return;
    const enabled = !routine.enabled;
    const saved = await updateRoutine(routine.id, { enabled, alarmNotificationId: null });
    if (!saved?.ok) { setNotice(operationMessage(saved?.error)); return; }
    if (!enabled) {
      await cancelAlarm(routine.alarmNotificationId);
      setNotice('Rutina pausada y alarma cancelada.');
      return;
    }
    const alarm = await syncRoutineAlarm(saved.item, null);
    if (saved.item.alarmLeadMinutes != null && !alarm.alarmNotificationId) {
      await updateRoutine(routine.id, { alarmLeadMinutes: null, alarmNotificationId: null });
      setNotice(alarm.notice || 'La rutina se reanudó, pero la alarma no pudo activarse.');
      return;
    }
    if (alarm.alarmNotificationId) {
      const linked = await updateRoutine(routine.id, { alarmNotificationId: alarm.alarmNotificationId });
      if (!linked?.ok) {
        await cancelAlarm(alarm.alarmNotificationId);
        await updateRoutine(routine.id, { alarmLeadMinutes: null, alarmNotificationId: null });
        setNotice('La rutina se reanudó, pero la alarma no pudo vincularse y quedó desactivada.');
        return;
      }
    }
    setNotice(alarm.notice || 'Rutina reanudada.');
  };

  const toggleAlarm = (enabled) => {
    if (!enabled) { patchForm({ alarmEnabled: false, alarmLeadMinutes: null }); return; }
    if (!form.startTime) { setNotice('Define una hora de inicio para activar la alarma.'); return; }
    if (exactAlarmPermission.granted) { patchForm({ alarmEnabled: true, alarmLeadMinutes: 15 }); return; }
    setPermissionSheetOpen(true);
  };

  const continueAlarmSetup = async () => {
    const permission = await getExactAlarmPermission({ request: true });
    setExactAlarmPermission(permission);
    patchForm({ alarmEnabled: true, alarmLeadMinutes: 15 });
  };

  const toggleDone = async (routine) => {
    if (routinesBusy) return;
    const result = await toggleRoutineCompletion(routine.id, today);
    if (!result?.ok) { setNotice(operationMessage(result?.error)); return; }
    const alarm = await syncRoutineAlarm(result.item, routine.alarmNotificationId);
    if (result.item.alarmLeadMinutes != null && !alarm.alarmNotificationId) {
      await updateRoutine(routine.id, { alarmLeadMinutes: null, alarmNotificationId: null });
      setNotice(alarm.notice || 'El progreso se guardó, pero la alarma quedó desactivada.');
      return;
    }
    if (alarm.alarmNotificationId) {
      const linked = await updateRoutine(routine.id, { alarmNotificationId: alarm.alarmNotificationId });
      if (!linked?.ok) {
        await cancelAlarm(alarm.alarmNotificationId);
        await updateRoutine(routine.id, { alarmLeadMinutes: null, alarmNotificationId: null });
        setNotice('El progreso se guardó, pero la alarma no pudo vincularse.');
        return;
      }
    }
    setNotice(alarm.notice || (routine.completedDates.includes(today) ? 'Rutina marcada como pendiente.' : 'Rutina completada.'));
  };

  const startTimeError = form?.startTime ? timeInputError(form.startTime) : null;
  const endTimeError = form?.endTime ? timeInputError(form.endTime) : null;
  const alarmLeadError = form?.alarmEnabled && !normalizeAlarmLead(form.alarmLeadMinutes) ? 'Usa entre 1 y 10080 minutos.' : null;
  const formInvalid = Boolean(form && (!form.name.trim() || startTimeError || endTimeError || alarmLeadError || (form.alarmEnabled && !form.startTime)));

  return (
    <>
      <Screen title="Mi rutina" subtitle="Hábitos personales, sin mezclar tu horario de clases." headerRight={null}>
        <Text style={[typography.small, styles.intro]}>
          Crea una rutina recurrente para estudio, trabajo o tu vida personal. Cada rutina se guarda una sola vez y su progreso queda asociado a cada fecha.
        </Text>
        {notice ? <Text accessibilityRole="alert" style={[typography.small, styles.notice]}>{notice}</Text> : null}
        {routinesRecoveryError ? <Card accent={colors.warning} style={styles.warning}>
          <Text style={typography.bodyStrong}>No se pudieron leer las rutinas guardadas</Text>
          <Text style={typography.small}>No se modificarán esos datos automáticamente. Puedes recuperarlos importando una copia que incluya rutinas; una copia antigua se rechazará para evitar borrarlas.</Text>
        </Card> : null}
        <Button label={form ? 'Cerrar editor' : 'Crear rutina'} icon={form ? undefined : 'plus'} onPress={() => (form ? requestClose() : openCreate())} disabled={routinesBusy || routinesRecoveryError} />

        {form ? (
          <Card style={styles.editor}>
            <SectionTitle title={form.id ? 'Editar rutina' : 'Nueva rutina'} variant="editorial" />
            <Text style={typography.label}>Nombre *</Text>
            <TextInput
              value={form.name}
              onChangeText={(name) => patchForm({ name })}
              placeholder="Ej. Estudio personal"
              placeholderTextColor={colors.textMuted}
              maxLength={70}
              returnKeyType="next"
              onSubmitEditing={() => descriptionRef.current?.focus()}
              accessibilityLabel="Nombre obligatorio de la rutina"
              style={styles.input}
            />
            <Text style={typography.label}>Descripción (opcional)</Text>
            <TextInput
              value={form.description}
              onChangeText={(description) => patchForm({ description })}
              placeholder="Un detalle que te ayude a reconocerla"
              placeholderTextColor={colors.textMuted}
              maxLength={160}
              accessibilityLabel="Descripción opcional"
              style={[styles.input, styles.multiline]}
              multiline
              ref={descriptionRef}
              returnKeyType="next"
              onSubmitEditing={() => startTimeRef.current?.focus()}
            />
            <Text style={typography.label}>Se repite</Text>
            <View style={styles.chips}>
              {WEEKDAYS.map((day, index) => {
                const selected = form.weekdays.includes(index);
                return <Chip key={day.short} label={day.short} selected={selected} onPress={() => patchForm({ weekdays: selected ? form.weekdays.filter((value) => value !== index) : [...form.weekdays, index].sort((a, b) => a - b) })} accessibilityLabel={`${day.long}${selected ? ', seleccionado' : ''}`} />;
              })}
            </View>
            <Text style={typography.label}>Horario (opcional)</Text>
            <View style={styles.timeRow}>
              <View style={styles.timeField}><TextInput ref={startTimeRef} value={form.startTime} onChangeText={(startTime) => patchForm({ startTime })} placeholder="Inicio HH:MM" placeholderTextColor={colors.textMuted} keyboardType="numbers-and-punctuation" maxLength={5} returnKeyType="next" onSubmitEditing={() => endTimeRef.current?.focus()} accessibilityLabel="Hora de inicio opcional, formato 24 horas" style={[styles.input, styles.timeInput]} />{startTimeError ? <Text accessibilityRole="alert" style={styles.fieldError}>{startTimeError}</Text> : null}</View>
              <View style={styles.timeField}><TextInput ref={endTimeRef} value={form.endTime} onChangeText={(endTime) => patchForm({ endTime })} placeholder="Término HH:MM" placeholderTextColor={colors.textMuted} keyboardType="numbers-and-punctuation" maxLength={5} returnKeyType={form.alarmEnabled ? 'next' : 'done'} onSubmitEditing={() => form.alarmEnabled && !ALARM_LEAD_PRESETS.includes(form.alarmLeadMinutes) ? customAlarmRef.current?.focus() : Keyboard.dismiss()} accessibilityLabel="Hora de término opcional, formato 24 horas" style={[styles.input, styles.timeInput]} />{endTimeError ? <Text accessibilityRole="alert" style={styles.fieldError}>{endTimeError}</Text> : null}</View>
            </View>
            <View style={styles.alarmBlock}>
              <View style={styles.alarmHeading}>
                <View style={styles.alarmCopy}>
                  <Text style={typography.bodyStrong}>Alarma</Text>
                  <Text style={typography.caption}>Sonido y vibración antes de la próxima rutina.</Text>
                </View>
                <Switch value={form.alarmEnabled} onValueChange={toggleAlarm} label="Activar alarma de rutina" hideLabel />
              </View>
              {form.alarmEnabled ? (
                <>
                  <Text style={[typography.caption, exactAlarmPermission.granted ? styles.exactStatus : styles.approximateStatus]}>
                    {exactAlarmPermission.granted ? 'Alarma exacta permitida por Android.' : 'Aviso aproximado: Android puede entregarlo con retraso.'}
                  </Text>
                  <View style={styles.chips}>
                    {ALARM_LEAD_PRESETS.map((minutes) => (
                      <Chip key={minutes} label={ALARM_LABELS.get(minutes)} selected={form.alarmLeadMinutes === minutes} onPress={() => patchForm({ alarmLeadMinutes: minutes, customAlarmLead: '' })} />
                    ))}
                    <Chip label="Personalizada" selected={!ALARM_LEAD_PRESETS.includes(form.alarmLeadMinutes)} onPress={() => {
                      const custom = normalizeAlarmLead(form.customAlarmLead) || 45;
                      patchForm({ alarmLeadMinutes: custom, customAlarmLead: String(custom) });
                    }} />
                  </View>
                  {alarmLeadError ? <Text accessibilityRole="alert" style={styles.fieldError}>{alarmLeadError}</Text> : null}
                  {!ALARM_LEAD_PRESETS.includes(form.alarmLeadMinutes) ? (
                    <TextInput ref={customAlarmRef} value={form.customAlarmLead} onChangeText={(text) => patchForm({ customAlarmLead: text, alarmLeadMinutes: normalizeAlarmLead(text) })} placeholder="Minutos antes, ej. 45" placeholderTextColor={colors.textMuted} keyboardType="number-pad" maxLength={5} returnKeyType="done" onSubmitEditing={() => Keyboard.dismiss()} accessibilityLabel="Anticipación personalizada de alarma en minutos" style={styles.input} />
                  ) : null}
                </>
              ) : null}
            </View>
            <Text style={typography.label}>Icono</Text>
            <View style={styles.colors}>
              {ROUTINE_ICONS.map((icon) => (
                <Pressable key={icon} onPress={() => patchForm({ icon })} accessibilityRole="radio" accessibilityState={{ checked: form.icon === icon }} accessibilityLabel={`Icono ${icon}`} style={[styles.iconChoice, form.icon === icon ? styles.iconSelected : null]}>
                  <Icon name={icon} size={20} color={form.icon === icon ? colors.accent : colors.textSecondary} />
                </Pressable>
              ))}
            </View>
            <Text style={typography.label}>Color</Text>
            <View style={styles.colors}>
              {palette.slice(0, 6).map((color) => (
                <Pressable key={color} onPress={() => patchForm({ color })} accessibilityRole="radio" accessibilityState={{ checked: form.color === color }} accessibilityLabel={`Color ${color}`} style={[styles.swatch, { backgroundColor: color }, form.color === color ? styles.swatchSelected : null]} />
              ))}
            </View>
            <View style={styles.actions}>
              <Button label="Guardar rutina" onPress={save} loading={routinesBusy} disabled={formInvalid} />
              <TextButton label="Cancelar" tone="ghost" onPress={requestClose} disabled={routinesBusy} />
            </View>
          </Card>
        ) : null}

        <SectionTitle title="Rutinas semanales" count={routines.length} variant="editorial" />
        {!routinesHydrated ? <Text style={typography.small}>Cargando rutinas…</Text> : null}
        {routinesHydrated && !routinesRecoveryError && routines.length === 0 ? (
          <Card style={styles.empty}>
            <Image source={ROUTINE_EMPTY_ART} style={styles.emptyArt} resizeMode="cover" accessible={false} importantForAccessibility="no" />
            <View style={styles.emptyCopy}>
              <Text style={typography.bodyStrong}>Tu espacio personal está listo</Text>
              <Text style={typography.small}>Añade una rutina para verla junto a tus clases y eventos en Día a Día.</Text>
            </View>
          </Card>
        ) : null}
        {routines.map((routine) => {
          const completed = routine.completedDates.includes(today);
          const days = routine.weekdays.map((index) => WEEKDAYS[index].short).join(' · ');
          const time = routine.startTime ? `${routine.startTime}${routine.endTime ? `–${routine.endTime}` : ''}` : 'Sin hora';
          return (
            <Card key={routine.id} accent={routine.color || colors.accent} style={styles.routineCard}>
              <View style={styles.routineHeading}>
                <View style={[styles.routineIcon, { backgroundColor: routine.color || colors.accent }]}>
                  <Icon name={routine.icon} size={19} color={colors.background} />
                </View>
                <View style={styles.routineCopy}>
                  <Text style={typography.bodyStrong} accessibilityRole="header">{routine.name}</Text>
                  <Text style={typography.caption}>{days} · {time}</Text>
                  {routine.description ? <Text style={typography.small}>{routine.description}</Text> : null}
                  {routine.alarmLeadMinutes != null ? (
                    <Text style={typography.caption}>
                      {routine.enabled === false
                        ? 'Alarma pausada'
                        : routine.alarmNotificationId
                          ? `Alarma · ${ALARM_LABELS.get(routine.alarmLeadMinutes) || `${routine.alarmLeadMinutes} min`}`
                          : 'Alarma pendiente de reconciliación'}
                    </Text>
                  ) : null}
                </View>
                <Pill label={completed ? 'Hecha hoy' : routine.enabled ? 'Activa' : 'Pausada'} tone={completed ? 'accent' : 'neutral'} />
              </View>
              <View style={styles.actions}>
                <Button label={completed ? 'Marcar pendiente' : 'Completar hoy'} variant="secondary" onPress={() => toggleDone(routine)} disabled={routinesBusy || !routine.enabled} />
                <TextButton label="Editar" onPress={() => openEdit(routine)} disabled={routinesBusy} />
                <TextButton label={routine.enabled ? 'Pausar' : 'Reanudar'} onPress={() => toggleRoutineEnabled(routine)} disabled={routinesBusy} />
                <TextButton label="Eliminar" tone="danger" onPress={() => setRemoveId(routine.id)} disabled={routinesBusy} />
              </View>
            </Card>
          );
        })}
      </Screen>
      <ConfirmSheet
        visible={discardOpen}
        onClose={() => setDiscardOpen(false)}
        onConfirm={() => { setDiscardOpen(false); setForm(null); }}
        title="¿Descartar cambios?"
        message="Se perderán los cambios de esta rutina."
        confirmLabel="Descartar"
      />
      <ConfirmSheet
        visible={Boolean(removeId)}
        onClose={() => setRemoveId(null)}
        onConfirm={confirmRemove}
        title="¿Eliminar rutina?"
        message={selectedRoutine ? `Se eliminará “${selectedRoutine.name}” y se conservará el resto de tus rutinas.` : 'Esta acción no se puede deshacer.'}
        confirmLabel="Eliminar rutina"
      />
      <Sheet
        visible={permissionSheetOpen}
        onClose={() => setPermissionSheetOpen(false)}
        title="Permitir alarmas exactas"
        subtitle="Puedes cancelar. Sin este permiso Android puede entregar la alarma con retraso."
        scrollable={false}
      >
        <View style={styles.permissionActions}>
          <TextButton label="Cancelar" tone="ghost" onPress={() => setPermissionSheetOpen(false)} />
          <Button label="Continuar" onPress={async () => {
            setPermissionSheetOpen(false);
            await continueAlarmSetup();
          }} />
        </View>
      </Sheet>
    </>
  );
}

const styles = themedStyles({
  intro: { marginBottom: spacing.sm },
  notice: { color: colors.accent, marginVertical: spacing.xs },
  editor: { gap: spacing.md },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.text, fontFamily: 'Manrope', fontSize: 15 },
  multiline: { minHeight: 76, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  timeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  timeField: { flex: 1, minWidth: 145, gap: spacing.xs },
  fieldError: { color: colors.danger, fontSize: 12, fontFamily: 'Manrope' },
  timeInput: { flex: 1, minWidth: 145 },
  alarmBlock: { gap: spacing.sm, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  alarmHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  alarmCopy: { flex: 1, gap: 2 },
  exactStatus: { color: colors.mint },
  approximateStatus: { color: colors.amber },
  permissionActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  iconChoice: { width: 48, height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  iconSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  swatch: { width: 48, height: 48, borderRadius: radius.pill, borderWidth: 2, borderColor: 'transparent' },
  swatchSelected: { borderColor: colors.text, transform: [{ scale: 1.08 }] },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  empty: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.md },
  emptyArt: { width: 112, height: 112, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  emptyCopy: { flex: 1, minWidth: 160, gap: spacing.xs },
  warning: { gap: spacing.xs },
  routineCard: { gap: spacing.sm },
  routineHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  routineIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  routineCopy: { flex: 1, minWidth: 145, gap: spacing.xs },
});
