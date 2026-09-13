import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Alert, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { addCard, getCards } from '@/lib/storage';
import { useTheme } from '@/lib/theme';

export default function AddCardScreen() {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [apr, setApr] = useState('');
  const [minPayment, setMinPayment] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [closingDate, setClosingDate] = useState('');
  const [creditLimit, setCreditLimit] = useState('');

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

    const existingCards = await getCards();
    const isFirstCard = existingCards.length === 0;

    await addCard({
      name: name.trim(),
      balance: balanceNum,
      apr: aprNum,
      minPayment: minPaymentNum,
      dueDate: dueDateNum,
      closingDate: closingDateNum,
      creditLimit: creditLimitNum,
    });

    if (isFirstCard) {
      Alert.alert(
        'Card added!',
        'Head to the Plan tab to see how you can pay it off.',
        [{ text: 'Got it', onPress: () => router.back() }]
      );
    } else {
      router.back();
    }
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>Card name</Text>
      <TextInput
        style={[styles.input, { borderColor: theme.border, backgroundColor: theme.cardInnerBackground, color: theme.textPrimary }]}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Chase Sapphire"
        placeholderTextColor={theme.textFaint}
      />

      <Text style={[styles.label, { color: theme.textSecondary }]}>Balance ($)</Text>
      <TextInput
        style={[styles.input, { borderColor: theme.border, backgroundColor: theme.cardInnerBackground, color: theme.textPrimary }]}
        value={balance}
        onChangeText={setBalance}
        placeholder="4200"
        placeholderTextColor={theme.textFaint}
        keyboardType="decimal-pad"
      />

      <Text style={[styles.label, { color: theme.textSecondary }]}>APR (%)</Text>
      <TextInput
        style={[styles.input, { borderColor: theme.border, backgroundColor: theme.cardInnerBackground, color: theme.textPrimary }]}
        value={apr}
        onChangeText={setApr}
        placeholder="24.9"
        placeholderTextColor={theme.textFaint}
        keyboardType="decimal-pad"
      />

      <Text style={[styles.label, { color: theme.textSecondary }]}>Minimum payment ($)</Text>
      <TextInput
        style={[styles.input, { borderColor: theme.border, backgroundColor: theme.cardInnerBackground, color: theme.textPrimary }]}
        value={minPayment}
        onChangeText={setMinPayment}
        placeholder="85"
        placeholderTextColor={theme.textFaint}
        keyboardType="decimal-pad"
      />

      <Text style={[styles.sectionLabel, { color: theme.textPrimary }]}>Optional details</Text>

      <Text style={[styles.label, { color: theme.textSecondary }]}>Credit limit ($)</Text>
      <TextInput
        style={[styles.input, { borderColor: theme.border, backgroundColor: theme.cardInnerBackground, color: theme.textPrimary }]}
        value={creditLimit}
        onChangeText={setCreditLimit}
        placeholder="10000"
        placeholderTextColor={theme.textFaint}
        keyboardType="decimal-pad"
      />

      <Text style={[styles.label, { color: theme.textSecondary }]}>Due date (day of month, 1-31)</Text>
      <TextInput
        style={[styles.input, { borderColor: theme.border, backgroundColor: theme.cardInnerBackground, color: theme.textPrimary }]}
        value={dueDate}
        onChangeText={setDueDate}
        placeholder="15"
        placeholderTextColor={theme.textFaint}
        keyboardType="number-pad"
      />

      <Text style={[styles.label, { color: theme.textSecondary }]}>Statement closing date (day of month, 1-31)</Text>
      <Text style={[styles.hint, { color: theme.textMuted }]}>
        The day your billing cycle ends - this is the balance reported to credit bureaus.
      </Text>
      <TextInput
        style={[styles.input, { borderColor: theme.border, backgroundColor: theme.cardInnerBackground, color: theme.textPrimary }]}
        value={closingDate}
        onChangeText={setClosingDate}
        placeholder="20"
        placeholderTextColor={theme.textFaint}
        keyboardType="number-pad"
      />

      <Pressable style={[styles.saveButton, { backgroundColor: theme.accent }]} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Save card</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  label: { fontSize: 13, marginBottom: 4, marginTop: 12 },
  hint: { fontSize: 12, marginBottom: 6 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
  },
  saveButton: {
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '500' },
});