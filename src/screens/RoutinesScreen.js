import { useMemo, useState } from 'react';
import { Image, Pressable, Text, TextInput, View } from 'react-native';
import { Screen, Card, Button, Chip, Pill, SectionTitle, TextButton } from '../components/ui/primitives';
import { ConfirmSheet } from '../components/ui/Sheet';
import { Icon } from '../components/Icon';
import { useAppData } from '../context/AppDataContext';
import { colors, palette, radius, spacing, themedStyles, typography } from '../theme/theme';
import { ROUTINE_ICONS } from '../services/routines';
import { WEEKDAYS, todayKey } from '../utils/dates';

const EMPTY_FORM = { name: '', description: '', icon: 'checkCircle', color: colors.accent, weekdays: [], startTime: '', endTime: '' };
const ROUTINE_EMPTY_ART = require('../../assets/nex/u11/routines/routine-rhythm.jpg');

function operationMessage(error) {
  if (error === 'duplicate-routine') return 'Ya existe una rutina igual con esos días y horario.';
  if (error === 'routine-not-found') return 'La rutina ya no está disponible. Actualiza la pantalla e inténtalo otra vez.';
  if (error === 'invalid-time') return 'Revisa las horas: el término debe ir después del inicio.';
  if (error === 'invalid-weekdays') return 'Elige al menos un día de repetición.';
  if (error === 'invalid-completed-date') return 'No se pudo validar el historial de fechas.';
  if (error === 'invalid-description') return 'Revisa la descripción de la rutina.';
  if (error === 'name-required') return 'Escribe un nombre para la rutina.';
  return 'No se pudo guardar en este teléfono. Tus cambios anteriores siguen disponibles.';
}

export default function RoutinesScreen() {
  const {
    routines, routinesBusy, routinesHydrated, routinesRecoveryError, createRoutine, updateRoutine,
    removeRoutine, toggleRoutineCompletion,
  } = useAppData();
  const [form, setForm] = useState(null);
  const [notice, setNotice] = useState('');
  const [removeId, setRemoveId] = useState(null);
  const today = todayKey();
  const selectedRoutine = useMemo(() => routines.find((item) => item.id === removeId), [routines, removeId]);

  const openCreate = () => { setNotice(''); setForm({ ...EMPTY_FORM, color: colors.accent }); };
  const openEdit = (routine) => { setNotice(''); setForm({ ...routine, startTime: routine.startTime || '', endTime: routine.endTime || '' }); };
  const patchForm = (patch) => setForm((current) => ({ ...current, ...patch }));

  const save = async () => {
    if (routinesBusy) return;
    const result = form.id
      ? await updateRoutine(form.id, form)
      : await createRoutine(form);
    if (!result?.ok) { setNotice(operationMessage(result?.error)); return; }
    setForm(null);
    setNotice(form.id ? 'Rutina actualizada.' : 'Rutina creada.');
  };

  const confirmRemove = async () => {
    if (!removeId || routinesBusy) return;
    const result = await removeRoutine(removeId);
    if (!result?.ok) setNotice(operationMessage(result?.error));
    else setNotice('Rutina eliminada.');
    setRemoveId(null);
  };

  const toggleDone = async (routine) => {
    if (routinesBusy) return;
    const result = await toggleRoutineCompletion(routine.id, today);
    if (!result?.ok) setNotice(operationMessage(result?.error));
    else setNotice(routine.completedDates.includes(today) ? 'Rutina marcada como pendiente.' : 'Rutina completada.');
  };

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
        <Button label={form ? 'Cerrar editor' : 'Crear rutina'} icon={form ? undefined : 'plus'} onPress={() => (form ? setForm(null) : openCreate())} disabled={routinesBusy || routinesRecoveryError} />

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
              <TextInput value={form.startTime} onChangeText={(startTime) => patchForm({ startTime })} placeholder="Inicio HH:MM" placeholderTextColor={colors.textMuted} keyboardType="numbers-and-punctuation" maxLength={5} accessibilityLabel="Hora de inicio opcional, formato 24 horas" style={[styles.input, styles.timeInput]} />
              <TextInput value={form.endTime} onChangeText={(endTime) => patchForm({ endTime })} placeholder="Término HH:MM" placeholderTextColor={colors.textMuted} keyboardType="numbers-and-punctuation" maxLength={5} accessibilityLabel="Hora de término opcional, formato 24 horas" style={[styles.input, styles.timeInput]} />
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
              <Button label="Guardar rutina" onPress={save} loading={routinesBusy} />
              <TextButton label="Cancelar" tone="ghost" onPress={() => setForm(null)} disabled={routinesBusy} />
            </View>
            <Text style={typography.caption}>Los recordatorios automáticos no están disponibles en esta versión.</Text>
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
                </View>
                <Pill label={completed ? 'Hecha hoy' : routine.enabled ? 'Activa' : 'Pausada'} tone={completed ? 'accent' : 'neutral'} />
              </View>
              <View style={styles.actions}>
                <Button label={completed ? 'Marcar pendiente' : 'Completar hoy'} variant="secondary" onPress={() => toggleDone(routine)} disabled={routinesBusy || !routine.enabled} />
                <TextButton label="Editar" onPress={() => openEdit(routine)} disabled={routinesBusy} />
                <TextButton label={routine.enabled ? 'Pausar' : 'Reanudar'} onPress={() => updateRoutine(routine.id, { enabled: !routine.enabled }).then((result) => { if (!result?.ok) setNotice(operationMessage(result.error)); })} disabled={routinesBusy} />
                <TextButton label="Eliminar" tone="danger" onPress={() => setRemoveId(routine.id)} disabled={routinesBusy} />
              </View>
            </Card>
          );
        })}
      </Screen>
      <ConfirmSheet
        visible={Boolean(removeId)}
        onClose={() => setRemoveId(null)}
        onConfirm={confirmRemove}
        title="¿Eliminar rutina?"
        message={selectedRoutine ? `Se eliminará “${selectedRoutine.name}” y se conservará el resto de tus rutinas.` : 'Esta acción no se puede deshacer.'}
        confirmLabel="Eliminar rutina"
      />
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
  timeInput: { flex: 1, minWidth: 145 },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  iconChoice: { width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  iconSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  swatch: { width: 40, height: 40, borderRadius: radius.pill, borderWidth: 2, borderColor: 'transparent' },
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
