import { Card } from '@/types/card';

export type Strategy = 'avalanche' | 'snowball';

export interface PayoffOrderEntry {
  cardId: string;
  cardName: string;
  originalBalance: number;
  apr: number;
  payoffMonth: number;
  interestPaid: number;
}

export interface PayoffResult {
  strategy: Strategy;
  monthsToPayoff: number;
  totalInterestPaid: number;
  payoffOrder: PayoffOrderEntry[];
}

// Picks which card gets the "extra" payment this round, based on strategy.
// Avalanche = highest APR first. Snowball = smallest balance first.
function pickTarget(cards: Card[], strategy: Strategy): Card {
  if (strategy === 'avalanche') {
    return cards.reduce((worst, c) => (c.apr > worst.apr ? c : worst), cards[0]);
  }
  return cards.reduce((smallest, c) => (c.balance < smallest.balance ? c : smallest), cards[0]);
}

// Simulates paying off all cards month-by-month using the given strategy.
// extraPayment = money beyond the sum of all minimum payments, put toward the target card each month.
export function calculatePayoff(
  initialCards: Card[],
  strategy: Strategy,
  extraPayment: number
): PayoffResult {
  // Work on a copy so we don't mutate the real card data.
  let remaining = initialCards.map((c) => ({ ...c }));
  let month = 0;
  let totalInterestPaid = 0;
  let extraPool = extraPayment; // grows as cards get paid off and their minimums roll over
  const payoffOrder: PayoffOrderEntry[] = [];

  // Track how much interest each individual card has accrued, and remember its
  // original balance/APR before we start mutating balances.
  const interestPaidByCard = new Map<string, number>();
  const originalInfo = new Map<string, { balance: number; apr: number; name: string }>();
  initialCards.forEach((c) => {
    interestPaidByCard.set(c.id, 0);
    originalInfo.set(c.id, { balance: c.balance, apr: c.apr, name: c.name });
  });

  // Safety cap - prevents an infinite loop if payments can't cover interest.
  const MAX_MONTHS = 600; // 50 years

  while (remaining.length > 0 && month < MAX_MONTHS) {
    month++;

    // Step 1: accrue this month's interest on every card.
    remaining.forEach((c) => {
      const monthlyInterest = (c.apr / 100 / 12) * c.balance;
      c.balance += monthlyInterest;
      totalInterestPaid += monthlyInterest;
      interestPaidByCard.set(c.id, (interestPaidByCard.get(c.id) ?? 0) + monthlyInterest);
    });

    // Step 2: pay minimums on every card.
    remaining.forEach((c) => {
      const payment = Math.min(c.minPayment, c.balance);
      c.balance -= payment;
    });

    // Step 3: dump the extra pool onto the target card.
    if (remaining.length > 0) {
      const target = pickTarget(remaining, strategy);
      const payment = Math.min(extraPool, target.balance);
      target.balance -= payment;
    }

    // Step 4: remove any cards that hit zero, and roll their minimum into the extra pool.
    const stillOwing: typeof remaining = [];
    remaining.forEach((c) => {
      if (c.balance <= 0.01) {
        const info = originalInfo.get(c.id)!;
        payoffOrder.push({
          cardId: c.id,
          cardName: info.name,
          originalBalance: info.balance,
          apr: info.apr,
          payoffMonth: month,
          interestPaid: Math.round(interestPaidByCard.get(c.id) ?? 0),
        });
        extraPool += c.minPayment; // freed-up payment now snowballs onto the next card
      } else {
        stillOwing.push(c);
      }
    });
    remaining = stillOwing;
  }

  return {
    strategy,
    monthsToPayoff: month,
    totalInterestPaid: Math.round(totalInterestPaid),
    payoffOrder,
  };
}