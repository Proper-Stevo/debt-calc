import { Card } from '@/types/card';

export type UtilizationTier = 'excellent' | 'good' | 'high' | 'unknown';

// A card's utilization ratio as a percentage (0-100+). Returns null if we
// don't have a credit limit to calculate it against.
export function utilizationPercent(card: Card): number | null {
  if (!card.creditLimit || card.creditLimit <= 0) return null;
  return (card.balance / card.creditLimit) * 100;
}

// Tiers based on well-established guidance: under 10% is excellent, under
// 30% is generally "good" and won't hurt your score, above 30% starts to
// drag on it.
export function utilizationTier(percent: number | null): UtilizationTier {
  if (percent === null) return 'unknown';
  if (percent < 10) return 'excellent';
  if (percent < 30) return 'good';
  return 'high';
}

// How much would need to be paid on this card to bring its balance down to
// a given target percentage of its limit. Returns null if we don't have a
// credit limit to calculate against, or 0 if already at/below the target.
export function amountToReachUtilization(card: Card, targetPercent: number): number | null {
  if (!card.creditLimit || card.creditLimit <= 0) return null;
  const targetBalance = card.creditLimit * (targetPercent / 100);
  return Math.max(0, Math.round(card.balance - targetBalance));
}

// Given a day-of-month (1-31), find how many days from today until that day
// next occurs - today counts as 0, and if the date has already passed this
// month, it rolls to next month.
export function daysUntil(dayOfMonth: number): number {
  return Math.round((nextOccurrence(dayOfMonth).getTime() - todayMidnight().getTime()) / (1000 * 60 * 60 * 24));
}

// The actual calendar date of the next occurrence of a day-of-month.
export function nextOccurrence(dayOfMonth: number): Date {
  const today = todayMidnight();
  let target = new Date(today.getFullYear(), today.getMonth(), dayOfMonth);
  if (target < today) {
    target = new Date(today.getFullYear(), today.getMonth() + 1, dayOfMonth);
  }
  return target;
}

// Readable label for that date, e.g. "Mar 20".
export function nextOccurrenceLabel(dayOfMonth: number): string {
  const date = nextOccurrence(dayOfMonth);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

function todayMidnight(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}