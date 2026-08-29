import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Alert } from 'react-native';
import { router } from 'expo-router';
import { addCard } from '@/lib/storage';

export default function AddCardScreen() {
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [apr, setApr] = useState('');
  const [minPayment, setMinPayment] = useState('');

  async function handleSave() {
    // Basic validation - make sure required fields aren't empty/invalid
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

    await addCard({
      name: name.trim(),
      balance: balanceNum,
      apr: aprNum,
      minPayment: minPaymentNum,
    });

    router.back(); // return to the Cards list
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Card name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Chase Sapphire"
      />

      <Text style={styles.label}>Balance ($)</Text>
      <TextInput
        style={styles.input}
        value={balance}
        onChangeText={setBalance}
        placeholder="4200"
        keyboardType="decimal-pad"
      />

      <Text style={styles.label}>APR (%)</Text>
      <TextInput
        style={styles.input}
        value={apr}
        onChangeText={setApr}
        placeholder="24.9"
        keyboardType="decimal-pad"
      />

      <Text style={styles.label}>Minimum payment ($)</Text>
      <TextInput
        style={styles.input}
        value={minPayment}
        onChangeText={setMinPayment}
        placeholder="85"
        keyboardType="decimal-pad"
      />

      <Pressable style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Save card</Text>
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
});