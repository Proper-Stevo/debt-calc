import AsyncStorage from '@react-native-async-storage/async-storage';
import { Card, NewCard } from '@/types/card';

// The "label" we use to store our cards list in the phone's storage.
const CARDS_KEY = 'cards';

// Load all saved cards. Returns an empty array if none exist yet.
export async function getCards(): Promise<Card[]> {
  const json = await AsyncStorage.getItem(CARDS_KEY);
  if (!json) return [];
  return JSON.parse(json);
}

// Remove every saved card (used when starting over as a new user).
export async function clearCards(): Promise<void> {
  await AsyncStorage.removeItem(CARDS_KEY);
}

// Whether the user has already dismissed the Plan tab's one-time intro card.
const PLAN_INTRO_KEY = 'seen_plan_intro';

export async function hasSeenPlanIntro(): Promise<boolean> {
  const seen = await AsyncStorage.getItem(PLAN_INTRO_KEY);
  return seen === 'true';
}

export async function markPlanIntroSeen(): Promise<void> {
  await AsyncStorage.setItem(PLAN_INTRO_KEY, 'true');
}

export async function clearPlanIntroFlag(): Promise<void> {
  await AsyncStorage.removeItem(PLAN_INTRO_KEY);
}

// Load a single card by id. Returns null if not found.
export async function getCard(id: string): Promise<Card | null> {
  const cards = await getCards();
  return cards.find((c) => c.id === id) ?? null;
}

// Save the entire cards list, overwriting whatever was there before.
async function saveCards(cards: Card[]): Promise<void> {
  await AsyncStorage.setItem(CARDS_KEY, JSON.stringify(cards));
}

// Add a new card. We generate a unique id for it here.
export async function addCard(newCard: NewCard): Promise<Card> {
  const cards = await getCards();
  const card: Card = {
    ...newCard,
    id: Date.now().toString(), // simple unique id based on current timestamp
  };
  await saveCards([...cards, card]);
  return card;
}

// Update an existing card by id.
export async function updateCard(updated: Card): Promise<void> {
  const cards = await getCards();
  const next = cards.map((c) => (c.id === updated.id ? updated : c));
  await saveCards(next);
}

// Delete a card by id.
export async function deleteCard(id: string): Promise<void> {
  const cards = await getCards();
  const next = cards.filter((c) => c.id !== id);
  await saveCards(next);
}