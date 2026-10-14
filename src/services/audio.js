import { Platform } from 'react-native';
import {
  RecordingPresets,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import { File } from 'expo-file-system';
import {
  FOLDERS,
  describeFile,
  formatBytes,
  listFolder,
  removeFile,
  safeName,
  sandboxFolder,
  totalSize,
} from './files';

/**
 * Microphone recording + playback helpers on top of `expo-audio` (SDK 57).
 *
 * `expo-av` is gone: recording is now a hook (`useAudioRecorder`) that owns an
 * `AudioRecorder` shared object, and playback is `useAudioPlayer`. This module keeps
 * everything that is *not* the hook: permissions, the audio session mode, and the
 * file juggling that turns a temporary cache recording into a permanent attachment.
 */

/**
 * Voice-note recording preset on top of `expo-audio` (SDK 57).
 *
 * Same container as the stock preset (`.m4a`/AAC, so iOS and Android agree), tuned for
 * speech: mono instead of stereo, half the bit rate, and metering enabled so the recorder
 * can paint a live level bar. Files are captured in the cache directory (cheap, disposable)
 * and only moved into `Documents/recordings/` once the user accepts the take, so a discarded
 * take never leaves a file behind.
 */
export const recordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  bitRate: 64000,
  isMeteringEnabled: true,
  directory: 'cache',
};

/** How often the hook polls the recorder (duration + level), in milliseconds. */
export const RECORDING_POLL_MS = 250;

export function isSupported() {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

/** True when the recorder/player hooks of `expo-audio` are reachable (needs a dev build). */
export function isAvailable() {
  try {
    const audio = require('expo-audio');
    return typeof audio?.useAudioRecorder === 'function' && typeof audio?.setAudioModeAsync === 'function';
  } catch {
    return false;
  }
}

const unsupported = () => ({ status: 'unsupported', granted: false, canAskAgain: false });

function normalize(response) {
  if (!response) return unsupported();
  return {
    status: response.status ?? 'unknown',
    granted: Boolean(response.granted),
    canAskAgain: response.canAskAgain !== false,
  };
}

export async function getMicrophonePermission() {
  if (!isSupported()) return unsupported();
  try {
    return normalize(await getRecordingPermissionsAsync());
  } catch (error) {
    console.warn('[audio] getRecordingPermissionsAsync failed', error);
    return unsupported();
  }
}

export async function requestMicrophonePermission() {
  if (!isSupported()) return unsupported();
  try {
    return normalize(await requestRecordingPermissionsAsync());
  } catch (error) {
    console.warn('[audio] requestRecordingPermissionsAsync failed', error);
    return unsupported();
  }
}

/**
 * The iOS audio session must allow the mic before recording starts, otherwise the
 * recorder silently produces silence. Playback ducking other apps keeps voice notes polite.
 */
let recordingMode = false;
let playbackMode = false;

export async function ensureRecordingMode() {
  if (!isSupported() || recordingMode) return;
  try {
    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
      interruptionMode: 'doNotMix',
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
    });
    recordingMode = true;
    playbackMode = false;
  } catch (error) {
    console.warn('[audio] could not switch to the recording mode', error);
  }
}

export async function ensurePlaybackMode() {
  if (!isSupported() || playbackMode) return;
  try {
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
      shouldPlayInBackground: false,
    });
    playbackMode = true;
    recordingMode = false;
  } catch (error) {
    console.warn('[audio] could not switch to the playback mode', error);
  }
}

/** `Documents/recordings`, created on demand. */
export function recordingsFolder() {
  return sandboxFolder(FOLDERS.recordings);
}

/**
 * Moves a finished recording out of the cache into `Documents/recordings` so it
 * survives the OS cleaning the cache. Returns the descriptor to store, or `null`.
 */
export async function persistRecording(uri, { prefix = 'voz' } = {}) {
  if (!isSupported() || !uri) return null;
  try {
    const source = new File(String(uri));
    if (!source.exists) return null;
    const extension = source.extension || '.m4a';
    const target = new File(recordingsFolder(), `${safeName(prefix, 'voz')}-${Date.now()}${extension}`);
    await source.move(target, { overwrite: true });
    return describeFile(target);
  } catch (error) {
    console.warn('[audio] could not store the recording', error);
    return null;
  }
}

/** Drops the file behind a stored voice note. Safe with nulls and stale paths. */
export function deleteRecording(reference) {
  return removeFile(reference?.uri ?? reference);
}

/* ------------------------------------------------------------------ *
 * Recorder lifecycle helpers (the "Guardar con audio" crash fix)
 *
 * `useAudioRecorder` releases its shared object the moment the host unmounts, and from
 * that instant *every read of the recorder throws* — `.isRecording`, `.uri`, `.getStatus()`.
 * `useRecorder` therefore never touches the native object directly: it goes through the
 * three helpers below, each of which is guaranteed not to throw, so stopping a take that is
 * already closed (or a recorder that is already gone) can never take the app down.
 * ------------------------------------------------------------------ */

/**
 * Reads the recorder without ever throwing and returns a plain, always-shaped snapshot.
 *
 * A released shared object throws on any property read, so the whole read lives inside one
 * `try`; anything that throws — or a recorder that was never mounted (`null`) — resolves to
 * a dead snapshot with `alive: false`. That flag is what lets `useRecorder` tell "nothing to
 * close" apart from "there is a live take", and `isRecording` is what decides whether a take
 * is still worth stopping.
 *
 * @returns {{alive: boolean, isRecording: boolean, uri: string|null, durationMs: number}}
 */
export function recorderSnapshot(recorder) {
  const dead = { alive: false, isRecording: false, uri: null, durationMs: 0 };
  if (!recorder) return dead;
  try {
    // `getStatus()` is the canonical source (it carries `url` and `durationMillis`), but it
    // too throws once the object is released — hence it stays inside the same guard.
    const status = typeof recorder.getStatus === 'function' ? recorder.getStatus() : null;
    const uri = typeof recorder.uri === 'string' && recorder.uri ? recorder.uri : status?.url ?? null;
    const isRecording = Boolean(status ? status.isRecording : recorder.isRecording);
    const seconds = Number(status?.durationMillis) || 0;
    const durationMs = seconds > 0 ? Math.round(seconds) : Math.round((Number(recorder.currentTime) || 0) * 1000);
    return { alive: true, isRecording, uri: uri || null, durationMs: Number.isFinite(durationMs) ? durationMs : 0 };
  } catch {
    // The shared object is gone: there is nothing left to read or to close.
    return dead;
  }
}

/** Upper bound for `stop()` so a silent native side can never leave the UI hanging. */
const STOP_TIMEOUT_MS = 3000;

/**
 * Stops an in-progress take and hands back what was captured, never throwing.
 *
 * The wait on `recorder.stop()` is raced against a bounded timeout: an unresponsive native
 * recorder must not block "Guardar", so if it goes quiet we fall back to the last known uri
 * and duration instead of hanging. After the stop the uri points at the finished file, so it
 * is read again (through the throw-safe snapshot) to pick up whatever changed.
 *
 * @returns {Promise<{uri: string|null, durationMs: number}>}
 */
export async function stopAndUnload(recorder) {
  const before = recorderSnapshot(recorder);
  // Nothing live to stop: a take that is already closed (or a released recorder) short-circuits,
  // and the uri it may still hold is returned so the caller can decide what to keep.
  if (!before.alive || !before.isRecording) return { uri: before.uri, durationMs: before.durationMs };

  try {
    const stopped = recorder.stop();
    await Promise.race([
      stopped,
      new Promise((resolve) => setTimeout(resolve, STOP_TIMEOUT_MS)),
    ]);
  } catch (error) {
    console.warn('[audio] stop failed; closing with the last known take', error);
  }

  const after = recorderSnapshot(recorder);
  return {
    uri: after.uri || before.uri || null,
    durationMs: after.durationMs || before.durationMs || 0,
  };
}

/**
 * Drops the disposable cache copy of a take once nothing holds the file open. Safe with
 * nulls and stale paths: a file the OS already reclaimed simply resolves to `true`.
 */
export function dropRecordingSource(uri) {
  if (!uri) return false;
  return removeFile(String(uri));
}

/** Every recording the app stores, newest first. */
export function listRecordings() {
  return listFolder(FOLDERS.recordings);
}

/** `1:05` style clock used by the recorder and the player. */
export function formatDuration(milliseconds) {
  const total = Math.max(0, Math.floor((Number(milliseconds) || 0) / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Seconds, rounded — what `useAudioPlayer` reports for `currentTime`/`duration`. */
export function formatSeconds(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

/** Human readable space used by a list of `{ uri }` voice notes. */
export function describeUsage(descriptors = []) {
  return formatBytes(totalSize(descriptors));
}

const PERMISSION_MESSAGES = {
  unsupported: 'Este dispositivo no puede grabar audio.',
  denied: 'Bloqueaste el micrófono: no se puede grabar. Puedes activarlo en Ajustes.',
};

export function describeAudioStatus(status, canAskAgain = true) {
  if (status === 'unsupported') return PERMISSION_MESSAGES.unsupported;
  if (status === 'denied') return canAskAgain === false ? PERMISSION_MESSAGES.denied : null;
  return null;
}

