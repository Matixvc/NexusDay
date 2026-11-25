import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { themedStyles, colors, layout, radius, spacing, typography } from '../theme/theme';
import { useAccentTheme } from '../context/ThemeContext';
import { useAppData } from '../context/AppDataContext';
import { useFocusRequest } from '../hooks/useFocusId';
import { HeaderIconButton } from '../components/ui/HeaderIconButton';
import { Icon } from '../components/Icon';
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
  TextButton,
} from '../components/ui/primitives';
import { ColorPicker, TextArea, TextField } from '../components/ui/inputs';
import { ConfirmSheet, Sheet } from '../components/ui/Sheet';
import SwipeRow from '../components/ui/SwipeRow';
import { Switch } from '../components/ui/Switch';
import { AttachmentRow, VoicePlayback, VoiceRecorder } from '../components/ui/media';
import { deleteRecording, formatSeconds } from '../services/audio';
import { authorizePrivateAction, describePrivacyFailure } from '../services/privacy';
import {
  PRIVATE_ACTIONS,
  applyPrivacyFlag,
  canExposeInList,
  redactPrivateRecord,
} from '../services/privacyPolicy';
import { describePickStatus, isAvailable as filesAvailable, pickAndImport, removeFile, shareFile } from '../services/files';
import {
  NOTE_KINDS,
  QUICK_TAGS,
  blankNote,
  checklistSummary,
  collectTags,
  hasNoteContent,
  makeCheckItem,
  notePreview,
  toggleCheckItem,
  toggleTag,
} from '../services/notes';
import { select as selectHaptic, success as successHaptic } from '../services/haptics';
import { timeAgo } from '../utils/dates';
import { selectNoteGroups } from './notesPresentation';

/** Una nota nueva en blanco, con el modelo enriquecido (kind, items, tags). */
const BLANK = () => ({ ...blankNote(colors.accent) });
const EMPTY_NOTES_IMAGE = require('../../assets/nexusday-empty-notes.png');
const NEX_U11_NOTES_IMAGE = require('../../assets/nex/u11/tutorial/tutorial-notes.jpg');

const PRIVATE_NOTE_PLACEHOLDER = Object.freeze({
  title: 'Nota privada',
  body: 'Desbloquea para ver el contenido',
  kind: NOTE_KINDS.text,
  items: [],
  tags: [],
  color: null,
  pinned: false,
  audio: null,
  attachment: null,
  updatedAt: null,
});

export default function NotesScreen({ navigation }) {
  const { notes, addNote, updateNote, removeNote, settings } = useAppData();
  const { surfaceId } = useAccentTheme();
  // The global lock can be turned off in Ajustes; secure by default.
  const privacyEnabled = settings?.privacyEnabled;
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [sheet, setSheet] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [importing, setImporting] = useState(false);
  const [pickError, setPickError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  // Vista: lista vertical o cuadrícula de dos columnas; y la etiqueta activa del filtro superior.
  const [grid, setGrid] = useState(false);
  const [activeTag, setActiveTag] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchFocused, setSearchFocused] = useState(false);
  // Handle to the recorder living inside the sheet: "Guardar" has to close the microphone
  // *before* the sheet (and with it the recorder) unmounts.
  const savingRef = useRef(false);
  const recorderRef = useRef(null);
  const handledFocusRequest = useRef(null);

  const trimmed = deferredQuery.trim().toLowerCase();
  // Set by the global search: the matched note opens straight in its editor.
  const { focusId, request: focusRequest } = useFocusRequest(null);
  const [unlockError, setUnlockError] = useState(null);

  const groups = useMemo(
    () => selectNoteGroups(notes, { filter: activeFilter, tag: activeTag, query: trimmed }),
    [notes, activeFilter, activeTag, trimmed],
  );
  const { publicNotes, filteredPublic, pinnedNotes, restNotes, visiblePrivate } = groups;
  // Etiquetas presentes solo en notas públicas.
  const allTags = useMemo(() => collectTags(publicNotes), [publicNotes]);
  const hasFilters = Boolean(trimmed || activeTag || activeFilter !== 'all');
  // Los grupos privados solo se incluyen como marcadores redactados; nunca entran en búsqueda,
  // filtros de etiqueta o contadores públicos.

  const pinnedCount = useMemo(() => publicNotes.filter((note) => note.pinned).length, [publicNotes]);

  const openCreate = useCallback(() => {
    setPickError(null);
    setQuery('');
    setActiveTag(null);
    setActiveFilter('all');
    setConfirmDiscard(false);
    setSheet({ mode: 'create', dirty: false, values: { ...BLANK() } });
  }, []);

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
    (note) => {
      setPickError(null);
      setSheet({
        mode: 'edit',
        dirty: false,
        id: note.id,
        original: note,
        values: toSheetValues(note),
      });
    },
    [],
  );

  const setValue = (patch, fromSave = false) => {
    if (savingRef.current && !fromSave) return;
    setSheet((prev) => (prev ? { ...prev, dirty: true, values: { ...prev.values, ...patch } } : prev));
  };
  const markDraftDirty = useCallback(() => {
    setSheet((prev) => (prev ? { ...prev, dirty: true } : prev));
  }, []);

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

  const runNoteAction = useCallback(async (note, action, promptMessage, onAuthorized) => {
    setUnlockError(null);
    const result = await authorizePrivateAction({
      record: note,
      action,
      privacyEnabled,
      promptMessage,
      onAuthorized,
    });
    if (!result.ok) setUnlockError(describePrivacyFailure(result.reason));
    return result.ok;
  }, [privacyEnabled]);

  /** A private note only opens after the phone confirms who is holding it. */
  const openNote = useCallback(
    (note, stillCurrent = () => true) => runNoteAction(
      note,
      PRIVATE_ACTIONS.open,
      'Desbloquea la nota privada',
      () => {
        if (stillCurrent()) openEdit(note);
      },
    ),
    [openEdit, runNoteAction],
  );

  // The global search can ask for a specific note: open it in its editor as soon as the
  // list is hydrated. Taps and navigation params share the same guarded open path.
  useEffect(() => {
    if (!focusId) {
      return;
    }
    if (handledFocusRequest.current === focusRequest) return;
    const focusedNote = notes.find((note) => note.id === focusId);
    if (!focusedNote) return;
    handledFocusRequest.current = focusRequest;
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        void openNote(focusedNote, () => active && handledFocusRequest.current === focusRequest);
      }
    });
    return () => {
      active = false;
    };
  }, [focusId, focusRequest, notes, openNote]);

  /** Marca/desmarca una casilla directamente desde la tarjeta, con háptica de confirmación. */
  const toggleItemFromCard = useCallback(
    (note, itemId) => runNoteAction(note, PRIVATE_ACTIONS.mutate, 'Desbloquea la nota privada', async () => {
      let items;
      const committed = await updateNote(note.id, current => {
        items = toggleCheckItem(current.items, itemId);
        return { items, updatedAt: Date.now() };
      });
      if (!committed) { setUnlockError('No se pudo guardar el cambio.'); return; }
      const nowDone = items.find((item) => item.id === itemId)?.done;
      if (nowDone) successHaptic();
      else selectHaptic();
    }),
    [runNoteAction, updateNote],
  );

  // Una nota guarda sentido con título, texto, o al menos una casilla por marcar.
  const hasContent = Boolean(sheet && hasNoteContent(sheet.values));
  const canSave = hasContent && !saving && !importing;

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
    if (!hasContent || savingRef.current || importing) return;
    savingRef.current = true;
    setSaving(true);
    setPickError(null);
    try {
      const take = (await recorderRef.current?.finishTake?.()) || null;
      if (take) setValue({ audio: take }, true);
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

      const stamp = new Date().getTime();
      const committed = mode === 'edit'
        ? await updateNote(id, { ...payload, pinned: values.pinned, private: Boolean(values.private), updatedAt: stamp })
        : await addNote(applyPrivacyFlag({ ...payload, pinned: false, createdAt: stamp, updatedAt: stamp }, values.private));
      if (!committed) {
        setPickError('No se pudo guardar la nota. Tu borrador sigue abierto para reintentar.');
        return;
      }

      if (original?.audio?.uri && original.audio.uri !== payload.audio?.uri) deleteRecording(original.audio);
      if (original?.attachment?.uri && original.attachment.uri !== payload.attachment?.uri) removeFile(original.attachment);
      successHaptic();
      setConfirmDiscard(false);
      setSheet(null);
    } catch {
      setPickError('No se pudo completar el guardado. Revisa la nota y vuelve a intentarlo.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!await removeNote(confirmId)) {
      setUnlockError('No se pudo eliminar la nota.');
      setConfirmId(null);
      return;
    }
    destroyFiles(notes.find((note) => note.id === confirmId));
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
    if (savingRef.current) return;
    if (sheet?.dirty) {
      setConfirmDiscard(true);
      return;
    }
    await recorderRef.current?.discardTake?.();
    setConfirmDiscard(false);
    setSheet(null);
    setPickError(null);
  };

  const discardDraft = async () => {
    await recorderRef.current?.discardTake?.();
    const draft = sheet;
    const original = draft?.original;
    if (draft?.values?.audio?.uri && draft.values.audio.uri !== original?.audio?.uri) {
      deleteRecording(draft.values.audio);
    }
    if (draft?.values?.attachment?.uri && draft.values.attachment.uri !== original?.attachment?.uri) {
      removeFile(draft.values.attachment);
    }
    setConfirmDiscard(false);
    setSheet(null);
    setPickError(null);
  };

  const togglePin = useCallback(
    (note) => runNoteAction(
      note,
      PRIVATE_ACTIONS.mutate,
      'Desbloquea la nota privada',
      async () => {
        if (!await updateNote(note.id, current => ({ pinned: !current.pinned }))) setUnlockError('No se pudo guardar el cambio.');
      },
    ),
    [runNoteAction, updateNote],
  );

  const requestDelete = useCallback(
    (note) => runNoteAction(
      note,
      PRIVATE_ACTIONS.delete,
      'Autoriza eliminar la nota privada',
      () => setConfirmId(note.id),
    ),
    [runNoteAction],
  );

  const changeSheetPrivacy = useCallback(
    (value) => {
      if (!sheet || value === Boolean(sheet.values.private)) return;
      const original = sheet.original;
      if (sheet.mode !== 'edit' || !original?.private || value !== false) {
        setValue({ private: value });
        return;
      }
      void runNoteAction(
        original,
        PRIVATE_ACTIONS.removePrivacy,
        'Autoriza quitar la privacidad de la nota',
        () => setValue({ private: false }),
      );
    },
    [runNoteAction, sheet],
  );

  const requestSheetDelete = async () => {
    if (savingRef.current || !sheet?.original) return;
    await runNoteAction(
      sheet.original,
      PRIVATE_ACTIONS.delete,
      'Autoriza eliminar la nota privada',
      async () => {
        await recorderRef.current?.discardTake?.();
        setConfirmId(sheet.id);
        setConfirmDiscard(false);
        setSheet(null);
      },
    );
  };

  return (
    <>
      <Screen
        title="Bloc de Notas"
        subtitle="Ideas, listas y apuntes en un solo lugar."
        headerRight={
          <View style={styles.headerActions}>
            <HeaderIconButton icon="settings" label="Abrir Ajustes" onPress={() => navigation.navigate('Ajustes')} />
          </View>
        }
      >
        <View style={[styles.searchWrap, searchFocused ? styles.searchFocused : null]}>
          <Icon name="search" size={20} color={searchFocused ? colors.accent : colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={(value) => {
              setQuery(value);
              if (value.trim() && activeFilter === 'private') setActiveFilter('all');
            }}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Buscar en tus notas"
            placeholderTextColor={colors.textMuted}
            style={styles.search}
            selectionColor={colors.accent}
            autoCorrect={false}
            returnKeyType="search"
            accessibilityHint="Busca solo en notas públicas por título, texto, listas o etiquetas"
            accessibilityLabel="Buscar notas por título, contenido o etiqueta"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Limpiar búsqueda" style={styles.clearSearch}>
              <Icon name="x" size={18} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>

        {unlockError ? <Notice text={unlockError} tone="danger" /> : null}

        <View accessible accessibilityLabel={`${publicNotes.length} notas públicas, ${pinnedCount} fijadas`} style={styles.summaryBar}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, typography.tabular]}>{publicNotes.length}</Text>
            <Text style={styles.summaryLabel}>públicas</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Icon name="star" size={15} color={pinnedCount ? colors.accent : colors.textMuted} />
            <Text style={styles.summaryLabel}>{pinnedCount} fijadas</Text>
          </View>
          <View style={styles.summarySpacer} />
          <Pressable
            onPress={() => {
              selectHaptic();
              setGrid((prev) => !prev);
            }}
            accessibilityRole="button"
            accessibilityLabel={grid ? 'Ver como lista' : 'Ver como cuadrícula'}
            style={({ pressed }) => [styles.viewToggle, pressed ? styles.pressed : null]}
          >
            <Icon name={grid ? 'list' : 'schedule'} size={19} color={colors.textSecondary} />
          </Pressable>
        </View>

        <Text style={styles.filterLabel}>MOSTRAR</Text>
        <ChipScroller contentContainerStyle={styles.tagScroller}>
          {[
            { id: 'all', label: 'Todas' },
            { id: 'pinned', label: 'Fijadas' },
            { id: 'private', label: 'Privadas' },
          ].map((filter) => (
            <Chip
              key={filter.id}
              label={filter.label}
              selected={activeFilter === filter.id}
              onPress={() => {
                selectHaptic();
                setActiveFilter(filter.id);
                setActiveTag(null);
                if (filter.id === 'private') setQuery('');
              }}
            />
          ))}
        </ChipScroller>

        {activeFilter !== 'private' && allTags.length ? <Text style={styles.filterLabel}>ETIQUETAS</Text> : null}
        {allTags.length && activeFilter !== 'private' ? (
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

        {filteredPublic.length === 0 && visiblePrivate.length === 0 ? (
          <EmptyState
            image={hasFilters ? undefined : surfaceId === 'nex' ? NEX_U11_NOTES_IMAGE : EMPTY_NOTES_IMAGE}
            icon={hasFilters ? (activeFilter === 'private' ? 'lock' : 'search') : 'note'}
            title={hasFilters ? 'Nada coincide' : 'Todavía no hay notas'}
            hint={
              hasFilters
                ? 'Prueba con otra palabra, etiqueta o quita el filtro.'
                : 'Anota pendientes, ideas o la lista del súper; se ordenan por última edición.'
            }
            action={hasFilters ? (
              <TextButton
                label="Limpiar filtros"
                onPress={() => {
                  setQuery('');
                  setActiveTag(null);
                  setActiveFilter('all');
                }}
              />
            ) : null}
          />
        ) : (
          <>
            {pinnedNotes.length ? (
              <>
                <SectionTitle title="Fijadas" count={pinnedNotes.length} variant="editorial" />
                <View style={grid ? styles.gridWrap : styles.listWrap}>
                  {pinnedNotes.map((note) => (
                    <NoteRow
                      key={note.id}
                      note={note}
                      grid={grid}
                      onOpen={openNote}
                      onTogglePin={togglePin}
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
                  title={trimmed || activeTag ? 'Coincidencias' : 'Otras notas'}
                  count={restNotes.length}
                  variant="editorial"
                  right={!visiblePrivate.length ? <TextButton label="+ Nueva" onPress={openCreate} /> : null}
                />
                <View style={grid ? styles.gridWrap : styles.listWrap}>
                  {restNotes.map((note) => (
                    <NoteRow
                      key={note.id}
                      note={note}
                      grid={grid}
                      onOpen={openNote}
                      onTogglePin={togglePin}
                      onDelete={requestDelete}
                      onToggleItem={toggleItemFromCard}
                    />
                  ))}
                </View>
              </>
            ) : null}

            {visiblePrivate.length ? (
              <>
                <SectionTitle title="Privadas" variant="editorial" />
                <View style={grid ? styles.gridWrap : styles.listWrap}>
                  {visiblePrivate.map((note) => (
                    <NoteRow
                      key={note.id}
                      note={note}
                      grid={grid}
                      onOpen={openNote}
                      onTogglePin={togglePin}
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

      <Fab onPress={openCreate} label="Crear nota" />

      <Sheet
        visible={Boolean(sheet)}
        onClose={closeSheet}
        title={sheet?.mode === 'edit' ? 'Editar nota' : 'Nueva nota'}
        subtitle={confirmDiscard ? 'El borrador aún no se ha guardado.' : 'Se guarda en el dispositivo al tocar Guardar.'}
        footer={
          confirmDiscard ? (
            <>
              <TextButton label="Seguir editando" tone="ghost" onPress={() => setConfirmDiscard(false)} style={styles.discardChoice} />
              <TextButton label="Descartar cambios" tone="danger" onPress={discardDraft} style={styles.discardChoice} />
            </>
          ) : (
            <>
              {sheet?.mode === 'edit' ? (
                <TextButton label="Eliminar" tone="danger" onPress={requestSheetDelete} />
              ) : null}
              <PrimaryButton
                label={saving ? 'Guardando…' : 'Guardar'}
                onPress={save}
                disabled={!canSave}
              />
            </>
          )
        }
      >
        {sheet ? (
          <>
            {confirmDiscard ? (
              <View style={styles.discardNotice} accessibilityRole="alert" accessibilityLiveRegion="assertive">
                <Icon name="alertCircle" size={20} color={colors.warning} />
                <Text style={typography.small}>Tienes cambios sin guardar. Puedes seguir editando o descartarlos.</Text>
              </View>
            ) : null}
            {pickError ? <Notice text={pickError} tone="danger" /> : null}
            <TextField
              label="Título"
              value={sheet.values.title}
              disabled={saving}
              onChangeText={(title) => setValue({ title })}
              placeholder="Ej. Pendientes de la semana"
              autoFocus
              maxLength={60}
              style={styles.editorTitle}
            />

            <View style={styles.kindRow} accessibilityRole="radiogroup" accessibilityLabel="Tipo de nota">
              {[
                { kind: NOTE_KINDS.text, label: 'Texto', icon: 'note' },
                { kind: NOTE_KINDS.checklist, label: 'Checklist', icon: 'checkCircle' },
              ].map((option) => {
                const selected = (sheet.values.kind === NOTE_KINDS.checklist) === (option.kind === NOTE_KINDS.checklist);
                return (
                  <Pressable
                    key={option.kind}
                    onPress={() => setKind(option.kind)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={option.label}
                    style={({ pressed }) => [styles.kindOption, selected ? styles.kindOptionSelected : null, pressed ? styles.pressed : null]}
                  >
                    <Icon name={option.icon} size={18} color={selected ? colors.accent : colors.textSecondary} />
                    <Text style={[typography.label, selected ? styles.kindOptionLabelSelected : null]}>{option.label}</Text>
                  </Pressable>
                );
              })}
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
                      style={styles.checkEditToggle}
                    >
                      <View style={[styles.checkBox, item.done ? styles.checkBoxDone : null]}>
                        {item.done ? <Text style={styles.checkMark}>✓</Text> : null}
                      </View>
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
                disabled={saving}
                onChangeText={(body) => setValue({ body })}
                placeholder="Escribe aquí…"
                minHeight={220}
                style={styles.editorBody}
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
              onRecordingStart={markDraftDirty}
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
                  label={importing ? 'Importando…' : 'Importar documento'}
                  tone="ghost"
                  onPress={importDocument}
                  disabled={importing}
                  style={styles.attachButton}
                />
              ) : null}
            </View>
            <View style={[styles.pinRow, styles.privatePinRow]}>
              <View style={styles.privateCopy}>
                <Text style={typography.overline}>Privada</Text>
                <Text style={styles.privateHint}>
                  {sheet.values.private
                    ? privacyEnabled === false
                      ? 'Oculta en listas · bloqueo global desactivado'
                      : 'Oculta en listas · requiere autorización'
                    : 'Oculta el contenido de las listas'}
                </Text>
              </View>
              <Switch
                value={Boolean(sheet.values.private)}
                onValueChange={changeSheetPrivacy}
                label="Nota privada"
              />
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
const NoteRow = memo(function NoteRow({ note, grid, onOpen, onTogglePin, onDelete, onToggleItem }) {
  const exposed = canExposeInList(note);
  const displayNote = redactPrivateRecord(note, PRIVATE_NOTE_PLACEHOLDER);
  const open = useCallback(() => onOpen(note), [note, onOpen]);
  const togglePin = useCallback(() => onTogglePin(note), [note, onTogglePin]);
  const askDelete = useCallback(() => onDelete(note), [note, onDelete]);
  const accessibilityActions = useMemo(() => [
    { name: 'togglePin', label: exposed ? (note.pinned ? 'Quitar fijación' : 'Fijar nota') : 'Cambiar fijación' },
    { name: 'delete', label: exposed ? 'Eliminar nota' : 'Eliminar nota privada' },
  ], [exposed, note.pinned]);
  const handleAccessibilityAction = useCallback(({ nativeEvent }) => {
    if (nativeEvent.actionName === 'togglePin') togglePin();
    if (nativeEvent.actionName === 'delete') askDelete();
  }, [askDelete, togglePin]);

  const leftAction = useMemo(
    () => ({
      label: exposed ? (note.pinned ? 'Quitar fijada' : 'Fijar nota') : 'Cambiar fijación',
      color: exposed ? note.color || colors.accent : colors.accent,
      onPress: togglePin,
    }),
    [exposed, note.color, note.pinned, togglePin],
  );
  const rightAction = useMemo(
    () => ({
      label: exposed ? 'Eliminar nota' : 'Eliminar nota privada',
      color: colors.danger,
      onPress: askDelete,
    }),
    [askDelete, exposed],
  );

  const preview = notePreview(displayNote);
  const isChecklist = displayNote.kind === NOTE_KINDS.checklist;
  const summary = isChecklist ? checklistSummary(displayNote.items) : null;
  const tags = Array.isArray(displayNote.tags) ? displayNote.tags : [];

  return (
    <SwipeRow style={[styles.swipeRow, grid ? styles.swipeRowGrid : null]} leftAction={leftAction} rightAction={rightAction}>
      <Card
        accent={displayNote.color}
        variant={exposed && note.pinned ? 'featured' : 'standard'}
        onPress={open}
        accessibilityLabel={exposed ? undefined : 'Nota privada. Desbloquea para ver el contenido'}
      accessibilityHint="Usa las acciones de accesibilidad para fijar o eliminar esta nota."
        accessibilityActions={accessibilityActions}
        onAccessibilityAction={handleAccessibilityAction}
        style={[styles.noteCard, exposed && note.pinned ? styles.noteCardPinned : null, grid ? styles.noteCardGrid : null]}
      >
        <View style={styles.noteHeader}>
          <Text style={[typography.bodyStrong, styles.noteTitle]} numberOfLines={2}>
            {displayNote.title}
          </Text>
          {note.private ? (
            <View style={styles.privateBadge}>
              <Icon name="lock" size={13} color={colors.warning} />
              <Text style={styles.privateBadgeLabel}>Privada</Text>
            </View>
          ) : displayNote.pinned ? (
            <View style={styles.pinnedBadge}>
              <Icon name="star" size={13} color={colors.accent} />
              <Text style={styles.pinnedBadgeLabel}>Fijada</Text>
            </View>
          ) : null}
        </View>

        {isChecklist && Array.isArray(displayNote.items) && displayNote.items.length ? (
          <View style={styles.checkList}>
            {(grid ? displayNote.items.slice(0, 3) : displayNote.items.slice(0, 5)).map((item) => (
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
            {tags.map((tag) => <Pill key={tag} label={tag} />)}
          </View>
        ) : null}

        {displayNote.audio?.uri || displayNote.attachment?.uri ? (
          <View style={styles.pillRow}>
            {displayNote.audio?.uri ? (
              <Pill label={`Audio · ${formatSeconds((Number(displayNote.audio.durationMs) || 0) / 1000)}`} tone="accent" />
            ) : null}
            {displayNote.attachment?.uri ? (
              <Pill label={`Adjunto · ${displayNote.attachment.name || 'archivo'}`} style={styles.longPill} />
            ) : null}
          </View>
        ) : null}

        {grid ? (
          exposed ? <Text style={styles.noteTime}>{timeAgo(displayNote.updatedAt)}</Text> : null
        ) : (
          <View style={styles.noteFooter}>
            <Text style={styles.noteTime}>{exposed ? timeAgo(displayNote.updatedAt) : 'Contenido protegido'}</Text>
            <View style={styles.noteActions}>
              {exposed ? (
                <TextButton label={note.pinned ? 'Quitar fija' : 'Fijar'} tone="ghost" onPress={togglePin} />
              ) : (
                <TextButton label="Abrir" tone="ghost" onPress={open} />
              )}
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  searchWrap: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  searchFocused: { borderColor: colors.accent },
  search: {
    flex: 1,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.text,
    minHeight: 58,
  },
  clearSearch: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  summaryBar: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  summaryValue: { color: colors.accent },
  summaryLabel: { ...typography.caption, color: colors.textSecondary },
  summaryDivider: { width: 1, height: 22, backgroundColor: colors.borderStrong },
  summarySpacer: { flex: 1 },
  filterLabel: { ...typography.overline, color: colors.textMuted, marginBottom: -spacing.sm },

  // Filtros y alternador de vista.
  tagScroller: { gap: spacing.sm, paddingRight: layout.gutter },
  viewToggle: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },

  // Lista vertical vs cuadrícula de dos columnas.
  listWrap: { gap: 0 },
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  swipeRowGrid: { marginBottom: spacing.sm, width: '48%', flexGrow: 1 },
  noteCardGrid: { height: '100%' },

  // Etiquetas de la tarjeta.
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: 2 },
  privateBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.pill, backgroundColor: colors.warningSoft },
  privateBadgeLabel: { ...typography.caption, color: colors.warning, fontWeight: '700' },
  pinnedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.pill, backgroundColor: colors.accentSoft },
  pinnedBadgeLabel: { ...typography.caption, color: colors.accent, fontWeight: '700' },

  // Checklist en la tarjeta.
  checkList: { gap: 2, marginTop: 2 },
  checkLine: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 2 },
  checkEditToggle: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
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
  kindOption: { minHeight: 52, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.md },
  kindOptionSelected: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  kindOptionLabelSelected: { color: colors.accent },
  editorTitle: { fontSize: 22, lineHeight: 30, fontWeight: '700', minHeight: 64 },
  editorBody: { fontSize: 16, lineHeight: 24, paddingTop: spacing.lg },
  discardNotice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.warningSoft },
  discardChoice: { flex: 1, alignItems: 'center' },
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
  noteCard: { gap: spacing.md, borderRadius: radius.xl, paddingVertical: spacing.lg },
  noteCardPinned: { borderWidth: 1.5, borderColor: colors.accent },
  noteHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  noteTitle: { flex: 1, fontSize: 16, lineHeight: 22 },
  noteBody: { lineHeight: 22, fontSize: 14 },
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
  privatePinRow: { minHeight: 76, alignItems: 'center', paddingVertical: spacing.sm, paddingRight: spacing.xs },
  privateCopy: { flex: 1, minWidth: 0, gap: spacing.xs, paddingVertical: spacing.xs },
  pinButton: { paddingVertical: spacing.sm },
  privateHint: { ...typography.caption, flexShrink: 1, minWidth: 0 },
});

