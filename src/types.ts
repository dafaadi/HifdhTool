export type SelectMode = 'ayah' | 'word' | 'letter' | 'tashkeel';

export interface MistakeEntry {
  id: string;
  number: number;
  pageNumber: number;
  wordId?: number;
  mode: SelectMode;
  surahNumber: number;
  ayahNumber: number;
  wordIndex?: number;
  letterIndex?: number;
  tashkeelIndex?: number;
  text: string;
  comment?: string;
}

import type { Card, ReviewLog } from 'ts-fsrs';

export interface ScheduleUnit {
  id: string;
  ruId?: string;
  wordIdRange: [number, number];
  surahNumber: number;
  ayahRange?: [number, number];
  pageNumbers: number[];
  displayLabel: string;
  timePreference: 'Morning' | 'Evening' | 'Any';
  fsrsCard: Card;
  reviewLogs: ReviewLog[];
  note: string;
  createdAt: string;
  isMacroRoutine: boolean;
  dueDateLimit?: string | Date;
  isDeleted: boolean;
}

export interface RevisionUnitData {
  id: string;
  unitType: string;         // e.g., 'Surah', 'Juz', etc.
  unitValue: string | number; // e.g., '1', '2', etc.
  scheduledUnitType: string;  // e.g., 'Page', 'Ruku', etc.
  scheduleList: ScheduleUnit[];
  fsrsCard: Card;
  reviewLogs: ReviewLog[];
  createdAt: string;
  isDeleted: boolean;
  priorityValue: number;
  routineDurationDays: number;
  ruRange: [number, number];
}

export interface Schedule {
  id: string;
  title: string;
  createdAt: string;
  isDeleted: boolean;
  revisionList: RevisionUnitData[];
  startDate: string;
}
