import { useCallback, useEffect, useRef, useState } from 'react';
import { useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import {
  RECORDING_POLL_MS,
  describeAudioStatus,
  dropRecordingSource,
  ensureRecordingMode,
  persistRecording,
  recordingOptions,
  recorderSnapshot,
  requestMicrophonePermission,
  stopAndUnload,
} from '../services/audio';

/**
 * Recording state machine on top of `expo-audio`'s `useAudioRecorder`.
 *
 * The hook owns one shared-object recorder: `prepareToRecordAsync()` → `record()` →
 * `stopAndUnload()`. Nothing is stored until `stopAndSave()` has a *copy* of the take inside
 * `Documents/recordings`, so `cancel()` simply abandons the cache file.
 *
 * ### Why this looks over-defensive
 *
 * `useAudioRecorder` releases its shared object when the component unmounts, and from that
 * moment on **every read of the recorder throws** (`.isRecording`, `.uri`, `.getStatus()`).
 * The note sheet unmounts the recorder the instant "Guardar" closes it, so an unguarded read
 * inside a cleanup — or a second `stop()` on a take that is already closed — used to take the
 * whole app down. Three rules keep that impossible:
 *
 * 1. The unmount guard is registered **before** `useAudioRecorder` is called. React runs the
 *    cleanups of a component in the order its effects were created, so this is the only code
 *    guaranteed to run while the recorder is still alive.
 * 2. Every native read goes through `recorderSnapshot()`, which never throws.
 * 3. `takeClosedRef` makes stopping idempotent: one take, one stop, no matter how many times
 *    the UI (the record button, "Guardar", the unmount) asks for it.
 *
 * @returns {{
 *  recording: boolean, canRecord: boolean, durationMs: number, metering: number|null,
 *  busy: boolean, error: string|null, saved: {uri,name,size,durationMs}|null,
 *  start: () => Promise<boolean>,
 *  stopAndSave: () => Promise<object|null>,
 *  finishTake: () => Promise<object|null>,
 *  discardTake: () => Promise<void>,
 *  cancel: () => Promise<void>
 * }}
 */
export function useRecorder({ prefix = 'voz' } = {}) {
  // ── 1. The unmount guard (see rule 1 above) ─────────────────────────────────────────
  const recorderRef = useRef(null);
  const takeClosedRef = useRef(true);

  useEffect(() => {
    return () => {
      const recorder = recorderRef.current;
      if (!recorder || takeClosedRef.current) return;
      takeClosedRef.current = true;
      try {
        const stopping = recorder.stop();
        // Fire and forget: the shared object is released as soon as this cleanup returns, so
        // awaiting would only produce a rejection nobody is around to handle.
        if (stopping && typeof stopping.catch === 'function') stopping.catch(() => {});
      } catch {
        // The native recorder is already gone; there is nothing left to close.
      }
    };
  }, []);

  const recorder = useAudioRecorder(recordingOptions);
  // 250 ms: smooth enough for the level bar, cheap enough not to drain the battery.
  const state = useAudioRecorderState(recorder, RECORDING_POLL_MS);

  useEffect(() => {
    recorderRef.current = recorder;
  }, [recorder]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(null);
  const starting = useRef(false);
  const saving = useRef(false);
  const savedRef = useRef(null);

  const start = useCallback(async () => {
    if (starting.current) return false;
    starting.current = true;
    setError(null);
    setSaved(null);
    savedRef.current = null;
    setBusy(true);
    try {
      const permission = await requestMicrophonePermission();
      if (!permission.granted) {
        setError(describeAudioStatus(permission.status, permission.canAskAgain) || 'Falta permiso del micrófono.');
        return false;
      }

      await ensureRecordingMode();
      if (!recorderSnapshot(recorderRef.current).alive) {
        setError('El grabador no está disponible en este dispositivo.');
        return false;
      }
      // A new take re-opens the guard: from here on the recorder is live again.
      takeClosedRef.current = false;
      await recorder.prepareToRecordAsync();
      recorder.record();
      return true;
    } catch (err) {
      console.warn('[useRecorder] could not start the recording', err);
      takeClosedRef.current = true;
      setError('No se pudo empezar a grabar.');
      return false;
    } finally {
      starting.current = false;
      setBusy(false);
    }
  }, [recorder]);

  /** Stops and keeps the take: copies it into `Documents/recordings` and returns the descriptor. */
  const stopAndSave = useCallback(async () => {
    // A second call while the first one is still landing returns the same descriptor instead of
    // stopping an already-stopped recorder — the native exception that closed the app.
    if (saving.current) return savedRef.current;
    saving.current = true;
    setBusy(true);
    setError(null);
    try {
      takeClosedRef.current = true;

      // 1. Close the recorder first: a single stop plus the mic session released, and the
      //    wait is bounded so a silent native side can never leave the UI hanging.
      const take = await stopAndUnload(recorderRef.current);
      if (!take.uri) {
        setError('La grabación no se pudo guardar.');
        return null;
      }

      // 2. Then the file. The URI only changes hands once the copy really lives in Documents,
      //    so no state — and no stored note — can point at a recording that is not there.
      const stored = await persistRecording(take.uri, { prefix });
      if (!stored) {
        setError('La grabación no se pudo guardar.');
        return null;
      }

      const info = { ...stored, durationMs: take.durationMs || 0 };
      savedRef.current = info;
      setSaved(info);

      // 3. Last the disposable cache copy, now that nothing holds the file open.
      dropRecordingSource(take.uri);
      return info;
    } catch (err) {
      console.warn('[useRecorder] could not store the recording', err);
      setError('La grabación se interrumpió.');
      return null;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }, [prefix]);

  /** Stops and throws the take away: the file stays in the cache for the OS to reclaim. */
  const cancel = useCallback(async () => {
    takeClosedRef.current = true;
    setBusy(true);
    try {
      const take = await stopAndUnload(recorderRef.current);
      if (take.uri) dropRecordingSource(take.uri);
    } catch (err) {
      console.warn('[useRecorder] stop failed', err);
    } finally {
      setBusy(false);
    }
  }, []);

  /**
   * Closes an open take and keeps it (`null` when nothing was recording).
   *
   * Screens call this from "Guardar" *before* closing the sheet: unmounting the recorder with
   * the microphone still open is what crashed the app, and this makes that path impossible.
   */
  const finishTake = useCallback(async () => {
    if (!recorderSnapshot(recorderRef.current).isRecording) return null;
    return stopAndSave();
  }, [stopAndSave]);

  /** The same guarantee for the cancel path: the mic is closed before the sheet disappears. */
  const discardTake = useCallback(async () => {
    if (!recorderSnapshot(recorderRef.current).isRecording) return;
    await cancel();
  }, [cancel]);

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
    finishTake,
    discardTake,
    cancel,
  };
}
