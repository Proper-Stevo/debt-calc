import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Card } from '@/types/card';
import { getCards, hasSeenPlanIntro, markPlanIntroSeen } from '@/lib/storage';
import { calculatePayoff, pickTarget, Strategy } from '@/lib/payoff';
import { utilizationPercent, utilizationTier, amountToReachUtilization, daysUntil, nextOccurrenceLabel, UtilizationTier } from '@/lib/utilization';
import CircularDial from '@/components/circular-dial';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatPayoffDate(monthsFromNow: number): string {
  const today = new Date();
  const target = new Date(today.getFullYear(), today.getMonth() + monthsFromNow, 1);
  return `${MONTH_NAMES[target.getMonth()]} ${target.getFullYear()}`;
}

const TIER_COLORS: Record<UtilizationTier, string> = { excellent: '#1a7f37', good: '#946200', high: '#c93030', unknown: '#888' };
const TIER_LABELS: Record<UtilizationTier, string> = { excellent: 'Excellent', good: 'Good', high: 'High', unknown: 'Unknown' };

const STRATEGY_EXPLAINER: Record<Strategy, string> = {
  avalanche: 'Puts your extra payment toward whichever card has the highest interest rate first. Saves you the most money overall.',
  snowball: 'Puts your extra payment toward whichever card has the smallest balance first. Clears individual cards fastest, for quick wins.',
  creditBuilder: 'To grow your credit fastest: pay down your most-used card before it closes each month - not just by its due date.',
};

type UtilRow = {
  card: Card;
  percent: number | null;
  days: number | null;
  toGood: number | null;
  toExcellent: number | null;
};

export default function PlanScreen() {
  const [cards, setCards] = useState<Card[]>([]);
  const [strategy, setStrategy] = useState<Strategy>('avalanche');
  const [extraPayment, setExtraPayment] = useState(100);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [planExpanded, setPlanExpanded] = useState(true);
  const [manualTargetId, setManualTargetId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showPlanIntro, setShowPlanIntro] = useState(false);

  useEffect(() => {
    hasSeenPlanIntro().then((seen) => setShowPlanIntro(!seen));
  }, []);

  function dismissPlanIntro() {
    setShowPlanIntro(false);
    markPlanIntroSeen();
  }

  function selectStrategy(next: Strategy) {
    setStrategy(next);
    setManualTargetId(null);
    setPickerOpen(false);
  }

  useFocusEffect(
    useCallback(() => {
      getCards().then(setCards);
    }, [])
  );

  const result = useMemo(() => {
    if (cards.length === 0 || strategy === 'creditBuilder') return null;
    return calculatePayoff(cards, strategy, extraPayment, manualTargetId ?? undefined);
  }, [cards, strategy, extraPayment, manualTargetId]);

  // The card actually shown as "this month's" target - the manual override if
  // one was chosen, otherwise whatever the strategy would automatically pick.
  const displayTarget = useMemo(() => {
    if (cards.length === 0 || strategy === 'creditBuilder') return null;
    if (manualTargetId) {
      const found = cards.find((c) => c.id === manualTargetId);
      if (found) return found;
    }
    return pickTarget(cards, strategy);
  }, [cards, strategy, manualTargetId]);

  const mostDebtCard = useMemo(() => {
    if (cards.length === 0) return null;
    return cards.reduce((worst, c) => (c.balance > worst.balance ? c : worst), cards[0]);
  }, [cards]);

  const utilizationRows = useMemo<UtilRow[]>(() => {
    return cards
      .map((c) => ({
        card: c,
        percent: utilizationPercent(c),
        days: c.closingDate ? daysUntil(c.closingDate) : null,
        toGood: amountToReachUtilization(c, 30),
        toExcellent: amountToReachUtilization(c, 10),
      }))
      .sort((a, b) => {
        if (a.days === null) return 1;
        if (b.days === null) return -1;
        return a.days - b.days;
      });
  }, [cards]);

  const mostUrgent = manualTargetId
    ? utilizationRows.find((r) => r.card.id === manualTargetId) ?? utilizationRows[0]
    : utilizationRows[0];
  const laterRows = utilizationRows.filter((r) => r.card.id !== mostUrgent?.card.id);

  // Combined utilization across every card that has a credit limit set.
  // Cards without a limit are simply excluded from this total, since we
  // have no way to know their share of the picture.
  const overallUtilization = useMemo(() => {
    const withLimit = cards.filter((c) => c.creditLimit && c.creditLimit > 0);
    if (withLimit.length === 0) return null;
    const totalBalance = withLimit.reduce((sum, c) => sum + c.balance, 0);
    const totalLimit = withLimit.reduce((sum, c) => sum + (c.creditLimit ?? 0), 0);
    return totalLimit > 0 ? (totalBalance / totalLimit) * 100 : null;
  }, [cards]);

  // What your overall utilization would become if you made every suggested
  // "get under 30%" payment across all your cards. Real math based on your
  // actual balances - not a guess at what your score would do.
  const projectedUtilization = useMemo(() => {
    const withLimit = cards.filter((c) => c.creditLimit && c.creditLimit > 0);
    if (withLimit.length === 0) return null;
    const totalLimit = withLimit.reduce((sum, c) => sum + (c.creditLimit ?? 0), 0);
    const totalProjectedBalance = withLimit.reduce((sum, c) => {
      const paydown = amountToReachUtilization(c, 30);
      const applied = paydown && paydown > 0 ? paydown : 0;
      return sum + Math.max(0, c.balance - applied);
    }, 0);
    return totalLimit > 0 ? (totalProjectedBalance / totalLimit) * 100 : null;
  }, [cards]);

  // Renders the walkthrough for any given utilization row - reused for both the
  // top "do this first" card and any expanded "Later" card. showChangeCard adds
  // an extra step letting the user override which card is the top priority.
  function renderStepsForRow(row: UtilRow, showChangeCard: boolean = false) {
    return (
      <>
        <View style={styles.numberedStep}>
          <View style={styles.numberCircle}>
            <Text style={styles.numberCircleText}>1</Text>
          </View>
          <View style={styles.numberedStepText}>
            <Text style={styles.numberedStepTitle}>Check your usage</Text>
            <Text style={styles.numberedStepDesc}>
              {row.percent !== null
                ? `This card is at ${row.percent.toFixed(0)}% of its limit (${utilizationTier(row.percent)}).`
                : `Add a credit limit to this card so we can calculate this.`}
            </Text>
          </View>
        </View>

        <View style={styles.numberedStep}>
          <View style={styles.numberCircle}>
            <Text style={styles.numberCircleText}>2</Text>
          </View>
          <View style={styles.numberedStepText}>
            <Text style={styles.numberedStepTitle}>Know your deadline</Text>
            <Text style={styles.numberedStepDesc}>
              {row.card.closingDate
                ? `Your statement closes ${nextOccurrenceLabel(row.card.closingDate)}${row.days !== null ? ` (in ${row.days} ${row.days === 1 ? 'day' : 'days'})` : ''}. That's the balance your bank reports to credit bureaus - not your due date.`
                : `Add a closing date to this card to get an exact deadline.`}
            </Text>
          </View>
        </View>

        <View style={styles.numberedStep}>
          <View style={styles.numberCircle}>
            <Text style={styles.numberCircleText}>3</Text>
          </View>
          <View style={styles.numberedStepText}>
            <Text style={styles.numberedStepTitle}>Make this payment</Text>
            {row.toGood !== null && row.toGood > 0 ? (
              <Text style={styles.numberedStepDesc}>
                Pay ${row.toGood.toLocaleString()}
                {row.card.closingDate ? ` before ${nextOccurrenceLabel(row.card.closingDate)}` : ''} to get under 30% usage.
              </Text>
            ) : row.percent !== null ? (
              <Text style={styles.numberedStepDescGood}>
                You're already under 30% - no payment needed to hit this goal.
              </Text>
            ) : (
              <Text style={styles.numberedStepDesc}>We need a credit limit first to suggest an amount.</Text>
            )}
          </View>
        </View>

        <View style={styles.numberedStep}>
          <View style={styles.numberCircle}>
            <Text style={styles.numberCircleText}>4</Text>
          </View>
          <View style={styles.numberedStepText}>
            <Text style={styles.numberedStepTitle}>After it closes</Text>
            <Text style={styles.numberedStepDesc}>
              A new billing cycle starts right away. Come back here to see your next deadline
              and keep this number low.
            </Text>
          </View>
        </View>

        {showChangeCard && (
          <View style={styles.numberedStep}>
            <View style={styles.numberCircle}>
              <Text style={styles.numberCircleText}>5</Text>
            </View>
            <View style={styles.numberedStepText}>
              <Text style={styles.numberedStepTitle}>Want to work on a different card?</Text>
              <Text style={styles.numberedStepDesc}>
                You can choose a different card to prioritize instead of the one picked automatically.
              </Text>
              <Pressable style={styles.changeButton} onPress={() => setPickerOpen(!pickerOpen)}>
                <Text style={styles.changeButtonText}>{pickerOpen ? 'Cancel' : 'View other cards'}</Text>
              </Pressable>
              {pickerOpen && (
                <View style={styles.pickerList}>
                  {cards.map((c) => (
                    <Pressable
                      key={c.id}
                      style={styles.pickerRow}
                      onPress={() => {
                        setManualTargetId(c.id);
                        setPickerOpen(false);
                      }}
                    >
                      <Text style={styles.pickerRowText}>{c.name}</Text>
                      {c.id === row.card.id && <Text style={styles.pickerCheck}>&#10003;</Text>}
                    </Pressable>
                  ))}
                  {manualTargetId && (
                    <Pressable
                      style={styles.pickerRow}
                      onPress={() => {
                        setManualTargetId(null);
                        setPickerOpen(false);
                      }}
                    >
                      <Text style={styles.pickerResetText}>Use automatic pick instead</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          </View>
        )}
      </>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Plan</Text>

      {cards.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Add a card first to see your payoff plan.</Text>
        </View>
      ) : (
        <>
          <View style={styles.toggleRow}>
            <Pressable
              style={[styles.toggleButton, strategy === 'avalanche' && styles.toggleButtonActive]}
              onPress={() => selectStrategy('avalanche')}
            >
              <Text style={[styles.toggleText, strategy === 'avalanche' && styles.toggleTextActive]}>
                Avalanche
              </Text>
            </Pressable>
            <Pressable
              style={[styles.toggleButton, strategy === 'snowball' && styles.toggleButtonActive]}
              onPress={() => selectStrategy('snowball')}
            >
              <Text style={[styles.toggleText, strategy === 'snowball' && styles.toggleTextActive]}>
                Snowball
              </Text>
            </Pressable>
            <Pressable
              style={[styles.toggleButton, strategy === 'creditBuilder' && styles.toggleButtonActive]}
              onPress={() => selectStrategy('creditBuilder')}
            >
              <Text style={[styles.toggleText, strategy === 'creditBuilder' && styles.toggleTextActive]}>
                Credit Builder
              </Text>
            </Pressable>
          </View>

          <Text style={styles.explainer}>{STRATEGY_EXPLAINER[strategy]}</Text>

          {showPlanIntro && (
            <View style={styles.introCard}>
              <Text style={styles.introTitle}>How this screen works</Text>
              <Text style={styles.introBody}>
                Tap Avalanche, Snowball, or Credit Builder above to switch strategies.
                Drag the circle below to change how much extra you pay each month.
                Tap any card in the plan to see its own steps.
              </Text>
              <Pressable style={styles.introButton} onPress={dismissPlanIntro}>
                <Text style={styles.introButtonText}>Got it</Text>
              </Pressable>
            </View>
          )}

          {strategy === 'creditBuilder' ? (
            <FlatList
              data={laterRows}
              keyExtractor={(item) => item.card.id}
              ListHeaderComponent={
                <>
                  {overallUtilization !== null && (
                    <View style={styles.snapshotCard}>
                      <Text style={styles.snapshotLabel}>OVERALL UTILIZATION SNAPSHOT</Text>
                      <View style={styles.snapshotCompareRow}>
                        <View style={styles.snapshotSide}>
                          <Text style={styles.snapshotSideLabel}>Now</Text>
                          <Text style={styles.snapshotPercent}>{overallUtilization.toFixed(0)}%</Text>
                          <View
                            style={[
                              styles.tierPill,
                              { backgroundColor: TIER_COLORS[utilizationTier(overallUtilization)] },
                            ]}
                          >
                            <Text style={styles.tierPillText}>
                              {TIER_LABELS[utilizationTier(overallUtilization)]}
                            </Text>
                          </View>
                        </View>

                        {projectedUtilization !== null && projectedUtilization < overallUtilization && (
                          <>
                            <Text style={styles.snapshotArrow}>&rarr;</Text>
                            <View style={styles.snapshotSide}>
                              <Text style={styles.snapshotSideLabel}>After suggested payments</Text>
                              <Text style={styles.snapshotPercent}>{projectedUtilization.toFixed(0)}%</Text>
                              <View
                                style={[
                                  styles.tierPill,
                                  { backgroundColor: TIER_COLORS[utilizationTier(projectedUtilization)] },
                                ]}
                              >
                                <Text style={styles.tierPillText}>
                                  {TIER_LABELS[utilizationTier(projectedUtilization)]}
                                </Text>
                              </View>
                            </View>
                          </>
                        )}
                      </View>
                      <Text style={styles.snapshotNote}>
                        This is your combined balance across all cards with a credit limit set,
                        divided by your combined limit. It's an estimate of the utilization piece
                        only - your real credit score also depends on payment history, account
                        age, and other factors this app doesn't track. This isn't an official score.
                      </Text>
                    </View>
                  )}

                  {mostUrgent && (
                    <View style={styles.stepCard}>
                      <Pressable
                        style={styles.stepCardHeader}
                        onPress={() => setPlanExpanded(!planExpanded)}
                      >
                        <View>
                          <Text style={styles.stepLabel}>
                            {laterRows.length > 0 ? 'DO THIS FIRST' : 'YOUR ACTION PLAN'}
                          </Text>
                          <Text style={styles.stepCardName}>{mostUrgent.card.name}</Text>
                        </View>
                        <Text style={styles.chevron}>{planExpanded ? '\u2303' : '\u2304'}</Text>
                      </Pressable>
                      {planExpanded && renderStepsForRow(mostUrgent, true)}
                    </View>
                  )}
                  {laterRows.length > 0 && <Text style={styles.orderLabel}>Later</Text>}
                </>
              }
              renderItem={({ item }) => {
                const tier = utilizationTier(item.percent);
                const isExpanded = expandedCardId === item.card.id;
                return (
                  <Pressable
                    style={styles.utilCard}
                    onPress={() => setExpandedCardId(isExpanded ? null : item.card.id)}
                  >
                    <View style={styles.utilTopLine}>
                      <Text style={styles.utilName}>{item.card.name}</Text>
                      <View style={styles.utilTopRight}>
                        <View style={[styles.tierPill, { backgroundColor: TIER_COLORS[tier] }]}>
                          <Text style={styles.tierPillText}>{TIER_LABELS[tier]}</Text>
                        </View>
                        <Text style={styles.chevron}>{isExpanded ? '\u2303' : '\u2304'}</Text>
                      </View>
                    </View>

                    {!isExpanded && (
                      <>
                        {item.percent !== null && (
                          <Text style={styles.utilPercent}>{item.percent.toFixed(0)}% utilized</Text>
                        )}
                        {item.days !== null && (
                          <Text style={styles.utilDays}>
                            Closes in {item.days} {item.days === 1 ? 'day' : 'days'}
                          </Text>
                        )}
                        <Text style={styles.tapHint}>Tap for steps</Text>
                      </>
                    )}

                    {isExpanded && <View style={styles.expandedSteps}>{renderStepsForRow(item)}</View>}
                  </Pressable>
                );
              }}
            />
          ) : (
            <FlatList
              data={result?.payoffOrder ?? []}
              keyExtractor={(item) => item.cardId}
              ListHeaderComponent={
                <>
                  {displayTarget && (
                    <View style={styles.stepCard}>
                      <Pressable
                        style={styles.stepCardHeader}
                        onPress={() => setPlanExpanded(!planExpanded)}
                      >
                        <Text style={styles.stepLabel}>THIS MONTH</Text>
                        <Text style={styles.chevron}>{planExpanded ? '\u2303' : '\u2304'}</Text>
                      </Pressable>

                      {planExpanded && (
                        <>
                      <View style={styles.numberedStep}>
                        <View style={styles.numberCircle}>
                          <Text style={styles.numberCircleText}>1</Text>
                        </View>
                        <View style={styles.numberedStepText}>
                          <Text style={styles.numberedStepTitle}>See where your debt sits</Text>
                          {mostDebtCard && (
                            <Text style={styles.numberedStepDesc}>
                              You owe the most on {mostDebtCard.name} (${mostDebtCard.balance.toLocaleString()}).
                            </Text>
                          )}
                        </View>
                      </View>

                      <View style={styles.numberedStep}>
                        <View style={styles.numberCircle}>
                          <Text style={styles.numberCircleText}>2</Text>
                        </View>
                        <View style={styles.numberedStepText}>
                          <Text style={styles.numberedStepTitle}>Your target this month</Text>
                          <Text style={styles.numberedStepDesc}>
                            {manualTargetId
                              ? `You chose to focus on ${displayTarget.name} first.`
                              : strategy === 'avalanche'
                              ? `${displayTarget.name} has your highest interest rate (${displayTarget.apr}% APR) - it's costing you the most, so it goes first.`
                              : `${displayTarget.name} has your smallest balance ($${displayTarget.balance.toLocaleString()}) - paying it off first gives you a quick win.`}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.numberedStep}>
                        <View style={styles.numberCircle}>
                          <Text style={styles.numberCircleText}>3</Text>
                        </View>
                        <View style={styles.numberedStepText}>
                          <Text style={styles.numberedStepTitle}>Want to work on a different card?</Text>
                          <Text style={styles.numberedStepDesc}>
                            You can override the automatic pick and choose which card to focus on instead.
                          </Text>
                          <Pressable
                            style={styles.changeButton}
                            onPress={() => setPickerOpen(!pickerOpen)}
                          >
                            <Text style={styles.changeButtonText}>
                              {pickerOpen ? 'Cancel' : 'View other cards'}
                            </Text>
                          </Pressable>
                          {pickerOpen && (
                            <View style={styles.pickerList}>
                              {cards.map((c) => (
                                <Pressable
                                  key={c.id}
                                  style={styles.pickerRow}
                                  onPress={() => {
                                    setManualTargetId(c.id === displayTarget.id && manualTargetId ? null : c.id);
                                    setPickerOpen(false);
                                  }}
                                >
                                  <Text style={styles.pickerRowText}>{c.name}</Text>
                                  {c.id === displayTarget.id && <Text style={styles.pickerCheck}>&#10003;</Text>}
                                </Pressable>
                              ))}
                              {manualTargetId && (
                                <Pressable
                                  style={styles.pickerRow}
                                  onPress={() => {
                                    setManualTargetId(null);
                                    setPickerOpen(false);
                                  }}
                                >
                                  <Text style={styles.pickerResetText}>Use automatic pick instead</Text>
                                </Pressable>
                              )}
                            </View>
                          )}
                        </View>
                      </View>

                      <View style={styles.numberedStep}>
                        <View style={styles.numberCircle}>
                          <Text style={styles.numberCircleText}>4</Text>
                        </View>
                        <View style={styles.numberedStepText}>
                          <Text style={styles.numberedStepTitle}>Make this payment</Text>
                          <Text style={styles.numberedStepDesc}>
                            Pay the minimum on every other card, and put your extra ${extraPayment} toward {displayTarget.name}.
                          </Text>
                        </View>
                      </View>

                      <View style={styles.numberedStep}>
                        <View style={styles.numberCircle}>
                          <Text style={styles.numberCircleText}>5</Text>
                        </View>
                        <View style={styles.numberedStepText}>
                          <Text style={styles.numberedStepTitle}>What happens next</Text>
                          <Text style={styles.numberedStepDesc}>
                            Once {displayTarget.name} is paid off, its payment rolls onto your next
                            card automatically. Keep this up and you'll be debt-free by{' '}
                            {result ? formatPayoffDate(result.monthsToPayoff) : 'your target date'}.
                          </Text>
                        </View>
                      </View>
                        </>
                      )}
                    </View>
                  )}

                  <View style={styles.dialWrap}>
                    <CircularDial
                      value={extraPayment}
                      onChange={setExtraPayment}
                      min={0}
                      max={500}
                      step={10}
                      label="extra / month"
                    />
                  </View>

                  {result && (
                    <View style={styles.heroCard}>
                      <Text style={styles.heroLabel}>Debt-free by</Text>
                      <Text style={styles.heroValue}>{formatPayoffDate(result.monthsToPayoff)}</Text>
                      <Text style={styles.heroSub}>
                        {result.monthsToPayoff} months &middot; ${result.totalInterestPaid.toLocaleString()} total interest
                      </Text>
                    </View>
                  )}

                  {result && <Text style={styles.orderLabel}>Full payoff order</Text>}
                </>
              }
              renderItem={({ item, index }) => (
                <View style={styles.orderRow}>
                  <View style={styles.orderTopLine}>
                    <Text style={styles.orderRank}>{index + 1}.</Text>
                    <Text style={styles.orderName}>{item.cardName}</Text>
                    <Text style={styles.orderMonth}>Paid off {formatPayoffDate(item.payoffMonth)}</Text>
                  </View>
                  <View style={styles.orderDetailLine}>
                    <Text style={styles.orderDetail}>
                      Started at ${item.originalBalance.toLocaleString()} &middot; {item.apr}% APR
                    </Text>
                    <Text style={styles.orderDetail}>${item.interestPaid.toLocaleString()} interest</Text>
                  </View>
                </View>
              )}
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 16 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  emptyText: { color: '#888', fontSize: 15, textAlign: 'center' },
  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  toggleButtonActive: { backgroundColor: '#111' },
  toggleText: { fontSize: 13, color: '#555' },
  toggleTextActive: { color: '#fff', fontWeight: '500' },
  explainer: { fontSize: 13, color: '#888', lineHeight: 18, marginBottom: 16 },
  introCard: {
    backgroundColor: '#fffbea',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f5e6a8',
  },
  introTitle: { fontSize: 14, fontWeight: '700', color: '#7a5c00', marginBottom: 6 },
  introBody: { fontSize: 13, color: '#6b5900', lineHeight: 18, marginBottom: 10 },
  introButton: {
    backgroundColor: '#7a5c00',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
  },
  introButtonText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  snapshotCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#eee',
  },
  snapshotLabel: { fontSize: 11, fontWeight: '700', color: '#888', letterSpacing: 0.5, marginBottom: 10 },
  snapshotCompareRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  snapshotSide: { alignItems: 'flex-start' },
  snapshotSideLabel: { fontSize: 11, color: '#999', marginBottom: 2 },
  snapshotArrow: { fontSize: 20, color: '#ccc', marginHorizontal: 14 },
  snapshotPercent: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
  snapshotNote: { fontSize: 12, color: '#999', lineHeight: 16 },
  stepCard: {
    backgroundColor: '#eaf3ff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#c9e0ff',
  },
  stepLabel: { fontSize: 11, fontWeight: '700', color: '#1a5fb4', letterSpacing: 0.5, marginBottom: 6 },
  stepCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  stepCardName: { fontSize: 18, fontWeight: '600', marginTop: 2 },
  changeButton: {
    backgroundColor: '#1a5fb4',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  changeButtonText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  pickerList: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#dbe8fb',
    overflow: 'hidden',
  },
  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eef4fc',
  },
  pickerRowText: { fontSize: 14, color: '#111' },
  pickerCheck: { fontSize: 14, color: '#1a5fb4', fontWeight: '700' },
  pickerResetText: { fontSize: 13, color: '#888', fontStyle: 'italic' },
  numberedStep: { flexDirection: 'row', marginTop: 14 },
  numberCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#1a5fb4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  numberCircleText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  numberedStepText: { flex: 1 },
  numberedStepTitle: { fontSize: 14, fontWeight: '600', color: '#111', marginBottom: 2 },
  numberedStepDesc: { fontSize: 13, color: '#444', lineHeight: 18 },
  numberedStepDescGood: { fontSize: 13, color: '#1a7f37', fontWeight: '500', lineHeight: 18 },
  dialWrap: { alignItems: 'center', marginBottom: 20 },
  heroCard: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  heroLabel: { color: '#aaa', fontSize: 13, marginBottom: 4 },
  heroValue: { color: '#fff', fontSize: 26, fontWeight: '600', marginBottom: 6 },
  heroSub: { color: '#ccc', fontSize: 13 },
  orderLabel: { fontSize: 13, color: '#666', marginBottom: 8 },
  orderRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  orderTopLine: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  orderRank: { width: 24, fontSize: 14, color: '#888' },
  orderName: { flex: 1, fontSize: 15, fontWeight: '500' },
  orderMonth: { fontSize: 12, color: '#888' },
  orderDetailLine: { flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 24 },
  orderDetail: { fontSize: 12, color: '#999' },
  utilCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  utilTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  utilTopRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chevron: { fontSize: 14, color: '#999' },
  utilName: { fontSize: 15, fontWeight: '500' },
  tierPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tierPillText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  utilPercent: { fontSize: 13, color: '#333', marginBottom: 2 },
  utilDays: { fontSize: 13, color: '#666', marginBottom: 4 },
  tapHint: { fontSize: 11, color: '#aaa', marginTop: 2, fontStyle: 'italic' },
  expandedSteps: { marginTop: 4 },
});