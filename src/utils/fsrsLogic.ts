import { fsrs, type Card, State, type FSRSParameters, createEmptyCard } from 'ts-fsrs';

// Custom parameters for FSRS for Quran Hifdh
export const quranFsrsParams: Partial<FSRSParameters> = {
  maximum_interval: 365,
  request_retention: 0.9,
};

// Initialize an FSRS instance with the custom params
export const quranFsrs = fsrs(quranFsrsParams);

/**
 * Creates an FSRS baseline card with differing starting states to handle content
 * that the user already knows (Previously Memorized), rather than treating them
 * as completely brand-new material.
 */
export function createBaselineFSRSCard(strength: 'weak' | 'normal' | 'solid'): Card {
  const card = createEmptyCard();
  const now = new Date();

  if (strength === 'weak') {
    // Return standard empty card
    return card;
  }

  if (strength === 'normal') {
    card.state = State.Review;
    card.stability = 7;
    card.difficulty = 4;
    card.reps = 1;
    // Set due to 7 days from now
    card.due = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return card;
  }

  if (strength === 'solid') {
    card.state = State.Review;
    card.stability = 14;
    card.difficulty = 3;
    card.reps = 1;
    // Set due to 14 days from now
    card.due = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    return card;
  }

  return card;
}
