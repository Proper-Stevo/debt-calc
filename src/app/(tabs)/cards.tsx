import { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Swipeable } from 'react-native-gesture-handler';
import { useFocusEffect, router } from 'expo-router';
import { Card } from '@/types/card';
import { getCards, deleteCard } from '@/lib/storage';

export default function CardsScreen() {
  const [cards, setCards] = useState<Card[]>([]);

  useFocusEffect(
    useCallback(() => {
      getCards().then(setCards);
    }, [])
  );

  function confirmDelete(card: Card) {
    Alert.alert('Delete card', `Are you sure you want to delete ${card.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteCard(card.id);
          setCards((prev) => prev.filter((c) => c.id !== card.id));
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Cards</Text>
        <Pressable onPress={() => router.push('/add-card')} hitSlop={12}>
          <Text style={styles.addButton}>+</Text>
        </Pressable>
      </View>

      {cards.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No cards yet. Tap + to add your first one.</Text>
        </View>
      ) : (
        <FlatList
          data={cards}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Swipeable
              renderRightActions={() => (
                <Pressable style={styles.deleteAction} onPress={() => confirmDelete(item)}>
                  <Text style={styles.deleteActionText}>Delete</Text>
                </Pressable>
              )}
            >
              <Pressable style={styles.card} onPress={() => router.push(`/edit-card/${item.id}`)}>
                <View style={styles.cardTextGroup}>
                  <Text style={styles.cardName}>{item.name}</Text>
                  <Text style={styles.cardDetails}>
                    ${item.balance.toLocaleString()} &middot; {item.apr}% APR
                  </Text>
                </View>
                <Text style={styles.chevron}>&rsaquo;</Text>
              </Pressable>
            </Swipeable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 24, fontWeight: '600' },
  addButton: { fontSize: 28, fontWeight: '400' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#888', fontSize: 15, textAlign: 'center' },
  card: {
  backgroundColor: '#f5f5f5',
  borderRadius: 12,
  padding: 14,
  marginBottom: 10,
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},
cardTextGroup: { flex: 1 },
chevron: { fontSize: 22, color: '#bbb', marginLeft: 8 },
  cardName: { fontSize: 16, fontWeight: '500', marginBottom: 4 },
  cardDetails: { fontSize: 13, color: '#666' },
  deleteAction: {
    backgroundColor: '#d33',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 12,
    marginBottom: 10,
  },
  deleteActionText: { color: '#fff', fontWeight: '500', fontSize: 14 },
});