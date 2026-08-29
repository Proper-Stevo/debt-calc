import { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Card } from '@/types/card';
import { getCards } from '@/lib/storage';
import { useAuth } from '@/lib/auth-context';

export default function HomeScreen() {
  const [cards, setCards] = useState<Card[]>([]);
  const { lock } = useAuth();

  useFocusEffect(
    useCallback(() => {
      getCards().then(setCards);
    }, [])
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {cards.length === 0 ? 'Welcome to CreditHelper' : 'Welcome back'}
        </Text>
        <Pressable onPress={lock} hitSlop={12}>
          <Text style={styles.logoutButton}>Log out</Text>
        </Pressable>
      </View>

      {cards.length === 0 ? (
        <>
          <Text style={styles.subtitle}>
            This app helps you build a plan to pay off credit card debt. Add your
            cards on the Cards tab, then compare payoff strategies on the Plan tab
            to see when you&apos;ll be debt-free.
          </Text>
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              Add a card on the Cards tab to see it here.
            </Text>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.subtitle}>
            Every payment gets you closer to debt-free. Check the Plan tab anytime
            to see how you&apos;re doing.
          </Text>
          <FlatList
            data={cards}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <Text style={styles.cardName}>{item.name}</Text>
                <Text style={styles.dueDate}>
                  {item.dueDate ? `Due on the ${item.dueDate}` + ordinalSuffix(item.dueDate) : 'No due date set'}
                </Text>
              </View>
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

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: { fontSize: 24, fontWeight: '600', flexShrink: 1 },
  logoutButton: { fontSize: 14, color: '#555' },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 20, lineHeight: 20 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  emptyText: { color: '#888', fontSize: 15, textAlign: 'center' },
  row: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingVertical: 28,
    paddingHorizontal: 14,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardName: { fontSize: 16, fontWeight: '500' },
  dueDate: { fontSize: 13, color: '#666' },
});