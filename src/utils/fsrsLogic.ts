import { fsrs, type Card, State, type FSRSParameters, createEmptyCard, Rating } from 'ts-fsrs';
import type { Schedule, ScheduleUnit, QuranMetadata, ScriptStyle } from '../types/index';
import { calculateMacroRUCard, actualizeMacroRoutine } from './memorizationEngine.v2';
import { SURAH_NAMES } from './constants';

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
export function createBaselineFSRSCard(strength: 'weak' | 'normal' | 'solid', baseDate: Date = new Date()): Card {
  const card = createEmptyCard(baseDate);
  const now = baseDate;

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

export interface GradeResult {
  schedules: Schedule[];
  actualization?: {
    ruLabel: string;
    newMacroDueDate: string;
  };
}

/**
 * Robust state-update handler for grading a ScheduleUnit.
 * Modifies the specific SU, and conditionally updates its parent RU if it is a Macro Routine.
 * Returns both the updated schedules and any actualization event data.
 */
export function handleGradeScheduleUnit(
  schedules: Schedule[],
  scheduleId: string,
  ruId: string,
  suId: string,
  rating: Rating,
  metadata: QuranMetadata,
  scriptStyle: ScriptStyle,
  now: Date = new Date(),
  wasFailedToday: boolean = false,
  startingCard?: Card
): GradeResult {
  let actualizationEvent: GradeResult['actualization'];

  const updatedSchedules = schedules.map(schedule => {
    if (schedule.id !== scheduleId) return schedule;

    const newRevisionList = schedule.revisionList.map(ru => {
      if (ru.id !== ruId) return ru;

      let suWasUpdated = false;
      let wasMacroTask = false;
      
      // 1. Update the specific child SU and capture its generational state
      const newScheduleList = ru.scheduleList.map(su => {
        if (su.id !== suId) return su;

        suWasUpdated = true;
        wasMacroTask = su.isMacroRoutine;

        // ALWAYS compute the next FSRS state — we must persist the graded card
        // regardless of rating, so the today-shell is never stale.
        // We use the startingCard override (from memory-only Again failures) if provided.
        const cardToGrade = startingCard ?? su.fsrsCard;
        const schedulingRecords = quranFsrs.repeat(cardToGrade, now);
        const recordLog = (schedulingRecords as any)[rating];
        const nextDueDate = recordLog.card.due;

        // BASE: always persist the updated card + log
        // We inject the current Macro status into the log as historical metadata
        const updatedSU = {
          ...su,
          fsrsCard: recordLog.card,
          reviewLogs: [...su.reviewLogs, { ...recordLog.log, wasMacroRoutine: su.isMacroRoutine } as any],
        };

        // --- FSRS Weakness Filter Path ---
        // THE BOUNCER: archive if the next due date would exceed the Event Horizon
        const hitLimit = su.dueDateLimit && nextDueDate >= new Date(su.dueDateLimit);

        // THE WEAKNESS FILTER REFINED:
        // Only spawn and save a future Micro-Review IF the final rating was 2 ("Hard") 
        // OR if the task was failed earlier today (marked as Again in session queue).
        const isStruggling = rating === Rating.Hard || wasFailedToday;

        if (hitLimit || !isStruggling) {
          // Archive from future scheduling; current graded state is still saved above.
          return { ...updatedSU, isDeleted: true };
        }

        // Struggling path: tag so a future micro-review slot is spawned
        return { ...updatedSU, isMacroRoutine: false };
      });

      if (!suWasUpdated) return ru;

      // STEP 2: TRIGGER ACTUALIZATION (THE SWEEP)
      if (wasMacroTask) {
        const latestTime = Math.max(...newScheduleList.map(s => new Date(s.fsrsCard.due).getTime()));
        const anchorDate = new Date(latestTime);
        const macroCard = calculateMacroRUCard(newScheduleList, anchorDate);

        // A Macro pass is considered complete when all active macro tasks have at least one review log.
        const isMacroCompleted = !newScheduleList.some(s => s.isMacroRoutine && !s.isDeleted && s.reviewLogs.length === 0);

        if (isMacroCompleted) {
          const updatedRU = {
            ...ru,
            scheduleList: newScheduleList,
            fsrsCard: macroCard
          };
          const actualizedRU = actualizeMacroRoutine(updatedRU, metadata, scriptStyle);
          
          actualizationEvent = {
            ruLabel: `${ru.unitValue}. ${metadata.madani.surah[String(ru.unitValue)] ? '' : ''}`, // Will refine label below
            newMacroDueDate: macroCard.due.toISOString()
          };
          
          // Refine label if it's Surah
          if (ru.unitType === 'Surah') {
            actualizationEvent.ruLabel = `${ru.unitValue}. ${SURAH_NAMES[Number(ru.unitValue) - 1]}`;
          } else {
            actualizationEvent.ruLabel = `${ru.unitType} ${ru.unitValue}`;
          }

          return actualizedRU;
        } else {
          return {
            ...ru,
            scheduleList: newScheduleList,
            fsrsCard: macroCard
          };
        }
      }

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

  return {
    schedules: updatedSchedules,
    actualization: actualizationEvent
  };
}

