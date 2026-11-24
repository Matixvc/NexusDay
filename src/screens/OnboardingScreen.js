import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
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

/** Tab names of the demo bar, in the same order as the real one. */
const DEMO_TABS = ['Día a Día', 'Bloc de Notas', 'Calendario'];
const DEMO_ICONS = ['home', 'note', 'calendar'];

/**
 * Mapping de nombres de pestaña a iconos de Lucide para la demo del onboarding.
 * Se usa el componente Icon centralizado en lugar de emojis.
 */
const TAB_ICON_MAP = {
  'Día a Día': 'home',
  'Bloc de Notas': 'note',
  Calendario: 'calendar',
};

/**
 * Copy of the tutorial.
 *
 * `demo` renders a small, *touchable* mock of the real screen: in a first run the user
 * pokes at the app before trusting it with real data. Slide 1 also carries the name field
 * (`field: true`), the only thing the tutorial asks for.
 */
const SLIDES = [
  {
    key: 'day',
    icon: 'home',
    title: 'Haz espacio para tu día',
    body: 'NexusDay reúne lo que tienes por delante en un lugar sereno y fácil de consultar.',
    points: ['Tus clases aparecen junto a los próximos eventos.', 'Abre Horario desde Día a Día para revisar o ajustar tu semana.', 'Usa el resumen para orientarte; tus registros privados no aparecen aquí.'],
    tip: 'Empieza con lo próximo y entra en Horario cuando necesites ver la semana completa.',
    demo: 'search',
    field: true,
  },
  {
    key: 'notes',
    icon: 'note',
    title: 'Guarda lo que importa',
    body: 'Crea notas para tus ideas y encuentra la información cuando la necesites.',
    points: ['Crea una nota con título y contenido.', 'Busca y organiza con etiquetas.', 'Marca una nota como privada para proteger su acceso.'],
    tip: 'Las notas privadas requieren autorización al abrirse y no se muestran en resúmenes.',
    demo: 'note',
  },
  {
    key: 'calendar',
    icon: 'calendar',
    title: 'Mira el mes, planea el día',
    body: 'Calendario conecta tus fechas importantes con la agenda de cada día.',
    points: ['Toca un día para consultar su agenda.', 'Crea eventos y revisa los que ya tienes.', 'Los cumpleaños se repiten cada año y permanecen en Calendario.'],
    tip: 'Selecciona una fecha del mes para ver sus eventos y cumpleaños.',
    demo: 'calendar',
  },
  {
    key: 'settings',
    icon: 'settings',
    title: 'A tu manera, en Ajustes',
    body: 'Personaliza la apariencia y vuelve a esta guía cuando quieras.',
    points: ['Elige entre Claro, Oscuro, Blanco y negro o Nex.', 'Ajusta el acento para reconocer NexusDay a primera vista.', 'Abre Ajustes desde el encabezado de las secciones.'],
    tip: 'En Ajustes › Ayuda puedes repetir este tutorial; tus datos y preferencias se conservan.',
    demo: 'settings',
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
    pagerRef.current?.scrollToOffset({ offset: target, animated: true });
  }, [index, width]);

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
          // Four slides is nothing: render them all. Windowing would recycle pages mid-swipe and
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

/** One page: the headline, optional name field, mini-demo and practical pointers. */
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
  if (kind === 'calendar') return <CalendarDemo unit={unit} />;
  if (kind === 'settings') return <SettingsDemo unit={unit} />;
  return <TabsDemo unit={unit} />;
}

function CalendarDemo({ unit }) {
  return (
    <DemoFrame caption="Calendario · tu agenda">
      <View style={styles.calendarDemoHeader}>
        <Text style={[typography.small, styles.demoRowLabel]}>VISTA MENSUAL</Text>
        <Text style={[typography.caption, { color: colors.accent }]}>Día seleccionado</Text>
      </View>
      <View style={styles.calendarDemoDays}>
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day, index) => (
          <View key={day} style={[styles.calendarDemoDay, index === 0 ? { backgroundColor: colors.accent, borderRadius: radius.pill } : null]}>
            <Text style={[typography.caption, { color: index === 0 ? colors.accentInk : colors.textMuted, fontSize: unit(10) }]}>{day}</Text>
          </View>
        ))}
      </View>
      <View style={styles.demoRow}>
        <View style={[styles.demoBadge, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
          <Icon name="calendar" size={unit(14)} color={colors.accent} />
        </View>
        <View style={styles.demoRowBody}>
          <Text style={[typography.small, styles.demoRowLabel]}>Agenda del día</Text>
          <Text style={typography.caption}>Eventos y cumpleaños</Text>
        </View>
      </View>
    </DemoFrame>
  );
}

function SettingsDemo({ unit }) {
  return (
    <DemoFrame caption="Ajustes · apariencia">
      <Text style={[typography.small, styles.demoRowLabel]}>Elige una identidad</Text>
      <View style={styles.demoActions}>
        {[
          ['Claro', colors.surface],
          ['Oscuro', colors.background],
          ['B y N', colors.text],
          ['Nex', colors.accent],
        ].map(([label, color]) => (
          <View key={label} style={styles.settingsDemoOption}>
            <View style={[styles.settingsDemoSwatch, { backgroundColor: color }]} />
            <Text style={[styles.demoChipLabel, { fontSize: unit(10) }]}>{label}</Text>
          </View>
        ))}
      </View>
      <Text style={typography.caption}>Personaliza el tema y el acento desde Ajustes.</Text>
    </DemoFrame>
  );
}

/** Dashboard: a working search over illustrative sample rows. */
function SearchDemo({ unit }) {
  const [query, setQuery] = useState('');
  const pool = [
    { icon: '📝', label: 'Nota · Pendientes de la semana' },
    { icon: '🗓️', label: 'Evento · Entrega del proyecto' },
    { icon: '🎓', label: 'Clase · Diseño de interfaces' },
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

/** Bottom bar: three primary destinations, the tapped one lights up. */
function TabsDemo({ unit }) {
  const [active, setActive] = useState(0);
  return (
    <DemoFrame caption="Barra inferior · 3 secciones">
      <Text style={styles.demoEmpty}>
        {`Estás en ${DEMO_TABS[active]}. Toca otro destino para cambiar.`}
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
            <Icon name={TAB_ICON_MAP[label] || DEMO_ICONS[index]} size={unit(11)} color={index === active ? colors.accent : colors.textMuted} />
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
            {recording ? 'Grabando… 0:03' : saved ? 'nota-de-voz-1.m4a' : 'Toca para grabar'}
          </Text>
          <Text style={typography.caption} numberOfLines={1}>
            {saved ? '4 KB · dentro de la app' : 'Se guarda en el dispositivo'}
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
  pointMark: { fontSize: 14, fontWeight: '800', marginTop: 1 },
  pointBody: { flex: 1, gap: spacing.xs },
  pointText: { ...typography.small, color: colors.text, lineHeight: 18 },
  pointTip: { ...typography.caption, color: colors.textSecondary, lineHeight: 17 },
  pointHint: { fontSize: 16, fontWeight: '800', lineHeight: 18 },

  // The pager grows, so the controls already sit at the bottom of the screen; the padding here is
  // the gutter the body deliberately does not carry.
  footer: { gap: spacing.md, paddingHorizontal: layout.gutter },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  dot: { width: 7, height: 7, borderRadius: radius.pill, backgroundColor: colors.surfacePlus },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  back: { flex: 0, paddingHorizontal: spacing.sm },
  backPlaceholder: { width: 56 },
  skip: { flex: 0, paddingHorizontal: spacing.sm },
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
  calendarDemoHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calendarDemoDays: { flexDirection: 'row', justifyContent: 'space-between' },
  calendarDemoDay: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  settingsDemoOption: { minWidth: 64, flexGrow: 1, alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs },
  settingsDemoSwatch: { width: 24, height: 24, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
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


