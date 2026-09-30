import { useMemo, useState } from 'react';
import {
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
import { useAppData } from '../context/AppDataContext';

/** Nombre configurado en app.json, para que los textos sigan un rename sin tocar código. */
const APP_NAME = Constants.expoConfig?.name || 'NexusDay';

/** Decorative hero, the same asset the dashboard uses. */
const WELCOME_BG = require('../../assets/welcome-bg.jpg');

/** Tab names of the demo bar, in the same order as the real one. */
const DEMO_TABS = ['Inicio', 'Horario', 'Agenda', 'Cumple', 'Notas', 'Hábitos', 'Gastos', 'AI', 'Ajustes'];
const DEMO_ICONS = ['🏠', '🗓️', '📆', '🎂', '📝', '💪', '💰', '🤖', '⚙️'];

/**
 * Copy of the tutorial.
 *
 * `demo` renders a small, *touchable* mock of the real screen: in a first run the user
 * pokes at the app before trusting it with real data. Slide 1 also carries the name field
 * (`field: true`), the only thing the tutorial asks for.
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
    tip: 'Probá el buscador de la demo: filtra notas, eventos, hábitos y gastos mientras escribís.',
    demo: 'search',
    field: true,
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
    tip: 'Tocá una solapa de la demo. En Ajustes podés reordenarlas u ocultarlas cuando quieras.',
    demo: 'tabs',
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
    tip: 'Tocá el micrófono de la demo: la grabación se guarda dentro del app, nunca sube a la nube.',
    demo: 'note',
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
    tip: 'Tocá el ✓ de la demo para ver cómo crece la racha, y el + para sumar un gasto.',
    demo: 'habits',
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
    tip: 'Tocá una sugerencia de la demo. El botón de papelera del header borra la conversación.',
    demo: 'ai',
  },
];

/**
 * First-run tutorial (also the replay Ajustes can trigger).
 *
 * Everything scales with `useWindowDimensions`: the copy, the ring, the demo and the
 * controls are derived from one `scale` factor, so a 5" phone and a tablet both get a
 * comfortable layout instead of a stretched one.
 */
export default function OnboardingScreen({ firstRun = true, onFinish }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { userName, setUserName } = useAppData();
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
          Full-bleed horizontal pager.

          The slides are exactly `width` wide and the container has **no** horizontal padding:
          any padding here would shrink the page the pager measures for `pagingEnabled` while
          the slides stayed `width` wide, which is what produced the overflow and the cut on
          the right edge. The gutter moves *inside* each slide instead, so the snap points and
          the page size always agree.
        */}
        <ScrollView
          style={styles.pager}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          onMomentumScrollEnd={(event) => {
            const next = Math.round(event.nativeEvent.contentOffset.x / width);
            if (next !== index) goTo(next);
          }}
        >
          {SLIDES.map((item) => (
            <View key={item.key} style={[styles.slidePage, { width }]}>
              <Slide
                slide={item}
                scale={scale}
                unit={unit}
                openTip={openTip}
                onToggleTip={toggleTip}
                nameDraft={item.field ? draft : ''}
                onChangeName={item.field ? setDraft : null}
                onSaveName={item.field ? saveName : null}
              />
            </View>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <View
            style={styles.dots}
            accessibilityRole="progressbar"
            accessibilityLabel={`Paso ${index + 1} de ${SLIDES.length}`}
          >
            {SLIDES.map((item, dotIndex) => (
              <Pressable
                key={item.key}
                onPress={() => goTo(dotIndex)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Ir al paso ${dotIndex + 1}`}
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

/** One page: the headline, the name field (slide 1), a live mini-demo and the points. */
function Slide({ slide, unit, openTip, onToggleTip, nameDraft, onChangeName, onSaveName }) {
  return (
    <View style={styles.slide}>
      <View style={styles.emojiRow}>
        <View style={[styles.emojiRing, { width: unit(62), height: unit(62), borderRadius: unit(31) }]}>
          <Text style={{ fontSize: unit(28) }}>{slide.emoji}</Text>
        </View>
        <View style={styles.headline}>
          <Text style={[typography.display, { fontSize: unit(25), lineHeight: unit(30) }]}>{slide.title}</Text>
          <Text style={[typography.subtitle, { lineHeight: unit(19) }]}>{slide.body}</Text>
        </View>
      </View>

      {slide.field ? <NameField unit={unit} value={nameDraft} onChange={onChangeName} onSave={onSaveName} /> : null}

      <Demo kind={slide.demo} unit={unit} />

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
                <Text style={[typography.small, styles.pointText]}>{point}</Text>
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

/** "¿Cómo querés que te llamemos?" — stored in `@nexusday/v1/user_name`. */
function NameField({ unit, value, onChange, onSave }) {
  return (
    <View style={styles.nameBlock}>
      <Text style={[typography.overline, { fontSize: unit(10) }]}>¿Cómo querés que te llamemos?</Text>
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
          accessibilityLabel="¿Cómo querés que te llamemos?"
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
        Se usa solo para el saludo del dashboard (“¡Hola, {value.trim() || 'Nombre'}! 👋”). Podés cambiarlo en
        Ajustes.
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Mini demos: small, touchable mocks of the real screens.
 * ------------------------------------------------------------------ */

/** Wraps every demo: same frame the app uses, so the shape is recognisable. */
function DemoFrame({ children, caption }) {
  return (
    <View style={styles.demo}>
      <View style={styles.demoTop}>
        <View style={styles.demoDot} />
        <View style={styles.demoDot} />
        <View style={styles.demoDot} />
        <Text style={styles.demoCaption} numberOfLines={1}>
          {caption}
        </Text>
      </View>
      <View style={styles.demoBody}>{children}</View>
    </View>
  );
}

function Demo({ kind, unit }) {
  if (kind === 'search') return <SearchDemo unit={unit} />;
  if (kind === 'tabs') return <TabsDemo unit={unit} />;
  if (kind === 'note') return <NoteDemo unit={unit} />;
  if (kind === 'habits') return <HabitsDemo unit={unit} />;
  return <AiDemo unit={unit} />;
}

/** Dashboard: a working search that filters four fake collections. */
function SearchDemo({ unit }) {
  const [query, setQuery] = useState('');
  const pool = [
    { icon: '📝', label: 'Nota · Pendientes de la semana' },
    { icon: '🗓️', label: 'Evento · Entrega del proyecto' },
    { icon: '💧', label: 'Hábito · Tomar 2 L de agua' },
    { icon: '💰', label: 'Gasto · Almuerzo en la facultad' },
  ];
  const needle = query.trim().toLowerCase();
  const hits = pool.filter((item) => item.label.toLowerCase().includes(needle));

  return (
    <DemoFrame caption="Inicio · búsqueda global">
      <View style={styles.demoField}>
        <Text style={{ fontSize: unit(13) }}>🔍</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar…"
          placeholderTextColor={colors.textMuted}
          style={[styles.demoInput, { fontSize: unit(13) }]}
          selectionColor={colors.accent}
          autoCorrect={false}
          accessibilityLabel="Demo del buscador global"
        />
        <Text style={[styles.demoCount, { fontSize: unit(11) }]}>{hits.length}</Text>
      </View>
      <View style={styles.demoRows}>
        {hits.length === 0 ? (
          <Text style={styles.demoEmpty}>Sin coincidencias</Text>
        ) : (
          hits.map((item) => (
            <View key={item.label} style={styles.demoRow}>
              <Text style={{ fontSize: unit(13) }}>{item.icon}</Text>
              <Text style={[typography.small, styles.demoRowLabel]} numberOfLines={1}>
                {item.label}
              </Text>
            </View>
          ))
        )}
      </View>
    </DemoFrame>
  );
}

/** Bottom bar: nine slots, the tapped one lights up. */
function TabsDemo({ unit }) {
  const [active, setActive] = useState(0);
  return (
    <DemoFrame caption="Barra inferior · 9 secciones">
      <Text style={styles.demoEmpty}>
        {`Estás en ${DEMO_TABS[active]}. Deslizá el dedo o tocá otra solapa.`}
      </Text>
      <View style={styles.demoTabs}>
        {DEMO_TABS.map((label, index) => (
          <Pressable
            key={label}
            onPress={() => setActive(index)}
            accessibilityRole="tab"
            accessibilityState={{ selected: index === active }}
            accessibilityLabel={label}
            style={({ pressed }) => [
              styles.demoTab,
              index === active ? { backgroundColor: colors.accentSoft, borderColor: colors.accent } : null,
              pressed ? styles.pointPressed : null,
            ]}
          >
            <Text style={{ fontSize: unit(11) }}>{DEMO_ICONS[index]}</Text>
            <Text
              style={[
                styles.demoTabLabel,
                index === active ? { color: colors.accent } : null,
                { fontSize: unit(8) },
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
    </DemoFrame>
  );
}

/** Note editor: record / stop, then the resulting chip. */
function NoteDemo({ unit }) {
  const [recording, setRecording] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <DemoFrame caption="Nota · audio local">
      <View style={styles.demoRow}>
        <Pressable
          onPress={() => {
            if (recording) setSaved(true);
            setRecording((value) => !value);
          }}
          accessibilityRole="button"
          accessibilityLabel={recording ? 'Detener la grabación' : 'Grabar nota de voz'}
          style={({ pressed }) => [
            styles.demoRecButton,
            recording ? { backgroundColor: colors.dangerSoft, borderColor: colors.danger } : null,
            pressed ? styles.pointPressed : null,
          ]}
        >
          <Text style={{ fontSize: unit(15) }}>{recording ? '■' : '🎙'}</Text>
        </Pressable>
        <View style={styles.demoRowBody}>
          <Text style={[typography.small, styles.demoRowLabel]} numberOfLines={1}>
            {recording ? 'Grabando… 0:03' : saved ? 'nota-de-voz-1.m4a' : 'Tocá para grabar'}
          </Text>
          <Text style={typography.caption} numberOfLines={1}>
            {saved ? '4 KB · dentro del app' : 'Se guarda en el dispositivo'}
          </Text>
        </View>
        {saved ? <Text style={{ fontSize: unit(14) }}>▶️</Text> : null}
      </View>
      <View style={styles.demoActions}>
        <View style={[styles.demoChip, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
          <Text style={[styles.demoChipLabel, { color: colors.accent, fontSize: unit(10) }]}>📅 Al calendario</Text>
        </View>
        <View style={styles.demoChip}>
          <Text style={[styles.demoChipLabel, { fontSize: unit(10) }]}>📎 Adjuntar</Text>
        </View>
      </View>
    </DemoFrame>
  );
}

/** Habit tick with a live streak plus a quick expense. */
function HabitsDemo({ unit }) {
  const [days, setDays] = useState(3);
  const [spent, setSpent] = useState(0);

  return (
    <DemoFrame caption="Hábitos y gastos">
      <View style={styles.demoRow}>
        <View style={[styles.demoBadge, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
          <Text style={{ fontSize: unit(14) }}>💧</Text>
        </View>
        <View style={styles.demoRowBody}>
          <Text style={[typography.small, styles.demoRowLabel]} numberOfLines={1}>
            Tomar 2 L de agua
          </Text>
          <Text style={typography.caption}>{`Racha: ${days} día(s)`}</Text>
        </View>
        <Pressable
          onPress={() => setDays((value) => value + 1)}
          accessibilityRole="button"
          accessibilityLabel="Marcar el hábito de hoy"
          style={({ pressed }) => [styles.demoCheck, pressed ? styles.pointPressed : null]}
        >
          <Text style={{ fontSize: unit(14) }}>✓</Text>
        </Pressable>
      </View>
      <View style={styles.demoRow}>
        <View style={[styles.demoBadge, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
          <Text style={{ fontSize: unit(14) }}>💰</Text>
        </View>
        <View style={styles.demoRowBody}>
          <Text style={[typography.small, styles.demoRowLabel]} numberOfLines={1}>
            {`Gastado hoy: $${spent}`}
          </Text>
          <Text style={typography.caption}>Un toque y queda cargado</Text>
        </View>
        <Pressable
          onPress={() => setSpent((value) => value + 500)}
          accessibilityRole="button"
          accessibilityLabel="Agregar un gasto"
          style={({ pressed }) => [styles.demoCheck, pressed ? styles.pointPressed : null]}
        >
          <Text style={{ fontSize: unit(15) }}>+</Text>
        </Pressable>
      </View>
    </DemoFrame>
  );
}

/** Assistant: tap a suggestion, get the answer bubble. */
function AiDemo({ unit }) {
  const [answer, setAnswer] = useState(null);
  const suggestions = ['¿Qué tengo hoy?', '¿Cuánto gasté?', '¿Qué hábitos me faltan?'];

  return (
    <DemoFrame caption="Nexus AI · 100% offline">
      <View style={styles.demoActions}>
        {suggestions.map((item) => (
          <Pressable
            key={item}
            onPress={() => setAnswer(item)}
            accessibilityRole="button"
            accessibilityLabel={item}
            style={({ pressed }) => [
              styles.demoChip,
              answer === item ? { backgroundColor: colors.accentSoft, borderColor: colors.accent } : null,
              pressed ? styles.pointPressed : null,
            ]}
          >
            <Text style={[styles.demoChipLabel, { fontSize: unit(9.5) }]}>{item}</Text>
          </Pressable>
        ))}
      </View>
      {answer ? (
        <View style={styles.demoBubble}>
          <Text style={[typography.small, styles.demoRowLabel]} numberOfLines={2}>
            {answer === '¿Cuánto gasté?'
              ? 'Hoy llevás $1.850 en 1 movimiento.'
              : answer === '¿Qué hábitos me faltan?'
                ? 'Te falta 1 hábito hoy: Tomar 2 L de agua.'
                : 'Tenés 1 cosa por delante: 18:30 Entrega del proyecto.'}
          </Text>
        </View>
      ) : (
        <Text style={styles.demoEmpty}>Tocá una sugerencia para ver una respuesta.</Text>
      )}
    </DemoFrame>
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

  body: { flex: 1, gap: spacing.md },
  // The pager spans the whole window: no horizontal padding here, or `pagingEnabled` would
  // measure a page narrower than the slides and clip the right edge.
  pager: { flexGrow: 0, marginHorizontal: -layout.gutter },
  // Each page is exactly `width` wide; the gutter lives in here.
  slidePage: { flexGrow: 0 },
  slide: { paddingHorizontal: layout.gutter, gap: spacing.md, paddingTop: spacing.md },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
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

  // Demos
  demo: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: `${colors.surface}cc`,
    overflow: 'hidden',
  },
  demoTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceAlt,
  },
  demoDot: { width: 6, height: 6, borderRadius: radius.pill, backgroundColor: colors.borderStrong },
  demoCaption: { ...typography.caption, marginLeft: spacing.xs, flex: 1 },
  demoBody: { padding: spacing.md, gap: spacing.sm },
  demoField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  demoInput: { flex: 1, color: colors.text, paddingVertical: spacing.sm, minHeight: 34 },
  demoCount: { ...typography.caption, color: colors.accent, fontWeight: '800' },
  demoRows: { gap: spacing.xs },
  demoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  demoRowBody: { flex: 1, gap: 1 },
  demoRowLabel: { color: colors.text },
  demoEmpty: { ...typography.caption, lineHeight: 16, paddingVertical: spacing.xs },
  demoTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'center' },
  demoTab: {
    width: 56,
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.xs + 1,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  demoTabLabel: { ...typography.caption, color: colors.textMuted, fontWeight: '700' },
  demoRecButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfacePlus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  demoChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  demoChipLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
  demoBadge: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoCheck: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.surfacePlus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoBubble: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});


