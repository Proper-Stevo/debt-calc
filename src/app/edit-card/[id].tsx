import { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { getCard, updateCard, deleteCard } from '@/lib/storage';

export default function EditCardScreen() {
  // useLocalSearchParams reads the dynamic part of the URL - in this case, the card's id.
  const { id } = useLocalSearchParams<{ id: string }>();

  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [apr, setApr] = useState('');
  const [minPayment, setMinPayment] = useState('');
  const [loading, setLoading] = useState(true);

  // On mount, load the existing card's data and pre-fill the form.
  useEffect(() => {
    getCard(id).then((card) => {
      if (card) {
        setName(card.name);
        setBalance(card.balance.toString());
        setApr(card.apr.toString());
        setMinPayment(card.minPayment.toString());
      }
      setLoading(false);
    });
  }, [id]);

  async function handleSave() {
    const balanceNum = parseFloat(balance);
    const aprNum = parseFloat(apr);
    const minPaymentNum = parseFloat(minPayment);

    if (!name.trim()) {
      Alert.alert('Missing name', 'Please enter a card name.');
      return;
    }
    if (isNaN(balanceNum) || isNaN(aprNum) || isNaN(minPaymentNum)) {
      Alert.alert('Invalid numbers', 'Please enter valid numbers for balance, APR, and minimum payment.');
      return;
    }

    await updateCard({
      id,
      name: name.trim(),
      balance: balanceNum,
      apr: aprNum,
      minPayment: minPaymentNum,
    });

    router.back();
  }

  function handleDelete() {
    Alert.alert('Delete card', `Are you sure you want to delete ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteCard(id);
          router.back();
        },
      },
    ]);
  }

  if (loading) return null; // brief flash while data loads - fine for now

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Card name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} />

      <Text style={styles.label}>Balance ($)</Text>
      <TextInput style={styles.input} value={balance} onChangeText={setBalance} keyboardType="decimal-pad" />

      <Text style={styles.label}>APR (%)</Text>
      <TextInput style={styles.input} value={apr} onChangeText={setApr} keyboardType="decimal-pad" />

      <Text style={styles.label}>Minimum payment ($)</Text>
      <TextInput style={styles.input} value={minPayment} onChangeText={setMinPayment} keyboardType="decimal-pad" />

      <Pressable style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Save changes</Text>
      </Pressable>

      <Pressable style={styles.deleteButton} onPress={handleDelete}>
        <Text style={styles.deleteButtonText}>Delete card</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  label: { fontSize: 13, color: '#666', marginBottom: 4, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: '#111',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '500' },
  deleteButton: {
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  deleteButtonText: { color: '#d33', fontSize: 16, fontWeight: '500' },
});