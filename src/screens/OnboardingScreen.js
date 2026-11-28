import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, FlatList, Image, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { themedStyles, colors, layout, radius, spacing, typography } from '../theme/theme';
import { PrimaryButton, TextButton } from '../components/ui/primitives';
import { TutorialDemos } from '../components/onboarding/TutorialDemos';
import { useAppData } from '../context/AppDataContext';
import { TUTORIAL_STEPS, tutorialStepIndex } from '../services/tutorialGuide';

const APP_NAME = Constants.expoConfig?.name || 'NexusDay';
const TUTORIAL_ART = {
  welcome: require('../../assets/nex/u11/ai/nex-orb-curious.jpg'),
  day: require('../../assets/nex/u11/tutorial/tutorial-day.jpg'),
  notes: require('../../assets/nex/u11/tutorial/tutorial-notes.jpg'),
  calendar: require('../../assets/nex/u11/tutorial/tutorial-calendar.jpg'),
  themes: require('../../assets/nex/u11/tutorial/tutorial-themes.jpg'),
};
const SLIDES = TUTORIAL_STEPS.map((step) => ({ ...step, image: TUTORIAL_ART[step.imageKey] }));

/** Five local-only visual lessons. Demos own ephemeral state and never touch AppData. */
export default function OnboardingScreen({ firstRun = true, onFinish }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { settings } = useAppData();
  const reduceMotion = settings?.reduceMotion === true;
  const [index, setIndex] = useState(0);
  const pagerRef = useRef(null);
  const lastOffset = useRef(0);
  const last = index === SLIDES.length - 1;
  const compact = height < 700;

  const goTo = useCallback((next) => {
    setIndex(Math.min(Math.max(next, 0), SLIDES.length - 1));
  }, []);

  useEffect(() => {
    const target = index * width;
    if (Math.abs(target - lastOffset.current) < 2) return;
    lastOffset.current = target;
    pagerRef.current?.scrollToOffset({ offset: target, animated: !reduceMotion });
  }, [index, reduceMotion, width]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (index > 0) {
        goTo(tutorialStepIndex(index, -1));
        return true;
      }
      if (!firstRun) onFinish();
      return true;
    });
    return () => subscription.remove();
  }, [firstRun, goTo, index, onFinish]);

  const itemLayout = useCallback(
    (unusedData, itemIndex) => ({ length: width, offset: width * itemIndex, index: itemIndex }),
    [width],
  );
  const artHeight = useMemo(() => Math.max(150, Math.min(compact ? 190 : 245, width * 0.56)), [compact, width]);

  return (
    <View style={styles.root}>
      <View style={[styles.body, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.sm }]}>
        <View style={styles.topRow} accessibilityRole="header">
          <View style={styles.brand}>
            <View style={styles.brandMark}><Text style={styles.brandLetter}>{APP_NAME.slice(0, 1)}</Text></View>
            <Text style={styles.brandName}>{APP_NAME}</Text>
          </View>
          <Text style={styles.step}>{`${index + 1} / ${SLIDES.length}`}</Text>
        </View>

        <FlatList
          ref={pagerRef}
          style={styles.pager}
          data={SLIDES}
          keyExtractor={(item) => item.key}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          getItemLayout={itemLayout}
          initialNumToRender={SLIDES.length}
          windowSize={SLIDES.length}
          onMomentumScrollEnd={(event) => {
            const offset = event.nativeEvent.contentOffset.x;
            lastOffset.current = offset;
            goTo(Math.round(offset / width));
          }}
          renderItem={({ item }) => (
            <View style={[styles.slidePage, { width }]}>
              <ScrollView
                style={styles.slideScroll}
                contentContainerStyle={styles.slide}
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                <View style={[styles.artFrame, { height: artHeight }]}>
                  <Image
                    source={item.image}
                    style={styles.art}
                    resizeMode="cover"
                    accessible
                    accessibilityRole="image"
                    accessibilityLabel={item.imageAlt}
                  />
                  <View style={styles.artBadge}><Text style={styles.artBadgeText}>{item.eyebrow}</Text></View>
                </View>
                <View style={styles.copy}>
                  <Text style={styles.title} accessibilityRole="header">{item.title}</Text>
                  <Text style={styles.subtitle}>{item.body}</Text>
                </View>
                <TutorialDemos demoId={item.demoId} />
              </ScrollView>
            </View>
          )}
        />

        <View style={styles.footer}>
          <View
            style={styles.progress}
            accessibilityRole="progressbar"
            accessibilityLabel={`Paso ${index + 1} de ${SLIDES.length}`}
            accessibilityValue={{ min: 1, max: SLIDES.length, now: index + 1 }}
          >
            {SLIDES.map((slide, dotIndex) => (
              <Pressable
                key={slide.key}
                onPress={() => goTo(dotIndex)}
                accessibilityRole="button"
                accessibilityLabel={`Ir al paso ${dotIndex + 1}: ${slide.title}`}
                accessibilityState={{ selected: dotIndex === index }}
                style={styles.progressTarget}
              >
                <View style={[styles.progressBar, dotIndex === index ? styles.progressBarActive : null]} />
              </Pressable>
            ))}
          </View>
          <View style={styles.actions}>
            <TextButton
              label={index > 0 ? 'Atrás' : (firstRun ? 'Omitir' : 'Cerrar')}
              tone="ghost"
              onPress={() => (index > 0 ? goTo(tutorialStepIndex(index, -1)) : onFinish())}
              style={styles.secondaryAction}
            />
            {index > 0 ? (
              <TextButton label={firstRun ? 'Omitir' : 'Cerrar'} tone="ghost" onPress={onFinish} style={styles.skipAction} />
            ) : null}
            <PrimaryButton
              label={last ? (firstRun ? 'Comenzar' : 'Listo') : 'Continuar'}
              onPress={() => (last ? onFinish() : goTo(tutorialStepIndex(index, 1)))}
              style={styles.primaryAction}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = themedStyles({
  root: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1 },
  topRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingHorizontal: layout.gutter },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  brandMark: { width: 34, height: 34, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  brandLetter: { ...typography.title, color: colors.accentInk },
  brandName: { ...typography.bodyStrong, color: colors.text },
  step: { ...typography.overline, color: colors.textMuted },
  pager: { flex: 1 },
  slidePage: { flexGrow: 0, flexShrink: 0, height: '100%' },
  slideScroll: { flex: 1 },
  slide: { gap: spacing.md, paddingHorizontal: layout.gutter, paddingTop: spacing.sm, paddingBottom: spacing.lg },
  artFrame: { position: 'relative', overflow: 'hidden', borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.elevated },
  art: { width: '100%', height: '100%' },
  artBadge: { position: 'absolute', left: spacing.md, bottom: spacing.md, minHeight: 32, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: `${colors.background}e8`, borderWidth: 1, borderColor: colors.border },
  artBadgeText: { ...typography.overline, color: colors.accent },
  copy: { gap: spacing.xs },
  title: { ...typography.display, fontSize: 30, lineHeight: 36, color: colors.text },
  subtitle: { ...typography.subtitle, lineHeight: 21, color: colors.textSecondary },
  footer: { gap: spacing.sm, paddingHorizontal: layout.gutter },
  progress: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xs },
  progressTarget: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  progressBar: { width: 24, height: 5, borderRadius: radius.pill, backgroundColor: colors.surfacePlus },
  progressBarActive: { width: 38, backgroundColor: colors.accent },
  actions: { minHeight: 52, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  secondaryAction: { minHeight: 48, flex: 0, paddingHorizontal: spacing.sm },
  skipAction: { minHeight: 48, flex: 0, paddingHorizontal: spacing.xs },
  primaryAction: { minHeight: 48, flex: 1 },
});
