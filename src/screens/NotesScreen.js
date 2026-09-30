import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme/theme';
import { useAppData } from '../context/AppDataContext';
import {
  Card,
  EmptyState,
  Fab,
  Notice,
  Pill,
  PrimaryButton,
  Screen,
  SectionTitle,
  Stat,
  TextButton,
} from '../components/ui/primitives';
import { ColorPicker, TextArea, TextField } from '../components/ui/inputs';
import { ConfirmSheet, Sheet } from '../components/ui/Sheet';
import { AttachmentRow, VoicePlayback, VoiceRecorder } from '../components/ui/media';
import { deleteRecording, formatSeconds } from '../services/audio';
import { describePickStatus, isAvailable as filesAvailable, pickAndImport, removeFile, shareFile } from '../services/files';
import { timeAgo } from '../utils/dates';

const BLANK = { title: '', body: '', color: colors.accent, audio: null, attachment: null };

function sortNotes(notes) {
  return notes
    .slice()
    .sort(
      (a, b) =>
        Number(b.pinned === true) - Number(a.pinned === true) || (b.updatedAt || 0) - (a.updatedAt || 0),
    );
}

function previewOf(body) {
  return String(body || '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function NotesScreen() {
  const { notes, addNote, updateNote, removeNote } = useAppData();
  const [query, setQuery] = useState('');
  const [sheet, setSheet] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [importing, setImporting] = useState(false);
  const [pickError, setPickError] = useState(null);

  const trimmed = query.trim().toLowerCase();

  const visible = useMemo(() => {
    const ordered = sortNotes(notes);
    if (!trimmed) return ordered;
    return ordered.filter(
      (note) =>
        String(note.title || '').toLowerCase().includes(trimmed) ||
        String(note.body || '').toLowerCase().includes(trimmed),
    );
  }, [notes, trimmed]);

  const pinnedCount = notes.filter((note) => note.pinned).length;

  const openCreate = () => setSheet({ mode: 'create', values: { ...BLANK } });

  const openEdit = (note) =>
    setSheet({
      mode: 'edit',
      id: note.id,
      original: note,
      values: {
        title: note.title || '',
        body: note.body || '',
        color: note.color || colors.accent,
        pinned: Boolean(note.pinned),
        audio: note.audio || null,
        attachment: note.attachment || null,
      },
    });

  const setValue = (patch) => setSheet((prev) => ({ ...prev, values: { ...prev.values, ...patch } }));

  const canSave = Boolean(sheet) && Boolean(sheet.values.title.trim() || sheet.values.body.trim());

  /** Voice notes and imported documents are sandbox copies: they die with the note. */
  const destroyFiles = (note) => {
    if (!note) return;
    if (note.audio?.uri) deleteRecording(note.audio);
    if (note.attachment?.uri) removeFile(note.attachment);
  };

  const save = () => {
    if (!canSave) return;
    const { mode, id, values, original } = sheet;
    const payload = {
      title: values.title.trim() || 'Sin título',
      body: values.body.trim(),
      color: values.color,
      audio: values.audio || null,
      attachment: values.attachment || null,
    };

    if (mode === 'edit') {
      // Sandboxed files are only deleted once the change is accepted, so cancelling
      // the sheet can never destroy a take that is still referenced by the note.
      if (original?.audio?.uri && original.audio.uri !== payload.audio?.uri) deleteRecording(original.audio);
      if (original?.attachment?.uri && original.attachment.uri !== payload.attachment?.uri) {
        removeFile(original.attachment);
      }
      updateNote(id, { ...payload, pinned: values.pinned, updatedAt: Date.now() });
    } else {
      const stamp = Date.now();
      addNote({ ...payload, pinned: false, createdAt: stamp, updatedAt: stamp });
    }

    setSheet(null);
  };

  const confirmDelete = () => {
    destroyFiles(notes.find((note) => note.id === confirmId));
    removeNote(confirmId);
    setConfirmId(null);
  };

  const importDocument = async () => {
    setImporting(true);
    setPickError(null);
    const result = await pickAndImport({ prefix: 'nota' });
    setImporting(false);
    if (result.status === 'ok') setValue({ attachment: result.file });
    else setPickError(describePickStatus(result.status));
  };

  const closeSheet = () => {
    setSheet(null);
    setPickError(null);
  };

  const togglePin = (note) => updateNote(note.id, { pinned: !note.pinned });

  return (
    <>
      <Screen
        title="Notas"
        subtitle="Rápidas, sin cuenta y sin nube."
        headerRight={<Pill label={`${notes.length} notas`} />}
      >
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar por título o contenido"
          placeholderTextColor={colors.textMuted}
          style={styles.search}
          selectionColor={colors.accent}
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />

        <View style={styles.statsRow}>
          <Stat value={notes.length} label="en total" />
          <Stat value={pinnedCount} label="fijas" accent={pinnedCount ? colors.accent : undefined} />
          <Stat value={visible.length} label={trimmed ? 'resultados' : 'visibles'} />
        </View>

        <SectionTitle
          title={trimmed ? 'Coincidencias' : 'Recientes'}
          count={visible.length}
          right={<TextButton label="+ Nueva" onPress={openCreate} />}
        />

        {visible.length === 0 ? (
          <EmptyState
            emoji={trimmed ? '🔍' : '📝'}
            title={trimmed ? 'Nada coincide con la búsqueda' : 'Todavía no hay notas'}
            hint={
              trimmed
                ? 'Probá con otra palabra o borrá la búsqueda.'
                : 'Anotá pendientes, ideas o la lista del súper; se ordenan por última edición.'
            }
          />
        ) : (
          visible.map((note) => (
            <Card key={note.id} accent={note.color} onPress={() => openEdit(note)} style={styles.noteCard}>
              <View style={styles.noteHeader}>
                <Text style={[typography.bodyStrong, styles.noteTitle]} numberOfLines={1}>
                  {note.pinned ? '📌 ' : ''}
                  {note.title}
                </Text>
                {note.pinned ? <Pill label="fija" tone="accent" /> : null}
              </View>

              {previewOf(note.body) ? (
                <Text style={[typography.small, styles.noteBody]} numberOfLines={3}>
                  {previewOf(note.body)}
                </Text>
              ) : null}

              {note.audio?.uri || note.attachment?.uri ? (
                <View style={styles.pillRow}>
                  {note.audio?.uri ? (
                    <Pill
                      label={`🎙 ${formatSeconds((Number(note.audio.durationMs) || 0) / 1000)}`}
                      tone="accent"
                    />
                  ) : null}
                  {note.attachment?.uri ? (
                    <Pill label={`📎 ${note.attachment.name || 'adjunto'}`} style={styles.longPill} />
                  ) : null}
                </View>
              ) : null}

              <View style={styles.noteFooter}>
                <Text style={styles.noteTime}>{timeAgo(note.updatedAt)}</Text>
                <View style={styles.noteActions}>
                  <TextButton
                    label={note.pinned ? 'Quitar fija' : 'Fijar'}
                    tone="ghost"
                    onPress={() => togglePin(note)}
                  />
                  <TextButton label="Borrar" tone="danger" onPress={() => setConfirmId(note.id)} />
                </View>
              </View>
            </Card>
          ))
        )}
      </Screen>

      <Fab onPress={openCreate} />

      <Sheet
        visible={Boolean(sheet)}
        onClose={closeSheet}
        title={sheet?.mode === 'edit' ? 'Editar nota' : 'Nueva nota'}
        subtitle="Se guarda en el dispositivo al tocar Guardar."
        footer={
          <>
            {sheet?.mode === 'edit' ? (
              <TextButton
                label="Eliminar"
                tone="danger"
                onPress={() => {
                  setConfirmId(sheet.id);
                  setSheet(null);
                }}
              />
            ) : null}
            <PrimaryButton label="Guardar" onPress={save} disabled={!canSave} />
          </>
        }
      >
        {sheet ? (
          <>
            <TextField
              label="Título"
              value={sheet.values.title}
              onChangeText={(title) => setValue({ title })}
              placeholder="Ej. Pendientes de la semana"
              autoFocus
              maxLength={60}
            />
            <TextArea
              label="Contenido"
              value={sheet.values.body}
              onChangeText={(body) => setValue({ body })}
              placeholder="Escribí acá…"
              minHeight={150}
            />
            <ColorPicker value={sheet.values.color} onChange={(color) => setValue({ color })} />

            <VoiceRecorder
              label="Nota de voz (opcional)"
              value={sheet.values.audio}
              onChange={(audio) => setValue({ audio })}
              prefix="nota"
              hint="Se guarda en el app; podés escucharla desde la nota."
            />
            {sheet.values.audio?.uri ? <VoicePlayback audio={sheet.values.audio} /> : null}

            <View style={styles.attachBlock}>
              <Text style={typography.overline}>Documento adjunto</Text>
              {sheet.values.attachment?.uri ? (
                <AttachmentRow
                  attachment={sheet.values.attachment}
                  onShare={() => shareFile(sheet.values.attachment, { dialogTitle: 'Adjunto de la nota' })}
                  onRemove={() => setValue({ attachment: null })}
                />
              ) : null}
              {filesAvailable() ? (
                <TextButton
                  label={importing ? 'Importando…' : '📎 Importar documento'}
                  tone="ghost"
                  onPress={importDocument}
                  disabled={importing}
                  style={styles.attachButton}
                />
              ) : null}
              {pickError ? <Notice text={pickError} tone="danger" /> : null}
            </View>
            <View style={styles.pinRow}>
              <Text style={typography.overline}>Fijar arriba de todas</Text>
              <TextButton
                label={sheet.values.pinned ? 'Sí, fijada' : 'No'}
                tone={sheet.values.pinned ? 'primary' : 'ghost'}
                onPress={() => setValue({ pinned: !sheet.values.pinned })}
                style={styles.pinButton}
              />
            </View>
          </>
        ) : null}
      </Sheet>

      <ConfirmSheet
        visible={Boolean(confirmId)}
        onClose={() => setConfirmId(null)}
        onConfirm={confirmDelete}
        title="¿Borrar nota?"
        message="Se elimina del dispositivo, incluidos su audio y su documento. No se puede deshacer."
      />
    </>
  );
}

const styles = StyleSheet.create({
  search: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 14.5,
    color: colors.text,
    minHeight: 46,
  },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  noteCard: { gap: 6 },
  noteHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  noteTitle: { flex: 1 },
  noteBody: { lineHeight: 19 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 2 },
  longPill: { maxWidth: 190 },
  attachBlock: { gap: spacing.sm },
  attachButton: { alignSelf: 'flex-start', paddingHorizontal: spacing.sm },
  noteFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  noteTime: { fontSize: 11.5, fontWeight: '600', color: colors.textMuted },
  noteActions: { flexDirection: 'row', alignItems: 'center', marginRight: -spacing.md },
  pinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: spacing.md,
  },
  pinButton: { paddingVertical: spacing.sm },
});

