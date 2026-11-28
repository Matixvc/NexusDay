import { useState } from 'react';
import { Text, View } from 'react-native';
import { ALARM_LEAD_PRESETS, BIRTHDAY_LEADS, normalizeAlarmLead } from '../services/reminders';
import {
  BIRTHDAY_EMOJIS,
  birthdayLeadLabel,
} from '../services/birthdays';
import { birthdayTurnsNext } from '../services/birthdayDates';
import { formatDateMedium } from '../utils/dates';
import { themedStyles, colors, spacing, typography } from '../theme/theme';
import { Chip, ChipScroller, PrimaryButton, TextButton } from './ui/primitives';
import { ColorPicker, PickerTrigger, TextField } from './ui/inputs';
import { DateField } from './ui/DateField';
import { TimeField } from './ui/TimeField';
import { OptionSheet, Sheet } from './ui/Sheet';
import { timeInputError } from '../services/timeInput';
import { SwitchRow } from './ui/Switch';

/** Shared birthday form used by both the legacy screen and the unified calendar. */
export function BirthdayEditor({ sheet, saving, onClose, onChange, onSave, onRequestDelete }) {
  const [leadOpen, setLeadOpen] = useState(false);
  const canSave = Boolean(sheet) && !saving && Boolean(sheet.values.name.trim()) && !timeInputError(sheet.values.time);

  return (
    <>
      <Sheet
        visible={Boolean(sheet)}
        onClose={onClose}
        title={sheet?.mode === 'edit' ? 'Editar cumpleaños' : 'Nuevo cumpleaños'}
        subtitle="Se conserva como cumpleaños y se repite cada año."
        footer={<PrimaryButton label={saving ? 'Guardando…' : 'Guardar'} onPress={onSave} disabled={!canSave} />}
      >
        {sheet ? (
          <>
            <TextField
              label="Nombre"
              value={sheet.values.name}
              onChangeText={(name) => onChange({ name })}
              placeholder="Ej. Camila"
              autoFocus
              maxLength={40}
            />
            <View style={styles.field}>
              <Text style={typography.overline}>Emoji</Text>
              <ChipScroller>
                {BIRTHDAY_EMOJIS.map((emoji) => (
                  <Chip
                    key={emoji}
                    label={emoji}
                    compact
                    selected={sheet.values.emoji === emoji}
                    onPress={() => onChange({ emoji })}
                  />
                ))}
              </ChipScroller>
            </View>
            <DateField
              label="Fecha de nacimiento"
              value={sheet.values.dateKey}
              onChange={(dateKey) => onChange({ dateKey })}
              quick={false}
            />
            <Text style={styles.hint}>
              {`Cumple ${birthdayTurnsNext(sheet.values.dateKey)} años el ${formatDateMedium(sheet.values.dateKey)}.`}
            </Text>
            <TimeField
              label="Hora del aviso"
              value={sheet.values.time}
              onChange={(time) => onChange({ time })}
              minuteStep={30}
            />
            <PickerTrigger
              label="Cuándo avisar"
              value={birthdayLeadLabel(sheet.values.daysBefore)}
              onPress={() => setLeadOpen(true)}
              trailing={sheet.values.notificationId ? <Text style={styles.armed}>● programado</Text> : null}
            />
            <View style={styles.field}>
              <SwitchRow title="Alarma" value={sheet.values.alarmLeadMinutes != null} onValueChange={(enabled) => onChange({ alarmLeadMinutes: enabled ? 15 : null, alarmTime: enabled ? (sheet.values.alarmTime || '09:00') : '09:00' })} hint={sheet.values.alarmLeadMinutes != null ? 'Sonido y vibración; exactitud según permiso de Android.' : 'Sin alarma sonora.'} />
              {sheet.values.alarmLeadMinutes != null ? <>
                <TimeField label="Hora de alarma" value={sheet.values.alarmTime || '09:00'} onChange={(alarmTime) => onChange({ alarmTime })} minuteStep={5} />
                <ChipScroller>{[15, 30, 60, 120].map((minutes) => <Chip key={minutes} label={`${minutes} min`} compact selected={sheet.values.alarmLeadMinutes === minutes} onPress={() => onChange({ alarmLeadMinutes: minutes })} />)}</ChipScroller>
                <TextField label="Personalizada (minutos)" value={ALARM_LEAD_PRESETS.includes(sheet.values.alarmLeadMinutes) ? '' : String(sheet.values.alarmLeadMinutes || '')} onChangeText={(text) => onChange({ alarmLeadMinutes: normalizeAlarmLead(text) })} keyboardType="number-pad" placeholder="Ej. 45" />
              </> : null}
            </View>
            <ColorPicker value={sheet.values.color} onChange={(color) => onChange({ color })} />
            {sheet.mode === 'edit' ? (
              <View style={styles.destructiveSection}>
                <View style={styles.destructiveCopy}>
                  <Text style={typography.overline}>Acciones del cumpleaños</Text>
                  <Text style={styles.hint}>Elimina el cumpleaños recurrente y cancela su aviso anual.</Text>
                </View>
                <TextButton label="Eliminar cumpleaños" tone="danger" onPress={() => onRequestDelete(sheet.id)} />
              </View>
            ) : null}
          </>
        ) : null}
      </Sheet>

      <OptionSheet
        visible={leadOpen}
        onClose={() => setLeadOpen(false)}
        title="¿Cuándo te aviso?"
        options={BIRTHDAY_LEADS}
        value={sheet?.values.daysBefore}
        onSelect={(daysBefore) => onChange({ daysBefore })}
      />
    </>
  );
}

const styles = themedStyles({
  field: { gap: spacing.sm },
  hint: { fontSize: 12, lineHeight: 17, color: colors.textMuted },
  armed: { fontSize: 11, fontWeight: '700', color: colors.accent },
  destructiveSection: { gap: spacing.sm, padding: spacing.md, borderRadius: 16, borderWidth: 1, borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  destructiveCopy: { gap: spacing.xs },
});
