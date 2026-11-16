import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { themedStyles, colors, layout, radius, spacing, typography } from '../theme/theme';
import { useAppData } from '../context/AppDataContext';
import { useFocusId } from '../hooks/useFocusId';
import {
  Card,
  Chip,
  ChipScroller,
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
import SwipeRow from '../components/ui/SwipeRow';
import { Switch } from '../components/ui/Switch';
import { AttachmentRow, VoicePlayback, VoiceRecorder } from '../components/ui/media';
import { deleteRecording, formatSeconds } from '../services/audio';
import { authenticate, describePrivacyFailure } from '../services/privacy';
import { describePickStatus, isAvailable as filesAvailable, pickAndImport, removeFile, shareFile } from '../services/files';
import {
  NOTE_KINDS,
  QUICK_TAGS,
  blankNote,
  checklistSummary,
  collectTags,
  makeCheckItem,
  notePreview,
  toggleCheckItem,
  toggleTag,
} from '../services/notes';
import { select as selectHaptic, success as successHaptic } from '../services/haptics';
import { timeAgo } from '../utils/dates';

/** Una nota nueva en blanco, con el modelo enriquecido (kind, items, tags). */
const BLANK = () => ({ ...blankNote(colors.accent) });

/** Fija las notas con casilla primero; dentro de cada grupo, la más reciente arriba. */
function sortNotes(notes) {
  return notes
    .slice()
    .sort(
      (a, b) =>
        Number(b.pinned === true) - Number(a.pinned === true) || (b.updatedAt || 0) - (a.updatedAt || 0),
    );
}

export default function NotesScreen() {
  const { notes, addNote, updateNote, removeNote, settings } = useAppData();
  // The global lock can be turned off in Ajustes; secure by default.
  const privacyEnabled = settings?.privacyEnabled;
  const [query, setQuery] = useState('');
  const [sheet, setSheet] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [importing, setImporting] = useState(false);
  const [pickError, setPickError] = useState(null);
  const [saving, setSaving] = useState(false);
  // Vista: lista vertical o cuadrícula de dos columnas; y la etiqueta activa del filtro superior.
  const [grid, setGrid] = useState(false);
  const [activeTag, setActiveTag] = useState(null);
  // Handle to the recorder living inside the sheet: "Guardar" has to close the microphone
  // *before* the sheet (and with it the recorder) unmounts.
  const recorderRef = useRef(null);

  const trimmed = query.trim().toLowerCase();
  // Set by the global search: the matched note opens straight in its editor.
  const focusId = useFocusId();
  const [unlockError, setUnlockError] = useState(null);

  // Etiquetas presentes en todas las notas, para el filtro superior.
  const allTags = useMemo(() => collectTags(notes), [notes]);

  const visible = useMemo(() => {
    const ordered = sortNotes(notes);
    return ordered.filter((note) => {
      // Filtro por etiqueta (independiente del buscador).
      if (activeTag && !(Array.isArray(note.tags) && note.tags.includes(activeTag))) return false;
      if (!trimmed) return true;
      const inText =
        String(note.title || '').toLowerCase().includes(trimmed) ||
        String(note.body || '').toLowerCase().includes(trimmed) ||
        (Array.isArray(note.items) &&
          note.items.some((item) => String(item.text || '').toLowerCase().includes(trimmed))) ||
        (Array.isArray(note.tags) && note.tags.some((tag) => String(tag).toLowerCase().includes(trimmed)));
      return inText;
    });
  }, [notes, trimmed, activeTag]);

  // Fijadas en su propia sección destacada; el resto debajo.
  const pinnedNotes = visible.filter((note) => note.pinned);
  const restNotes = visible.filter((note) => !note.pinned);

  const pinnedCount = notes.filter((note) => note.pinned).length;

  const openCreate = useCallback(() => setSheet({ mode: 'create', values: { ...BLANK() } }), []);

  /** Rellena el editor con el modelo completo de la nota (texto o checklist, con sus tags). */
  const toSheetValues = (note) => ({
    title: note.title || '',
    kind: note.kind === NOTE_KINDS.checklist ? NOTE_KINDS.checklist : NOTE_KINDS.text,
    body: note.body || '',
    items: Array.isArray(note.items) ? note.items.map((item) => ({ ...item })) : [],
    tags: Array.isArray(note.tags) ? [...note.tags] : [],
    color: note.color || colors.accent,
    pinned: Boolean(note.pinned),
    audio: note.audio || null,
    attachment: note.attachment || null,
    private: Boolean(note.private),
  });

  const openEdit = useCallback(
    (note) =>
      setSheet({
        mode: 'edit',
        id: note.id,
        original: note,
        values: toSheetValues(note),
      }),
    [],
  );

  const setValue = (patch) => setSheet((prev) => ({ ...prev, values: { ...prev.values, ...patch } }));

  // ── Editor de checklist ───────────────────────────────────────────────────────────────
  const setKind = (kind) => setValue({ kind });

  const addCheckItem = () => {
    setValue({ items: [...(sheet.values.items || []), makeCheckItem('')] });
  };

  const editCheckItem = (itemId, text) => {
    setValue({ items: (sheet.values.items || []).map((item) => (item.id === itemId ? { ...item, text } : item)) });
  };

  const toggleCheckItemInSheet = (itemId) => {
    const items = toggleCheckItem(sheet.values.items, itemId);
    const done = items.find((item) => item.id === itemId)?.done;
    if (done) successHaptic();
    else selectHaptic();
    setValue({ items });
  };

  const removeCheckItem = (itemId) => {
    setValue({ items: (sheet.values.items || []).filter((item) => item.id !== itemId) });
  };

  const toggleSheetTag = (label) => {
    selectHaptic();
    setValue({ tags: toggleTag(sheet.values.tags, label) });
  };

  /** A private note only opens after the phone confirms who is holding it. */
  const openNote = useCallback(async (note) => {
    if (!note.private || privacyEnabled === false) {
      setUnlockError(null);
      openEdit(note);
      return;
    }
    const result = await authenticate({ promptMessage: `Desbloquea “${note.title || 'la nota'}”` });
    if (result.ok) {
      setUnlockError(null);
      openEdit(note);
      return;
    }
    setUnlockError(describePrivacyFailure(result.reason));
  }, [openEdit, privacyEnabled]);

  // The global search can ask for a specific note: open it in its editor as soon as the
  // list is hydrated. SetState during render is the pattern React recommends for deriving
  // state from props, and the guard keeps it to one update.
  const focusedNote = focusId ? notes.find((note) => note.id === focusId) : null;
  if (focusedNote && sheet?.id !== focusedNote.id) {
    setSheet({
      mode: 'edit',
      id: focusedNote.id,
      original: focusedNote,
      values: toSheetValues(focusedNote),
    });
  }

  /** Marca/desmarca una casilla directamente desde la tarjeta, con háptica de confirmación. */
  const toggleItemFromCard = useCallback(
    (note, itemId) => {
      const items = toggleCheckItem(note.items, itemId);
      updateNote(note.id, { items, updatedAt: Date.now() });
      const nowDone = items.find((item) => item.id === itemId)?.done;
      if (nowDone) successHaptic();
      else selectHaptic();
    },
    [updateNote],
  );

  // Una nota guarda sentido con título, texto, o al menos una casilla por marcar.
  const hasContent =
    Boolean(sheet) &&
    Boolean(
      sheet.values.title.trim() ||
        sheet.values.body.trim() ||
        (sheet.values.kind === NOTE_KINDS.checklist &&
          sheet.values.items.some((item) => String(item.text || '').trim())),
    );
  const canSave = hasContent && !saving;

  /** Voice notes and imported documents are sandbox copies: they die with the note. */
  const destroyFiles = (note) => {
    if (!note) return;
    if (note.audio?.uri) deleteRecording(note.audio);
    if (note.attachment?.uri) removeFile(note.attachment);
  };

  /**
   * Persists the note.
   *
   * The recorder is mounted inside this sheet, so closing the sheet releases it — and
   * releasing a recorder that is still capturing is what closed the app. An open take is
   * therefore stopped, unloaded and copied to storage *first*; its descriptor is folded into
   * the payload below, so the audio is never left behind by the note that references it.
   */
  const save = async () => {
    if (!hasContent || saving) return;
    setSaving(true);

    const take = (await recorderRef.current?.finishTake?.()) || null;
    const { mode, id, values, original } = sheet;
    const audio = take || values.audio || null;
    const isChecklist = values.kind === NOTE_KINDS.checklist;
    // Las casillas vacías se descartan al guardar: una línea en blanco no es una tarea.
    const items = isChecklist
      ? values.items
          .map((item) => ({ ...item, text: String(item.text || '').trim() }))
          .filter((item) => item.text)
      : [];
    const payload = {
      kind: isChecklist ? NOTE_KINDS.checklist : NOTE_KINDS.text,
      title: values.title.trim() || (isChecklist ? 'Lista de tareas' : 'Sin título'),
      body: isChecklist ? '' : values.body.trim(),
      items,
      tags: Array.isArray(values.tags) ? [...values.tags] : [],
      color: values.color,
      audio,
      attachment: values.attachment || null,
    };

    if (mode === 'edit') {
      // Sandboxed files are only deleted once the change is accepted, so cancelling
      // the sheet can never destroy a take that is still referenced by the note.
      if (original?.audio?.uri && original.audio.uri !== payload.audio?.uri) deleteRecording(original.audio);
      if (original?.attachment?.uri && original.attachment.uri !== payload.attachment?.uri) {
        removeFile(original.attachment);
      }
      updateNote(id, { ...payload, pinned: values.pinned, private: Boolean(values.private), updatedAt: Date.now() });
    } else {
      const stamp = Date.now();
      addNote({ ...payload, pinned: false, createdAt: stamp, updatedAt: stamp });
    }

    setSaving(false);
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

  /**
   * Dismisses the editor. A take that is still being captured is thrown away here — never
   * left running while the recorder unmounts — and the note itself is untouched.
   */
  const closeSheet = async () => {
    await recorderRef.current?.discardTake?.();
    setSheet(null);
    setPickError(null);
  };

  const togglePin = useCallback((note) => updateNote(note.id, { pinned: !note.pinned }), [updateNote]);

  const togglePrivate = useCallback(
    (note) => updateNote(note.id, { private: !note.private }),
    [updateNote],
  );

  const requestDelete = useCallback((id) => setConfirmId(id), []);

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
          placeholder="Buscar por título, contenido o etiqueta"
          placeholderTextColor={colors.textMuted}
          style={styles.search}
          selectionColor={colors.accent}
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />

        {unlockError ? <Notice text={unlockError} tone="danger" /> : null}

        {/* Filtro por etiquetas + alternador de vista. */}
        {allTags.length ? (
          <ChipScroller contentContainerStyle={styles.tagScroller}>
            <Chip
              label="Todas"
              compact
              selected={activeTag === null}
              onPress={() => {
                selectHaptic();
                setActiveTag(null);
              }}
            />
            {allTags.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                compact
                selected={activeTag === tag}
                onPress={() => {
                  selectHaptic();
                  setActiveTag((prev) => (prev === tag ? null : tag));
                }}
              />
            ))}
          </ChipScroller>
        ) : null}

        <View style={styles.statsRow}>
          <Stat value={notes.length} label="en total" />
          <Stat value={pinnedCount} label="fijas" accent={pinnedCount ? colors.accent : undefined} />
          <Stat value={visible.length} label={trimmed || activeTag ? 'resultados' : 'visibles'} />
          <Pressable
            onPress={() => {
              selectHaptic();
              setGrid((prev) => !prev);
            }}
            accessibilityRole="button"
            accessibilityLabel={grid ? 'Ver como lista' : 'Ver como cuadrícula'}
            style={({ pressed }) => [styles.viewToggle, pressed ? styles.pressed : null]}
          >
            <Text style={styles.viewToggleText}>{grid ? '☰  Lista' : '▦  Cuadrícula'}</Text>
          </Pressable>
        </View>

        {visible.length === 0 ? (
          <EmptyState
            emoji={trimmed || activeTag ? '🔍' : '📝'}
            title={trimmed || activeTag ? 'Nada coincide' : 'Todavía no hay notas'}
            hint={
              trimmed || activeTag
                ? 'Prueba con otra palabra, etiqueta o quita el filtro.'
                : 'Anota pendientes, ideas o la lista del súper; se ordenan por última edición.'
            }
          />
        ) : (
          <>
            {pinnedNotes.length ? (
              <>
                <SectionTitle title="Fijadas" count={pinnedNotes.length} />
                <View style={grid ? styles.gridWrap : styles.listWrap}>
                  {pinnedNotes.map((note) => (
                    <NoteRow
                      key={note.id}
                      note={note}
                      grid={grid}
                      onOpen={openNote}
                      onTogglePin={togglePin}
                      onTogglePrivate={togglePrivate}
                      onDelete={requestDelete}
                      onToggleItem={toggleItemFromCard}
                    />
                  ))}
                </View>
              </>
            ) : null}

            {restNotes.length ? (
              <>
                <SectionTitle
                  title={trimmed || activeTag ? 'Coincidencias' : 'Recientes'}
                  count={restNotes.length}
                  right={<TextButton label="+ Nueva" onPress={openCreate} />}
                />
                <View style={grid ? styles.gridWrap : styles.listWrap}>
                  {restNotes.map((note) => (
                    <NoteRow
                      key={note.id}
                      note={note}
                      grid={grid}
                      onOpen={openNote}
                      onTogglePin={togglePin}
                      onTogglePrivate={togglePrivate}
                      onDelete={requestDelete}
                      onToggleItem={toggleItemFromCard}
                    />
                  ))}
                </View>
              </>
            ) : null}
          </>
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
                onPress={async () => {
                  const { id } = sheet;
                  // Same reason as `closeSheet`: the recorder must be closed before its host
                  // disappears, and here the take is thrown away with the edit.
                  await recorderRef.current?.discardTake?.();
                  setConfirmId(id);
                  setSheet(null);
                }}
              />
            ) : null}
            <PrimaryButton
              label={saving ? 'Guardando…' : 'Guardar'}
              onPress={save}
              disabled={!canSave}
            />
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

            {/* Alternador Texto / Checklist. */}
            <View style={styles.kindRow}>
              <Chip
                label="📝 Texto"
                compact
                selected={sheet.values.kind !== NOTE_KINDS.checklist}
                onPress={() => setKind(NOTE_KINDS.text)}
              />
              <Chip
                label="☑ Checklist"
                compact
                selected={sheet.values.kind === NOTE_KINDS.checklist}
                onPress={() => setKind(NOTE_KINDS.checklist)}
              />
            </View>

            {sheet.values.kind === NOTE_KINDS.checklist ? (
              <View style={styles.checkEditor}>
                {sheet.values.items.map((item, index) => (
                  <View key={item.id} style={styles.checkEditRow}>
                    <Pressable
                      onPress={() => toggleCheckItemInSheet(item.id)}
                      hitSlop={6}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: Boolean(item.done) }}
                      accessibilityLabel={item.text || 'Tarea'}
                      style={[styles.checkBox, item.done ? styles.checkBoxDone : null]}
                    >
                      {item.done ? <Text style={styles.checkMark}>✓</Text> : null}
                    </Pressable>
                    <TextInput
                      value={item.text}
                      onChangeText={(text) => editCheckItem(item.id, text)}
                      placeholder={`Tarea ${index + 1}`}
                      placeholderTextColor={colors.textMuted}
                      style={[styles.checkEditInput, item.done ? styles.checkEditInputDone : null]}
                      selectionColor={colors.accent}
                      returnKeyType="done"
                      onSubmitEditing={() => {
                        if (index === sheet.values.items.length - 1) addCheckItem();
                      }}
                    />
                    <TextButton label="✕" tone="ghost" onPress={() => removeCheckItem(item.id)} />
                  </View>
                ))}
                <TextButton label="+ Añadir tarea" tone="ghost" onPress={addCheckItem} />
              </View>
            ) : (
              <TextArea
                label="Contenido"
                value={sheet.values.body}
                onChangeText={(body) => setValue({ body })}
                placeholder="Escribe aquí…"
                minHeight={150}
              />
            )}

            {/* Etiquetas rápidas + el nombre de la asignatura si viene de una nota de clase. */}
            <View style={styles.tagEditor}>
              <Text style={typography.overline}>Etiquetas</Text>
              <View style={styles.tagChipRow}>
                {QUICK_TAGS.map((tag) => (
                  <Chip
                    key={tag.id}
                    label={tag.label}
                    compact
                    color={tag.color}
                    selected={(sheet.values.tags || []).includes(tag.label)}
                    onPress={() => toggleSheetTag(tag.label)}
                  />
                ))}
              </View>
            </View>

            <ColorPicker value={sheet.values.color} onChange={(color) => setValue({ color })} />

            <VoiceRecorder
              label="Nota de voz (opcional)"
              value={sheet.values.audio}
              onChange={(audio) => setValue({ audio })}
              prefix="nota"
              hint="Se guarda en la app; puedes escucharla desde la nota."
              controllerRef={recorderRef}
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
              <Text style={typography.overline}>Privada</Text>
              <View style={styles.privateRow}>
                <Text style={styles.privateHint}>Pedir huella, rostro o PIN</Text>
                <Switch
                  value={Boolean(sheet.values.private)}
                  onValueChange={(value) => setValue({ private: value })}
                  label="Nota privada"
                />
              </View>
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

/**
 * One note row.
 *
 * Memoized so that pinning, locking or deleting a single note does not re-render every
 * other card in the list. The swipe actions are `useMemo`d as well, because `SwipeRow` keys
 * its pan responder on them: new object literals on every render would rebuild the
 * responder each time and make the drag feel laggy.
 */
/**
 * Una nota de la lista o la cuadrícula.
 *
 * Memoized para que fijar, bloquear, borrar o marcar una casilla de una nota no vuelva a
 * renderizar las demás. Las acciones de deslizamiento van en `useMemo` porque `SwipeRow`
 * engancha su respondedor de gestos a ellas: literales nuevos en cada render reconstruirían
 * el respondedor y el arrastre se sentiría trabado.
 *
 * En modo cuadrícula (`grid`) la tarjeta se vuelve compacta: sin botones de pie y con la
 * vista previa recortada. Las casillas de una checklist se marcan aquí mismo, sin abrir el
 * editor.
 */
const NoteRow = memo(function NoteRow({ note, grid, onOpen, onTogglePin, onTogglePrivate, onDelete, onToggleItem }) {
  const leftAction = useMemo(
    () => ({
      label: note.pinned ? '📌 Quitar' : '📌 Fijar',
      color: note.color || colors.accent,
      onPress: () => onTogglePin(note),
    }),
    [note, onTogglePin],
  );

  const rightAction = useMemo(
    () => ({
      label: note.private ? '🔓 Abrir' : '🔒 Privado',
      color: colors.accent,
      onPress: () => onTogglePrivate(note),
    }),
    [note, onTogglePrivate],
  );

  const open = useCallback(() => onOpen(note), [note, onOpen]);
  const togglePin = useCallback(() => onTogglePin(note), [note, onTogglePin]);
  const askDelete = useCallback(() => onDelete(note.id), [note.id, onDelete]);
  const preview = notePreview(note);
  const isChecklist = note.kind === NOTE_KINDS.checklist;
  const summary = isChecklist ? checklistSummary(note.items) : null;
  const tags = Array.isArray(note.tags) ? note.tags : [];

  return (
    <SwipeRow style={[styles.swipeRow, grid ? styles.swipeRowGrid : null]} leftAction={leftAction} rightAction={rightAction}>
      <Card accent={note.color} onPress={open} style={[styles.noteCard, grid ? styles.noteCardGrid : null]}>
        <View style={styles.noteHeader}>
          <Text style={[typography.bodyStrong, styles.noteTitle]} numberOfLines={1}>
            {note.pinned ? '📌 ' : ''}
            {note.title}
          </Text>
          {note.private ? <Pill label="🔒 privada" /> : null}
          {note.pinned ? <Pill label="fija" tone="accent" /> : null}
        </View>

        {isChecklist && Array.isArray(note.items) && note.items.length ? (
          <View style={styles.checkList}>
            {(grid ? note.items.slice(0, 3) : note.items.slice(0, 5)).map((item) => (
              <CheckLine key={item.id} item={item} onPress={() => onToggleItem?.(note, item.id)} />
            ))}
            {summary && summary.total > (grid ? 3 : 5) ? (
              <Text style={[typography.caption, styles.moreItems]}>
                +{summary.total - (grid ? 3 : 5)} {summary.total - (grid ? 3 : 5) === 1 ? 'tarea más' : 'tareas más'}
              </Text>
            ) : null}
          </View>
        ) : preview ? (
          <Text style={[typography.small, styles.noteBody]} numberOfLines={grid ? 2 : 3}>
            {preview}
          </Text>
        ) : null}

        {tags.length ? (
          <View style={styles.tagRow}>
            {tags.map((tag) => (
              <Pill key={tag} label={tag} />
            ))}
          </View>
        ) : null}

        {note.audio?.uri || note.attachment?.uri ? (
          <View style={styles.pillRow}>
            {note.audio?.uri ? (
              <Pill label={`🎙 ${formatSeconds((Number(note.audio.durationMs) || 0) / 1000)}`} tone="accent" />
            ) : null}
            {note.attachment?.uri ? (
              <Pill label={`📎 ${note.attachment.name || 'adjunto'}`} style={styles.longPill} />
            ) : null}
          </View>
        ) : null}

        {grid ? (
          <Text style={styles.noteTime}>{timeAgo(note.updatedAt)}</Text>
        ) : (
          <View style={styles.noteFooter}>
            <Text style={styles.noteTime}>{timeAgo(note.updatedAt)}</Text>
            <View style={styles.noteActions}>
              <TextButton label={note.pinned ? 'Quitar fija' : 'Fijar'} tone="ghost" onPress={togglePin} />
              <TextButton label="Borrar" tone="danger" onPress={askDelete} />
            </View>
          </View>
        )}
      </Card>
    </SwipeRow>
  );
});

/** Una casilla de checklist marcable desde la tarjeta; el toque no abre el editor. */
function CheckLine({ item, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: Boolean(item.done) }}
      accessibilityLabel={item.text}
      style={({ pressed }) => [styles.checkLine, pressed ? styles.pressed : null]}
    >
      <View style={[styles.checkBox, item.done ? styles.checkBoxDone : null]}>
        {item.done ? <Text style={styles.checkMark}>✓</Text> : null}
      </View>
      <Text
        style={[typography.small, styles.checkText, item.done ? styles.checkTextDone : null]}
        numberOfLines={1}
      >
        {item.text}
      </Text>
    </Pressable>
  );
}

const styles = themedStyles({
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

  // Filtro por etiquetas y alternador de vista.
  tagScroller: { gap: spacing.sm, paddingRight: layout.gutter },
  viewToggle: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  viewToggleText: { fontSize: 12.5, fontWeight: '700', color: colors.textSecondary },

  // Lista vertical vs cuadrícula de dos columnas.
  listWrap: { gap: 0 },
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  swipeRowGrid: { marginBottom: spacing.sm, width: '48%', flexGrow: 1 },
  noteCardGrid: { height: '100%' },

  // Etiquetas de la tarjeta.
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: 2 },

  // Checklist en la tarjeta.
  checkList: { gap: 2, marginTop: 2 },
  checkLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 2 },
  checkBox: {
    width: 18,
    height: 18,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxDone: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkMark: { fontSize: 12, lineHeight: 14, fontWeight: '800', color: colors.accentInk },
  checkText: { flex: 1, color: colors.text },
  checkTextDone: { color: colors.textMuted, textDecorationLine: 'line-through' },
  moreItems: { color: colors.textMuted, marginTop: 2 },

  // Editor: alternador de modo, editor de checklist y etiquetas.
  kindRow: { flexDirection: 'row', gap: spacing.sm },
  checkEditor: { gap: spacing.sm },
  checkEditRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkEditInput: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.text,
    minHeight: 42,
  },
  checkEditInputDone: { color: colors.textMuted, textDecorationLine: 'line-through' },
  tagEditor: { gap: spacing.sm },
  tagChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pressed: { opacity: 0.68 },

  swipeRow: { marginBottom: spacing.md },
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
  privateRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.md },
  privateHint: { ...typography.caption },
});

