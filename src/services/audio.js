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
 *
 * Recordings are captured in the cache directory (cheap, disposable) and only moved
 * into `Documents/recordings/` once the user accepts the take, so a discarded take
 * never leaves a file behind.
 */

/** Same shape `expo-audio` ships, pinned to `.m4a` so iOS/Android agree on the container. */
export const recordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  directory: 'cache',
};

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

