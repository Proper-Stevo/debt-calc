import { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Alert, Platform, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { getCard, updateCard, deleteCard } from '@/lib/storage';
import { useTheme } from '@/lib/theme';

export default function EditCardScreen() {
  const theme = useTheme();
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

  async function handleDelete() {
    // react-native-web's Alert.alert doesn't support multi-button dialogs -
    // it falls back to a plain window.alert() and silently drops the
    // Cancel/Delete buttons and their onPress callbacks. Use the browser's
    // real confirm() on web instead, which returns a boolean we can act on.
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`Are you sure you want to delete ${name}?`);
      if (confirmed) {
        await deleteCard(id);
        router.back();
      }
      return;
    }

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
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>Card name</Text>
      <TextInput
        style={[styles.input, { borderColor: theme.border, backgroundColor: theme.cardInnerBackground, color: theme.textPrimary }]}
        value={name}
        onChangeText={setName}
        placeholderTextColor={theme.textFaint}
      />

      <Text style={[styles.label, { color: theme.textSecondary }]}>Balance ($)</Text>
      <TextInput
        style={[styles.input, { borderColor: theme.border, backgroundColor: theme.cardInnerBackground, color: theme.textPrimary }]}
        value={balance}
        onChangeText={setBalance}
        keyboardType="decimal-pad"
        placeholderTextColor={theme.textFaint}
      />

      <Text style={[styles.label, { color: theme.textSecondary }]}>APR (%)</Text>
      <TextInput
        style={[styles.input, { borderColor: theme.border, backgroundColor: theme.cardInnerBackground, color: theme.textPrimary }]}
        value={apr}
        onChangeText={setApr}
        keyboardType="decimal-pad"
        placeholderTextColor={theme.textFaint}
      />

      <Text style={[styles.label, { color: theme.textSecondary }]}>Minimum payment ($)</Text>
      <TextInput
        style={[styles.input, { borderColor: theme.border, backgroundColor: theme.cardInnerBackground, color: theme.textPrimary }]}
        value={minPayment}
        onChangeText={setMinPayment}
        keyboardType="decimal-pad"
        placeholderTextColor={theme.textFaint}
      />

      <Text style={[styles.sectionLabel, { color: theme.textPrimary }]}>Optional details</Text>

      <Text style={[styles.label, { color: theme.textSecondary }]}>Credit limit ($)</Text>
      <TextInput
        style={[styles.input, { borderColor: theme.border, backgroundColor: theme.cardInnerBackground, color: theme.textPrimary }]}
        value={creditLimit}
        onChangeText={setCreditLimit}
        keyboardType="decimal-pad"
        placeholderTextColor={theme.textFaint}
      />

      <Text style={[styles.label, { color: theme.textSecondary }]}>Due date (day of month, 1-31)</Text>
      <TextInput
        style={[styles.input, { borderColor: theme.border, backgroundColor: theme.cardInnerBackground, color: theme.textPrimary }]}
        value={dueDate}
        onChangeText={setDueDate}
        keyboardType="number-pad"
        placeholderTextColor={theme.textFaint}
      />

      <Text style={[styles.label, { color: theme.textSecondary }]}>Statement closing date (day of month, 1-31)</Text>
      <Text style={[styles.hint, { color: theme.textMuted }]}>
        The day your billing cycle ends - this is the balance reported to credit bureaus.
      </Text>
      <TextInput
        style={[styles.input, { borderColor: theme.border, backgroundColor: theme.cardInnerBackground, color: theme.textPrimary }]}
        value={closingDate}
        onChangeText={setClosingDate}
        keyboardType="number-pad"
        placeholderTextColor={theme.textFaint}
      />

      <Pressable style={[styles.saveButton, { backgroundColor: theme.accent }]} onPress={handleSave}>
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
  deleteButton: {
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  deleteButtonText: { color: '#d33', fontSize: 16, fontWeight: '500' },
});