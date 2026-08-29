import { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Card } from '@/types/card';
import { getCards } from '@/lib/storage';
import { calculatePayoff, Strategy } from '@/lib/payoff';
import CircularDial from '@/components/circular-dial';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Turns a number of months-from-now into a readable "Month Year" string.
function formatPayoffDate(monthsFromNow: number): string {
  const today = new Date();
  const target = new Date(today.getFullYear(), today.getMonth() + monthsFromNow, 1);
  return `${MONTH_NAMES[target.getMonth()]} ${target.getFullYear()}`;
}

export default function PlanScreen() {
  const [cards, setCards] = useState<Card[]>([]);
  const [strategy, setStrategy] = useState<Strategy>('avalanche');
  const [extraPayment, setExtraPayment] = useState(100);

  useFocusEffect(
    useCallback(() => {
      getCards().then(setCards);
    }, [])
  );

  // Recalculates automatically whenever cards, strategy, or the extra payment changes.
  const result = useMemo(() => {
    if (cards.length === 0) return null;
    return calculatePayoff(cards, strategy, extraPayment);
  }, [cards, strategy, extraPayment]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Plan</Text>

      {cards.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Add a card first to see your payoff plan.</Text>
        </View>
      ) : (
        <FlatList
          data={result?.payoffOrder ?? []}
          keyExtractor={(item) => item.cardId}
          ListHeaderComponent={
            <>
              <View style={styles.toggleRow}>
                <Pressable
                  style={[styles.toggleButton, strategy === 'avalanche' && styles.toggleButtonActive]}
                  onPress={() => setStrategy('avalanche')}
                >
                  <Text style={[styles.toggleText, strategy === 'avalanche' && styles.toggleTextActive]}>
                    Avalanche
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.toggleButton, strategy === 'snowball' && styles.toggleButtonActive]}
                  onPress={() => setStrategy('snowball')}
                >
                  <Text style={[styles.toggleText, strategy === 'snowball' && styles.toggleTextActive]}>
                    Snowball
                  </Text>
                </Pressable>
              </View>

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

              {result && <Text style={styles.orderLabel}>Payoff order</Text>}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 16 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  emptyText: { color: '#888', fontSize: 15, textAlign: 'center' },
  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  toggleButton: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  toggleButtonActive: { backgroundColor: '#111' },
  toggleText: { fontSize: 14, color: '#555' },
  toggleTextActive: { color: '#fff', fontWeight: '500' },
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
});