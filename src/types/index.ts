/**
 * src/types/index.ts
 *
 * Central barrel for all shared TypeScript types and interfaces.
 * Split into three layers:
 *   1. Core primitives (re-exported from src/types.ts legacy location)
 *   2. Quran metadata shapes used by the engine
 *   3. Scheduling domain types (DailyTask, ProjectedTask, etc.)
 */

// ── Re-export legacy core types (ScheduleUnit, Schedule, etc.) ───────────────
export type { ScheduleUnit, RevisionUnitData, Schedule, MistakeEntry, SelectMode } from '../types';

// ── Engine primitives ─────────────────────────────────────────────────────────

export type Interval = [number, number]; // [startWordId, endWordId]
export type MetadataMap = Record<string, Interval>;

export type ScriptStyle = 'madani' | 'indopak';
export type ViewMode = 'default' | 'surahs-only';

// ── Graduation & display settings ─────────────────────────────────────────────

export interface GraduationSettings {
  madani: {
    surahToJuz:  boolean;
    hizbToSurah: boolean;
    rubToHizb:   boolean;
    pageToRub:   boolean;
    ayahToPage:  boolean;
  };
  indopak: {
    paraToManzil: boolean;
    surahToPara:  boolean;
    pageToSurah:  boolean;
    ayahToRuku:   boolean;
    ayahToPage:   boolean;
  };
}

export interface Pill {
  label:       string;
  type:        string;
  divisionKey: string;
  range:       Interval;
  level:       'high' | 'mid' | 'low' | 'partial';
  isGrouped:   boolean;
}

// ── Quran metadata shape ───────────────────────────────────────────────────────

export interface QuranMetadata {
  madani: {
    juz:   MetadataMap;
    surah: MetadataMap;
    hizb:  MetadataMap;
    rub:   MetadataMap;
    page:  MetadataMap;
  };
  indopak: {
    manzil: MetadataMap;
    para:   MetadataMap;
    surah:  MetadataMap;
    ruku:   MetadataMap;
    page:   MetadataMap;
  };
}

// ── Scheduling domain types ───────────────────────────────────────────────────

import type { ScheduleUnit } from '../types';

export type DailyTask = ScheduleUnit & {
  createdAt:      string;
  isDeleted:      boolean;
  details:        string[];
  ruId?:          string;
  ruType?:        string;
  ruLabel?:       string;
  suType?:        string;
  isCompleted?:   boolean;
  wasFailedToday?: boolean;
};

export interface ProjectedTask {
  dateKey:      string; // YYYY-MM-DD
  ruLabel:      string;
  displayLabel: string;
  ruId:         string;
  surahNumber:  number;
  ruType:       string;
}

export interface SUEntry {
  key:         string;
  label:       string;
  range:       [number, number];
  surahNumber: number;
}
