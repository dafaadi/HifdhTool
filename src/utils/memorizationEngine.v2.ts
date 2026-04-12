/**
 * memorizationEngine.v2.ts
 *
 * Extracted, dependency-clean scheduling engine.
 * Contains only the 7 live functions actively consumed by the UI,
 * plus their required private helpers.
 *
 * Imports:
 *   - Types  → ../types/index
 *   - Constants → ./constants
 *   - FSRS baseline card → ./fsrsLogic
 */

import type {
  Interval,
  MetadataMap,
  ScriptStyle,
  ViewMode,
  GraduationSettings,
  Pill,
  QuranMetadata,
  DailyTask,
  ProjectedTask,
  SUEntry,
} from '../types/index';
import type { RevisionUnitData, ScheduleUnit } from '../types';
import { SURAH_NAMES, MADANI_SU_HIERARCHY, INDOPAK_SU_HIERARCHY } from './constants';
import { createBaselineFSRSCard } from './fsrsLogic';
import { type Card, State, createEmptyCard } from 'ts-fsrs';

// Re-export types that downstream components import from this file
export type {
  Interval, MetadataMap, ScriptStyle, ViewMode,
  GraduationSettings, Pill, QuranMetadata,
  DailyTask, ProjectedTask, SUEntry,
};

// ═══════════════════════════════════════════════════════════════════════════════
// 1. mergeOverlappingIntervals
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Merges an array of [startWordId, endWordId] intervals.
 * Handles overlaps AND adjacency (e.g. [1,10] + [11,20] → [1,20]).
 */
export function mergeOverlappingIntervals(ranges: number[][]): Interval[] {
  if (!ranges.length) return [];

  const sorted = (ranges as Interval[])
    .filter(r => r.length === 2 && typeof r[0] === 'number' && typeof r[1] === 'number')
    .sort((a, b) => a[0] - b[0]);

  if (!sorted.length) return [];

  const merged: Interval[] = [[sorted[0][0], sorted[0][1]]];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const [start, end] = sorted[i];

    if (start <= last[1] + 1) {
      if (end > last[1]) last[1] = end;
    } else {
      merged.push([start, end]);
    }
  }

  return merged;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. isFullyContained
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Returns true ONLY if targetRange fits entirely within ONE contiguous block
 * in mergedRangesArray. A partial overlap returns false.
 */
export function isFullyContained(
  targetRange: number[],
  mergedRangesArray: number[][]
): boolean {
  const [tStart, tEnd] = targetRange;
  return mergedRangesArray.some(([s, e]) => s <= tStart && e >= tEnd);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. countSubUnits
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Counts how many specific sub-units (e.g., 'Surah', 'Page') intersect with a given word range.
 */
export function countSubUnits(
  targetRange: Interval,
  suType: string,
  scriptStyle: ScriptStyle,
  metadata: QuranMetadata
): number {
  if (suType === 'Ayah') {
    const surahDetail = (metadata as any).madani?.surah_detail as
      Record<string, { weight_pages: number; ayah_ranges: Record<string, [number, number]> }>;

    if (!surahDetail) return 100;

    const [tS, tE] = targetRange;
    const surahMap = (metadata as any).madani?.surah as MetadataMap;
    const pageMap = (metadata as any).madani?.page as MetadataMap;
    let count = 0;

    for (const [surahKey, detail] of Object.entries(surahDetail)) {
      const surahRange = surahMap?.[surahKey];
      if (!surahRange) continue;
      if (surahRange[1] < tS || surahRange[0] > tE) continue;

      for (const pageKey of Object.keys(detail.ayah_ranges)) {
        const ayahRange = detail.ayah_ranges[pageKey];
        const pageNum = parseInt(pageKey.replace('page_', ''), 10);
        const pageWordRange = pageMap?.[String(pageNum)];
        if (!pageWordRange) continue;
        if (pageWordRange[1] < tS || pageWordRange[0] > tE) continue;

        count += (ayahRange[1] - ayahRange[0] + 1);
      }
    }
    return count;
  }

  const { madani, indopak } = metadata;
  let map: MetadataMap | undefined;

  if (scriptStyle === 'madani') {
    map = (madani as any)[suType.toLowerCase()];
    if (suType === "Rub'") map = madani.rub;
  } else {
    map = (indopak as any)[suType.toLowerCase()];
  }

  if (!map) return 0;

  const [tS, tE] = targetRange;
  let count = 0;
  for (const range of Object.values(map)) {
    const [s, e] = range;
    if (s <= tE && e >= tS) count++;
  }

  return count;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. getValidSUs
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Returns which Schedule Units are valid for a given Revision Unit, applying
 * both hierarchy rules and count-sense checks.
 */
export function getValidSUs(
  ruType: string,
  ruRange: [number, number],
  scriptStyle: ScriptStyle,
  metadata: QuranMetadata
): string[] {
  const hierarchy = scriptStyle === 'madani' ? MADANI_SU_HIERARCHY : INDOPAK_SU_HIERARCHY;
  const candidates: string[] = [...hierarchy];
  const uniqueCandidates = Array.from(new Set(candidates));

  return uniqueCandidates.filter(suType => {
    if (suType === ruType) return true;
    if (suType === 'Ayah') return true;
    const count = countSubUnits(ruRange, suType, scriptStyle, metadata);
    return count >= 2;
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Private helpers for collectSUEntries / distributeSequentially
// ═══════════════════════════════════════════════════════════════════════════════

/** Collects all sub-unit (SU) entries for a given Revision Unit range and SU type. */
export function collectSUEntries(
  ruRange: [number, number],
  suType: string,
  scriptStyle: ScriptStyle,
  metadata: QuranMetadata
): SUEntry[] {
  const [tS, tE] = ruRange;

  if (suType === 'Ayah') {
    const surahDetail = (metadata as any).madani?.surah_detail as
      Record<string, { weight_pages: number; ayah_ranges: Record<string, [number, number]> }>;
    if (!surahDetail) return [];

    const surahMap = (metadata as any).madani?.surah as Record<string, [number, number]>;
    const pageMap = (metadata as any).madani?.page as MetadataMap;
    const entries: SUEntry[] = [];

    for (const [surahKey, detail] of Object.entries(surahDetail)) {
      const surahRange = surahMap?.[surahKey];
      if (!surahRange || surahRange[1] < tS || surahRange[0] > tE) continue;

      const surahNum = parseInt(surahKey, 10);
      const sortedPageKeys = Object.keys(detail.ayah_ranges).sort((a, b) =>
        parseInt(a.replace('page_', ''), 10) - parseInt(b.replace('page_', ''), 10)
      );

      for (const pageKey of sortedPageKeys) {
        const ayahRange = detail.ayah_ranges[pageKey];
        const pageNum = parseInt(pageKey.replace('page_', ''), 10);
        const pageWordRange = pageMap?.[String(pageNum)];
        if (!pageWordRange || pageWordRange[1] < tS || pageWordRange[0] > tE) continue;

        for (let a = ayahRange[0]; a <= ayahRange[1]; a++) {
          entries.push({
            key: `${surahKey}-${a}`,
            label: `Ayah ${a}`,
            range: pageWordRange,
            surahNumber: surahNum,
          });
        }
      }
    }
    return entries;
  }

  const { madani, indopak } = metadata;
  let map: MetadataMap | undefined;
  if (scriptStyle === 'madani') {
    map = (madani as any)[suType.toLowerCase()];
    if (suType === "Rub'") map = madani.rub;
  } else {
    map = (indopak as any)[suType.toLowerCase()];
  }

  if (!map) return [];

  const entries: SUEntry[] = [];
  let labelFn = (k: string) => `${suType} ${k}`;
  if (suType === 'Surah') labelFn = k => `${k}. ${SURAH_NAMES[+k - 1] ?? ''}`;

  const sortedEntries = Object.entries(map).sort((a, b) => a[1][0] - b[1][0]);
  for (const [k, r] of sortedEntries) {
    if (r[0] <= tE && r[1] >= tS) {
      const surahMap = (scriptStyle === 'madani' ? madani.surah : indopak.surah) as MetadataMap;
      let surahNumber = 1;
      for (const [sk, sr] of Object.entries(surahMap)) {
        if (sr[0] <= r[0] && sr[1] >= r[0]) {
          surahNumber = parseInt(sk, 10);
          break;
        }
      }
      entries.push({ key: k, label: labelFn(k), range: r as [number, number], surahNumber });
    }
  }

  return entries;
}

/** Helper for Ayah display labels (e.g. "Ayah 5" or "Ayahs 3–8" or cross-surah format). */
function displayLabelFromAyahSlice(group: SUEntry[]): string {
  const first = group[0];
  const last = group[group.length - 1];

  const getAyahNum = (label: string) => {
    const match = label.match(/Ayah (\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  };

  const fA = getAyahNum(first.label);
  const lA = getAyahNum(last.label);

  if (first.surahNumber === last.surahNumber) {
    if (fA === lA) return `Ayah ${fA}`;
    return `Ayahs ${fA}–${lA}`;
  } else {
    const fName = SURAH_NAMES[first.surahNumber - 1];
    const lName = SURAH_NAMES[last.surahNumber - 1];
    return `${fName} ${fA} → ${lName} ${lA}`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. distributeSequentially  (core scheduler)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * The core scheduling engine.
 * Takes multiple revision units and a shared duration, then distributes all
 * sub-units sequentially across the timeline with 1-to-1 task mapping.
 */
export function distributeSequentially(
  ruItems: {
    id?: string;
    ruRange: [number, number];
    suType: string;
    ruLabel?: string;
    ruType: string;
    ruValue: string | number;
  }[],
  durationDays: number,
  scriptStyle: ScriptStyle,
  metadata: QuranMetadata,
  startDateString?: string
): (DailyTask & { ruId?: string })[] {
  if (durationDays < 1) return [];

  // 1. Collect all SUs across all RUs in queue order
  const allSUs: (SUEntry & {
    ruId?: string;
    ruLabel?: string;
    ruType: string;
    ruValue: string | number;
    suType: string;
  })[] = [];

  for (const item of ruItems) {
    const entries = collectSUEntries(item.ruRange, item.suType, scriptStyle, metadata);
    allSUs.push(...entries.map(e => ({
      ...e,
      ruId: item.id,
      ruLabel: item.ruLabel,
      ruType: item.ruType,
      ruValue: item.ruValue,
      suType: item.suType,
    })));
  }

  const total = allSUs.length;
  if (total === 0) return [];

  const base = Math.floor(total / durationDays);
  const remainder = total % durationDays;

  const results: (DailyTask & { ruId?: string })[] = [];
  let currentIndex = 0;

  for (let i = 0; i < durationDays; i++) {
    const countForDay = i < durationDays - remainder ? base : base + 1;
    const slice = allSUs.slice(currentIndex, currentIndex + countForDay);
    currentIndex += countForDay;

    if (slice.length === 0) {
      const baseDate = startDateString
        ? (() => {
            const [y, m, d] = startDateString.split('-').map(Number);
            return new Date(y, m - 1, d);
          })()
        : new Date();
      baseDate.setDate(baseDate.getDate() + i);
      const fsrsCard = createBaselineFSRSCard('normal', baseDate);
      fsrsCard.due = baseDate;
      results.push({
        id: crypto.randomUUID(),
        wordIdRange: [0, 0],
        surahNumber: 1,
        pageNumbers: [],
        displayLabel: '0 SUs',
        timePreference: 'Any',
        fsrsCard,
        reviewLogs: [],
        note: '',
        createdAt: new Date().toISOString(),
        isMacroRoutine: true,
        isDeleted: false,
        details: [],
      });
      continue;
    }

    // Finalize each sub-unit as its own standalone DailyTask (1:1 mapping)
    const finalizeGroup = (group: typeof slice, dayIdx: number) => {
      if (group.length === 0) return;

      const first = group[0];
      const suType = first.suType;

      let displayLabel = '';
      if (suType === 'Surah') displayLabel = SURAH_NAMES[first.surahNumber - 1] ?? first.label;
      else displayLabel = first.label;

      const totalRange: [number, number] = [group[0].range[0], group[group.length - 1].range[1]];

      const pageNumbers: number[] = [];
      const { madani, indopak } = metadata;
      const pageMap = (scriptStyle === 'madani' ? madani.page : indopak.page) as MetadataMap;
      for (const [pk, pr] of Object.entries(pageMap)) {
        if (pr[0] <= totalRange[1] && pr[1] >= totalRange[0]) pageNumbers.push(+pk);
      }

      const baseDate = startDateString
        ? (() => {
            const [y, m, d] = startDateString.split('-').map(Number);
            return new Date(y, m - 1, d);
          })()
        : new Date();
      baseDate.setDate(baseDate.getDate() + dayIdx);
      const fsrsCard = createBaselineFSRSCard('normal', baseDate);
      fsrsCard.due = baseDate;

      results.push({
        id: crypto.randomUUID(),
        ruId: first.ruId,
        ruType: first.ruType,
        wordIdRange: totalRange,
        surahNumber: first.ruType === 'Surah' ? Number(first.ruValue) : first.surahNumber,
        pageNumbers,
        displayLabel,
        timePreference: 'Any',
        fsrsCard,
        reviewLogs: [],
        note: '',
        createdAt: new Date().toISOString(),
        isDeleted: false,
        details: group.map(s => s.label),
        ruLabel: first.ruLabel,
        suType: first.suType,
        isMacroRoutine: true,
      });
    };

    for (const item of slice) {
      finalizeGroup([item], i);
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Private helpers for generatePills
// ═══════════════════════════════════════════════════════════════════════════════

function subtractFromPool(pool: Interval[], remove: Interval): Interval[] {
  const result: Interval[] = [];
  for (const [s, e] of pool) {
    if (remove[1] < s || remove[0] > e) {
      result.push([s, e]);
    } else {
      if (s < remove[0]) result.push([s, remove[0] - 1]);
      if (e > remove[1]) result.push([remove[1] + 1, e]);
    }
  }
  return result;
}

function extractLevel(
  pool: Interval[],
  map: MetadataMap,
  labelFn: (key: string) => string,
  type: string,
  level: Pill['level']
): { pills: Pill[]; remaining: Interval[] } {
  const pills: Pill[] = [];
  let remaining = [...pool];

  const entries = Object.entries(map)
    .map(([k, r]) => ({ key: k, range: r }))
    .sort((a, b) => a.range[0] - b.range[0]);

  for (const { key, range } of entries) {
    if (isFullyContained(range, remaining)) {
      pills.push({ label: labelFn(key), type, divisionKey: key, range, level, isGrouped: false });
      remaining = subtractFromPool(remaining, range);
    }
  }

  return { pills, remaining };
}

function extractGroupedPages(
  pool: Interval[],
  pageMap: MetadataMap,
  type: string
): { pills: Pill[]; remaining: Interval[] } {
  const covered: { key: number; range: Interval }[] = Object.entries(pageMap)
    .filter(([, r]) => isFullyContained(r, pool))
    .map(([k, r]) => ({ key: Number(k), range: r }))
    .sort((a, b) => a.key - b.key);

  const pills: Pill[] = [];
  let remaining = [...pool];
  let i = 0;

  while (i < covered.length) {
    const first = covered[i];
    let last = first;

    while (i + 1 < covered.length && covered[i + 1].key === covered[i].key + 1) {
      i++;
      last = covered[i];
    }

    const groupRange: Interval = [first.range[0], last.range[1]];
    const isGrouped = first.key !== last.key;

    pills.push({
      label: isGrouped ? `Pages ${first.key}–${last.key}` : `Page ${first.key}`,
      type,
      divisionKey: String(first.key),
      range: groupRange,
      level: 'low',
      isGrouped,
    });

    remaining = subtractFromPool(remaining, groupRange);
    i++;
  }

  return { pills, remaining };
}

function describePartial(interval: Interval, surahMap: MetadataMap): string {
  const overlapping = Object.entries(surahMap)
    .filter(([, r]) => r[0] <= interval[1] && r[1] >= interval[0])
    .map(([k]) => SURAH_NAMES[Number(k) - 1] ?? `Surah ${k}`);

  if (!overlapping.length) return `Words ${interval[0]}–${interval[1]}`;
  if (overlapping.length === 1) return `${overlapping[0]} (partial)`;
  if (overlapping.length === 2) return `${overlapping[0]}–${overlapping[1]} (partial)`;
  return `${overlapping[0]} + ${overlapping.length - 1} more (partial)`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. generatePills
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Top-down hierarchy engine for the "Previously Memorized" card.
 * Runs containment checks from highest graduation level down to Pages,
 * then labels leftover fragments as partial surah descriptions.
 */
export function generatePills(
  mergedRanges: Interval[],
  viewMode: ViewMode,
  graduationSettings: GraduationSettings,
  scriptStyle: ScriptStyle,
  metadata: QuranMetadata
): Pill[] {
  const pills: Pill[] = [];
  let remaining = [...mergedRanges];

  if (!remaining.length) return [];

  const { madani, indopak } = metadata;
  const surahMap = scriptStyle === 'madani' ? madani.surah : indopak.surah;
  const pageMap  = scriptStyle === 'madani' ? madani.page  : indopak.page;

  if (viewMode === 'surahs-only') {
    const { pills: sp, remaining: r1 } = extractLevel(
      remaining, surahMap,
      k => `${SURAH_NAMES[Number(k) - 1] ?? `Surah ${k}`}`,
      'surah', 'high'
    );
    pills.push(...sp);
    remaining = r1;

    const { pills: pp, remaining: r2 } = extractGroupedPages(remaining, pageMap, 'page');
    pills.push(...pp);
    remaining = r2;

    for (const interval of remaining) {
      pills.push({ label: describePartial(interval, surahMap), type: 'partial', divisionKey: '', range: interval, level: 'partial', isGrouped: false });
    }
    return pills;
  }

  if (scriptStyle === 'madani') {
    const s = graduationSettings.madani;

    if (s.surahToJuz) {
      const { pills: p, remaining: r } = extractLevel(remaining, madani.juz, k => `Juz ${k}`, 'juz', 'high');
      pills.push(...p); remaining = r;
    }
    if (s.hizbToSurah) {
      const { pills: p, remaining: r } = extractLevel(remaining, madani.surah, k => `${SURAH_NAMES[Number(k) - 1] ?? `Surah ${k}`}`, 'surah', 'mid');
      pills.push(...p); remaining = r;
    }
    if (s.rubToHizb) {
      const { pills: p, remaining: r } = extractLevel(remaining, madani.hizb, k => `Hizb ${k}`, 'hizb', 'mid');
      pills.push(...p); remaining = r;
    }
    if (s.pageToRub) {
      const { pills: p, remaining: r } = extractLevel(remaining, madani.rub, k => `Rub' ${k}`, 'rub', 'low');
      pills.push(...p); remaining = r;
    }
    if (s.ayahToPage) {
      const { pills: p, remaining: r } = extractGroupedPages(remaining, madani.page, 'page');
      pills.push(...p); remaining = r;
    }
  } else {
    const s = graduationSettings.indopak;

    if (s.paraToManzil) {
      const { pills: p, remaining: r } = extractLevel(remaining, indopak.manzil, k => `Manzil ${k}`, 'manzil', 'high');
      pills.push(...p); remaining = r;
    }
    if (s.surahToPara) {
      const { pills: p, remaining: r } = extractLevel(remaining, indopak.para, k => `Para ${k}`, 'para', 'high');
      pills.push(...p); remaining = r;
    }
    if (s.pageToSurah) {
      const { pills: p, remaining: r } = extractLevel(remaining, indopak.surah, k => `${SURAH_NAMES[Number(k) - 1] ?? `Surah ${k}`}`, 'surah', 'mid');
      pills.push(...p); remaining = r;
    }
    if (s.ayahToRuku) {
      const { pills: p, remaining: r } = extractLevel(remaining, indopak.ruku, k => `Ruku ${k}`, 'ruku', 'low');
      pills.push(...p); remaining = r;
    } else if (s.ayahToPage) {
      const { pills: p, remaining: r } = extractGroupedPages(remaining, indopak.page, 'page');
      pills.push(...p); remaining = r;
    }
  }

  for (const interval of remaining) {
    pills.push({ label: describePartial(interval, surahMap), type: 'partial', divisionKey: '', range: interval, level: 'partial', isGrouped: false });
  }

  return pills;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. generateProjectedSUs
// ═══════════════════════════════════════════════════════════════════════════════

/** Generates a readable label for a Revision Unit. */
export function getRuLabel(type: string, value: string | number): string {
  if (type === 'Surah') {
    return `${value}. ${SURAH_NAMES[Number(value) - 1] || ''}`;
  }
  return `${type} ${value}`;
}

/**
 * Generates future projected tasks for a Revision Unit based on its FSRS due date
 * and its original planned duration. Used by CalendarPreview to render future reviews.
 */
export function generateProjectedSUs(
  ru: RevisionUnitData,
  metadata: QuranMetadata,
  scriptStyle: ScriptStyle
): ProjectedTask[] {
  let range = ru.ruRange;
  let duration = ru.routineDurationDays;

  // Fallback for legacy data created before schema update
  if (!range && ru.scheduleList && ru.scheduleList.length > 0) {
    const validTasks = ru.scheduleList.filter((su: ScheduleUnit) => su.wordIdRange && su.wordIdRange[1] > 0);
    if (validTasks.length > 0) {
      const sorted = [...validTasks].sort((a, b) => a.wordIdRange[0] - b.wordIdRange[0]);
      range = [sorted[0].wordIdRange[0], sorted[sorted.length - 1].wordIdRange[1]];
    }
  }
  if ((!duration || duration < 1) && ru.scheduleList && ru.scheduleList.length > 0) {
    duration = new Set(ru.scheduleList.map((su: ScheduleUnit) => new Date(su.fsrsCard.due).toDateString())).size;
  }

  if (!range || !duration || duration < 1) return [];

  const startDate = new Date(ru.fsrsCard.due);
  const ruLabel = getRuLabel(ru.unitType, ru.unitValue);

  const items = [{
    id: ru.id,
    ruRange: range,
    suType: ru.scheduledUnitType,
    ruLabel,
    ruType: ru.unitType,
    ruValue: ru.unitValue,
  }];

  const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
  const tasks = distributeSequentially(items, duration, scriptStyle, metadata, startDateStr);

  return tasks.map(t => {
    const d = new Date(t.fsrsCard.due);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return {
      dateKey,
      ruLabel,
      displayLabel: t.displayLabel,
      ruId: ru.id,
      surahNumber: t.surahNumber,
      ruType: ru.unitType,
    };
  });
}

/**
 * Calculates a parent RevisionUnit (RU) card by aggregating its child ScheduleUnits (SUs).
 * Uses a discounted mean for Stability and a stamina penalty for Difficulty.
 */
export function calculateMacroRUCard(scheduleList: ScheduleUnit[], baseDate: Date = new Date()): Card {
  const activeSUs = scheduleList.filter(su => !su.isDeleted);
  
  if (activeSUs.length === 0) {
    return createEmptyCard(baseDate);
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

  const ruCard = createEmptyCard(baseDate);
  ruCard.stability = macroStability;
  ruCard.difficulty = macroDifficulty;
  ruCard.reps = avgReps;
  ruCard.state = State.Review;

  const intervalDays = Math.max(1, Math.round(macroStability));
  ruCard.due = new Date(baseDate.getTime() + intervalDays * 24 * 60 * 60 * 1000);

  return ruCard;
}

/**
 * The 'Sweep': Finalizes a Macro-routine by regenerating its next pass 
 * and cleaning up micro-reviews that hit the 'Event Horizon'.
 */
export function actualizeMacroRoutine(
  ru: RevisionUnitData,
  metadata: QuranMetadata,
  scriptStyle: ScriptStyle
): RevisionUnitData {
  const nextPassStartDate = new Date(ru.fsrsCard.due);
  const nextPassStartDateStr = nextPassStartDate.toISOString().split('T')[0];

  // 1. Regeneration: Generate the NEXT contiguous block
  const ruItems = [{
    id: ru.id,
    ruRange: ru.ruRange,
    suType: ru.scheduledUnitType,
    ruLabel: getRuLabel(ru.unitType, ru.unitValue),
    ruType: ru.unitType,
    ruValue: ru.unitValue
  }];

  const nextPassSUs = distributeSequentially(
    ruItems,
    ru.routineDurationDays || 30,
    scriptStyle,
    metadata,
    nextPassStartDateStr
  );

  // 2. Anchoring: Set the parent RU's card due date to [Last SU Date + 7 Days]
  // This mimics the initial baseline anchoring from RevisionScheduler.
  let finalCard = { ...ru.fsrsCard };
  if (nextPassSUs.length > 0) {
    const lastSU = nextPassSUs[nextPassSUs.length - 1];
    const lastSUDue = new Date(lastSU.fsrsCard.due);
    const ruBufferDate = new Date(lastSUDue.getTime() + 7 * 24 * 60 * 60 * 1000);
    finalCard.due = ruBufferDate;
  }

  // 3. The Sweep & Stamping: Process existing tasks
  const processedSUs = ru.scheduleList.map(su => {
    // ARCHIVE COMPLETED MACRO TASKS: They've contributed to the RU card and are now replaced by nextPassSUs
    if (su.isMacroRoutine) return { ...su, isDeleted: true };
    if (su.isDeleted) return su;

    const suDueDate = new Date(su.fsrsCard.due);
    
    // If current FSRS due date is >= nextPassStartDate: ARCHIVE
    if (suDueDate >= nextPassStartDate) {
      return { ...su, isDeleted: true };
    }

    // Otherwise: Stamp with Event Horizon
    return { ...su, dueDateLimit: nextPassStartDate };
  });

  return {
    ...ru,
    fsrsCard: finalCard,
    scheduleList: [...processedSUs, ...nextPassSUs]
  };
}

// ── Re-export constants for convenience ───────────────────────────────────────
export { SURAH_NAMES, MADANI_SU_HIERARCHY, INDOPAK_SU_HIERARCHY };
