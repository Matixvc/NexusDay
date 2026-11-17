import { useState } from 'react';
import { Text, View } from 'react-native';
import { BIRTHDAY_LEADS } from '../services/reminders';
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

/** Shared birthday form used by both the legacy screen and the unified calendar. */
export function BirthdayEditor({ sheet, saving, onClose, onChange, onSave, onRequestDelete }) {
  const [leadOpen, setLeadOpen] = useState(false);
  const canSave = Boolean(sheet) && !saving && Boolean(sheet.values.name.trim());

  return (
    <>
      <Sheet
        visible={Boolean(sheet)}
        onClose={onClose}
        title={sheet?.mode === 'edit' ? 'Editar cumpleaños' : 'Nuevo cumpleaños'}
        subtitle="Se conserva como cumpleaños y se repite cada año."
        footer={
          <>
            {sheet?.mode === 'edit' ? (
              <TextButton label="Eliminar" tone="danger" onPress={() => onRequestDelete(sheet.id)} />
            ) : null}
            <PrimaryButton label={saving ? 'Guardando…' : 'Guardar'} onPress={onSave} disabled={!canSave} />
          </>
        }
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
            <ColorPicker value={sheet.values.color} onChange={(color) => onChange({ color })} />
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
});
