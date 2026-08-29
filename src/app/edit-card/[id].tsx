import { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Alert, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { getCard, updateCard, deleteCard } from '@/lib/storage';

export default function EditCardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [apr, setApr] = useState('');
  const [minPayment, setMinPayment] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [closingDate, setClosingDate] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCard(id).then((card) => {
      if (card) {
        setName(card.name);
        setBalance(card.balance.toString());
        setApr(card.apr.toString());
        setMinPayment(card.minPayment.toString());
        setDueDate(card.dueDate?.toString() ?? '');
        setClosingDate(card.closingDate?.toString() ?? '');
        setCreditLimit(card.creditLimit?.toString() ?? '');
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

    const dueDateNum = dueDate.trim() ? parseInt(dueDate, 10) : undefined;
    const closingDateNum = closingDate.trim() ? parseInt(closingDate, 10) : undefined;
    const creditLimitNum = creditLimit.trim() ? parseFloat(creditLimit) : undefined;

    if (dueDateNum !== undefined && (isNaN(dueDateNum) || dueDateNum < 1 || dueDateNum > 31)) {
      Alert.alert('Invalid due date', 'Please enter a day between 1 and 31.');
      return;
    }
    if (closingDateNum !== undefined && (isNaN(closingDateNum) || closingDateNum < 1 || closingDateNum > 31)) {
      Alert.alert('Invalid closing date', 'Please enter a day between 1 and 31.');
      return;
    }
    if (creditLimitNum !== undefined && isNaN(creditLimitNum)) {
      Alert.alert('Invalid credit limit', 'Please enter a valid number.');
      return;
    }

    await updateCard({
      id,
      name: name.trim(),
      balance: balanceNum,
      apr: aprNum,
      minPayment: minPaymentNum,
      dueDate: dueDateNum,
      closingDate: closingDateNum,
      creditLimit: creditLimitNum,
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

  if (loading) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Card name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} />

      <Text style={styles.label}>Balance ($)</Text>
      <TextInput style={styles.input} value={balance} onChangeText={setBalance} keyboardType="decimal-pad" />

      <Text style={styles.label}>APR (%)</Text>
      <TextInput style={styles.input} value={apr} onChangeText={setApr} keyboardType="decimal-pad" />

      <Text style={styles.label}>Minimum payment ($)</Text>
      <TextInput style={styles.input} value={minPayment} onChangeText={setMinPayment} keyboardType="decimal-pad" />

      <Text style={styles.sectionLabel}>Optional details</Text>

      <Text style={styles.label}>Credit limit ($)</Text>
      <TextInput style={styles.input} value={creditLimit} onChangeText={setCreditLimit} keyboardType="decimal-pad" />

      <Text style={styles.label}>Due date (day of month, 1-31)</Text>
      <TextInput style={styles.input} value={dueDate} onChangeText={setDueDate} keyboardType="number-pad" />

      <Text style={styles.label}>Statement closing date (day of month, 1-31)</Text>
      <Text style={styles.hint}>
        The day your billing cycle ends - this is the balance reported to credit bureaus.
      </Text>
      <TextInput style={styles.input} value={closingDate} onChangeText={setClosingDate} keyboardType="number-pad" />

      <Pressable style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Save changes</Text>
      </Pressable>

      <Pressable style={styles.deleteButton} onPress={handleDelete}>
        <Text style={styles.deleteButtonText}>Delete card</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  label: { fontSize: 13, color: '#666', marginBottom: 4, marginTop: 12 },
  hint: { fontSize: 12, color: '#999', marginBottom: 6 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginTop: 24,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
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