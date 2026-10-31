import { Text, View } from 'react-native';
import { themedStyles, colors, spacing, typography } from '../../theme/theme';

const RESULT_TONE = {
  pending: colors.textMuted,
  running: colors.warning,
  success: colors.accent,
  warning: colors.warning,
  error: colors.warning,
};

export function TestResult({ title, status = 'pending', message, time }) {
  const tone = RESULT_TONE[status] || RESULT_TONE.pending;
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: tone }]} />
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
      <View style={styles.meta}>
        <Text style={styles.status}>{status}</Text>
        {time ? <Text style={styles.time}>{time}</Text> : null}
      </View>
    </View>
  );
}

const styles = themedStyles({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  body: { flex: 1, gap: 2 },
  title: { ...typography.bodyStrong, fontSize: 14, color: colors.text },
  message: { ...typography.small, color: colors.textSecondary },
  meta: { alignItems: 'flex-end', gap: 2 },
  status: { ...typography.caption, color: colors.textMuted, textTransform: 'uppercase' },
  time: { ...typography.caption, color: colors.textMuted },
});
