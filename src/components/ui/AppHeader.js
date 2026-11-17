import { Text, View } from 'react-native';
import { themedStyles, spacing, typography } from '../../theme/theme';
import { useResponsiveLayout } from '../../theme/responsive';

export function AppHeader({ title, subtitle, headerLeft, headerRight, variant = 'large', style }) {
  const { headerStacked } = useResponsiveLayout();
  const titleStyle = variant === 'compact' ? typography.h2 : typography.h1;

  return (
    <View style={[styles.header, headerStacked ? styles.stacked : null, style]}>
      {headerLeft ? <View style={styles.leading}>{headerLeft}</View> : null}
      <View style={styles.copy}>
        <Text style={titleStyle} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={[typography.subtitle, styles.subtitle]}>{subtitle}</Text> : null}
      </View>
      {headerRight ? <View style={[styles.actions, headerStacked ? styles.actionsStacked : null]}>{headerRight}</View> : null}
    </View>
  );
}

const styles = themedStyles({
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md, minWidth: 0 },
  stacked: { alignItems: 'flex-start', flexWrap: 'wrap' },
  leading: { flexShrink: 0 },
  copy: { flex: 1, minWidth: 160 },
  subtitle: { marginTop: spacing.xs },
  actions: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  actionsStacked: { marginLeft: 'auto' },
});
