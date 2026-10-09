import AsyncStorage from '@react-native-async-storage/async-storage';
import { Card } from '@/types/card';
import { getCards } from '@/lib/storage';

// ---------- Types ----------

export type PayFrequency = 'weekly' | 'biweekly' | 'monthly';

// One line the user types in themselves, e.g. { name: 'Phone bill', amount: 45 }.
export type LineItem = { id: string; name: string; amount: number };

// Everything the user entered for ONE calendar month.
export type MonthRecord = {
  month: string; // 'YYYY-MM'
  paycheck: number; // take-home pay per paycheck
  frequency: PayFrequency;
  fixed: LineItem[]; // money that's already spoken for
  flexible: LineItem[]; // everyday spending
  // Total of the user's card minimum payments for this month. Pulled from the
  // Cards tab automatically so the user never has to type it in. Optional so
  // months saved before this existed still load.
  minimums?: number;
};

// ---------- Month helpers ----------

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function monthKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${date.getFullYear()}-${m}`;
}

// Move a 'YYYY-MM' key forward or backward by whole months.
export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

// ---------- The math ----------

// Weekly and every-two-weeks paychecks don't land on a neat 4 / 2 per month,
// so we use the yearly average (52 weeks or 26 pay periods, divided by 12).
const PAYCHECKS_PER_MONTH: Record<PayFrequency, number> = {
  weekly: 52 / 12,
  biweekly: 26 / 12,
  monthly: 1,
};

export const FREQUENCY_LABELS: Record<PayFrequency, string> = {
  weekly: 'Every week',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
};

export function monthlyIncome(rec: MonthRecord): number {
  return rec.paycheck * PAYCHECKS_PER_MONTH[rec.frequency];
}

export function sumItems(items: LineItem[]): number {
  return items.reduce((sum, i) => sum + i.amount, 0);
}

// Sum of every card's minimum payment. These are owed no matter what, so they
// come off the top before anything is "left over" for extra payments.
export function totalMinimums(cards: Card[]): number {
  return cards.reduce((sum, c) => sum + (c.minPayment || 0), 0);
}

// Income, minus card minimums, minus bills, minus everyday spending.
export function leftoverFor(rec: MonthRecord): number {
  return monthlyIncome(rec) - (rec.minimums ?? 0) - sumItems(rec.fixed) - sumItems(rec.flexible);
}

export function emptyRecord(month: string): MonthRecord {
  return { month, paycheck: 0, frequency: 'biweekly', fixed: [], flexible: [] };
}

function isEmpty(rec: MonthRecord): boolean {
  return rec.paycheck === 0 && rec.fixed.length === 0 && rec.flexible.length === 0;
}

// ---------- Storage ----------
// Same pattern as storage.ts: one JSON blob in AsyncStorage. Here it's a map
// of 'YYYY-MM' -> that month's record, so months never overwrite each other.

const FINANCE_KEY = 'finance_months';
const FINANCE_INTRO_KEY = 'seen_finance_intro';

export async function getFinanceMonths(): Promise<Record<string, MonthRecord>> {
  const json = await AsyncStorage.getItem(FINANCE_KEY);
  return json ? JSON.parse(json) : {};
}

// Save one month. A month with nothing in it is removed instead, so just
// browsing to a month doesn't leave empty entries in the history.
export async function saveMonth(rec: MonthRecord): Promise<void> {
  const all = await getFinanceMonths();
  if (isEmpty(rec)) {
    delete all[rec.month];
  } else {
    all[rec.month] = rec;
  }
  await AsyncStorage.setItem(FINANCE_KEY, JSON.stringify(all));
}

// The leftover for the current calendar month, or null if the user hasn't
// entered a paycheck for it. The Plan tab uses this for its dial. Card
// minimums are read fresh from the Cards tab so edits there show up right away.
export async function getCurrentLeftover(): Promise<number | null> {
  const all = await getFinanceMonths();
  const rec = all[monthKey(new Date())];
  if (!rec || rec.paycheck <= 0) return null;
  const cards = await getCards();
  return leftoverFor({ ...rec, minimums: totalMinimums(cards) });
}

export async function clearFinance(): Promise<void> {
  await AsyncStorage.removeItem(FINANCE_KEY);
  await AsyncStorage.removeItem(FINANCE_INTRO_KEY);
}

export async function hasSeenFinanceIntro(): Promise<boolean> {
  return (await AsyncStorage.getItem(FINANCE_INTRO_KEY)) === 'true';
}

export async function markFinanceIntroSeen(): Promise<void> {
  await AsyncStorage.setItem(FINANCE_INTRO_KEY, 'true');
}