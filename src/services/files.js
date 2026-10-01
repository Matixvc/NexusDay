import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { Directory, File, Paths } from 'expo-file-system';

/**
 * Files, attachments and sharing (SDK 57 API).
 *
 * Verified against node_modules/expo-file-system/build — this is the *new* class API:
 * - `new Directory(Paths.document, 'sub')` + `dir.create({ intermediates, idempotent })`
 * - `new File(dir, 'name.txt')` → `.exists`, `.create({ overwrite })`, `.write(text)`,
 *   `.textSync()`, `.copy(dest)`, `.move(dest)`, `.delete()`, `.size`, `.name`
 * - There is **no** `FileSystem.readAsStringAsync` any more: `index.d.ts` only exports
 *   `Paths`, `File`, `Directory` and the network task classes.
 * - `expo-sharing` keeps the `shareAsync(uri, options)` signature.
 */

/** Folders inside the app sandbox. Everything the app writes lives here. */
export const FOLDERS = {
  attachments: 'attachments',
  recordings: 'recordings',
  exports: 'exports',
};

export function isSupported() {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

/**
 * Cheap probe: the native module may be missing (Expo Go without a development build,
 * or a headless test environment). Screens use it to hide the controls instead of
 * crashing on a hook that needs the module.
 */
export function isAvailable() {
  try {
    const fileSystem = require('expo-file-system');
    return Boolean(fileSystem?.Paths?.document && fileSystem?.File && fileSystem?.Directory);
  } catch {
    return false;
  }
}

/** Lowercase, ASCII, no spaces: safe for any filesystem and for the share sheet. */
export function safeName(text, fallback = 'archivo') {
  const cleaned = String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return cleaned || fallback;
}

/** `informe.pdf` -> `{ base: 'informe', extension: '.pdf' }` (the dot stays with the extension). */
export function splitName(name) {
  const value = String(name ?? '');
  const index = value.lastIndexOf('.');
  if (index <= 0) return { base: value, extension: '' };
  return { base: value.slice(0, index), extension: value.slice(index) };
}

export function formatBytes(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/** A `Directory` inside Documents, created on demand (idempotent, never throws on repeat). */
export function sandboxFolder(name) {
  const dir = new Directory(Paths.document, name);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/** Plain object that is safe to persist in AsyncStorage (never keep class instances). */
export function describeFile(file) {
  if (!file) return null;
  return {
    uri: file.uri,
    name: file.name,
    size: Number(file.size) || 0,
  };
}

function toFile(reference) {
  if (reference instanceof File) return reference;
  return new File(String(reference));
}

export function fileExists(reference) {
  if (!reference) return false;
  try {
    return toFile(reference).exists;
  } catch {
    return false;
  }
}

export function readText(reference) {
  try {
    const file = toFile(reference);
    return file.exists ? file.textSync() : '';
  } catch (error) {
    console.warn('[files] could not read the file', error);
    return '';
  }
}

/**
 * Writes `text` into `Documents/<folder>/<name>` and returns the described file.
 * `create({ overwrite })` makes repeated exports replace the previous copy instead of throwing.
 */
export function writeText({ folder = FOLDERS.exports, name, text }) {
  const dir = sandboxFolder(folder);
  const file = new File(dir, safeName(name, 'archivo'));
  file.create({ overwrite: true, intermediates: true });
  file.write(String(text ?? ''));
  return describeFile(file);
}

/** Silently removes a file; a missing file is not an error. */
export function removeFile(reference) {
  if (!reference || !isSupported()) return false;
  try {
    const file = toFile(reference);
    if (!file.exists) return true;
    file.delete();
    return true;
  } catch (error) {
    console.warn('[files] could not delete the file', error);
    return false;
  }
}

/** Files inside a sandbox folder. Never throws. */
export function listFolder(folder) {
  if (!isSupported()) return [];
  try {
    return sandboxFolder(folder)
      .list()
      .filter((entry) => !(entry instanceof Directory))
      .map((entry) => describeFile(entry))
      .filter(Boolean);
  } catch (error) {
    console.warn('[files] could not list the folder', error);
    return [];
  }
}

/** Total bytes used by a list of `{ uri }` descriptors (missing files count as 0). */
export function totalSize(items = []) {
  return items.reduce((total, item) => {
    if (!item?.uri) return total;
    try {
      const file = toFile(item.uri);
      return total + (file.exists ? Number(file.size) || 0 : 0);
    } catch {
      return total;
    }
  }, 0);
}

/** Removes every file the app keeps in one of its folders. Returns how many were deleted. */
export function clearFolder(folder) {
  if (!isSupported()) return 0;
  return listFolder(folder).reduce((removed, item) => (removeFile(item.uri) ? removed + 1 : removed), 0);
}

export async function sharingAvailable() {
  if (!isSupported()) return false;
  try {
    return await Sharing.isAvailableAsync();
  } catch (error) {
    console.warn('[files] sharing availability failed', error);
    return false;
  }
}

/** Opens the system share sheet for a file that already lives in the sandbox. */
export async function shareFile(reference, { dialogTitle = 'Compartir' } = {}) {
  if (!isSupported()) return { status: 'unsupported' };

  let file;
  try {
    file = toFile(reference);
  } catch {
    return { status: 'missing' };
  }
  if (!file.exists) return { status: 'missing' };

  try {
    if (!(await Sharing.isAvailableAsync())) return { status: 'unsupported' };
    await Sharing.shareAsync(file.uri, { dialogTitle, universalLinksOnly: false });
    return { status: 'shared', uri: file.uri };
  } catch (error) {
    console.warn('[files] share failed', error);
    return { status: 'error' };
  }
}

/** Writes the text into a file and shares it in one step. */
export async function shareText({ folder = FOLDERS.exports, name, text, dialogTitle }) {
  if (!isSupported()) return { status: 'unsupported' };
  try {
    const file = writeText({ folder, name, text });
    const result = await shareFile(file.uri, { dialogTitle });
    return { ...result, file };
  } catch (error) {
    console.warn('[files] shareText failed', error);
    return { status: 'error' };
  }
}

/**
 * Copies a picked document into `Documents/attachments` so the app owns a real file:
 * the picker only guarantees its temporary copy for the current session.
 * Resolves `{ status: 'cancel' }` when the user backs out of the picker.
 */
export async function pickAndImport({ type = '*/*', folder = FOLDERS.attachments, prefix = 'doc' } = {}) {
  if (!isSupported()) return { status: 'unsupported' };

  let picked;
  try {
    picked = await DocumentPicker.getDocumentAsync({ type, copyToCacheDirectory: true, multiple: false });
  } catch (error) {
    console.warn('[files] the document picker failed', error);
    return { status: 'error' };
  }

  if (!picked || picked.canceled === true) return { status: 'cancel' };

  const asset = Array.isArray(picked.assets) ? picked.assets[0] : null;
  if (!asset?.uri) return { status: 'error' };

  try {
    const { base, extension } = splitName(asset.name || 'documento');
    const source = new File(asset.uri);
    const target = new File(
      sandboxFolder(folder),
      `${safeName(prefix, 'doc')}-${Date.now()}-${safeName(base, 'documento')}${extension}`,
    );
    await source.copy(target, { overwrite: true });
    return { status: 'ok', file: describeFile(target), mimeType: asset.mimeType || '' };
  } catch (error) {
    console.warn('[files] could not import the document', error);
    return { status: 'error' };
  }
}

const SHARE_MESSAGES = {
  unsupported: 'Este dispositivo no puede compartir archivos.',
  missing: 'El archivo ya no está en el dispositivo.',
  error: 'No se pudo abrir el menú para compartir.',
};

/** Human readable reason for a failed share, or `null` when it worked. */
export function describeShareStatus(status) {
  if (!status || status === 'shared') return null;
  return SHARE_MESSAGES[status] || SHARE_MESSAGES.error;
}

const PICK_MESSAGES = {
  unsupported: 'Este dispositivo no permite importar documentos.',
  error: 'No se pudo copiar el documento a la app.',
};

export function describePickStatus(status) {
  if (!status || status === 'ok' || status === 'cancel') return null;
  return PICK_MESSAGES[status] || PICK_MESSAGES.error;
}


