import { useEffect, useState } from 'react';
import { Animated, LayoutAnimation, Platform, Pressable, Text, UIManager, View } from 'react-native';
import { themedStyles, colors, radius, spacing, typography } from '../../theme/theme';
import { select as selectHaptic } from '../../services/haptics';

/**
 * Sección colapsable usada en Ajustes › Permisos y Seguridad.
 *
 * El contenido se pliega tras una cabecera siempre visible. El giro del chevrón se anima con
 * un único `Animated.Value` estable (inicializador perezoso de `useState`, sin leer refs en
 * render); el despliegue se apoya en `LayoutAnimation`, que en Android necesita habilitarse
 * una vez (UIManager) para que la transición sea suave. `defaultOpen` empieza abierto para que
 * los permisos se lean de un vistazo, y el háptico de selección acompaña cada apertura/cierre.
 */
function Accordion({ title, subtitle, icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  // An Animated.Value that survives re-renders without ever being read during render.
  const [rotate] = useState(() => new Animated.Value(defaultOpen ? 1 : 0));

  useEffect(() => {
    Animated.timing(rotate, {
      toValue: open ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [open, rotate]);

  const toggle = () => {
    selectHaptic();
    // LayoutAnimation gives the list a native, smooth reflow on both platforms.
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((prev) => !prev);
  };

  const chevron = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
        style={({ pressed }) => [styles.header, pressed ? styles.pressed : null]}
      >
        {icon ? <Text style={styles.icon}>{icon}</Text> : null}
        <View style={styles.headerText}>
          <Text style={typography.bodyStrong}>{title}</Text>
          {subtitle ? <Text style={typography.caption}>{subtitle}</Text> : null}
        </View>
        <Animated.Text style={[styles.chevron, { transform: [{ rotate: chevron }] }]}>▾</Animated.Text>
      </Pressable>

      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

export { Accordion };

export default Accordion;

const styles = themedStyles({
  wrap: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  icon: { fontSize: 18 },
  headerText: { flex: 1, gap: 2 },
  chevron: { fontSize: 16, color: colors.textMuted },
  body: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  pressed: { opacity: 0.7 },
});
