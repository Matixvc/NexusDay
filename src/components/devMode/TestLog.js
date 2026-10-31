import { ScrollView, Text, View } from 'react-native';
import { themedStyles, colors, spacing, typography } from '../../theme/theme';
import { TestResult } from './TestResult';

export function TestLog({ entries = [] }) {
  if (!entries.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Sin pruebas ejecutadas todavÃ­a.</Text>
      </View>
    );
  }
  return (
    <ScrollView style={styles.scroll} nestedScrollEnabled>
      {entries.map((entry) => (
        <TestResult
          key={entry.id}
          title={entry.name}
          status={entry.status}
          message={entry.message}
          time={entry.time}
        />
      ))}
    </ScrollView>
  );
}

const styles = themedStyles({
  scroll: { maxHeight: 280 },
  empty: { paddingVertical: spacing.lg, alignItems: 'center' },
  emptyText: { ...typography.small, color: colors.textMuted },
});
