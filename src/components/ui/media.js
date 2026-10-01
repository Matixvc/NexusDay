import { Pressable, Text, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { themedStyles, colors, radius, spacing, typography } from '../../theme/theme';
import { Field } from './inputs';
import { Notice, TextButton } from './primitives';
import { useRecorder } from '../../hooks/useRecorder';
import { ensurePlaybackMode, formatSeconds, isAvailable as audioAvailable } from '../../services/audio';
import { formatBytes } from '../../services/files';

/**
 * Voice notes and document attachments.
 *
 * Everything here degrades gracefully: when the native audio module is not reachable
 * (Expo Go without a development build, tests) the controls collapse into a notice
 * instead of crashing the screen with a hook that cannot resolve.
 */

const UNAVAILABLE = 'La grabación de audio requiere una versión de desarrollo de la app con expo-audio.';

/**
 * Grabar → detener → guardar. `value` is the descriptor stored on the note
 * (`{ uri, name, size, durationMs }`); `onChange(null)` clears it. This component never
 * deletes files: the owner (the screen) removes the replaced or discarded file once the
 * change is actually persisted, so cancelling a sheet cannot destroy an older take.
 */
export function VoiceRecorder({ label = 'Nota de voz', value, onChange, prefix = 'voz', hint }) {
  if (!audioAvailable()) {
    return (
      <Field label={label}>
        <Notice text={UNAVAILABLE} />
      </Field>
    );
  }
  return <VoiceRecorderControls value={value} onChange={onChange} prefix={prefix} label={label} hint={hint} />;
}

function VoiceRecorderControls({ label, value, onChange, prefix, hint }) {
  const recorder = useRecorder({ prefix });
  const attached = value?.uri ? value : null;

  const handlePress = async () => {
    if (recorder.recording) {
      const info = await recorder.stopAndSave();
      if (info) onChange?.(info);
      return;
    }
    await recorder.start();
  };

  const handleRemove = () => onChange?.(null);

  const secondary = attached && !recorder.recording ? (
    <TextButton label="Quitar" tone="danger" onPress={handleRemove} />
  ) : null;

  return (
    <Field label={label} hint={hint}>
      <View style={styles.recorder}>
        <Pressable
          onPress={handlePress}
          disabled={recorder.busy}
          style={({ pressed }) => [
            styles.recordButton,
            recorder.recording ? styles.recordButtonActive : null,
            pressed ? styles.pressed : null,
          ]}
        >
          <Text style={[styles.recordGlyph, recorder.recording ? { color: colors.danger } : null]}>
            {recorder.recording ? '■' : '🎙'}
          </Text>
        </Pressable>

        <View style={styles.grow}>
          <Text style={typography.bodyStrong} numberOfLines={1}>
            {recorder.recording ? 'Grabando…' : attached ? attached.name || 'Grabación guardada' : 'Toca para grabar'}
          </Text>
          <Text style={typography.caption} numberOfLines={1}>
            {recorder.recording
              ? formatSeconds(recorder.durationMs / 1000)
              : attached
                ? `${formatSeconds((Number(attached.durationMs) || 0) / 1000)} · ${formatBytes(attached.size)}`
                : 'La nota se guarda dentro de la app'}
          </Text>
        </View>

        {secondary}
      </View>
      {recorder.error ? <Notice text={recorder.error} tone="danger" /> : null}
    </Field>
  );
}

/** Inline player for a stored voice note. `audio` is `{ uri, name, size, durationMs }`. */
export function VoicePlayback({ audio, style }) {
  if (!audio?.uri || !audioAvailable()) return null;
  return <VoicePlaybackControls audio={audio} style={style} />;
}

function VoicePlaybackControls({ audio, style }) {
  const player = useAudioPlayer(audio.uri);
  const status = useAudioPlayerStatus(player);

  const total = Number(status.duration) || (Number(audio.durationMs) || 0) / 1000;
  const elapsed = Number(status.currentTime) || 0;
  const progress = total > 0 ? Math.min(1, elapsed / total) : 0;
  const finished = Boolean(status.didJustFinish) || (total > 0 && elapsed >= total - 0.05);

  const toggle = () => {
    try {
      if (status.playing) {
        player.pause();
        return;
      }
      const restart = finished ? player.seekTo(0) : Promise.resolve();
      Promise.resolve(restart)
        .catch(() => {})
        .then(() => ensurePlaybackMode())
        .then(() => player.play())
        .catch((error) => console.warn('[media] playback failed', error));
    } catch (error) {
      console.warn('[media] playback failed', error);
    }
  };

  return (
    <View style={[styles.player, style]}>
      <Pressable
        onPress={toggle}
        style={({ pressed }) => [styles.playButton, pressed ? styles.pressed : null]}
        accessibilityRole="button"
        accessibilityLabel={status.playing ? 'Pausar nota de voz' : 'Reproducir nota de voz'}
      >
        <Text style={styles.playGlyph}>{status.playing ? '❚❚' : '▶'}</Text>
      </Pressable>
      <View style={styles.grow}>
        <Text style={[typography.small, styles.truncate]} numberOfLines={1}>
          {audio.name || 'Nota de voz'}
        </Text>
        <View style={styles.track}>
          <View style={[styles.trackFill, { width: `${(progress * 100).toFixed(1)}%` }]} />
        </View>
        <Text style={[typography.caption, typography.tabular]}>
          {status.isLoaded === false ? 'Cargando…' : `${formatSeconds(elapsed)} / ${formatSeconds(total)}`}
        </Text>
      </View>
    </View>
  );
}

/** One imported document (PDF, image, …) with its size and the actions the screen offers. */
export function AttachmentRow({ attachment, onShare, onRemove, style }) {
  if (!attachment?.uri) return null;
  const extension = String(attachment.name || '').split('.').pop() || 'doc';
  return (
    <View style={[styles.attachment, style]}>
      <View style={styles.attachmentBadge}>
        <Text style={styles.attachmentBadgeText}>{extension.slice(0, 4).toUpperCase()}</Text>
      </View>
      <View style={styles.grow}>
        <Text style={[typography.small, styles.truncate]} numberOfLines={1}>
          {attachment.name || 'Documento adjunto'}
        </Text>
        <Text style={typography.caption}>{formatBytes(attachment.size)}</Text>
      </View>
      {onShare ? <TextButton label="Compartir" tone="ghost" onPress={onShare} /> : null}
      {onRemove ? <TextButton label="Quitar" tone="danger" onPress={onRemove} /> : null}
    </View>
  );
}

const styles = themedStyles({
  grow: { flex: 1, gap: 3 },
  truncate: { color: colors.text },
  pressed: { opacity: 0.6 },

  recorder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  recordButton: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.surfacePlus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButtonActive: { backgroundColor: colors.dangerSoft },
  recordGlyph: { fontSize: 18 },

  player: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playGlyph: { fontSize: 13, fontWeight: '800', color: colors.accent },
  track: { height: 4, borderRadius: radius.pill, backgroundColor: colors.surfacePlus, overflow: 'hidden' },
  trackFill: { height: 4, borderRadius: radius.pill, backgroundColor: colors.accent },

  attachment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  attachmentBadge: {
    minWidth: 42,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.surfacePlus,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  attachmentBadgeText: { fontSize: 10.5, fontWeight: '800', color: colors.textSecondary, letterSpacing: 0.4 },
});

