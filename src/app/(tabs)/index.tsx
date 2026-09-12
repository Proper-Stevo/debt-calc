import { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
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

  function handleCardPress(card: Card) {
    Alert.alert(card.name, 'What would you like to see?', [
      { text: 'View card', onPress: () => router.push(`/edit-card/${card.id}`) },
      { text: 'View plan', onPress: () => router.push('/plan') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {cards.length === 0 ? 'Welcome to Nudge' : 'Welcome back'}
        </Text>
        <View style={styles.headerActions}>
          <Pressable onPress={() => router.push('/about')} hitSlop={12}>
            <Text style={styles.aboutButton}>About</Text>
          </Pressable>
          <Pressable onPress={lock} hitSlop={12}>
            <Text style={styles.logoutButton}>Log out</Text>
          </Pressable>
        </View>
      </View>

      {cards.length === 0 ? (
        <>
          <Text style={styles.subtitle}>
            We&apos;ll help you pay off your debt three ways. Not sure which fits?
            Just add your cards below and we&apos;ll take it from there.
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
              <Pressable style={styles.row} onPress={() => handleCardPress(item)}>
                <View style={styles.accentBar} />
                <View style={styles.rowContent}>
                  <View style={styles.left}>
                    <Text style={styles.cardName}>{item.name}</Text>
                    <Text style={styles.dueDate}>
                      {item.dueDate ? `Due on the ${item.dueDate}` + ordinalSuffix(item.dueDate) : 'No due date set'}
                    </Text>
                  </View>
                  <View style={styles.right}>
                    <Text style={styles.amountDue}>${item.balance.toLocaleString()}</Text>
                    <Text style={styles.minPayment}>min ${item.minPayment.toLocaleString()}</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: { fontSize: 24, fontWeight: '600', flexShrink: 1, color: '#111' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  aboutButton: { fontSize: 14, color: '#555' },
  logoutButton: { fontSize: 14, color: '#555' },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 20, lineHeight: 20 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  emptyText: { color: '#888', fontSize: 15, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
  },
  accentBar: { width: 4, backgroundColor: '#1a5fb4' },
  rowContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 14,
  },
  left: { flexShrink: 1 },
  cardName: { fontSize: 15, fontWeight: '600', color: '#111', marginBottom: 3 },
  dueDate: { fontSize: 12, color: '#111' },
  right: { alignItems: 'flex-end' },
  amountDue: { fontSize: 17, fontWeight: '700', color: '#111' },
  minPayment: { fontSize: 12, color: '#111', marginTop: 2 },
});