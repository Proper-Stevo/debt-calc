import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useTheme, Theme } from '@/lib/theme';
import { getCards } from '@/lib/storage';
import {
  MonthRecord,
  LineItem,
  PayFrequency,
  FREQUENCY_LABELS,
  monthKey,
  shiftMonth,
  monthLabel,
  monthlyIncome,
  sumItems,
  leftoverFor,
  emptyRecord,
  totalMinimums,
  getFinanceMonths,
  saveMonth,
  hasSeenFinanceIntro,
  markFinanceIntroSeen,
} from '@/lib/finance';

// While typing, amounts are kept as text so "4." or "" doesn't fight the user.
type Draft = { id: string; name: string; amount: string };

const FREQUENCIES: PayFrequency[] = ['weekly', 'biweekly', 'monthly'];

function parseNum(text: string): number {
  const n = parseFloat(text.replace(/[^0-9.]/g, ''));
  return isNaN(n) ? 0 : n;
}

function money(n: number): string {
  const rounded = Math.round(Math.abs(n));
  return `${n < 0 ? '-' : ''}$${rounded.toLocaleString()}`;
}

function newId(): string {
  return Date.now().toString() + Math.random().toString(36).slice(2, 7);
}

function toDrafts(items: LineItem[]): Draft[] {
  return items.map((i) => ({ id: i.id, name: i.name, amount: i.amount ? i.amount.toString() : '' }));
}

// Drop rows the user left completely blank; keep anything with a name or amount.
function toItems(drafts: Draft[]): LineItem[] {
  return drafts
    .filter((d) => d.name.trim() || parseNum(d.amount) > 0)
    .map((d) => ({ id: d.id, name: d.name.trim(), amount: parseNum(d.amount) }));
}

type SectionProps = {
  title: string;
  hint: string;
  namePlaceholder: string;
  items: Draft[];
  setItems: (next: Draft[]) => void;
  theme: Theme;
};

function ItemSection({ title, hint, namePlaceholder, items, setItems, theme }: SectionProps) {
  const total = sumItems(toItems(items));

  function update(id: string, patch: Partial<Draft>) {
    setItems(items.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  return (
    <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{title}</Text>
        <Text style={[styles.sectionTotal, { color: theme.textSecondary }]}>{money(total)}</Text>
      </View>
      <Text style={[styles.hint, { color: theme.textMuted }]}>{hint}</Text>

      {items.map((d) => (
        <View key={d.id} style={styles.itemRow}>
          <TextInput
            style={[
              styles.input,
              styles.nameInput,
              { backgroundColor: theme.cardInnerBackground, borderColor: theme.border, color: theme.textPrimary },
            ]}
            value={d.name}
            onChangeText={(t) => update(d.id, { name: t })}
            placeholder={namePlaceholder}
            placeholderTextColor={theme.textFaint}
          />
          <TextInput
            style={[
              styles.input,
              styles.amountInput,
              { backgroundColor: theme.cardInnerBackground, borderColor: theme.border, color: theme.textPrimary },
            ]}
            value={d.amount}
            onChangeText={(t) => update(d.id, { amount: t })}
            placeholder="$0"
            placeholderTextColor={theme.textFaint}
            keyboardType="decimal-pad"
          />
          <Pressable
            style={styles.removeButton}
            onPress={() => setItems(items.filter((x) => x.id !== d.id))}
            hitSlop={8}
          >
            <Text style={[styles.removeText, { color: theme.textFaint }]}>{'✕'}</Text>
          </Pressable>
        </View>
      ))}

      <Pressable onPress={() => setItems([...items, { id: newId(), name: '', amount: '' }])}>
        <Text style={[styles.addText, { color: theme.accent }]}>+ Add a line</Text>
      </Pressable>
    </View>
  );
}

export default function FinanceScreen() {
  const theme = useTheme();
  const thisMonth = monthKey(new Date());

  const [month, setMonth] = useState(thisMonth);
  const [loaded, setLoaded] = useState(false);
  const [paycheck, setPaycheck] = useState('');
  const [frequency, setFrequency] = useState<PayFrequency>('biweekly');
  const [fixed, setFixed] = useState<Draft[]>([]);
  const [flexible, setFlexible] = useState<Draft[]>([]);
  const [saved, setSaved] = useState<Record<string, MonthRecord>>({});
  const [showIntro, setShowIntro] = useState(false);
  // Card minimums pulled from the Cards tab. Current month = always live;
  // a past month keeps whatever was saved with it.
  const [minimums, setMinimums] = useState(0);

  useEffect(() => {
    hasSeenFinanceIntro().then((seen) => setShowIntro(!seen));
  }, []);

  function applyRecord(rec: MonthRecord) {
    setPaycheck(rec.paycheck ? rec.paycheck.toString() : '');
    setFrequency(rec.frequency);
    setFixed(toDrafts(rec.fixed));
    setFlexible(toDrafts(rec.flexible));
  }

  // Load whenever the tab is focused or the month changes.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([getFinanceMonths(), getCards()]).then(([all, cards]) => {
        if (cancelled) return;
        const live = totalMinimums(cards);
        const rec = all[month];
        setSaved(all);
        applyRecord(rec ?? emptyRecord(month));
        setMinimums(month === thisMonth ? live : rec?.minimums ?? live);
        setLoaded(true);
      });
      return () => {
        cancelled = true;
      };
    }, [month])
  );

  // Switching months pauses saving until the new month has loaded, so one
  // month's numbers can never be written into another month.
  function changeMonth(next: string) {
    setLoaded(false);
    setMonth(next);
  }

  // The record as it currently looks on screen.
  const record = useMemo<MonthRecord>(
    () => ({
      month,
      paycheck: parseNum(paycheck),
      frequency,
      fixed: toItems(fixed),
      flexible: toItems(flexible),
      minimums,
    }),
    [month, paycheck, frequency, fixed, flexible, minimums]
  );
  // (minimums is part of the record so past months keep their own number)

  // Auto-save on every change.
  useEffect(() => {
    if (!loaded) return;
    saveMonth(record);
  }, [record, loaded]);

  const income = monthlyIncome(record);
  const fixedTotal = sumItems(record.fixed);
  const flexibleTotal = sumItems(record.flexible);
  const leftover = leftoverFor(record);
  const hasPaycheck = record.paycheck > 0;

  // Earlier months for the history list, with this month's live numbers merged in.
  const history = useMemo(() => {
    const merged = { ...saved, [month]: record };
    return Object.values(merged)
      .filter((r) => r.paycheck > 0)
      .sort((a, b) => (a.month < b.month ? 1 : -1));
  }, [saved, month, record]);

  // Offer to start from last month's lines when this month is still blank.
  const previous = saved[shiftMonth(month, -1)];
  const canCopyPrevious =
    !!previous && fixed.length === 0 && flexible.length === 0 && (previous.fixed.length > 0 || previous.flexible.length > 0);

  function copyFromPrevious() {
    if (!previous) return;
    setFixed(toDrafts(previous.fixed).map((d) => ({ ...d, id: newId() })));
    setFlexible(toDrafts(previous.flexible).map((d) => ({ ...d, id: newId() })));
    if (!paycheck) {
      setPaycheck(previous.paycheck ? previous.paycheck.toString() : '');
      setFrequency(previous.frequency);
    }
  }

  function dismissIntro() {
    setShowIntro(false);
    markFinanceIntroSeen();
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: theme.textPrimary }]}>Paycheck</Text>

        <View style={styles.monthRow}>
          <Pressable onPress={() => changeMonth(shiftMonth(month, -1))} hitSlop={10} style={styles.monthArrow}>
            <Text style={[styles.monthArrowText, { color: theme.accent }]}>{'‹'}</Text>
          </Pressable>
          <Text style={[styles.monthLabel, { color: theme.textPrimary }]}>{monthLabel(month)}</Text>
          <Pressable
            onPress={() => changeMonth(shiftMonth(month, 1))}
            hitSlop={10}
            style={styles.monthArrow}
            disabled={month >= thisMonth}
          >
            <Text
              style={[
                styles.monthArrowText,
                { color: month >= thisMonth ? theme.border : theme.accent },
              ]}
            >
              {'›'}
            </Text>
          </Pressable>
        </View>

        {showIntro && (
          <View style={[styles.tipCard, { backgroundColor: theme.tipBackground, borderColor: theme.tipBorder }]}>
            <Text style={[styles.tipTitle, { color: theme.tipTextStrong }]}>What is this tab?</Text>
            <Text style={[styles.tipBody, { color: theme.tipText }]}>
              Your take-home pay (what hits your bank account after taxes), minus your card minimums, minus
              the bills you have to pay, minus your everyday spending, equals your leftover. That leftover is
              the most you could put toward your cards on top of your minimums without squeezing your
              day-to-day life. It is optional and only an estimate, so change it any time.
            </Text>
            <Pressable style={[styles.tipButton, { backgroundColor: theme.tipTextStrong }]} onPress={dismissIntro}>
              <Text style={[styles.tipButtonText, { color: theme.background }]}>Got it</Text>
            </Pressable>
          </View>
        )}

        {/* Paycheck */}
        <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Your take-home pay</Text>
          <View
            style={[
              styles.takeHomeBox,
              { backgroundColor: theme.tipBackground, borderColor: theme.tipBorder },
            ]}
          >
            <Text style={[styles.takeHomeTitle, { color: theme.tipTextStrong }]}>TAKE-HOME PAY ONLY</Text>
            <Text style={[styles.takeHomeBody, { color: theme.tipText }]}>
              Enter what actually lands in your bank account after taxes and deductions. Not your salary,
              not your hourly rate times hours, and not the number before taxes. Check a recent pay stub
              or your bank deposit. Using a bigger number would make everything below look better than it is.
            </Text>
          </View>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: theme.cardInnerBackground, borderColor: theme.border, color: theme.textPrimary },
            ]}
            value={paycheck}
            onChangeText={setPaycheck}
            placeholder="Take-home per paycheck, e.g. 450"
            placeholderTextColor={theme.textFaint}
            keyboardType="decimal-pad"
          />
          <View style={styles.freqRow}>
            {FREQUENCIES.map((f) => (
              <Pressable
                key={f}
                style={[
                  styles.freqButton,
                  { backgroundColor: theme.cardInnerBackground },
                  frequency === f && { backgroundColor: theme.accent },
                ]}
                onPress={() => setFrequency(f)}
              >
                <Text
                  style={[
                    styles.freqText,
                    { color: theme.textSecondary },
                    frequency === f && styles.freqTextActive,
                  ]}
                >
                  {FREQUENCY_LABELS[f]}
                </Text>
              </Pressable>
            ))}
          </View>
          {hasPaycheck && frequency !== 'monthly' && (
            <Text style={[styles.hint, { color: theme.textMuted, marginTop: 10, marginBottom: 0 }]}>
              That works out to about {money(income)} a month on average.
            </Text>
          )}
        </View>

        {canCopyPrevious && (
          <Pressable
            style={[styles.copyButton, { borderColor: theme.border }]}
            onPress={copyFromPrevious}
          >
            <Text style={[styles.copyText, { color: theme.accent }]}>
              Start from {monthLabel(shiftMonth(month, -1))}'s lines
            </Text>
          </Pressable>
        )}

        {/* Card minimums: automatic, read-only */}
        <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Card minimum payments</Text>
            <Text style={[styles.sectionTotal, { color: theme.textSecondary }]}>{money(minimums)}</Text>
          </View>
          <Text style={[styles.hint, { color: theme.textMuted, marginBottom: 0 }]}>
            Added up automatically from your Cards tab, so you don't need to list them below. These come
            out first every month.
          </Text>
        </View>

        <ItemSection
          title="Already spoken for"
          hint="Other money that's going out no matter what: phone bill, subscriptions, car payment, insurance, rent. Don't add your credit card minimums here."
          namePlaceholder="e.g. Phone bill"
          items={fixed}
          setItems={setFixed}
          theme={theme}
        />

        <ItemSection
          title="Day-to-day spending"
          hint="Money you spend as you go: food, gas, going out, shopping. A rough guess is fine."
          namePlaceholder="e.g. Food and going out"
          items={flexible}
          setItems={setFlexible}
          theme={theme}
        />

        {/* Leftover */}
        <View
          style={[
            styles.leftoverCard,
            { backgroundColor: theme.accentBackground, borderColor: theme.accentBorder },
          ]}
        >
          <Text style={[styles.leftoverLabel, { color: theme.accent }]}>LEFTOVER THIS MONTH</Text>
          {!hasPaycheck ? (
            <Text style={[styles.leftoverNote, { color: theme.textSecondary }]}>
              Add your paycheck above to see how much you have left each month.
            </Text>
          ) : (
            <>
              <Text
                style={[
                  styles.leftoverValue,
                  { color: leftover < 0 ? '#c93030' : theme.textPrimary },
                ]}
              >
                {money(leftover)}
              </Text>
              <Text style={[styles.leftoverMath, { color: theme.textSecondary }]}>
                {money(income)} in {'−'} {money(minimums)} card minimums {'−'} {money(fixedTotal)} spoken for {'−'} {money(flexibleTotal)} day-to-day
              </Text>
              <Text style={[styles.leftoverNote, { color: theme.textSecondary }]}>
                {leftover > 0
                  ? "This is roughly the most you could put toward your cards on top of your minimums this month. The Plan tab uses it as the limit for your extra payment, and suggests a bit less so you keep a cushion."
                  : leftover === 0
                  ? 'Everything you earn is going out this month, so there is nothing left over for extra card payments yet. You can still make your minimums.'
                  : "You're spending more than you bring in this month, so even your minimums are a stretch. Day-to-day spending is usually the easiest place to find room."}
              </Text>
            </>
          )}
        </View>

        {/* History */}
        {history.length > 0 && (
          <View style={styles.historyWrap}>
            <Text style={[styles.historyTitle, { color: theme.textMuted }]}>Your months</Text>
            {history.map((r) => {
              const left = leftoverFor(r);
              const selected = r.month === month;
              return (
                <Pressable
                  key={r.month}
                  style={[
                    styles.historyRow,
                    { borderBottomColor: theme.border },
                    selected && { backgroundColor: theme.cardBackground },
                  ]}
                  onPress={() => changeMonth(r.month)}
                >
                  <Text style={[styles.historyMonth, { color: theme.textPrimary }]}>{monthLabel(r.month)}</Text>
                  <Text
                    style={[
                      styles.historyValue,
                      { color: left < 0 ? '#c93030' : theme.success },
                    ]}
                  >
                    {money(left)} left
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <Text style={[styles.disclaimer, { color: theme.disclaimerText }]}>
          These are estimates based on what you enter, not financial advice.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 140 },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 12 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  monthArrow: { paddingHorizontal: 12 },
  monthArrowText: { fontSize: 30, lineHeight: 32 },
  monthLabel: { fontSize: 17, fontWeight: '600' },
  tipCard: { borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1 },
  tipTitle: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  tipBody: { fontSize: 13, lineHeight: 18, marginBottom: 10 },
  tipButton: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  tipButtonText: { fontSize: 12, fontWeight: '600' },
  section: { borderRadius: 14, padding: 16, marginBottom: 16 },
  takeHomeBox: { borderRadius: 10, padding: 12, borderWidth: 1, marginTop: 8, marginBottom: 12 },
  takeHomeTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 },
  takeHomeBody: { fontSize: 12, lineHeight: 17 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  sectionTotal: { fontSize: 15, fontWeight: '500' },
  hint: { fontSize: 12, lineHeight: 17, marginTop: 4, marginBottom: 12 },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 16 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  nameInput: { flex: 1 },
  amountInput: { width: 90 },
  removeButton: { paddingHorizontal: 4 },
  removeText: { fontSize: 16 },
  addText: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  freqRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  freqButton: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  freqText: { fontSize: 13 },
  freqTextActive: { color: '#fff', fontWeight: '500' },
  copyButton: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  copyText: { fontSize: 14, fontWeight: '500' },
  leftoverCard: { borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1 },
  leftoverLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
  leftoverValue: { fontSize: 34, fontWeight: '700', marginBottom: 4 },
  leftoverMath: { fontSize: 12, marginBottom: 10 },
  leftoverNote: { fontSize: 13, lineHeight: 18 },
  historyWrap: { marginBottom: 16 },
  historyTitle: { fontSize: 13, marginBottom: 8 },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderRadius: 6,
  },
  historyMonth: { fontSize: 15, fontWeight: '500' },
  historyValue: { fontSize: 14, fontWeight: '500' },
  disclaimer: { fontSize: 11, textAlign: 'center', lineHeight: 15 },
});