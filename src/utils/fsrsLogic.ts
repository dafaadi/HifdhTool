import { fsrs, type Card, State, type FSRSParameters, createEmptyCard, Rating } from 'ts-fsrs';
import type { Schedule, ScheduleUnit, RevisionUnitData, QuranMetadata, ScriptStyle, Interval } from '../types/index';
import { calculateMacroRUCard, actualizeMacroRoutine, getRuLabel } from './memorizationEngine.v2';

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
  graduatedRanges?: Interval[]; // New intervals to merge into previouslyMemorized
  unitCelebration?: {           // Individual SU completion notification
    message: string;
  };
  megaCelebration?: {           // The Final Cycle Celebration event
    ruLabel: string;
    nextDueDate: string;
    message: string;
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
  let megaCelebration: GradeResult['megaCelebration'];
  let unitCelebration: GradeResult['unitCelebration'];
  const graduatedRanges: Interval[] = [];
  
  // Pending additions for the Genesis Trigger
  const pendingGenesisTriggers: { su: ScheduleUnit; ru: RevisionUnitData }[] = [];

  const updatedSchedules = schedules.map(schedule => {
    if (schedule.id !== scheduleId) return schedule;

    const newRevisionList = schedule.revisionList.map(ru => {
      if (ru.id !== ruId) return ru;

      let suWasUpdated = false;
      let wasMacroTask = false;
      let suJustGraduated = false;

      // 1. Update the specific child SU and capture its generational state
      const newScheduleList = ru.scheduleList.map(su => {
        if (su.id !== suId) return su;

        suWasUpdated = true;
        wasMacroTask = su.isMacroRoutine;

        // ALWAYS compute the next FSRS state
        const cardToGrade = startingCard ?? su.fsrsCard;
        const schedulingRecords = quranFsrs.repeat(cardToGrade, now);
        const recordLog = (schedulingRecords as any)[rating];
        let nextDueDate = new Date(recordLog.card.due);

        // BASE: always persist the updated card + log
        const updatedSU: ScheduleUnit = {
          ...su,
          fsrsCard: recordLog.card,
          reviewLogs: [...su.reviewLogs, { ...recordLog.log, wasMacroRoutine: su.isMacroRoutine } as any],
        };

        const isMemorizationTrack = schedule.type === 'memorization' || ru.taskType === 'memorization';
        let isStruggling = rating === Rating.Hard || wasFailedToday;

        if (isMemorizationTrack) {
          const nextReps = recordLog.card.reps;

          if (nextReps < 3) {
            // Phase 0 & 1: Solidification
            const maxDate = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);
            if (nextDueDate > maxDate) {
              updatedSU.fsrsCard.due = maxDate;
              nextDueDate = maxDate;
            }
            isStruggling = true; // Force Micro-review
          } else if (nextReps === 3 && !su.isMemorizationGraduated) {
            // Phase 2: Graduation & Genesis
            updatedSU.isMemorizationGraduated = true;
            suJustGraduated = true;
            graduatedRanges.push(updatedSU.wordIdRange);
            pendingGenesisTriggers.push({ su: updatedSU, ru });

            const suLabel = updatedSU.displayLabel || 'Portion';
            const ruLabelText = getRuLabel(ru.unitType, ru.unitValue);
            unitCelebration = {
              message: `${suLabel} memorization phase completed, ${suLabel} has been moved to the ${ruLabelText} revision schedule. بارك الله فيك 🌹`
            };

            const maxDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
            if (nextDueDate > maxDate) {
              updatedSU.fsrsCard.due = maxDate;
              nextDueDate = maxDate;
            }
            isStruggling = true; // Force Micro-review (Fledgling condition)
            
          } else if (updatedSU.isMemorizationGraduated && nextReps < 5) {
            // Phase 3: Fledgling Override
            const maxDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
            if (nextDueDate > maxDate) {
              updatedSU.fsrsCard.due = maxDate;
              nextDueDate = maxDate;
            }
            isStruggling = true; // Force Micro-review
          }
        }

        // --- FSRS Weakness Filter Path ---
        // THE BOUNCER: archive if the next due date would exceed the Event Horizon
        const hitLimit = su.dueDateLimit && nextDueDate >= new Date(su.dueDateLimit);

        if (hitLimit || !isStruggling) {
          // Archive from future scheduling; current graded state is still saved above.
          return { ...updatedSU, isDeleted: true };
        }

        // Struggling path: tag so a future micro-review slot is spawned
        return { ...updatedSU, isMacroRoutine: false };
      });

      if (!suWasUpdated) return ru;

      // Check Phase 4 Final Actualization (if Memorization block entirely graduated)
      const isMemorizationTrack = schedule.type === 'memorization' || ru.taskType === 'memorization';
      if (isMemorizationTrack && suJustGraduated) {
        const allActiveGraduated = newScheduleList.every(s => s.isDeleted || s.isMemorizationGraduated);
        if (allActiveGraduated) {
          const ruLabelText = getRuLabel(ru.unitType, ru.unitValue);
          megaCelebration = {
            ruLabel: ruLabelText,
            nextDueDate: '', // To be filled during actualization of the revision schedule
            message: `Alhamdulillah! Memorization of ${ruLabelText} complete!\nYour memorization schedule has now graduated to a revision schedule starting on `
          };
        }
      }

      // STEP 2: TRIGGER ACTUALIZATION (THE SWEEP)
      if (wasMacroTask) {
        const latestTime = Math.max(...newScheduleList.map(s => new Date(s.fsrsCard.due).getTime()));
        const anchorDate = new Date(latestTime);
        const macroCard = calculateMacroRUCard(newScheduleList, anchorDate);

        const isMacroCompleted = !newScheduleList.some(s => s.isMacroRoutine && !s.isDeleted && s.reviewLogs.length === 0);

        if (isMacroCompleted) {
          const updatedRU = {
            ...ru,
            scheduleList: newScheduleList,
            fsrsCard: macroCard
          };
          const actualizedRU = actualizeMacroRoutine(updatedRU, metadata, scriptStyle);
          
          actualizationEvent = {
            ruLabel: getRuLabel(ru.unitType, ru.unitValue),
            newMacroDueDate: macroCard.due.toISOString()
          };
          
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

  // Post-process the Genesis Triggers to append graduated SUs to Revision Schedules
  // This must be a clean transfer or tracking.
  const finalSchedules = [...updatedSchedules];
  
  for (const trigger of pendingGenesisTriggers) {
    const { su, ru } = trigger;
    // If it's already in the revision track, it shouldn't hit genesis trigger again.

    let matchingRevSched = finalSchedules.find(s => 
      s.type === 'revision' && 
      s.revisionList.some(r => r.unitType === ru.unitType && r.unitValue === ru.unitValue && r.taskType === 'memorization')
    );

    let matchingRU: RevisionUnitData | undefined;

    if (!matchingRevSched) {
      // Create new Revision Schedule for this RU
      const newRU: RevisionUnitData = {
        id: crypto.randomUUID(),
        unitType: ru.unitType,
        unitValue: ru.unitValue,
        scheduledUnitType: ru.scheduledUnitType,
        scheduleList: [],
        fsrsCard: createBaselineFSRSCard('normal', now),
        reviewLogs: [],
        createdAt: now.toISOString(),
        isDeleted: false,
        priorityValue: 0,
        routineDurationDays: ru.routineDurationDays || 30, // Fallback if missing
        ruRange: ru.ruRange,
        taskType: 'memorization'
      };
      
      const ruLabelText = getRuLabel(ru.unitType, ru.unitValue);
      const newSchedule: Schedule = {
        id: crypto.randomUUID(),
        type: 'revision',
        title: `Revision: ${ruLabelText}`,
        createdAt: now.toISOString(),
        isDeleted: false,
        revisionList: [newRU],
        startDate: now.toISOString().split('T')[0]
      };
      
      finalSchedules.push(newSchedule);
      matchingRevSched = newSchedule;
      matchingRU = newRU;
    } else {
      matchingRU = matchingRevSched.revisionList.find(r => r.unitType === ru.unitType && r.unitValue === ru.unitValue && r.taskType === 'memorization');
    }

    if (matchingRU) {
      // We append a cloned track of the SU to it
      // And we mark the original one in the Memorization schedule as deleted to stop it from duplicating next dates.
      // But wait: if we do that, we mutate finalSchedules backwards.
      
      // Let's find the original in finalSchedules and flag it isDeleted to transfer it cleanly.
      finalSchedules.forEach(s => {
        if (s.id === scheduleId) {
          s.revisionList.forEach(origRU => {
            if (origRU.id === ruId) {
              origRU.scheduleList.forEach(origSU => {
                if (origSU.id === su.id) {
                  origSU.isDeleted = true;
                }
              });
            }
          });
        }
      });
      
      const clonedSU = {
        ...su,
        ruId: matchingRU.id,
        // It stays as a micro-review for the Fledgling phase
        isMacroRoutine: false 
      };
      
      matchingRU.scheduleList.push(clonedSU);
    }
  }
  
  // If we triggered a MegaCelebration, actualize the newly created Revision Schedule
  if (megaCelebration) {
    // We can find it by unitType and unitValue that match the graduated
    const triggeringRU = pendingGenesisTriggers[0]?.ru;
    if (triggeringRU) {
      const targetRevSched = finalSchedules.find(s => 
        s.type === 'revision' && 
        s.revisionList.some(r => r.unitType === triggeringRU.unitType && r.unitValue === triggeringRU.unitValue && r.taskType === 'memorization')
      );
      
      if (targetRevSched) {
        const targetRUIndex = targetRevSched.revisionList.findIndex(r => r.unitType === triggeringRU.unitType && r.unitValue === triggeringRU.unitValue);
        if (targetRUIndex > -1) {
          const actualizedRU = actualizeMacroRoutine(targetRevSched.revisionList[targetRUIndex], metadata, scriptStyle);
          targetRevSched.revisionList[targetRUIndex] = actualizedRU;
          
          const newStartStr = new Date(actualizedRU.fsrsCard.due).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
          megaCelebration.nextDueDate = actualizedRU.fsrsCard.due.toISOString();
          megaCelebration.message += newStartStr + ".\n\nوفقك الله";
        }
      }
    }
  }

  return {
    schedules: finalSchedules,
    actualization: actualizationEvent,
    graduatedRanges: graduatedRanges.length > 0 ? graduatedRanges : undefined,
    unitCelebration,
    megaCelebration
  };
}

