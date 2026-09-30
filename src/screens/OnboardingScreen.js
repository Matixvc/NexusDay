import { useRef, useState } from 'react';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { themedStyles, colors, layout, radius, spacing, typography } from '../theme/theme';
import { PrimaryButton, TextButton } from '../components/ui/primitives';

/** Nombre configurado en app.json, para que los textos sigan un rename sin tocar código. */
const APP_NAME = Constants.expoConfig?.name || 'NexusDay';

/** Decorative hero, the same asset the dashboard uses. */
const WELCOME_BG = require('../../assets/welcome-bg.jpg');

/**
 * Copy of the tutorial.
 *
 * Every slide carries three short points plus a `tip` the user can expand: a first run full
 * of text is the fastest way to make somebody skip the whole thing.
 */
const SLIDES = [
  {
    key: 'hub',
    emoji: '🏠',
    title: 'Todo arranca en Inicio',
    body: 'Inicio es tu hub central: en una sola pantalla ves cómo viene el día.',
    points: [
      'Saludo, gastado del día y hábitos pendientes.',
      'Las próximas actividades, ordenadas por hora.',
      'Tarjetas de acceso directo a cada sección.',
    ],
    tip: 'El buscador global está arriba del todo: escribí dos letras y filtrá notas, eventos, hábitos y gastos a la vez.',
  },
  {
    key: 'nav',
    emoji: '👆',
    title: 'Todo abajo, y deslizá para ir',
    body: 'Las nueve secciones viven en la barra inferior. No hay menús escondidos.',
    points: [
      'Inicio · Horario · Agenda · Cumpleaños.',
      'Notas · Hábitos · Gastos · Nexus AI · Ajustes.',
      'Deslizá el dedo a los costados para cambiar de sección.',
    ],
    tip: 'La solapa iluminada es la que estás viendo. Si tocás una tarjeta de acceso rápido, saltás directo a esa sección.',
  },
  {
    key: 'notes',
    emoji: '🎙️',
    title: 'Notas con voz y calendario',
    body: 'Las notas aceptan audio y documentos, y la agenda se copia a tu calendario.',
    points: [
      'Grabá una nota de voz y guardala junto al texto.',
      'Adjuntá un documento sin salir del app.',
      '“Añadir al calendario” copia tus eventos al teléfono.',
    ],
    tip: 'Si preferís no dar permisos, exportás la agenda a un archivo .ics y lo abrís en cualquier app.',
  },
  {
    key: 'habits',
    emoji: '💪',
    title: 'Hábitos y gastos bajo control',
    body: 'Marcá el día con un toque y cargá un gasto en dos: monto y categoría.',
    points: [
      'Un toque por día: la racha se arma sola.',
      'Avisos con “✓ Completar” directo en la notificación.',
      'Resumen por categoría del mes en pantalla.',
    ],
    tip: 'El acento neón se cambia en Ajustes › Tema: hay cuatro variantes para que el app se sienta tuyo.',
  },
  {
    key: 'ai',
    emoji: '🤖',
    title: 'Nexus AI, sin internet',
    body: 'El asistente vive en el teléfono: lee tus datos y responde al instante.',
    points: [
      'Resume el día, los gastos y las rachas.',
      'Busca en tus notas, eventos, hábitos y cumpleaños.',
      'Si le preguntás algo ajeno al app, te reorienta.',
    ],
    tip: 'El botón de papelera del header borra la conversación cuando quieras empezar de cero.',
  },
];

/**
 * First-run tutorial (also the replay Ajustes can trigger).
 *
 * Swipe between slides, tap a point to expand its tip, and finish with “Comenzar a usar
 * NexusDay”, which is also what wipes the sample data so the app starts completely blank.
 */
export default function OnboardingScreen({ firstRun = true, onFinish }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const pagerRef = useRef(null);
  const [index, setIndex] = useState(0);
  const [openTip, setOpenTip] = useState(null);

  const last = index === SLIDES.length - 1;

  const goTo = (next) => {
    const target = Math.min(Math.max(next, 0), SLIDES.length - 1);
    pagerRef.current?.scrollTo({ x: target * width, animated: true });
    setIndex(target);
    setOpenTip(null);
  };

  const onMomentumScroll = (event) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    setIndex((current) => (current === next ? current : next));
    setOpenTip(null);
  };

  const toggleTip = (pointIndex) => setOpenTip((current) => (current === pointIndex ? null : pointIndex));

  return (
    <ImageBackground source={WELCOME_BG} style={styles.root} imageStyle={styles.rootImage} resizeMode="cover">
      {/* Two scrims: a flat one that kills the brightness of the photo and a bottom-heavy
          one that guarantees contrast for the text block. */}
      <View style={styles.scrim} />
      <View style={styles.scrimBottom} />

      <View style={[styles.body, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.topRow}>
          <View style={styles.brand}>
            <Text style={styles.brandMark}>{APP_NAME.slice(0, 1)}</Text>
            <Text style={styles.brandName} numberOfLines={1}>
              {APP_NAME}
            </Text>
          </View>
          <Text style={[typography.overline, styles.step]}>{`PASO ${index + 1} DE ${SLIDES.length}`}</Text>
        </View>

        <ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          onMomentumScrollEnd={onMomentumScroll}
          style={styles.pager}
        >
          {SLIDES.map((item) => (
            <Slide key={item.key} slide={item} width={width} openTip={openTip} onToggleTip={toggleTip} />
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <View
            style={styles.dots}
            accessibilityRole="progressbar"
            accessibilityLabel={`Paso ${index + 1} de ${SLIDES.length}`}
          >
            {SLIDES.map((item, dotIndex) => (
              <View
                key={item.key}
                style={[styles.dot, dotIndex === index ? { backgroundColor: colors.accent, width: 22 } : null]}
              />
            ))}
          </View>

          <View style={styles.actions}>
            <TextButton label={firstRun ? 'Omitir' : 'Cerrar'} tone="ghost" onPress={onFinish} style={styles.skip} />
            <PrimaryButton
              label={last ? (firstRun ? 'Comenzar a usar NexusDay' : 'Volver a NexusDay') : 'Siguiente'}
              onPress={() => (last ? onFinish() : goTo(index + 1))}
              style={styles.next}
            />
          </View>

          {last && firstRun ? (
            <Text style={[typography.caption, styles.wipeNote]}>
              Al empezar borramos los datos de ejemplo: la app queda en blanco para que cargues lo tuyo.
            </Text>
          ) : null}
        </View>
      </View>
    </ImageBackground>
  );
}

/** One page of the pager: emoji, headline and the three expandable points. */
function Slide({ slide, width, openTip, onToggleTip }) {
  return (
    <View style={[styles.slide, { width }]}>
      <View style={styles.emojiRing}>
        <Text style={styles.emoji}>{slide.emoji}</Text>
      </View>
      <Text style={styles.slideTitle}>{slide.title}</Text>
      <Text style={styles.slideBody}>{slide.body}</Text>

      <View style={styles.points}>
        {slide.points.map((point, pointIndex) => {
          const open = openTip === pointIndex;
          return (
            <Pressable
              key={point}
              onPress={() => onToggleTip(pointIndex)}
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              accessibilityLabel={point}
              style={({ pressed }) => [styles.point, pressed ? styles.pointPressed : null]}
            >
              <Text style={[styles.pointMark, { color: colors.accent }]}>✓</Text>
              <View style={styles.pointBody}>
                <Text style={styles.pointText}>{point}</Text>
                {open ? <Text style={styles.pointTip}>{slide.tip}</Text> : null}
              </View>
              <Text style={[styles.pointHint, { color: colors.accent }]}>{open ? '−' : '+'}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = themedStyles({
  root: { flex: 1, backgroundColor: colors.background },
  // The photo is decoration only: dropping its opacity is what keeps the white text readable.
  rootImage: { opacity: 0.38 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: `${colors.background}b8` },
  scrimBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: '30%',
    backgroundColor: `${colors.background}ee`,
  },

  body: { flex: 1, paddingHorizontal: layout.gutter, gap: spacing.md },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  brandMark: { ...typography.title, color: colors.accent },
  brandName: { ...typography.bodyStrong, color: colors.text },
  step: { color: colors.textMuted },

  pager: { flexGrow: 0 },
  slide: { paddingRight: spacing.sm, gap: spacing.md, paddingTop: spacing.md },
  emojiRing: {
    width: 62,
    height: 62,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 28 },
  slideTitle: { ...typography.display, fontSize: 25, lineHeight: 30, color: colors.text },
  slideBody: { ...typography.subtitle, lineHeight: 19, color: colors.textSecondary },

  points: { gap: spacing.sm, marginTop: spacing.xs },
  point: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: `${colors.surface}f2`,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  pointPressed: { opacity: 0.75 },
  pointMark: { fontSize: 14, fontWeight: '800', marginTop: 1 },
  pointBody: { flex: 1, gap: spacing.xs },
  pointText: { ...typography.small, color: colors.text, lineHeight: 18 },
  pointTip: { ...typography.caption, color: colors.textSecondary, lineHeight: 17 },
  pointHint: { fontSize: 16, fontWeight: '800', lineHeight: 18 },

  footer: { gap: spacing.md },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  dot: { width: 7, height: 7, borderRadius: radius.pill, backgroundColor: colors.surfacePlus },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  skip: { flex: 0, paddingHorizontal: spacing.lg },
  next: { flex: 1, paddingHorizontal: spacing.lg },
  wipeNote: { textAlign: 'center', lineHeight: 16 },
});
