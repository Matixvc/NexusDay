import { Image, Text, View } from 'react-native';
import { Card, Pill, Screen } from '../components/ui/primitives';
import { HeaderIconButton } from '../components/ui/HeaderIconButton';
import { colors, radius, spacing, themedStyles, typography } from '../theme/theme';

const NEX_ORB = require('../../assets/nex/u11/ai/nex-orb-base.jpg');

/** Brand preview only. No chat, data access, network service, or simulated actions. */
export default function NexAiPreviewScreen({ navigation }) {
  return (
    <Screen
      title="Nex AI"
      subtitle="Una nueva parte de NexusDay está en preparación."
      backButton={false}
      headerRight={<HeaderIconButton icon="settings" label="Abrir Ajustes" onPress={() => navigation.navigate('Ajustes')} />}
    >
      <View style={styles.artFrame}>
        <Image source={NEX_ORB} style={styles.art} resizeMode="cover" accessible={false} importantForAccessibility="no" />
      </View>
      <Card style={styles.message}>
        <Pill label="PRÓXIMAMENTE" tone="accent" />
        <Text style={typography.h2} accessibilityRole="header">Una identidad en preparación</Text>
        <Text style={typography.body}>
          Nex AI todavía no está disponible. Esta pantalla presenta su identidad visual; no inicia conversaciones,
          no consulta tus datos y no se conecta a servicios externos.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = themedStyles({
  artFrame: {
    width: '100%',
    maxWidth: 360,
    aspectRatio: 1,
    alignSelf: 'center',
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: '#111315',
    borderWidth: 1,
    borderColor: colors.border,
  },
  art: { width: '100%', height: '100%' },
  message: { gap: spacing.md },
});
