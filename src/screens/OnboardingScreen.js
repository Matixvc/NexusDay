import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { themedStyles, colors, layout, radius, spacing, typography } from '../theme/theme';
import { PrimaryButton, TextButton } from '../components/ui/primitives';
import { Icon } from '../components/Icon';
import { useAppData } from '../context/AppDataContext';

/** Nombre configurado en app.json, para que los textos sigan un rename sin tocar código. */
const APP_NAME = Constants.expoConfig?.name || 'NexusDay';

/** Decorative hero, the same asset the dashboard uses. */
const WELCOME_BG = require('../../assets/nexusday-onboarding.png');
const TUTORIAL_ART = {
  day: require('../../assets/nex/u11/tutorial/tutorial-day.jpg'),
  notes: require('../../assets/nex/u11/tutorial/tutorial-notes.jpg'),
  calendar: require('../../assets/nex/u11/tutorial/tutorial-calendar.jpg'),
  themes: require('../../assets/nex/u11/tutorial/tutorial-themes.jpg'),
  privacy: require('../../assets/nex/u11/tutorial/tutorial-privacy.jpg'),
};

/**
 * Local-first tutorial.
 *
 * Artwork is illustrative and contains no user data. The welcome page carries the optional
 * name field (`field: true`), the only profile detail this guide asks for.
 */
const SLIDES = [
  {
    key: 'welcome',
    icon: 'home',
    title: 'Tu día, con más claridad',
    body: 'NexusDay reúne tu tiempo, tus ideas y tus rutinas en un espacio local.',
    points: ['Empieza en Día a Día para ver lo que viene.', 'Tus datos permanecen en este dispositivo.', 'Configura solo lo que quieras usar.'],
    tip: 'Puedes volver a esta guía desde Ajustes cuando lo necesites.',
    field: true,
  },
  {
    key: 'day',
    icon: 'home',
    title: 'Organiza tu jornada',
    body: 'Día a Día integra clases, eventos cercanos y tus rutinas personales.',
    points: ['Consulta las clases y su cuenta regresiva.', 'Las rutinas aparecen junto a tus compromisos sin mezclarse con el horario.', 'Abre Horario para revisar o ajustar la semana.'],
    tip: 'El resumen no incluye contenido de notas privadas.',
    image: TUTORIAL_ART.day,
  },
  {
    key: 'notes',
    icon: 'note',
    title: 'Guarda lo que importa',
    body: 'Crea notas para tus ideas y encuentra la información cuando la necesites.',
    points: ['Crea una nota con título y contenido.', 'Busca y organiza con etiquetas.', 'Marca una nota como privada para proteger su acceso.'],
    tip: 'Las notas privadas requieren autorización al abrirse y no se muestran en resúmenes.',
    image: TUTORIAL_ART.notes,
  },
  {
    key: 'calendar',
    icon: 'calendar',
    title: 'Mira el mes, planea el día',
    body: 'Calendario conecta tus fechas importantes con la agenda de cada día.',
    points: ['Toca un día para consultar su agenda.', 'Crea eventos y revisa los que ya tienes.', 'Los cumpleaños se repiten cada año y permanecen en Calendario.'],
    tip: 'Selecciona una fecha del mes para ver sus eventos y cumpleaños.',
    image: TUTORIAL_ART.calendar,
  },
  {
    key: 'themes',
    icon: 'palette',
    title: 'Adáptalo a tu ambiente',
    body: 'Apariencia reúne los temas Blanco, Oscuro y Nex, además de los acentos disponibles.',
    points: ['Elige un tema con su vista previa.', 'Selecciona uno de los acentos existentes.', 'Las preferencias se guardan en este dispositivo.'],
    tip: 'Cambiar de tema no modifica tus notas, rutinas ni eventos.',
    image: TUTORIAL_ART.themes,
  },
  {
    key: 'privacy',
    icon: 'shieldCheck',
    title: 'Protege y conserva tus datos',
    body: 'NexusDay incluye controles de privacidad y copias que puedes administrar desde Ajustes.',
    points: ['Las notas privadas requieren autorización según tu configuración.', 'Exporta una copia antes de cambiar de dispositivo.', 'Repite este tutorial desde Ajustes sin restablecer tus datos.'],
    tip: 'Los adjuntos locales pueden depender de los archivos disponibles en el dispositivo.',
    image: TUTORIAL_ART.privacy,
  },
];

/**
 * First-run tutorial (also the replay Ajustes can trigger).
 *
 * Everything scales with `useWindowDimensions`: the copy, artwork and the
 * controls are derived from one `scale` factor, so a 5" phone and a tablet both get a
 * comfortable layout instead of a stretched one.
 */
export default function OnboardingScreen({ firstRun = true, onFinish }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { userName, setUserName, settings } = useAppData();
  const reduceMotion = settings?.reduceMotion === true;
  const [index, setIndex] = useState(0);
  const [openTip, setOpenTip] = useState(null);
  const [draft, setDraft] = useState(userName);

  // 390 x 780 is the reference layout; anything bigger/smaller is scaled and clamped so the
  // text never turns unreadable on a very small screen nor huge on a tablet.
  const scale = useMemo(
    () => Math.min(1.12, Math.max(0.82, Math.min(width / 390, height / 780))),
    [height, width],
  );
  const unit = (value) => Math.round(value * scale);

  const last = index === SLIDES.length - 1;

  const goTo = (next) => {
    const target = Math.min(Math.max(next, 0), SLIDES.length - 1);
    setIndex(target);
    setOpenTip(null);
  };

  // ── Pager ────────────────────────────────────────────────────────────────────────────────
  const pagerRef = useRef(null);
  /** Last offset the list reported, so the effect below never fights the finger. */
  const lastOffset = useRef(0);

  /** One page == one window. Stated up front so `scrollToOffset` always lands on a boundary. */
  const itemLayout = useCallback(
    (unusedData, itemIndex) => ({ length: width, offset: width * itemIndex, index: itemIndex }),
    [width],
  );

  // `pagingEnabled` only ever moves on a finger: the dots and the "Siguiente" button change
  // `index`, and this is what drags the list along with them.
  useEffect(() => {
    const target = index * width;
    if (Math.abs(target - lastOffset.current) < 2) return;
    lastOffset.current = target;
    pagerRef.current?.scrollToOffset({ offset: target, animated: !reduceMotion });
  }, [index, reduceMotion, width]);

  const toggleTip = (pointIndex) => setOpenTip((current) => (current === pointIndex ? null : pointIndex));

  /** The name is stored as soon as the user confirms it, not on the last slide. */
  const saveName = () => {
    const next = draft.trim();
    if (next) setUserName(next);
  };

  return (
    <ImageBackground source={WELCOME_BG} style={styles.root} imageStyle={styles.rootImage} resizeMode="cover">
      {/* Two scrims: a flat one that kills the brightness of the photo and a bottom-heavy
          one that guarantees contrast for the text block. */}
      <View style={styles.scrim} />
      <View style={styles.scrimBottom} />

      <View
        style={[
          styles.body,
          { paddingTop: insets.top + unit(12), paddingBottom: insets.bottom + unit(10) },
        ]}
      >
        <View style={styles.topRow}>
          <View style={styles.brand}>
            <Text style={[styles.brandMark, { fontSize: unit(19) }]}>{APP_NAME.slice(0, 1)}</Text>
            <Text style={[styles.brandName, { fontSize: unit(15) }]} numberOfLines={1}>
              {APP_NAME}
            </Text>
          </View>
          <Text style={[typography.overline, styles.step]}>{`PASO ${index + 1} DE ${SLIDES.length}`}</Text>
        </View>

        {/*
          Horizontal pager.

          Each page is exactly `width` wide and the list itself carries **no** horizontal padding
          and no negative margin: `pagingEnabled` snaps by the width of the list, so padding here
          (or pulling the list out of the screen with a negative margin) makes the snap points
          drift and clips the right edge of every slide — which is what this rewrite fixes. The
          gutter lives *inside* each slide instead, and `getItemLayout` states the page geometry
          up front so `scrollToOffset` from the dots and the "Siguiente" button always lands on a
          page boundary.
        */}
        <FlatList
          ref={pagerRef}
          style={styles.pager}
          data={SLIDES}
          keyExtractor={(item) => item.key}
          horizontal
          pagingEnabled
          bounces={false}
          scrollEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          getItemLayout={itemLayout}
          initialScrollIndex={0}
          contentContainerStyle={styles.pagerContent}
          // Six slides fit comfortably: render them all. Windowing would recycle pages mid-swipe and
          // the tallest slide would keep resizing the list under the footer.
          initialNumToRender={SLIDES.length}
          extraData={{ openTip, draft }}
          onMomentumScrollEnd={(event) => {
            const offset = event.nativeEvent.contentOffset.x;
            lastOffset.current = offset;
            const next = Math.round(offset / width);
            if (next !== index) goTo(next);
          }}
          renderItem={({ item }) => (
            <View style={[styles.slidePage, { width }]}>
              {/* Each page scrolls on its own axis: a slide that does not fit a small screen
                  reads to the end instead of losing its last lines behind the footer. */}
              <ScrollView
                style={styles.slideScroll}
                contentContainerStyle={styles.slide}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <Slide
                  slide={item}
                  scale={scale}
                  unit={unit}
                  openTip={openTip}
                  onToggleTip={toggleTip}
                  nameDraft={firstRun && item.field ? draft : ''}
                  onChangeName={firstRun && item.field ? setDraft : null}
                  onSaveName={firstRun && item.field ? saveName : null}
                />
              </ScrollView>
            </View>
          )}
        />

        <View style={styles.footer}>
          <View
            style={styles.dots}
            accessibilityRole="progressbar"
            accessibilityLabel={`Paso ${index + 1} de ${SLIDES.length}`}
            accessibilityValue={{ min: 1, max: SLIDES.length, now: index + 1 }}
          >
            {SLIDES.map((item, dotIndex) => (
              <Pressable
                key={item.key}
                onPress={() => goTo(dotIndex)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Ir al paso ${dotIndex + 1}`}
                accessibilityState={{ selected: dotIndex === index }}
                style={styles.progressTarget}
              >
                <View
                  style={[
                    styles.dot,
                    dotIndex === index ? { backgroundColor: colors.accent, width: unit(22) } : null,
                  ]}
                />
              </Pressable>
            ))}
          </View>

          <View style={styles.actions}>
            {index > 0 ? (
              <TextButton label="Atrás" tone="ghost" onPress={() => goTo(index - 1)} style={styles.back} />
            ) : <View style={styles.backPlaceholder} />}
            <TextButton label={firstRun ? 'Omitir' : 'Cerrar'} tone="ghost" onPress={onFinish} style={styles.skip} />
            <PrimaryButton
              label={last ? (firstRun ? 'Comenzar a usar NexusDay' : 'Volver a NexusDay') : 'Siguiente'}
              onPress={() => (last ? onFinish() : goTo(index + 1))}
              style={styles.next}
            />
          </View>

          {last && firstRun ? (
            <Text style={[typography.caption, styles.wipeNote]}>
              Al empezar borramos los datos de ejemplo: la app queda en blanco para que registres lo tuyo.
            </Text>
          ) : null}
        </View>
      </View>
    </ImageBackground>
  );
}

/** One page: the headline, optional name field, illustration and practical pointers. */
function Slide({ slide, unit, openTip, onToggleTip, nameDraft, onChangeName, onSaveName }) {
  return (
    <View style={styles.slideBody}>
      <View style={styles.emojiRow}>
        <View style={[styles.emojiRing, { width: unit(62), height: unit(62), borderRadius: unit(31) }]}>
          <Icon name={slide.icon} size={unit(28)} color={colors.accent} />
        </View>
        <View style={styles.headline}>
          <Text style={[typography.display, { fontSize: unit(25), lineHeight: unit(30) }]}>{slide.title}</Text>
          <Text style={[typography.subtitle, { lineHeight: unit(19) }]}>{slide.body}</Text>
        </View>
      </View>

      {slide.field ? <NameField unit={unit} value={nameDraft} onChange={onChangeName} onSave={onSaveName} /> : null}

      {slide.image ? (
        <Image
          source={slide.image}
          style={styles.tutorialArt}
          resizeMode="cover"
          accessible={false}
          importantForAccessibility="no"
        />
      ) : null}

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
              <Icon name="check" size={16} color={colors.accent} />
              <View style={styles.pointBody}>
                <Text style={[typography.small, styles.pointText]}>{point}</Text>
                {open ? <Text style={styles.pointTip}>{slide.tip}</Text> : null}
              </View>
              <Icon name={open ? 'minus' : 'plus'} size={16} color={colors.accent} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** "¿Cómo quieres que te llamemos?" — stored in `@nexusday/v1/user_name`. */
function NameField({ unit, value, onChange, onSave }) {
  return (
    <View style={styles.nameBlock}>
      <Text style={[typography.overline, { fontSize: unit(10) }]}>¿Cómo quieres que te llamemos?</Text>
      <View style={styles.nameRow}>
        <TextInput
          value={value}
          onChangeText={onChange}
          onSubmitEditing={onSave}
          placeholder="Tu nombre"
          placeholderTextColor={colors.textMuted}
          style={[styles.nameInput, { fontSize: unit(15) }]}
          selectionColor={colors.accent}
          cursorColor={colors.accent}
          returnKeyType="done"
          maxLength={20}
          autoCapitalize="words"
          autoCorrect={false}
          accessibilityLabel="¿Cómo quieres que te llamemos?"
        />
        <Pressable
          onPress={onSave}
          accessibilityRole="button"
          accessibilityLabel="Guardar el nombre"
          style={({ pressed }) => [styles.nameSave, pressed ? styles.pointPressed : null]}
        >
          <Text style={[styles.nameSaveLabel, { fontSize: unit(12) }]}>Guardar</Text>
        </Pressable>
      </View>
      <Text style={styles.nameHint}>
        Se usa solo para el saludo del dashboard (“¡Hola, {value.trim() || 'Nombre'}! 👋”). Puedes cambiarlo en
        Ajustes.
      </Text>
    </View>
  );
}

const styles = themedStyles({
  root: { flex: 1, backgroundColor: colors.background },
  // The photo is decoration only: dropping its opacity is what keeps the white text readable.
  rootImage: { opacity: 0.58 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: `${colors.background}b8` },
  scrimBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: '30%',
    backgroundColor: `${colors.background}ee`,
  },

  body: { flex: 1, gap: spacing.md },
  // The pager is the only full-bleed element of the screen: it is a direct child of a body that
  // has *no* horizontal padding, so its own width is exactly the window width and each page can
  // be `width` wide. A padding here (or a negative margin on the list) would make
  // `pagingEnabled` snap off-centre and clip the slides — the bug this layout avoids.
  // It does grow, so the footer stays pinned to the bottom whatever the slide heights are.
  pager: { flexGrow: 1 },
  // Stretch, not centre: pages take the full height of the list so the scroll inside them has a
  // bounded box to work with.
  pagerContent: { alignItems: 'stretch' },
  // Each page is exactly `width` wide; the gutter lives in here.
  slidePage: { flexGrow: 0, flexShrink: 0, height: '100%' },
  slideScroll: { flex: 1 },
  slide: {
    paddingHorizontal: layout.gutter,
    gap: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  slideBody: { gap: spacing.md },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: layout.gutter,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  brandMark: { ...typography.title, color: colors.accent },
  brandName: { ...typography.bodyStrong, color: colors.text },
  step: { color: colors.textMuted },

  // (pager, slidePage and slide are declared above, next to `body`.)

  emojiRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  emojiRing: {
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headline: { flex: 1, gap: 4 },

  nameBlock: { gap: spacing.xs },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nameInput: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    color: colors.text,
    minHeight: 44,
  },
  nameSave: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
  },
  nameSaveLabel: { fontWeight: '800', color: colors.accentInk },
  nameHint: { ...typography.caption, lineHeight: 16 },

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
  pointBody: { flex: 1, gap: spacing.xs },
  pointText: { ...typography.small, color: colors.text, lineHeight: 18 },
  pointTip: { ...typography.caption, color: colors.textSecondary, lineHeight: 17 },

  // The pager grows, so the controls already sit at the bottom of the screen; the padding here is
  // the gutter the body deliberately does not carry.
  footer: { gap: spacing.md, paddingHorizontal: layout.gutter },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  progressTarget: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 7, height: 7, borderRadius: radius.pill, backgroundColor: colors.surfacePlus },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  back: { flex: 0, paddingHorizontal: spacing.sm },
  backPlaceholder: { width: 56 },
  skip: { flex: 0, paddingHorizontal: spacing.sm },
  next: { flex: 1, paddingHorizontal: spacing.lg },
  wipeNote: { textAlign: 'center', lineHeight: 16 },

  tutorialArt: { width: '100%', aspectRatio: 1.25, maxHeight: 240, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.elevated },
});


