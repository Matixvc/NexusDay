import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { themedStyles, colors, layout, radius, spacing, typography } from '../theme/theme';
import { useAppData } from '../context/AppDataContext';
import { Card, Chip, ChipScroller, Pill, PrimaryButton, TextButton } from '../components/ui/primitives';
import { Glyph } from '../navigation/TabGlyphs';
import { ASSISTANT_SUGGESTIONS, answerQuestion } from '../services/assistant';
import { applyCommand, detectCommand } from '../services/assistantCommands';
import { shareAgendaICS } from '../services/agendaExport';
import { describeShareStatus } from '../services/files';

/**
 * Nexus AI — panel del asistente.
 *
 * Es un chat local: cada pregunta se resuelve con `answerQuestion`, que lee las
 * colecciones ya guardadas en el dispositivo. No hay red, ni API key, ni envío de
 * datos; el propio texto de la pantalla lo aclara. Además escribe: `applyCommand` ejecuta las órdenes. El alcance es la app —notas,
 * agenda, horario, hábitos, gastos— y una pregunta fuera de tema devuelve al usuario
 * a las funciones del dispositivo.
 */
export default function AssistantScreen({ navigation }) {
  const { events, activities, birthdays, notes, habits, expenses, addNote, addEvent, addExpense } = useAppData();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef(null);
  const [question, setQuestion] = useState('');
  const [log, setLog] = useState([]);

  /** El .ics lo abre el sistema: la respuesta del chat llega cuando el sheet se cierra. */
  const shareICS = async () => {
    const result = await shareAgendaICS(events, { name: 'nexusday-agenda.ics', dialogTitle: 'Compartir agenda' });
    const problem = describeShareStatus(result?.status);
    return problem
      ? { title: 'No se pudo compartir', body: `${problem} También puedes usar “Exportar .ics” en Horario.`, route: 'Horario', routeLabel: 'Abrir horario' }
      : { title: 'Agenda lista 📤', body: 'Te preparé el archivo .ics con tus eventos. Ábrelo donde quieras.', route: 'Horario', routeLabel: 'Abrir horario' };
  };

  /**
   * Una orden ("crea una nota de la reunión") se ejecuta sobre las colecciones; lo demás es
   * una pregunta y se responde leyendo los datos. Los dos terminan en la misma burbuja.
   */
  const ask = async (suggestion) => {
    const value = String(suggestion ?? question).trim();
    if (!value) return;
    const command = detectCommand(value);
    const answer = command
      ? await applyCommand(command, { addNote, addEvent, addExpense, shareICS })
      : answerQuestion(value, { events, activities, birthdays, notes, habits, expenses });
    if (!answer?.title) return;
    setLog((prev) => [...prev, { id: `a-${Date.now()}`, question: value, ...answer }].slice(-8));
    setQuestion('');
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };

  /** Wipes the conversation (and anything half-typed) from the header bin. */
  const clearHistory = () => {
    setLog([]);
    setQuestion('');
  };

  const canClear = log.length > 0;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerText}>
            <Text style={typography.display} numberOfLines={1}>
              Nexus AI
            </Text>
            <Text style={[typography.subtitle, styles.headerSubtitle]} numberOfLines={2}>
              Asistente local: contesta y anota con los datos de tu app, sin conexión ni cuentas.
            </Text>
          </View>
          <Pressable
            onPress={clearHistory}
            disabled={!canClear}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Borrar la conversación"
            accessibilityState={{ disabled: !canClear }}
            style={({ pressed }) => [
              styles.trash,
              !canClear ? styles.trashDisabled : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <Glyph name="trash" color={canClear ? colors.textSecondary : colors.textMuted} />
          </Pressable>
        </View>
        <Pill label="100% offline · solo tus datos" tone="accent" />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {log.length === 0 ? (
          <Card accent={colors.accent} style={styles.intro}>
            <Text style={typography.bodyStrong}>¿Qué quieres saber?</Text>
            <Text style={[typography.small, styles.introText]}>
              Puedo resumirte el día, decirte cuánto llevas gastado, qué hábitos te faltan o cuándo cumple años
              alguien.
            </Text>
          </Card>
        ) : null}

        {log.map((entry, index) => (
          <View key={`${entry.id}-${index}`} style={styles.turn}>
            <View style={styles.userBubble}>
              <Text style={[typography.small, styles.userText]}>{entry.question}</Text>
            </View>
            <Card accent={colors.accent} style={styles.answerCard}>
              <Text style={typography.bodyStrong}>{entry.title}</Text>
              <Text style={[typography.small, styles.answerBody]}>{entry.body}</Text>
              {entry.route ? (
                <TextButton
                  label={entry.routeLabel || `Abrir ${entry.route}`}
                  onPress={() => navigation.navigate(entry.route)}
                />
              ) : null}
            </Card>
          </View>
        ))}

        <Text style={styles.suggestionsTitle}>Prueba con</Text>
        <ChipScroller horizontal={false}>
          {ASSISTANT_SUGGESTIONS.map((suggestion) => (
            <Chip key={suggestion} label={suggestion} onPress={() => ask(suggestion)} />
          ))}
        </ChipScroller>
      </ScrollView>

      <View style={styles.composer}>
        <TextInput
          value={question}
          onChangeText={setQuestion}
          placeholder="Escribe tu pregunta…"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          onSubmitEditing={() => ask()}
          returnKeyType="send"
          selectionColor={colors.accent}
        />
        <PrimaryButton label="Enviar" onPress={() => ask()} disabled={!question.trim()} style={styles.send} />
      </View>
    </View>
  );
}

const styles = themedStyles({
  root: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: layout.gutter, paddingBottom: spacing.lg, gap: spacing.sm },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  headerText: { flex: 1, gap: spacing.sm },
  headerSubtitle: { marginBottom: spacing.xs },
  trash: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trashDisabled: { opacity: 0.45 },
  pressed: { opacity: 0.65 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: layout.gutter, paddingBottom: spacing.xxl, gap: spacing.md },
  intro: { gap: spacing.sm },
  introText: { lineHeight: 19 },
  turn: { gap: spacing.sm },
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '86%',
    backgroundColor: colors.surfacePlus,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  userText: { color: colors.text },
  answerCard: { gap: spacing.sm },
  answerBody: { lineHeight: 20 },
  suggestionsTitle: { ...typography.overline, marginTop: spacing.sm },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.elevated,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.text,
    minHeight: 46,
  },
  send: { flex: 0, paddingHorizontal: spacing.xl },
});
