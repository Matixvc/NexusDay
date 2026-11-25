import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Icon } from '../Icon';
import { getTutorialAgenda, TUTORIAL_CALENDAR_DAYS, TUTORIAL_HELP_ITEMS, TUTORIAL_NOTE_ITEMS, TUTORIAL_THEME_PREVIEWS, toggleTutorialChecklistItem } from '../../services/tutorialGuide';
import { themedStyles, colors, radius, spacing, typography } from '../../theme/theme';

const SAFE_LABEL = 'Prueba local · datos ficticios, no se guarda';

export function TutorialDemos({ demoId }) {
  switch (demoId) {
    case 'welcome': return <WelcomeDemo />;
    case 'routine': return <RoutineDemo />;
    case 'notes': return <NotesDemo />;
    case 'calendar': return <CalendarDemo />;
    case 'themes': return <ThemeDemo />;
    case 'first-steps': return <FirstStepsGuide />;
    default: return null;
  }
}

function DemoPanel({ title, children }) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeading}>
        <Text style={[typography.overline, styles.demoLabel]}>{SAFE_LABEL}</Text>
        <Icon name="info" size={16} color={colors.accent} />
      </View>
      <Text style={typography.bodyStrong}>{title}</Text>
      {children}
    </View>
  );
}

function WelcomeDemo() {
  const [expanded, setExpanded] = useState(false);
  return (
    <DemoPanel title="Día a Día reúne lo que viene">
      <View style={styles.previewRow}>
        <View style={styles.previewMark}><Icon name="clock" size={17} color={colors.accent} /></View>
        <View style={styles.flexCopy}>
          <Text style={typography.label}>Próxima clase</Text>
          <Text style={typography.caption}>09:30 · Clase de ejemplo</Text>
        </View>
        <Text style={styles.previewTag}>HOY</Text>
      </View>
      <Pressable
        onPress={() => setExpanded((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={expanded ? 'Ocultar qué incluye Día a Día' : 'Ver qué incluye Día a Día'}
        style={({ pressed }) => [styles.inlineAction, pressed ? styles.pressed : null]}
      >
        <Text style={typography.label}>{expanded ? 'Ocultar resumen' : 'Ver qué incluye'}</Text>
        <Icon name={expanded ? 'chevronUp' : 'chevronDown'} size={17} color={colors.accent} />
      </Pressable>
      {expanded ? <Text style={typography.small}>Clases · rutinas personales · eventos próximos</Text> : null}
    </DemoPanel>
  );
}

function RoutineDemo() {
  const [done, setDone] = useState(false);
  return (
    <DemoPanel title="Una rutina semanal, un toque para marcarla">
      <View style={styles.previewRow}>
        <View style={[styles.previewMark, done ? styles.completeMark : null]}>
          <Icon name={done ? 'check' : 'calendar'} size={17} color={colors.accent} />
        </View>
        <View style={styles.flexCopy}>
          <Text style={typography.label}>Repasar apuntes</Text>
          <Text style={typography.caption}>Lunes · 18:00 · ejemplo</Text>
        </View>
        <Pressable
          onPress={() => setDone((value) => !value)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done }}
          accessibilityLabel={done ? 'Desmarcar rutina de ejemplo' : 'Marcar rutina de ejemplo como hecha'}
          style={({ pressed }) => [styles.checkButton, pressed ? styles.pressed : null]}
        >
          <Icon name={done ? 'check' : 'plus'} size={18} color={done ? colors.accentInk : colors.accent} />
        </Pressable>
      </View>
      <Text style={typography.caption}>{done ? 'Hecha en esta demostración.' : 'Toca el control para probar la acción.'}</Text>
    </DemoPanel>
  );
}

function NotesDemo() {
  const [items, setItems] = useState(TUTORIAL_NOTE_ITEMS);
  const [privateNote, setPrivateNote] = useState(false);
  return (
    <DemoPanel title="Prueba una checklist y la vista privada">
      <View style={styles.demoList}>
        {items.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => setItems((current) => toggleTutorialChecklistItem(current, item.id))}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: item.done }}
            accessibilityLabel={`${item.text}, ${item.done ? 'completada' : 'pendiente'}`}
            style={({ pressed }) => [styles.checkRow, pressed ? styles.pressed : null]}
          >
            <View style={[styles.checkbox, item.done ? styles.checkboxDone : null]}>
              {item.done ? <Icon name="check" size={14} color={colors.accentInk} /> : null}
            </View>
            <Text style={[typography.small, item.done ? styles.completedText : null]}>{item.text}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable
        onPress={() => setPrivateNote((value) => !value)}
        accessibilityRole="switch"
        accessibilityState={{ checked: privateNote }}
        accessibilityLabel="Activar vista privada de ejemplo"
        style={({ pressed }) => [styles.privacyRow, pressed ? styles.pressed : null]}
      >
        <Icon name={privateNote ? 'lock' : 'unlock'} size={17} color={colors.accent} />
        <View style={styles.flexCopy}>
          <Text style={typography.label}>Vista privada</Text>
          <Text style={typography.caption}>{privateNote ? 'Contenido oculto en la lista' : 'Vista de muestra sin protección'}</Text>
        </View>
        <View style={[styles.switchTrack, privateNote ? styles.switchTrackActive : null]}>
          <View style={[styles.switchThumb, privateNote ? styles.switchThumbActive : null]} />
        </View>
      </Pressable>
      <Text style={typography.caption}>No se crea una nota ni se solicita autenticación.</Text>
    </DemoPanel>
  );
}

function CalendarDemo() {
  const [selected, setSelected] = useState('tuesday');
  const agenda = getTutorialAgenda(selected);
  return (
    <DemoPanel title="Elige un día para ver su agenda">
      <View style={styles.dayChoices}>
        {TUTORIAL_CALENDAR_DAYS.map((day) => (
          <Pressable
            key={day.id}
            onPress={() => setSelected(day.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: selected === day.id }}
            accessibilityLabel={`${day.label} ${day.number}${day.agenda.length ? ', con actividad' : ', sin actividad de muestra'}`}
            style={({ pressed }) => [styles.dayChoice, selected === day.id ? styles.dayChoiceSelected : null, pressed ? styles.pressed : null]}
          >
            <Text style={[typography.caption, selected === day.id ? styles.dayTextSelected : null]}>{day.label}</Text>
            <Text style={[typography.bodyStrong, selected === day.id ? styles.dayTextSelected : null]}>{day.number}</Text>
            <View style={[styles.dayDot, day.agenda.length ? styles.dayDotActive : null]} />
          </Pressable>
        ))}
      </View>
      {agenda.length ? (
        <View style={styles.demoList}>
          {agenda.map((item) => (
            <View key={item.id} style={styles.agendaRow}>
          <Icon name={item.kind === 'birthday' ? 'birthdays' : 'calendar'} size={16} color={colors.accent} />
              <Text style={[typography.small, styles.flexCopy]}>{item.title}</Text>
              <Text style={typography.caption}>{item.time}</Text>
            </View>
          ))}
        </View>
      ) : <Text style={typography.caption}>Sin eventos de muestra en este día.</Text>}
    </DemoPanel>
  );
}

function ThemeDemo() {
  const [selected, setSelected] = useState('nex');
  const theme = TUTORIAL_THEME_PREVIEWS.find((item) => item.id === selected) || TUTORIAL_THEME_PREVIEWS[0];
  return (
    <DemoPanel title="Compara los tres temas">
      <View style={styles.themeChoices}>
        {TUTORIAL_THEME_PREVIEWS.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => setSelected(item.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: selected === item.id }}
            accessibilityLabel={`Vista previa ${item.label}`}
            style={({ pressed }) => [styles.themeChoice, selected === item.id ? styles.themeChoiceSelected : null, pressed ? styles.pressed : null]}
          >
            <View style={[styles.themeSwatch, { backgroundColor: item.colors.background, borderColor: item.colors.border }]}>
              <View style={[styles.themeSwatchCard, { backgroundColor: item.colors.surface }]}>
                <View style={[styles.themeSwatchLine, { backgroundColor: item.colors.text }]} />
                <View style={[styles.themeSwatchAccent, { backgroundColor: item.colors.accent }]} />
              </View>
            </View>
            <Text style={typography.caption}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={[styles.themePreview, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
        <Text style={[typography.label, { color: theme.colors.text }]}>{theme.label} · vista local</Text>
        <Text style={[typography.caption, { color: theme.colors.muted }]}>La preferencia real no cambia.</Text>
        <View style={[styles.themeAction, { backgroundColor: theme.colors.accent }]}>
          <Text style={[typography.caption, { color: theme.colors.accentInk }]}>Ejemplo</Text>
        </View>
      </View>
    </DemoPanel>
  );
}

function FirstStepsGuide() {
  const [openIndex, setOpenIndex] = useState(null);
  return (
    <DemoPanel title="Tus primeros pasos, cuando quieras">
      <View style={styles.helpList}>
        {TUTORIAL_HELP_ITEMS.map((item, index) => {
          const expanded = openIndex === index;
          return (
            <Pressable
              key={item.title}
              onPress={() => setOpenIndex((current) => current === index ? null : index)}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              accessibilityLabel={item.title}
              style={({ pressed }) => [styles.helpItem, pressed ? styles.pressed : null]}
            >
              <View style={styles.helpHeading}>
                <Text style={[typography.label, styles.flexCopy]}>{item.title}</Text>
                <Icon name={expanded ? 'minus' : 'plus'} size={17} color={colors.accent} />
              </View>
              {expanded ? <Text style={typography.caption}>{item.detail}</Text> : null}
            </Pressable>
          );
        })}
      </View>
      <Text style={typography.caption}>Estos consejos solo abren información. No exportan ni modifican nada.</Text>
    </DemoPanel>
  );
}

const styles = themedStyles({
  panel: { padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg },
  panelHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  demoLabel: { color: colors.accent, flexShrink: 1 },
  previewRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  previewMark: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.accentSoft },
  completeMark: { backgroundColor: colors.accentSoft },
  flexCopy: { flex: 1, minWidth: 0 },
  previewTag: { color: colors.accent, fontFamily: typography.overline.fontFamily, fontSize: 10, fontWeight: '800' },
  inlineAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.sm },
  checkButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.accentSoft },
  demoList: { gap: spacing.xs },
  checkRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm },
  checkbox: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.borderStrong, borderRadius: 7 },
  checkboxDone: { borderColor: colors.accent, backgroundColor: colors.accent },
  completedText: { textDecorationLine: 'line-through', color: colors.textMuted },
  privacyRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  switchTrack: { width: 42, height: 24, justifyContent: 'center', padding: 3, borderRadius: radius.pill, backgroundColor: colors.surfacePlus },
  switchTrackActive: { backgroundColor: colors.accent },
  switchThumb: { width: 18, height: 18, borderRadius: radius.pill, backgroundColor: colors.textSecondary },
  switchThumbActive: { alignSelf: 'flex-end', backgroundColor: colors.accentInk },
  dayChoices: { flexDirection: 'row', gap: spacing.sm },
  dayChoice: { flex: 1, minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  dayChoiceSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  dayTextSelected: { color: colors.accent },
  dayDot: { width: 5, height: 5, borderRadius: radius.pill, backgroundColor: 'transparent' },
  dayDotActive: { backgroundColor: colors.accent },
  agendaRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xs },
  themeChoices: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  themeChoice: { flex: 1, minHeight: 78, alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.xs },
  themeChoiceSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  themeSwatch: { width: '100%', maxWidth: 72, height: 34, padding: 4, borderWidth: 1, borderRadius: radius.sm },
  themeSwatchCard: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, borderRadius: 4 },
  themeSwatchLine: { width: 22, height: 4, borderRadius: 2 },
  themeSwatchAccent: { width: 10, height: 10, borderRadius: radius.pill },
  themePreview: { minHeight: 60, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.md, padding: spacing.sm },
  themeAction: { minHeight: 28, justifyContent: 'center', borderRadius: radius.sm, paddingHorizontal: spacing.sm },
  helpList: { gap: spacing.xs },
  helpItem: { minHeight: 44, justifyContent: 'center', gap: spacing.xs, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  helpHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pressed: { opacity: 0.75 },
});
