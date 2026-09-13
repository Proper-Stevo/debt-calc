import { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Card } from '@/types/card';
import { getCards } from '@/lib/storage';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme';

export default function HomeScreen() {
  const [cards, setCards] = useState<Card[]>([]);
  const { lock } = useAuth();
  const theme = useTheme();

  useFocusEffect(
    useCallback(() => {
      getCards().then(setCards);
    }, [])
  );

  function handleCardPress(card: Card) {
    Alert.alert(card.name, undefined, [
      { text: 'View card', onPress: () => router.push(`/edit-card/${card.id}`) },
      { text: 'View plan', onPress: () => router.push('/plan') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>
          {cards.length === 0 ? 'Welcome to Nudge' : 'Welcome back'}
        </Text>
        <View style={styles.headerActions}>
          <Pressable onPress={() => router.push('/about')} hitSlop={12}>
            <Text style={[styles.aboutButton, { color: theme.textSecondary }]}>About</Text>
          </Pressable>
          <Pressable onPress={lock} hitSlop={12}>
            <Text style={[styles.logoutButton, { color: theme.textSecondary }]}>Log out</Text>
          </Pressable>
        </View>
      </View>

      {cards.length === 0 ? (
        <>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            We&apos;ll help you pay off your debt three ways. Not sure which fits?
            Just add your cards below and we&apos;ll take it from there.
          </Text>
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              Add a card on the Cards tab to see it here.
            </Text>
          </View>
        </>
      ) : (
        <>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            Every payment gets you closer to debt-free. Check the Plan tab anytime
            to see how you&apos;re doing.
          </Text>
          <FlatList
            data={cards}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.row, { backgroundColor: theme.cardBackground }]}
                onPress={() => handleCardPress(item)}
              >
                <View style={[styles.accentBar, { backgroundColor: theme.accent }]} />
                <View style={styles.rowContent}>
                  <View style={styles.left}>
                    <Text style={[styles.cardName, { color: theme.textPrimary }]}>{item.name}</Text>
                    <Text style={[styles.dueDate, { color: theme.textPrimary }]}>
                      {item.dueDate ? `Due on the ${item.dueDate}` + ordinalSuffix(item.dueDate) : 'No due date set'}
                    </Text>
                  </View>
                  <View style={styles.right}>
                    <Text style={[styles.amountDue, { color: theme.textPrimary }]}>${item.balance.toLocaleString()}</Text>
                    <Text style={[styles.minPayment, { color: theme.textPrimary }]}>min ${item.minPayment.toLocaleString()}</Text>
                  </View>
                </View>
              </Pressable>
            )}
          />
        </>
      )}
    </SafeAreaView>
  );
}

// Turns 1 -> "st", 2 -> "nd", 3 -> "rd", everything else -> "th"
function ordinalSuffix(day: number): string {
  if (day % 10 === 1 && day !== 11) return 'st';
  if (day % 10 === 2 && day !== 12) return 'nd';
  if (day % 10 === 3 && day !== 13) return 'rd';
  return 'th';
}

// Note: colors have been moved OUT of this StyleSheet and applied inline
// via the theme object above, so they can change with dark/light mode.
// This StyleSheet now only holds layout (sizing, spacing, alignment).
const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: { fontSize: 24, fontWeight: '600', flexShrink: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  aboutButton: { fontSize: 14 },
  logoutButton: { fontSize: 14 },
  subtitle: { fontSize: 14, marginBottom: 20, lineHeight: 20 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  emptyText: { fontSize: 15, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
  },
  accentBar: { width: 4 },
  rowContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 14,
  },
  left: { flexShrink: 1 },
  cardName: { fontSize: 15, fontWeight: '600', marginBottom: 3 },
  dueDate: { fontSize: 12 },
  right: { alignItems: 'flex-end' },
  amountDue: { fontSize: 17, fontWeight: '700' },
  minPayment: { fontSize: 12, marginTop: 2 },
});