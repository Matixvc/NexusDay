import { useCallback, useRef, useState } from 'react';
import { useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import {
  describeAudioStatus,
  ensureRecordingMode,
  persistRecording,
  recordingOptions,
  requestMicrophonePermission,
} from '../services/audio';

/**
 * Recording state machine on top of `expo-audio`'s `useAudioRecorder`.
 *
 * The hook owns one shared-object recorder: `prepareToRecordAsync()` → `record()` →
 * `stop()`, and the finished file is exposed through `recorder.uri`. Nothing is stored
 * until `stopAndSave()` moves the take out of the cache, so `cancel()` simply abandons it.
 *
 * @returns {{
 *  recording: boolean, canRecord: boolean, durationMs: number, metering: number|null,
 *  busy: boolean, error: string|null, saved: {uri,name,size}|null,
 *  start: () => Promise<boolean>, stopAndSave: () => Promise<object|null>, cancel: () => Promise<void>
 * }}
 */
export function useRecorder({ prefix = 'voz' } = {}) {
  const recorder = useAudioRecorder(recordingOptions);
  const state = useAudioRecorderState(recorder, 250);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(null);
  const starting = useRef(false);

  const start = useCallback(async () => {
    if (starting.current) return false;
    starting.current = true;
    setError(null);
    setSaved(null);
    setBusy(true);
    try {
      const permission = await requestMicrophonePermission();
      if (!permission.granted) {
        setError(describeAudioStatus(permission.status, permission.canAskAgain) || 'Falta permiso del micrófono.');
        return false;
      }

      await ensureRecordingMode();
      await recorder.prepareToRecordAsync();
      recorder.record();
      return true;
    } catch (err) {
      console.warn('[useRecorder] could not start the recording', err);
      setError('No se pudo empezar a grabar.');
      return false;
    } finally {
      starting.current = false;
      setBusy(false);
    }
  }, [recorder]);

  /** Stops and keeps the take: moves it to `Documents/recordings` and returns the descriptor. */
  const stopAndSave = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await recorder.stop();
      const durationMs = Number(recorder.getStatus?.().durationMillis ?? state.durationMillis) || 0;
      const stored = await persistRecording(recorder.uri, { prefix });
      if (!stored) {
        setError('La grabación no se pudo guardar.');
        return null;
      }
      const info = { ...stored, durationMs };
      setSaved(info);
      return info;
    } catch (err) {
      console.warn('[useRecorder] could not store the recording', err);
      setError('La grabación se interrumpió.');
      return null;
    } finally {
      setBusy(false);
    }
  }, [prefix, recorder, state.durationMillis]);

  /** Stops and throws the take away: the file stays in the cache for the OS to reclaim. */
  const cancel = useCallback(async () => {
    setBusy(true);
    try {
      await recorder.stop();
    } catch (err) {
      console.warn('[useRecorder] stop failed', err);
    } finally {
      setBusy(false);
    }
  }, [recorder]);

  return {
    recording: Boolean(state.isRecording),
    canRecord: Boolean(state.canRecord),
    durationMs: Number(state.durationMillis) || 0,
    metering: Number.isFinite(state.metering) ? state.metering : null,
    busy,
    error,
    saved,
    start,
    stopAndSave,
    cancel,
  };
}
