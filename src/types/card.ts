// A single credit card the user is tracking.
export interface Card {
  id: string;              // unique identifier we generate when the card is created
  name: string;            // e.g. "Chase Sapphire"
  balance: number;         // current amount owed, in dollars (e.g. 4200.50)
  apr: number;              // annual interest rate as a percentage (e.g. 24.9 means 24.9%)
  minPayment: number;      // minimum monthly payment required, in dollars
  dueDate?: number;        // optional: day of the month payment is due (1-31)
  closingDate?: number;    // optional: day of the month the billing cycle closes (1-31) -
                           // this is the balance that gets reported to credit bureaus
  creditLimit?: number;    // optional: total credit limit, needed to calculate utilization
}

// What the user provides when adding a new card (no id yet - we generate that).
export type NewCard = Omit<Card, 'id'>;