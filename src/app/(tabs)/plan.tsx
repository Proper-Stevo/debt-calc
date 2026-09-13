import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Card } from '@/types/card';
import { getCards, hasSeenPlanIntro, markPlanIntroSeen, getUserCreditScore, setUserCreditScore } from '@/lib/storage';
import { calculatePayoff, pickTarget, Strategy } from '@/lib/payoff';
import { utilizationPercent, utilizationTier, amountToReachUtilization, daysUntil, nextOccurrenceLabel, estimateScoreRange, UtilizationTier } from '@/lib/utilization';
import CircularDial from '@/components/circular-dial';
import { useTheme } from '@/lib/theme';

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
  creditBuilder: 'Finds whichever card, if paid down, improves your overall credit usage the most - not just whichever closes soonest.',
};

const PLAN_INTRO_CONTENT: Record<Strategy, { title: string; body: string }> = {
  avalanche: {
    title: 'How this tab works',
    body: "Drag the circle below to set how much extra you pay each month. We'll show which card to focus on first and update your debt-free date live. Tap Snowball or Credit Builder above to compare other approaches.",
  },
  snowball: {
    title: 'How this tab works',
    body: "Drag the circle below to set how much extra you pay each month. We'll show which card to focus on first and update your debt-free date live. Tap Avalanche or Credit Builder above to compare other approaches.",
  },
  creditBuilder: {
    title: 'How this tab works',
    body: "This tab ranks your cards by how much fixing each one would improve your overall credit usage - biggest improvement first. Tap any card below to see its own step-by-step plan.",
  },
};

type UtilRow = {
  card: Card;
  percent: number | null;
  days: number | null;
  toGood: number | null;
  toExcellent: number | null;
  impact: number;
};

export default function PlanScreen() {
  const theme = useTheme();
  const [cards, setCards] = useState<Card[]>([]);
  const [strategy, setStrategy] = useState<Strategy>('avalanche');
  const [extraPayment, setExtraPayment] = useState(100);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [planExpanded, setPlanExpanded] = useState(true);
  const [manualTargetId, setManualTargetId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showPlanIntro, setShowPlanIntro] = useState(false);
  const [creditScoreInput, setCreditScoreInput] = useState('');
  const [savedCreditScore, setSavedCreditScore] = useState<number | null>(null);

  useEffect(() => {
    getUserCreditScore().then((score) => {
      if (score !== null) {
        setSavedCreditScore(score);
        setCreditScoreInput(score.toString());
      }
    });
  }, []);

  function saveCreditScore() {
    const num = parseInt(creditScoreInput, 10);
    if (!isNaN(num) && num >= 300 && num <= 850) {
      setUserCreditScore(num);
      setSavedCreditScore(num);
    }
  }

  useEffect(() => {
    hasSeenPlanIntro(strategy).then((seen) => setShowPlanIntro(!seen));
  }, [strategy]);

  function dismissPlanIntro() {
    setShowPlanIntro(false);
    markPlanIntroSeen(strategy);
  }

  function reopenPlanIntro() {
    setShowPlanIntro(true);
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

  const overallStats = useMemo(() => {
    const withLimit = cards.filter((c) => c.creditLimit && c.creditLimit > 0);
    if (withLimit.length === 0) return { overall: null as number | null, projected: null as number | null, totalLimit: 0, totalBalance: 0 };
    const totalBalance = withLimit.reduce((sum, c) => sum + c.balance, 0);
    const totalLimit = withLimit.reduce((sum, c) => sum + (c.creditLimit ?? 0), 0);
    const overall = totalLimit > 0 ? (totalBalance / totalLimit) * 100 : null;
    const totalProjectedBalance = withLimit.reduce((sum, c) => {
      const paydown = amountToReachUtilization(c, 30);
      const applied = paydown && paydown > 0 ? paydown : 0;
      return sum + Math.max(0, c.balance - applied);
    }, 0);
    const projected = totalLimit > 0 ? (totalProjectedBalance / totalLimit) * 100 : null;
    return { overall, projected, totalLimit, totalBalance };
  }, [cards]);

  const overallUtilization = overallStats.overall;
  const projectedUtilization = overallStats.projected;

  const utilizationRows = useMemo<UtilRow[]>(() => {
    const { totalLimit, totalBalance, overall } = overallStats;
    return cards
      .map((c) => {
        const percent = utilizationPercent(c);
        const days = c.closingDate ? daysUntil(c.closingDate) : null;
        const toGood = amountToReachUtilization(c, 30);
        const toExcellent = amountToReachUtilization(c, 10);
        let impact = 0;
        if (totalLimit > 0 && overall !== null && toGood !== null && toGood > 0) {
          const newBalance = totalBalance - toGood;
          const newOverall = (newBalance / totalLimit) * 100;
          impact = overall - newOverall;
        }
        return { card: c, percent, days, toGood, toExcellent, impact };
      })
      .sort((a, b) => {
        if (b.impact !== a.impact) return b.impact - a.impact;
        if (a.days === null) return 1;
        if (b.days === null) return -1;
        return a.days - b.days;
      });
  }, [cards, overallStats]);

  const mostUrgent = manualTargetId
    ? utilizationRows.find((r) => r.card.id === manualTargetId) ?? utilizationRows[0]
    : utilizationRows[0];
  const laterRows = utilizationRows.filter((r) => r.card.id !== mostUrgent?.card.id);

  const scoreEstimate = useMemo(() => {
    if (overallUtilization === null || !mostUrgent || mostUrgent.impact <= 0) return null;
    const afterThisCard = overallUtilization - mostUrgent.impact;
    return estimateScoreRange(overallUtilization, afterThisCard);
  }, [overallUtilization, mostUrgent]);

  function renderStepsForRow(row: UtilRow) {
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
      </>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Text style={[styles.title, { color: theme.textPrimary }]}>Plan</Text>

      {cards.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>Add a card first to see your payoff plan.</Text>
        </View>
      ) : (
        <>
          <View style={styles.toggleRow}>
            <Pressable
              style={[
                styles.toggleButton,
                { backgroundColor: theme.cardInnerBackground },
                strategy === 'avalanche' && { backgroundColor: theme.accent },
              ]}
              onPress={() => selectStrategy('avalanche')}
            >
              <Text style={[styles.toggleText, { color: theme.textSecondary }, strategy === 'avalanche' && styles.toggleTextActive]}>
                Avalanche
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.toggleButton,
                { backgroundColor: theme.cardInnerBackground },
                strategy === 'snowball' && { backgroundColor: theme.accent },
              ]}
              onPress={() => selectStrategy('snowball')}
            >
              <Text style={[styles.toggleText, { color: theme.textSecondary }, strategy === 'snowball' && styles.toggleTextActive]}>
                Snowball
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.toggleButton,
                { backgroundColor: theme.cardInnerBackground },
                strategy === 'creditBuilder' && { backgroundColor: theme.accent },
              ]}
              onPress={() => selectStrategy('creditBuilder')}
            >
              <Text style={[styles.toggleText, { color: theme.textSecondary }, strategy === 'creditBuilder' && styles.toggleTextActive]}>
                Credit Builder
              </Text>
            </Pressable>
          </View>

          <View style={styles.explainerRow}>
            <Text style={[styles.explainer, { color: theme.textMuted }]}>{STRATEGY_EXPLAINER[strategy]}</Text>
            <Pressable style={[styles.helpButton, { backgroundColor: theme.accent }]} onPress={reopenPlanIntro} hitSlop={10}>
              <Text style={styles.helpButtonText}>?</Text>
            </Pressable>
          </View>

          {showPlanIntro && (
            <View style={styles.introCard}>
              <Text style={styles.introTitle}>{PLAN_INTRO_CONTENT[strategy].title}</Text>
              <Text style={styles.introBody}>{PLAN_INTRO_CONTENT[strategy].body}</Text>
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
                  {mostUrgent && (
                    <View style={styles.stepCard}>
                      <Pressable
                        style={styles.stepCardHeader}
                        onPress={() => setPlanExpanded(!planExpanded)}
                      >
                        <View>
                          <Text style={styles.stepLabel}>YOUR CREDIT PLAN</Text>
                          <Text style={styles.stepCardName}>{mostUrgent.card.name}</Text>
                        </View>
                        <Text style={styles.stepCardChevron}>{planExpanded ? '\u2303' : '\u2304'}</Text>
                      </Pressable>

                      {planExpanded && (
                        <>
                          <View style={styles.numberedStep}>
                            <View style={styles.numberCircle}>
                              <Text style={styles.numberCircleText}>1</Text>
                            </View>
                            <View style={styles.numberedStepText}>
                              <Text style={styles.numberedStepTitle}>See your overall picture</Text>
                              {overallUtilization !== null ? (
                                <Text style={styles.numberedStepDesc}>
                                  Across all your cards, you're using {overallUtilization.toFixed(0)}% of your
                                  total credit
                                  {projectedUtilization !== null && projectedUtilization < overallUtilization
                                    ? ` - suggested payments below could bring that to ${projectedUtilization.toFixed(0)}%.`
                                    : '.'}
                                </Text>
                              ) : (
                                <Text style={styles.numberedStepDesc}>
                                  Add credit limits to your cards to see this.
                                </Text>
                              )}

                              <View style={styles.scoreInputRow}>
                                <Text style={styles.scoreInputLabel}>Your current credit score</Text>
                                <TextInput
                                  style={styles.scoreInput}
                                  value={creditScoreInput}
                                  onChangeText={setCreditScoreInput}
                                  placeholder="e.g. 620"
                                  keyboardType="number-pad"
                                  maxLength={3}
                                />
                                <Pressable style={styles.scoreSaveButton} onPress={saveCreditScore}>
                                  <Text style={styles.scoreSaveButtonText}>Save</Text>
                                </Pressable>
                              </View>

                              {scoreEstimate ? (
                                <Text style={styles.scoreEstimateText}>
                                  Fixing {mostUrgent.card.name} alone could move your score up by roughly{' '}
                                  {scoreEstimate.lowPoints}-{scoreEstimate.highPoints} points
                                  {savedCreditScore
                                    ? ` (from about ${savedCreditScore} to about ${savedCreditScore + scoreEstimate.lowPoints}-${savedCreditScore + scoreEstimate.highPoints}).`
                                    : '.'}
                                </Text>
                              ) : mostUrgent && mostUrgent.impact > 0 ? (
                                <Text style={styles.scoreEstimateTextMuted}>
                                  Paying this down helps your usage, but the improvement isn't large enough
                                  to give a reliable point estimate.
                                </Text>
                              ) : mostUrgent && mostUrgent.percent !== null ? (
                                <Text style={styles.scoreEstimateTextMuted}>
                                  This card is already in good shape - no score estimate needed here.
                                </Text>
                              ) : null}

                              {(scoreEstimate || (mostUrgent && mostUrgent.impact > 0)) && (
                                <Text style={styles.scoreDisclaimer}>
                                  *This is a rough estimate based on published patterns, not a guarantee -
                                  your real results depend on your full credit history, payment record, and
                                  other factors this app doesn't track.
                                </Text>
                              )}
                            </View>
                          </View>

                          <View style={styles.numberedStep}>
                            <View style={styles.numberCircle}>
                              <Text style={styles.numberCircleText}>2</Text>
                            </View>
                            <View style={styles.numberedStepText}>
                              <Text style={styles.numberedStepTitle}>Your priority card</Text>
                              <Text style={styles.numberedStepDesc}>
                                {mostUrgent.percent !== null
                                  ? `${mostUrgent.card.name} is at ${mostUrgent.percent.toFixed(0)}% usage. `
                                  : ''}
                                {mostUrgent.impact > 0 && overallUtilization !== null
                                  ? `Fixing this one card drops your overall usage from ${overallUtilization.toFixed(0)}% to ${(overallUtilization - mostUrgent.impact).toFixed(0)}% - the biggest single improvement available right now.`
                                  : `This is your highest-priority card right now.`}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.numberedStep}>
                            <View style={styles.numberCircle}>
                              <Text style={styles.numberCircleText}>3</Text>
                            </View>
                            <View style={styles.numberedStepText}>
                              <Text style={styles.numberedStepTitle}>Know your deadline</Text>
                              <Text style={styles.numberedStepDesc}>
                                {mostUrgent.card.closingDate
                                  ? `Your statement closes ${nextOccurrenceLabel(mostUrgent.card.closingDate)}${mostUrgent.days !== null ? ` (in ${mostUrgent.days} ${mostUrgent.days === 1 ? 'day' : 'days'})` : ''}. That's the balance your bank reports to credit bureaus - not your due date.`
                                  : `Add a closing date to this card to get an exact deadline.`}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.numberedStep}>
                            <View style={styles.numberCircle}>
                              <Text style={styles.numberCircleText}>4</Text>
                            </View>
                            <View style={styles.numberedStepText}>
                              <Text style={styles.numberedStepTitle}>Make this payment</Text>
                              {mostUrgent.toGood !== null && mostUrgent.toGood > 0 ? (
                                <Text style={styles.numberedStepDesc}>
                                  Pay ${mostUrgent.toGood.toLocaleString()}
                                  {mostUrgent.card.closingDate ? ` before ${nextOccurrenceLabel(mostUrgent.card.closingDate)}` : ''} to get under 30% usage.
                                </Text>
                              ) : mostUrgent.percent !== null ? (
                                <Text style={styles.numberedStepDescGood}>
                                  You're already under 30% - no payment needed to hit this goal.
                                </Text>
                              ) : (
                                <Text style={styles.numberedStepDesc}>
                                  We need a credit limit first to suggest an amount.
                                </Text>
                              )}
                            </View>
                          </View>

                          <View style={styles.numberedStep}>
                            <View style={styles.numberCircle}>
                              <Text style={styles.numberCircleText}>5</Text>
                            </View>
                            <View style={styles.numberedStepText}>
                              <Text style={styles.numberedStepTitle}>After it closes</Text>
                              <Text style={styles.numberedStepDesc}>
                                A new billing cycle starts right away. Come back here to see your next
                                priority card.
                              </Text>
                            </View>
                          </View>

                          <View style={styles.numberedStep}>
                            <View style={styles.numberCircle}>
                              <Text style={styles.numberCircleText}>6</Text>
                            </View>
                            <View style={styles.numberedStepText}>
                              <Text style={styles.numberedStepTitle}>Want to work on a different card?</Text>
                              <Text style={styles.numberedStepDesc}>
                                You can choose a different card to prioritize instead of the one picked
                                automatically.
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
                                        setManualTargetId(c.id);
                                        setPickerOpen(false);
                                      }}
                                    >
                                      <Text style={styles.pickerRowText}>{c.name}</Text>
                                      {c.id === mostUrgent.card.id && (
                                        <Text style={styles.pickerCheck}>&#10003;</Text>
                                      )}
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
                        </>
                      )}
                    </View>
                  )}
                  {laterRows.length > 0 && <Text style={[styles.orderLabel, { color: theme.textMuted }]}>Later</Text>}
                </>
              }
              renderItem={({ item }) => {
                const tier = utilizationTier(item.percent);
                const isExpanded = expandedCardId === item.card.id;
                return (
                  <Pressable
                    style={[styles.utilCard, { backgroundColor: theme.cardInnerBackground }]}
                    onPress={() => setExpandedCardId(isExpanded ? null : item.card.id)}
                  >
                    <View style={styles.utilTopLine}>
                      <Text style={[styles.utilName, { color: theme.textPrimary }]}>{item.card.name}</Text>
                      <View style={styles.utilTopRight}>
                        <View style={[styles.tierPill, { backgroundColor: TIER_COLORS[tier] }]}>
                          <Text style={styles.tierPillText}>{TIER_LABELS[tier]}</Text>
                        </View>
                        <Text style={[styles.chevron, { color: theme.textFaint }]}>{isExpanded ? '\u2303' : '\u2304'}</Text>
                      </View>
                    </View>

                    {!isExpanded && (
                      <>
                        {item.percent !== null && (
                          <Text style={[styles.utilPercent, { color: theme.textSecondary }]}>{item.percent.toFixed(0)}% utilized</Text>
                        )}
                        {item.days !== null && (
                          <Text style={[styles.utilDays, { color: theme.textMuted }]}>
                            Closes in {item.days} {item.days === 1 ? 'day' : 'days'}
                          </Text>
                        )}
                        <Text style={[styles.tapHint, { color: theme.textFaint }]}>Tap for steps</Text>
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
                        <Text style={styles.stepCardChevron}>{planExpanded ? '\u2303' : '\u2304'}</Text>
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

                  {result && <Text style={[styles.orderLabel, { color: theme.textMuted }]}>Full payoff order</Text>}
                </>
              }
              renderItem={({ item, index }) => (
                <View style={[styles.orderRow, { borderBottomColor: theme.border }]}>
                  <View style={styles.orderTopLine}>
                    <Text style={[styles.orderRank, { color: theme.textMuted }]}>{index + 1}.</Text>
                    <Text style={[styles.orderName, { color: theme.textPrimary }]}>{item.cardName}</Text>
                    <Text style={[styles.orderMonth, { color: theme.textMuted }]}>Paid off {formatPayoffDate(item.payoffMonth)}</Text>
                  </View>
                  <View style={styles.orderDetailLine}>
                    <Text style={[styles.orderDetail, { color: theme.textFaint }]}>
                      Started at ${item.originalBalance.toLocaleString()} &middot; {item.apr}% APR
                    </Text>
                    <Text style={[styles.orderDetail, { color: theme.textFaint }]}>${item.interestPaid.toLocaleString()} interest</Text>
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
  helpButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    marginTop: 1,
  },
  helpButtonText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  explainerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  emptyText: { fontSize: 15, textAlign: 'center' },
  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
  },
  toggleText: { fontSize: 13 },
  toggleTextActive: { color: '#fff', fontWeight: '500' },
  explainer: { flex: 1, fontSize: 13, lineHeight: 18 },
  // Self-contained widgets below keep their own fixed light-theme colors
  // intentionally (yellow tip card, blue step card, dark hero card, gray
  // utilization card) since each sets its own explicit background and is
  // readable regardless of system light/dark mode.
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
  stepCardName: { fontSize: 18, fontWeight: '600', marginTop: 2, color: '#111' },
  stepCardChevron: { fontSize: 14, color: '#7395c4' },
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
  scoreEstimateText: { fontSize: 13, color: '#1a5fb4', fontWeight: '500', lineHeight: 18, marginTop: 6 },
  scoreEstimateTextMuted: { fontSize: 13, color: '#888', lineHeight: 18, marginTop: 6, fontStyle: 'italic' },
  scoreInputRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  scoreInputLabel: { fontSize: 12, color: '#666' },
  scoreInput: {
    borderWidth: 1,
    borderColor: '#c9e0ff',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    fontSize: 13,
    width: 70,
    backgroundColor: '#fff',
    color: '#111',
  },
  scoreSaveButton: {
    backgroundColor: '#1a5fb4',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  scoreSaveButtonText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  scoreDisclaimer: { fontSize: 11, color: '#8098bd', lineHeight: 15, marginTop: 8, fontStyle: 'italic' },
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
  orderLabel: { fontSize: 13, marginBottom: 8 },
  orderRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  orderTopLine: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  orderRank: { width: 24, fontSize: 14 },
  orderName: { flex: 1, fontSize: 15, fontWeight: '500' },
  orderMonth: { fontSize: 12 },
  orderDetailLine: { flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 24 },
  orderDetail: { fontSize: 12 },
  utilCard: {
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
  chevron: { fontSize: 14 },
  utilName: { fontSize: 15, fontWeight: '500' },
  tierPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tierPillText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  utilPercent: { fontSize: 13, marginBottom: 2 },
  utilDays: { fontSize: 13, marginBottom: 4 },
  tapHint: { fontSize: 11, marginTop: 2, fontStyle: 'italic' },
  expandedSteps: { marginTop: 4 },
});