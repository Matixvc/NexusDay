import { canExposeInList, filterDiscoverableRecords } from '../services/privacyPolicy';

/** Selects list groups from hydrated note records without searching private metadata. */
export function selectNoteGroups(notes = [], { filter = 'all', tag = null, query = '' } = {}) {
  const publicNotes = filterDiscoverableRecords(notes).slice().sort(
    (a, b) => Number(b.pinned === true) - Number(a.pinned === true) || (b.updatedAt || 0) - (a.updatedAt || 0),
  );
  const normalizedQuery = String(query).trim().toLowerCase();
  const filteredPublic = publicNotes.filter((note) => {
    if (filter === 'private' || (filter === 'pinned' && !note.pinned)) return false;
    if (tag && !(Array.isArray(note.tags) && note.tags.includes(tag))) return false;
    if (!normalizedQuery) return true;
    return (
      String(note.title || '').toLowerCase().includes(normalizedQuery) ||
      String(note.body || '').toLowerCase().includes(normalizedQuery) ||
      (Array.isArray(note.items) && note.items.some((item) => String(item.text || '').toLowerCase().includes(normalizedQuery))) ||
      (Array.isArray(note.tags) && note.tags.some((value) => String(value).toLowerCase().includes(normalizedQuery)))
    );
  });
  const visiblePrivate = filter === 'private' || (filter === 'all' && !normalizedQuery && !tag)
    ? notes.filter((note) => !canExposeInList(note))
    : [];

  return {
    publicNotes,
    filteredPublic,
    pinnedNotes: filteredPublic.filter((note) => note.pinned),
    restNotes: filteredPublic.filter((note) => !note.pinned),
    visiblePrivate,
  };
}
