import { memo, useCallback, useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { themedStyles, colors, radius, spacing, typography } from '../theme/theme';
import { useAppData } from '../context/AppDataContext';
import { useFocusId } from '../hooks/useFocusId';
import {
  Card,
  Chip,
  ChipScroller,
  EmptyState,
  Notice,
  Pill,
  PrimaryButton,
  Screen,
  SectionTitle,
  Stat,
  TextButton,
} from '../components/ui/primitives';
import { TextField } from '../components/ui/inputs';
import { DateField } from '../components/ui/DateField';
import { ConfirmSheet, Sheet } from '../components/ui/Sheet';
import SwipeRow from '../components/ui/SwipeRow';
import { Switch } from '../components/ui/Switch';
import { authorizePrivateAction, describePrivacyFailure } from '../services/privacy';
import {
  PRIVATE_ACTIONS,
  canExposeInList,
  filterDiscoverableRecords,
  redactPrivateRecord,
} from '../services/privacyPolicy';
import { EXPENSE_CATEGORIES, categoryOf, formatMoney, parseAmount, sumAmounts } from '../utils/money';
import { relativeDayLabel, todayKey } from '../utils/dates';
import { plural } from '../utils/text';

const MAX_ROWS = 8;
const PRIVATE_EXPENSE_PLACEHOLDER = Object.freeze({
  note: 'Gasto privado',
  amount: null,
  category: null,
  dateKey: null,
});

export default function ExpensesScreen() {
  const { expenses, addExpense, updateExpense, removeExpense, settings } = useAppData();
  // The global lock can be turned off in Ajustes; secure by default.
  const privacyEnabled = settings?.privacyEnabled;
  // Highlighted by the global search for a few seconds.
  const focusId = useFocusId();

  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0].id);
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [unlockError, setUnlockError] = useState(null);

  const today = todayKey();
  const monthPrefix = today.slice(0, 7);

  const sorted = useMemo(
    () => {
      const publicRows = filterDiscoverableRecords(expenses)
        .slice()
        .sort((a, b) => String(b.dateKey || '').localeCompare(String(a.dateKey || '')) || (b.createdAt || 0) - (a.createdAt || 0));
      const privateRows = expenses
        .filter((expense) => !canExposeInList(expense))
        .slice()
        .sort((a, b) => String(a.id).localeCompare(String(b.id)));
      return [...publicRows, ...privateRows];
    },
    [expenses],
  );

  const publicExpenses = useMemo(() => filterDiscoverableRecords(expenses), [expenses]);
  const monthExpenses = useMemo(
    () => publicExpenses.filter((item) => String(item.dateKey || '').startsWith(monthPrefix)),
    [monthPrefix, publicExpenses],
  );

  const byCategory = useMemo(() => {
    const rows = EXPENSE_CATEGORIES.map((item) => ({
      ...item,
      total: sumAmounts(monthExpenses.filter((expense) => expense.category === item.id)),
    })).filter((row) => row.total > 0);
    return rows.sort((a, b) => b.total - a.total);
  }, [monthExpenses]);

  const topTotal = byCategory[0]?.total || 1;
  const visible = showAll ? sorted : sorted.slice(0, MAX_ROWS);

  const submit = async () => {
    const value = parseAmount(amount);
    if (value <= 0) {
      setError('Escribe un monto mayor a 0.');
      return;
    }
    const saved = await addExpense({ dateKey: today, amount: value, category, note: note.trim(), createdAt: Date.now() });
    if (!saved) { setError('No se pudo guardar el gasto.'); return; }
    setAmount('');
    setNote('');
    setError(null);
  };

  const openEdit = useCallback(
    (expense) =>
      setSheet({
        mode: 'edit',
        id: expense.id,
        original: expense,
        values: {
          amount: String(expense.amount ?? ''),
          category: expense.category || EXPENSE_CATEGORIES[0].id,
          note: expense.note || '',
          dateKey: expense.dateKey || today,
          private: Boolean(expense.private),
        },
      }),
    [today],
  );

  const runExpenseAction = useCallback(async (expense, action, promptMessage, onAuthorized) => {
    const result = await authorizePrivateAction({
      record: expense,
      action,
      privacyEnabled,
      promptMessage,
      onAuthorized,
    });
    setUnlockError(result.ok ? null : describePrivacyFailure(result.reason));
    return result.ok;
  }, [privacyEnabled]);

  /** A private expense only opens after the phone authenticates the user. */
  const openExpense = useCallback(
    (expense) => runExpenseAction(
      expense,
      PRIVATE_ACTIONS.open,
      'Desbloquea el gasto privado',
      () => openEdit(expense),
    ),
    [openEdit, runExpenseAction],
  );

  const togglePrivate = useCallback(
    (expense) => runExpenseAction(
      expense,
      expense.private ? PRIVATE_ACTIONS.removePrivacy : PRIVATE_ACTIONS.mutate,
      'Autoriza quitar la privacidad del gasto',
      () => updateExpense(expense.id, { private: !expense.private }),
    ),
    [runExpenseAction, updateExpense],
  );

  const requestDelete = useCallback(
    (expense) => runExpenseAction(
      expense,
      PRIVATE_ACTIONS.delete,
      'Autoriza eliminar el gasto privado',
      () => {
        setConfirmId(expense.id);
        setSheet(null);
      },
    ),
    [runExpenseAction],
  );

  const setValue = (patch) => setSheet((prev) => ({ ...prev, values: { ...prev.values, ...patch } }));

  const changeSheetPrivacy = (value) => {
    if (!sheet || value === Boolean(sheet.values.private)) return;
    const original = sheet.original;
    if (!original?.private || value !== false) {
      setValue({ private: value });
      return;
    }
    void runExpenseAction(
      original,
      PRIVATE_ACTIONS.removePrivacy,
      'Autoriza quitar la privacidad del gasto',
      () => setValue({ private: false }),
    );
  };

  const saveEdit = async () => {
    if (!sheet) return;
    const value = parseAmount(sheet.values.amount);
    if (value <= 0) return;
    const saved = await updateExpense(sheet.id, {
      amount: value,
      category: sheet.values.category,
      note: sheet.values.note.trim(),
      dateKey: sheet.values.dateKey,
      private: Boolean(sheet.values.private),
    });
    if (!saved) { setError('No se pudo guardar el gasto.'); return; }
    setSheet(null);
  };

  return (
    <>
      <Screen
        title="Gastos"
        subtitle="Registra lo que gastas en dos toques."
        headerRight={<Pill label={plural(publicExpenses.length, 'movimiento')} />}
      >
        {unlockError ? <Notice text={unlockError} tone="danger" /> : null}

        <Card accent={colors.accent} style={styles.form}>
          <Text style={typography.overline}>Gasto rápido</Text>
          <View style={styles.amountRow}>
            <Text style={styles.currency}>$</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              style={styles.amountInput}
              selectionColor={colors.accent}
              returnKeyType="done"
              onSubmitEditing={submit}
            />
          </View>
          <ChipScroller>
            {EXPENSE_CATEGORIES.map((item) => (
              <Chip
                key={item.id}
                label={`${item.emoji} ${item.id}`}
                color={item.color}
                selected={category === item.id}
                onPress={() => setCategory(item.id)}
              />
            ))}
          </ChipScroller>
          <TextField
            label="Detalle (opcional)"
            value={note}
            onChangeText={setNote}
            placeholder="Ej. Almuerzo en la facu"
            maxLength={60}
          />
          {error ? <Notice text={error} tone="danger" /> : null}
          <PrimaryButton label="Agregar gasto" onPress={submit} />
        </Card>

        <View style={styles.statsRow}>
          <Stat value={formatMoney(sumAmounts(publicExpenses.filter((item) => item.dateKey === today)))} label="Hoy" accent={colors.accent} />
          <Stat value={formatMoney(sumAmounts(monthExpenses))} label="Este mes" />
          <Stat value={publicExpenses.length} label="En total" />
        </View>
        {byCategory.length ? (
          <>
            <SectionTitle title="Este mes por categoría" count={byCategory.length} />
            <Card style={styles.breakdown}>
              {byCategory.map((row) => (
                <View key={row.id} style={styles.breakRow}>
                  <Text style={styles.breakLabel} numberOfLines={1}>{`${row.emoji} ${row.id}`}</Text>
                  <View style={styles.track}>
                    <View
                      style={[
                        styles.fill,
                        { width: `${Math.max(4, (row.total / topTotal) * 100)}%`, backgroundColor: row.color },
                      ]}
                    />
                  </View>
                  <Text style={[styles.breakValue, typography.tabular]}>{formatMoney(row.total)}</Text>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        <SectionTitle
          title="Movimientos"
          count={sorted.length}
          right={
            sorted.length > MAX_ROWS ? (
              <TextButton label={showAll ? 'Ver menos' : 'Ver todos'} onPress={() => setShowAll((prev) => !prev)} />
            ) : null
          }
        />

        {sorted.length === 0 ? (
          <EmptyState
            emoji="💸"
            title="Sin gastos cargados"
            hint="Anota el primero arriba y vas a ver los totales del día y del mes."
          />
        ) : (
          visible.map((expense) => (
            <ExpenseRow
              key={expense.id}
              expense={expense}
              focused={canExposeInList(expense) && focusId === expense.id}
              onOpen={openExpense}
              onTogglePrivate={togglePrivate}
              onDelete={requestDelete}
            />
          ))
        )}
      </Screen>

      <Sheet
        visible={Boolean(sheet)}
        onClose={() => setSheet(null)}
        title="Editar gasto"
        subtitle="Corregí el monto, la categoría o el día."
        footer={
          <>
            <TextButton
              label="Eliminar"
              tone="danger"
              onPress={() => sheet?.original && requestDelete(sheet.original)}
            />
            <PrimaryButton label="Guardar" onPress={saveEdit} />
          </>
        }
      >
        {sheet ? (
          <>
            <TextField
              label="Monto"
              value={sheet.values.amount}
              onChangeText={(value) => setValue({ amount: value })}
              keyboardType="decimal-pad"
              placeholder="0"
            />
            <ChipScroller>
              {EXPENSE_CATEGORIES.map((item) => (
                <Chip
                  key={item.id}
                  label={`${item.emoji} ${item.id}`}
                  color={item.color}
                  selected={sheet.values.category === item.id}
                  onPress={() => setValue({ category: item.id })}
                />
              ))}
            </ChipScroller>
            <TextField
              label="Detalle"
              value={sheet.values.note}
              onChangeText={(value) => setValue({ note: value })}
              placeholder="Ej. Supermercado"
              maxLength={60}
            />
            <DateField label="Día" value={sheet.values.dateKey} onChange={(dateKey) => setValue({ dateKey })} />
            <View style={styles.privateRow}>
              <View style={styles.privateBody}>
                <Text style={typography.bodyStrong}>Gasto privado</Text>
                <Text style={typography.caption}>Pide huella, rostro o PIN al abrirlo.</Text>
              </View>
              <Switch
                value={Boolean(sheet.values.private)}
                onValueChange={changeSheetPrivacy}
                label="Gasto privado"
              />
            </View>
          </>
        ) : null}
      </Sheet>

      <ConfirmSheet
        visible={Boolean(confirmId)}
        onClose={() => setConfirmId(null)}
        onConfirm={() => confirmId && removeExpense(confirmId)}
        title="¿Borrar movimiento?"
        message="Se elimina del registro de gastos."
      />

    </>
  );
}

/**
 * One expense row.
 *
 * Memoized for the same reason as the note and habit rows: adding a single expense rewrites
 * the `expenses` array, and the swipe actions are `useMemo`d so `SwipeRow` keeps a stable
 * pan responder instead of rebuilding it on every render.
 */
const ExpenseRow = memo(function ExpenseRow({ expense, focused, onOpen, onTogglePrivate, onDelete }) {
  const exposed = canExposeInList(expense);
  const displayExpense = redactPrivateRecord(expense, PRIVATE_EXPENSE_PLACEHOLDER);
  const item = categoryOf(displayExpense.category || EXPENSE_CATEGORIES[0].id);
  const open = useCallback(() => onOpen(expense), [expense, onOpen]);
  const askDelete = useCallback(() => onDelete(expense), [expense, onDelete]);

  const leftAction = {
    label: exposed ? '🔒 Privado' : '🔓 Abrir',
    color: exposed ? item.color : colors.accent,
    onPress: exposed ? () => onTogglePrivate(expense) : open,
  };

  const rightAction = { label: '🗑 Borrar', color: colors.danger, onPress: askDelete };

  return (
    <SwipeRow style={styles.swipeRow} leftAction={leftAction} rightAction={rightAction}>
      <Card
        accent={exposed ? item.color : colors.accent}
        onPress={open}
        accessibilityLabel={exposed ? undefined : 'Gasto privado. Desbloquea para ver el contenido'}
        style={[styles.row, focused && exposed ? styles.focused : null]}
      >
        <View style={styles.rowInner}>
          <View
            style={[
              styles.rowIcon,
              {
                backgroundColor: `${exposed ? item.color : colors.accent}22`,
                borderColor: exposed ? item.color : colors.accent,
              },
            ]}
          >
            <Text style={styles.rowEmoji}>{exposed ? item.emoji : '🔒'}</Text>
          </View>
          <View style={styles.rowBody}>
            <Text style={typography.bodyStrong} numberOfLines={1}>
              {exposed ? displayExpense.note || item.id : displayExpense.note}
            </Text>
            <Text style={typography.caption} numberOfLines={1}>
              {exposed ? `${relativeDayLabel(displayExpense.dateKey)} · ${item.id}` : 'Desbloquea para ver el contenido'}
            </Text>
          </View>
          <Text style={[styles.rowAmount, typography.tabular]}>
            {exposed ? formatMoney(displayExpense.amount) : '•••'}
          </Text>
        </View>
      </Card>
    </SwipeRow>
  );
});

const styles = themedStyles({
  form: { gap: spacing.md },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  currency: { fontSize: 26, fontWeight: '800', color: colors.textSecondary },
  amountInput: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  swipeRow: { marginBottom: spacing.sm },
  privateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  privateBody: { flex: 1, gap: 2 },

  breakdown: { gap: spacing.md },
  breakRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  breakLabel: { width: 96, fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  track: { flex: 1, height: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  fill: { height: 8, borderRadius: radius.pill },
  breakValue: { fontSize: 12.5, fontWeight: '700', color: colors.text },

  row: { paddingVertical: spacing.md },
  rowInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowEmoji: { fontSize: 18 },
  rowBody: { flex: 1, gap: 2 },
  rowAmount: { fontSize: 15, fontWeight: '700', color: colors.text },
  // Used by the global search to point at the matched item.
  focused: { borderColor: colors.accent, borderWidth: 1.5 },
});
