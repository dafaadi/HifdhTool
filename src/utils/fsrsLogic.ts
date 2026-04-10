import { fsrs, type Card, State, type FSRSParameters, createEmptyCard, Rating, type ReviewLog } from 'ts-fsrs';
import type { Schedule, ScheduleUnit, RevisionUnitData } from '../types';

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

/**
 * Calculates a parent RevisionUnit (RU) card by aggregating its child ScheduleUnits (SUs).
 * Uses a discounted mean for Stability and a stamina penalty for Difficulty.
 */
export function calculateMacroRUCard(scheduleList: ScheduleUnit[]): Card {
  const activeSUs = scheduleList.filter(su => !su.isDeleted);
  
  if (activeSUs.length === 0) {
    return createEmptyCard();
  }

  let totalStability = 0;
  let totalDifficulty = 0;
  let totalReps = 0;

  activeSUs.forEach(su => {
    totalStability += su.fsrsCard.stability;
    totalDifficulty += su.fsrsCard.difficulty;
    totalReps += su.fsrsCard.reps;
  });

  const avgStability = totalStability / activeSUs.length;
  const avgDifficulty = totalDifficulty / activeSUs.length;
  const avgReps = Math.round(totalReps / activeSUs.length);

  // 1. Calculate the average stability, then apply a 25% discount penalty
  const macroStability = avgStability * 0.75;
  
  // 2. Calculate the average difficulty, then apply a 20% stamina penalty (capped at 10)
  const macroDifficulty = Math.min(avgDifficulty * 1.2, 10);

  const ruCard = createEmptyCard();
  ruCard.stability = macroStability;
  ruCard.difficulty = macroDifficulty;
  ruCard.reps = avgReps;
  ruCard.state = State.Review; // Force into review state assuming children have been reviewed

  // Calculate new due date strictly based on the newly calculated stability
  // (Using stability directly as the interval in days)
  const intervalDays = Math.max(1, Math.round(macroStability));
  const now = new Date();
  ruCard.due = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);

  return ruCard;
}

/**
 * Robust state-update handler for grading a ScheduleUnit.
 * Modifies the specific SU, and conditionally updates its parent RU if it is a Macro Routine.
 */
export function handleGradeScheduleUnit(
  schedules: Schedule[],
  scheduleId: string,
  ruId: string,
  suId: string,
  rating: Rating,
  options: { isMacroRoutine: boolean }
): Schedule[] {
  return schedules.map(schedule => {
    if (schedule.id !== scheduleId) return schedule;

    const newRevisionList = schedule.revisionList.map(ru => {
      if (ru.id !== ruId) return ru;

      let suWasUpdated = false;
      
      // Update the specific child SU
      const newScheduleList = ru.scheduleList.map(su => {
        if (su.id !== suId) return su;

        suWasUpdated = true;
        const now = new Date();
        
        // Pass current fsrsCard and the user's rating into the ts-fsrs engine
        const schedulingRecords = quranFsrs.repeat(su.fsrsCard, now);
        const recordLog = (schedulingRecords as any)[rating];
        
        return {
          ...su,
          fsrsCard: recordLog.card,
          reviewLogs: [...su.reviewLogs, recordLog.log]
        };
      });

      if (!suWasUpdated) return ru;

      // 3. Conditional Parent Trigger (Live Umbrella Date)
      if (options.isMacroRoutine) {
        // Instantly recalculate the parent RU's projected future review date
        const macroCard = calculateMacroRUCard(newScheduleList);
        return {
          ...ru,
          scheduleList: newScheduleList,
          fsrsCard: macroCard
        };
      }

      // If FALSE: Do nothing else, save state.
      return {
        ...ru,
        scheduleList: newScheduleList
      };
    });

    return {
      ...schedule,
      revisionList: newRevisionList
    };
  });
}
