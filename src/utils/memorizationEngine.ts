/**
 * memorizationEngine.ts
 *
 * Pure math utilities for the Hifdh memorization tracking system.
 * No React, no localStorage — just intervals and pill generation.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export type Interval = [number, number]; // [startWordId, endWordId]
export type MetadataMap = Record<string, Interval>; // { "1": [1, 36], ... }

export type ScriptStyle = 'madani' | 'indopak';
export type ViewMode = 'default' | 'surahs-only';

export interface GraduationSettings {
  madani: {
    surahToJuz:  boolean; // test Juz level
    hizbToSurah: boolean; // test Surah level
    rubToHizb:   boolean; // test Hizb level
    pageToRub:   boolean; // test Rub' level
    ayahToPage:  boolean; // test Page level (base)
  };
  indopak: {
    paraToManzil: boolean; // test Manzil level
    surahToPara:  boolean; // test Para level
    pageToSurah:  boolean; // test Surah level
    ayahToRuku:   boolean; // test Ruku level (mutually exclusive with ayahToPage)
    ayahToPage:   boolean; // test Page level (base)
  };
}

export interface Pill {
  label:        string;
  type:         string; // 'juz' | 'surah' | 'hizb' | 'rub' | 'page' | 'ruku' | 'para' | 'manzil' | 'partial'
  divisionKey:  string; // numeric key, e.g. "36" for Ya-Sin
  range:        Interval;
  level:        'high' | 'mid' | 'low' | 'partial';
  isGrouped:    boolean; // true when this pill spans multiple consecutive divisions
}

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

// ── Surah names (shared) ───────────────────────────────────────────────────────
export const SURAH_NAMES: string[] = [
  'Al-Fatihah','Al-Baqarah','Ali \'Imran','An-Nisa\'','Al-Ma\'idah','Al-An\'am',
  'Al-A\'raf','Al-Anfal','At-Tawbah','Yunus','Hud','Yusuf','Ar-Ra\'d','Ibrahim',
  'Al-Hijr','An-Nahl','Al-Isra\'','Al-Kahf','Maryam','Ta-Ha','Al-Anbiya\'','Al-Hajj',
  'Al-Mu\'minun','An-Nur','Al-Furqan','Ash-Shu\'ara\'','An-Naml','Al-Qasas',
  'Al-\'Ankabut','Ar-Rum','Luqman','As-Sajdah','Al-Ahzab','Saba\'','Fatir','Ya-Sin',
  'As-Saffat','Sad','Az-Zumar','Ghafir','Fussilat','Ash-Shura','Az-Zukhruf',
  'Ad-Dukhan','Al-Jathiyah','Al-Ahqaf','Muhammad','Al-Fath','Al-Hujurat','Qaf',
  'Ad-Dhariyat','At-Tur','An-Najm','Al-Qamar','Ar-Rahman','Al-Waqi\'ah','Al-Hadid',
  'Al-Mujadila','Al-Hashr','Al-Mumtahanah','As-Saff','Al-Jumu\'ah','Al-Munafiqun',
  'At-Taghabun','At-Talaq','At-Tahrim','Al-Mulk','Al-Qalam','Al-Haqqah','Al-Ma\'arij',
  'Nuh','Al-Jinn','Al-Muzzammil','Al-Muddaththir','Al-Qiyamah','Al-Insan',
  'Al-Mursalat','An-Naba\'','An-Nazi\'at','\'Abasa','At-Takwir','Al-Infitar',
  'Al-Mutaffifin','Al-Inshiqaq','Al-Buruj','At-Tariq','Al-A\'la','Al-Ghashiyah',
  'Al-Fajr','Al-Balad','Ash-Shams','Al-Layl','Ad-Duha','Ash-Sharh','At-Tin',
  'Al-\'Alaq','Al-Qadr','Al-Bayyinah','Az-Zalzalah','Al-\'Adiyat','Al-Qari\'ah',
  'At-Takathur','Al-\'Asr','Al-Humazah','Al-Fil','Quraysh','Al-Ma\'un','Al-Kawthar',
  'Al-Kafirun','An-Nasr','Al-Masad','Al-Ikhlas','Al-Falaq','An-Nas',
];

// ═══════════════════════════════════════════════════════════════════════════════
// 1. mergeOverlappingIntervals
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Merges an array of [startWordId, endWordId] intervals.
 * Handles overlaps AND adjacency (e.g. [1,10] + [11,20] → [1,20]).
 * Input does not need to be sorted.
 *
 * @example
 * mergeOverlappingIntervals([[5,10],[1,6],[15,20]]) // → [[1,10],[15,20]]
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
      // Overlapping or adjacent — extend
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
 *
 * @example
 * isFullyContained([50, 80], [[1,100],[200,300]])  // → true  (inside first block)
 * isFullyContained([80, 150], [[1,100],[200,300]]) // → false (spans the gap)
 */
export function isFullyContained(
  targetRange: number[],
  mergedRangesArray: number[][]
): boolean {
  const [tStart, tEnd] = targetRange;
  return mergedRangesArray.some(([s, e]) => s <= tStart && e >= tEnd);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2b. countSubUnits
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Counts how many specific sub-units (e.g., 'Surah', 'Page') intersect with a given word range.
 * This is useful for scheduling math (e.g., knowing how many Surahs are in a Juz block).
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
        
        // Sum total individual ayahs instead of counting page-level entries
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
    // Overlaps if start is before target end AND end is after target start
    if (s <= tE && e >= tS) {
      count++;
    }
  }

  return count;
}

import type { ScheduleUnit, RevisionUnitData } from '../types';
import { createBaselineFSRSCard } from './fsrsLogic';

export type DailyTask = ScheduleUnit & {
  createdAt: string;
  isDeleted: boolean;
  details: string[]; // Keep details for UI rendering in modal
  ruId?: string;
  ruType?: string;
  ruLabel?: string;
  isCompleted?: boolean;
};

export interface ProjectedTask {
  dateKey: string; // YYYY-MM-DD
  ruLabel: string;
  displayLabel: string;
  ruId: string;
  surahNumber: number;
  ruType: string;
}

export interface SUEntry {
  key: string;
  label: string;
  range: [number, number];
  surahNumber: number;
}

/**
 * Collects all sub-unit (SU) entries for a given Revision Unit (RU) range and SU type.
 */
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
      // Skip if surah is entirely outside ruRange
      if (!surahRange || surahRange[1] < tS || surahRange[0] > tE) continue;

      const surahNum = parseInt(surahKey, 10);

      // We need to iterate pages in order
      const sortedPageKeys = Object.keys(detail.ayah_ranges).sort((a, b) => 
        parseInt(a.replace('page_', ''), 10) - parseInt(b.replace('page_', ''), 10)
      );

      for (const pageKey of sortedPageKeys) {
        const ayahRange = detail.ayah_ranges[pageKey];
        const pageNum = parseInt(pageKey.replace('page_', ''), 10);
        const pageWordRange = pageMap?.[String(pageNum)];
        if (!pageWordRange || pageWordRange[1] < tS || pageWordRange[0] > tE) continue;

        // Create one entry per individual ayah
        for (let a = ayahRange[0]; a <= ayahRange[1]; a++) {
          entries.push({
            key: `${surahKey}-${a}`,
            label: `Ayah ${a}`,
            range: pageWordRange, // Atomic range is the page since we lack per-ayah word maps
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
      // Determine primary surah for this SU
      const surahMap = (scriptStyle === 'madani' ? madani.surah : indopak.surah) as MetadataMap;
      let surahNumber = 1;
      for (const [sk, sr] of Object.entries(surahMap)) {
        if (sr[0] <= r[0] && sr[1] >= r[0]) {
          surahNumber = parseInt(sk, 10);
          break;
        }
      }

      entries.push({
        key: k,
        label: labelFn(k),
        range: r as [number, number],
        surahNumber,
      });
    }
  }

  return entries;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2c. getValidSUs — Smart SU dropdown population
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Global hierarchy truth arrays. The SU must appear BELOW the RU in this order.
 * This is the single source of truth for which units a schedule unit can be.
 */
export const MADANI_SU_HIERARCHY  = ['Juz', 'Hizb', "Rub'", 'Surah', 'Page', 'Ayah'] as const;
export const INDOPAK_SU_HIERARCHY = ['Manzil', 'Para', 'Surah', 'Ruku', 'Page', 'Ayah'] as const;

/**
 * Returns which Schedule Units are valid for a given Revision Unit, applying
 * both hierarchy rules and count-sense checks (e.g., no 'Hizb' if RU only
 * contains 1 hizb, because that is the RU itself).
 */
export function getValidSUs(
  ruType: string,
  ruRange: [number, number],
  scriptStyle: ScriptStyle,
  metadata: QuranMetadata
): string[] {
  const hierarchy = scriptStyle === 'madani' ? MADANI_SU_HIERARCHY : INDOPAK_SU_HIERARCHY;
  
  // 1. Candidates: All possible units. 
  // We no longer strictly follow the hierarchy list for 'Surah' RUs 
  // because Surahs can be larger than Rubs, Hizbs, or even Juz.
  let candidates: string[] = [...hierarchy];
  
  // Deduplicate
  const uniqueCandidates = Array.from(new Set(candidates));

  // 2. Filter to only include SUs that are strictly "within" the RU and smaller than it,
  // OR the exact same unit type as the RU (to allow 1-day whole-unit revision).
  return uniqueCandidates.filter(suType => {
    // If it's the SAME type as the RU, we always allow it
    if (suType === ruType) return true;

    if (suType === 'Ayah') return true; 
    const count = countSubUnits(ruRange, suType, scriptStyle, metadata);
    
    // For other units, we require at least 2 to ensure it's a valid "split".
    return count >= 2;
  });
}

/**
 * Distributes overlapping sub-units into daily buckets for the calendar.
 */
export function distributeSUs(
  ruRange: [number, number],
  suType: string,
  durationDays: number,
  scriptStyle: ScriptStyle,
  metadata: QuranMetadata,
  ruType: string,
  ruLabel?: string,
  startDateString?: string
): DailyTask[] {
  if (durationDays < 1) return [];
  
  // ── Ayah handling using surah_detail ────────────────────────────────────────
  if (suType === 'Ayah') {
    return distributeAyahs(ruRange, durationDays, metadata, ruType, ruLabel, startDateString);
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

  const [tS, tE] = ruRange;
  const overlapping: { key: string, label: string, range: [number, number] }[] = [];
  
  let labelFn = (k: string) => `${suType} ${k}`;
  if (suType === 'Surah') labelFn = k => `${k}. ${SURAH_NAMES[+k - 1] ?? ''}`;

  // Sort by start word ID to ensure chronological order
  const entries = Object.entries(map).sort((a,b) => a[1][0] - b[1][0]);
  for (const [k, r] of entries) {
    if (r[0] <= tE && r[1] >= tS) {
      overlapping.push({ key: k, label: labelFn(k), range: r });
    }
  }
  
  const total = overlapping.length;
  if (total === 0) return [];
  
  const base = Math.floor(total / durationDays);
  const remainder = total % durationDays;
  
  const days: DailyTask[] = [];
  let currentIndex = 0;
  
  for (let i = 0; i < durationDays; i++) {
    const countForDay = i < durationDays - remainder ? base : base + 1;
    const slice = overlapping.slice(currentIndex, currentIndex + countForDay);
    currentIndex += countForDay;
    
    if (slice.length === 0) {
      const baseDate = startDateString 
        ? (() => {
            const [y, m, d] = startDateString.split('-').map(Number);
            return new Date(y, m - 1, d);
          })()
        : new Date();
      baseDate.setDate(baseDate.getDate() + i);
      const fsrsCard = createBaselineFSRSCard('normal');
      fsrsCard.due = baseDate;

      days.push({
        id: crypto.randomUUID(),
        wordIdRange: [0, 0],
        surahNumber: 1,
        pageNumbers: [],
        displayLabel: `0 ${suType}s`,
        timePreference: 'Any',
        fsrsCard,
        reviewLogs: [],
        note: '',
        createdAt: new Date().toISOString(),
        isDeleted: false,
        details: [],
        ruLabel,
      });
      continue;
    }

    let shortLabel = '';
    if (slice.length === 1) {
      if (suType === 'Surah') shortLabel = SURAH_NAMES[+slice[0].key - 1] ?? slice[0].label;
      else shortLabel = slice[0].label;
    }
    else {
      const first = slice[0];
      const last = slice[slice.length - 1];
      if (suType === 'Surah') {
         shortLabel = `${SURAH_NAMES[+first.key - 1]} – ${SURAH_NAMES[+last.key - 1]}`;
      } else {
         shortLabel = `${suType}s ${first.key}–${last.key}`;
      }
    }

    const totalRange: [number, number] = [slice[0].range[0], slice[slice.length - 1].range[1]];

    // Build page numbers
    const pageNumbers: number[] = [];
    const pageMap = (scriptStyle === 'madani' ? madani.page : indopak.page) as MetadataMap;
    for (const [k, r] of Object.entries(pageMap)) {
      if (r[0] <= totalRange[1] && r[1] >= totalRange[0]) pageNumbers.push(+k);
    }

    // Determine primary surah
    const surahNumbers: number[] = [];
    const surahMap = (scriptStyle === 'madani' ? madani.surah : indopak.surah) as MetadataMap;
    for (const [k, r] of Object.entries(surahMap)) {
      if (r[0] <= totalRange[1] && r[1] >= totalRange[0]) surahNumbers.push(+k);
    }
    const surahNumber = surahNumbers.length > 0 ? surahNumbers[0] : 1;

    // Remove redundant Surah prefix, just use the generated shortLabel
    const displayLabel = shortLabel;

    // Get sequential Date
    const baseDate = startDateString 
      ? (() => {
          const [y, m, d] = startDateString.split('-').map(Number);
          return new Date(y, m - 1, d);
        })()
      : new Date();
    baseDate.setDate(baseDate.getDate() + i);

    const fsrsCard = createBaselineFSRSCard('normal');
    fsrsCard.due = baseDate;

    days.push({
      id: crypto.randomUUID(),
      wordIdRange: totalRange,
      surahNumber,
      pageNumbers,
      displayLabel,
      timePreference: 'Any',
      fsrsCard,
      reviewLogs: [],
      note: '',
      createdAt: new Date().toISOString(),
      isDeleted: false,

      // UI extensions
      details: slice.map(s => s.label), // stripped of surah prefix
      ruLabel,
    });
  }
  
  return days;
}

// ═══════════════════════════════════════════════════════════════════════════════
// distributeAyahs  — Ayah-level scheduling using surah_detail.ayah_ranges
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Uses surah_detail[N].ayah_ranges (keyed "page_N" → [firstAyah, lastAyah])
 * to distribute exact ayah bounds across durationDays daily buckets.
 */
export function distributeAyahs(
  ruRange: [number, number],
  durationDays: number,
  metadata: QuranMetadata,
  ruType: string,
  ruLabel?: string,
  startDateString?: string
): DailyTask[] {
  const entries = collectSUEntries(ruRange, 'Ayah', 'madani', metadata); // Ayahs always use madani detail structure
  const total = entries.length;
  if (total === 0) return [];

  const base = Math.floor(total / durationDays);
  const remainder = total % durationDays;

  const days: DailyTask[] = [];
  let currentIndex = 0;

  for (let i = 0; i < durationDays; i++) {
    const countForDay = i < durationDays - remainder ? base : base + 1;
    const slice = entries.slice(currentIndex, currentIndex + countForDay);
    currentIndex += countForDay;

    const baseDate = startDateString 
      ? (() => {
          const [y, m, d] = startDateString.split('-').map(Number);
          return new Date(y, m - 1, d);
        })()
      : new Date();
    baseDate.setDate(baseDate.getDate() + i);
    const fsrsCard = createBaselineFSRSCard('normal');
    fsrsCard.due = baseDate;

    if (slice.length === 0) {
      days.push({
        id: crypto.randomUUID(),
        wordIdRange: [0, 0],
        surahNumber: 1,
        pageNumbers: [],
        displayLabel: `0 Ayahs`,
        timePreference: 'Any',
        fsrsCard,
        reviewLogs: [],
        note: '',
        createdAt: new Date().toISOString(),
        isDeleted: false,
        details: [],
        ruType,
        ruLabel
      });
      continue;
    }

    const displayLabel = displayLabelFromAyahSlice(slice);
    const first = slice[0];
    const last = slice[slice.length - 1];

    days.push({
      id: crypto.randomUUID(),
      wordIdRange: [first.range[0], last.range[1]],
      surahNumber: first.surahNumber,
      pageNumbers: Array.from(new Set(slice.map(s => {
        // Find page number for this range
        const pageMap = metadata.madani.page as MetadataMap;
        for (const [pk, pr] of Object.entries(pageMap)) {
          if (pr[0] <= s.range[1] && pr[1] >= s.range[0]) return parseInt(pk, 10);
        }
        return 0;
      }))).filter(p => p > 0),
      displayLabel,
      timePreference: 'Any',
      fsrsCard,
      reviewLogs: [],
      note: '',
      createdAt: new Date().toISOString(),
      isDeleted: false,
      details: slice.map(s => s.label),
      ruType,
      ruLabel
    });
  }

  return days;
}


// ═══════════════════════════════════════════════════════════════════════════════
// Internal helpers
// ═══════════════════════════════════════════════════════════════════════════════

/** Returns surah name(s) covering a specific word ID range, optionally filtered by a constraint range. */
export function getSurahNamesForRange(
  range: [number, number],
  scriptStyle: ScriptStyle,
  metadata: QuranMetadata,
  constraintRange?: [number, number]
): string {
  const surahMap = (scriptStyle === 'madani' ? metadata.madani.surah : metadata.indopak.surah) as MetadataMap;
  if (!surahMap) return '';
  const [rS, rE] = range;
  const found: string[] = [];

  const surahEntries = Object.entries(surahMap).sort((a, b) => a[1][0] - b[1][0]);
  for (const [k, r] of surahEntries) {
    if (r[0] <= rE && r[1] >= rS) {
      // If a constraint is provided (e.g. we only care about Al-Mulk),
      // only include this surah if it overlaps with the constraint.
      if (constraintRange) {
        if (r[1] < constraintRange[0] || r[0] > constraintRange[1]) continue;
      }
      found.push(SURAH_NAMES[+k - 1]);
    }
  }

  if (found.length === 0) return '';
  if (found.length === 1) return found[0];
  return `${found[0]}–${found[found.length - 1]}`;
}

/** Remove a single interval from a pool, returning the remaining fragments. */
function subtractFromPool(pool: Interval[], remove: Interval): Interval[] {
  const result: Interval[] = [];
  for (const [s, e] of pool) {
    if (remove[1] < s || remove[0] > e) {
      result.push([s, e]);           // No overlap at all
    } else {
      if (s < remove[0]) result.push([s, remove[0] - 1]); // Left fragment
      if (e > remove[1]) result.push([remove[1] + 1, e]); // Right fragment
    }
  }
  return result;
}

/**
 * Iterate over a MetadataMap (sorted by start word id) and extract every
 * division that is fully covered by `pool`.
 * Modifies `pool` in-place via the returned remaining value.
 */
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
      pills.push({
        label:       labelFn(key),
        type,
        divisionKey: key,
        range,
        level,
        isGrouped:   false,
      });
      remaining = subtractFromPool(remaining, range);
    }
  }

  return { pills, remaining };
}

/**
 * Find all pages fully covered by `pool` and group consecutive page numbers
 * into single pills (e.g. pages 10,11,12 → "Pages 10–12").
 */
function extractGroupedPages(
  pool: Interval[],
  pageMap: MetadataMap,
  type: string
): { pills: Pill[]; remaining: Interval[] } {
  // Collect all covered pages
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

    // Extend while consecutive
    while (
      i + 1 < covered.length &&
      covered[i + 1].key === covered[i].key + 1
    ) {
      i++;
      last = covered[i];
    }

    const groupRange: Interval = [first.range[0], last.range[1]];
    const isGrouped = first.key !== last.key;

    pills.push({
      label:       isGrouped ? `Pages ${first.key}–${last.key}` : `Page ${first.key}`,
      type,
      divisionKey: String(first.key),
      range:       groupRange,
      level:       'low',
      isGrouped,
    });

    remaining = subtractFromPool(remaining, groupRange);
    i++;
  }

  return { pills, remaining };
}

/** Describe a leftover interval by which surah(s) it overlaps with. */
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
// 3. generatePills
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Top-down hierarchy engine.
 *
 * Given the merged memorized word-id pool, runs a series of containment checks
 * from the highest enabled graduation level down to Pages, then labels any
 * leftover fragments as partial surah descriptions.
 *
 * Execution order:
 *   Madani:  Juz → Surah → Hizb → Rub' → Page (grouped) → partial
 *   IndoPak: Manzil → Para → Surah → Ruku → Page (grouped) → partial
 *
 * "Surahs Only" view skips hierarchy, extracts complete Surahs first,
 * then maps remaining fragments to grouped Pages.
 */
export function generatePills(
  mergedRanges:       Interval[],
  viewMode:           ViewMode,
  graduationSettings: GraduationSettings,
  scriptStyle:        ScriptStyle,
  metadata:           QuranMetadata
): Pill[] {
  const pills: Pill[] = [];
  let remaining = [...mergedRanges];

  if (!remaining.length) return [];

  const { madani, indopak } = metadata;
  const surahMap = scriptStyle === 'madani' ? madani.surah : indopak.surah;
  const pageMap  = scriptStyle === 'madani' ? madani.page  : indopak.page;

  // ── SURAHS-ONLY VIEW ────────────────────────────────────────────────────────
  if (viewMode === 'surahs-only') {
    // 1. Complete Surahs
    const { pills: sp, remaining: r1 } = extractLevel(
      remaining, surahMap,
      k => `${SURAH_NAMES[Number(k) - 1] ?? `Surah ${k}`}`,
      'surah', 'high'
    );
    pills.push(...sp);
    remaining = r1;

    // 2. Leftover → grouped Pages
    const { pills: pp, remaining: r2 } = extractGroupedPages(remaining, pageMap, 'page');
    pills.push(...pp);
    remaining = r2;

    // 3. Sub-page fragments → partial
    for (const interval of remaining) {
      pills.push({
        label: describePartial(interval, surahMap),
        type: 'partial', divisionKey: '', range: interval,
        level: 'partial', isGrouped: false,
      });
    }

    return pills;
  }

  // ── DEFAULT GRADUATION MODE ──────────────────────────────────────────────────
  if (scriptStyle === 'madani') {
    const s = graduationSettings.madani;

    if (s.surahToJuz) {
      const { pills: p, remaining: r } = extractLevel(
        remaining, madani.juz, k => `Juz ${k}`, 'juz', 'high'
      );
      pills.push(...p); remaining = r;
    }

    if (s.hizbToSurah) {
      const { pills: p, remaining: r } = extractLevel(
        remaining, madani.surah,
        k => `${SURAH_NAMES[Number(k) - 1] ?? `Surah ${k}`}`,
        'surah', 'mid'
      );
      pills.push(...p); remaining = r;
    }

    if (s.rubToHizb) {
      const { pills: p, remaining: r } = extractLevel(
        remaining, madani.hizb, k => `Hizb ${k}`, 'hizb', 'mid'
      );
      pills.push(...p); remaining = r;
    }

    if (s.pageToRub) {
      const { pills: p, remaining: r } = extractLevel(
        remaining, madani.rub, k => `Rub' ${k}`, 'rub', 'low'
      );
      pills.push(...p); remaining = r;
    }

    if (s.ayahToPage) {
      const { pills: p, remaining: r } = extractGroupedPages(remaining, madani.page, 'page');
      pills.push(...p); remaining = r;
    }

  } else {
    // IndoPak
    const s = graduationSettings.indopak;

    if (s.paraToManzil) {
      const { pills: p, remaining: r } = extractLevel(
        remaining, indopak.manzil, k => `Manzil ${k}`, 'manzil', 'high'
      );
      pills.push(...p); remaining = r;
    }

    if (s.surahToPara) {
      const { pills: p, remaining: r } = extractLevel(
        remaining, indopak.para, k => `Para ${k}`, 'para', 'high'
      );
      pills.push(...p); remaining = r;
    }

    if (s.pageToSurah) {
      const { pills: p, remaining: r } = extractLevel(
        remaining, indopak.surah,
        k => `${SURAH_NAMES[Number(k) - 1] ?? `Surah ${k}`}`,
        'surah', 'mid'
      );
      pills.push(...p); remaining = r;
    }

    if (s.ayahToRuku) {
      // Mutually exclusive with ayahToPage — only one should be active
      const { pills: p, remaining: r } = extractLevel(
        remaining, indopak.ruku, k => `Ruku ${k}`, 'ruku', 'low'
      );
      pills.push(...p); remaining = r;
    } else if (s.ayahToPage) {
      const { pills: p, remaining: r } = extractGroupedPages(remaining, indopak.page, 'page');
      pills.push(...p); remaining = r;
    }
  }

  // ── PARTIAL LEFTOVERS ────────────────────────────────────────────────────────
  for (const interval of remaining) {
    pills.push({
      label:       describePartial(interval, surahMap),
      type:        'partial',
      divisionKey: '',
      range:       interval,
      level:       'partial',
      isGrouped:   false,
    });
  }

  return pills;
}

/**
 * The core scheduling engine.
 * Takes multiple revision units and a shared duration, then distributes all sub-units
 * sequentially across the timeline.
 */
export function distributeSequentially(
  ruItems: { 
    id?: string, 
    ruRange: [number, number], 
    suType: string, 
    ruLabel?: string, 
    ruType: string, 
    ruValue: string | number 
  }[],
  durationDays: number,
  scriptStyle: ScriptStyle,
  metadata: QuranMetadata,
  startDateString?: string
): (DailyTask & { ruId?: string })[] {
  if (durationDays < 1) return [];

  // 1. Collect all SUs across all RUs in queue order
  const allSUs: (SUEntry & { ruId?: string, ruLabel?: string, ruType: string, ruValue: string | number, suType: string })[] = [];
  for (const item of ruItems) {
    const entries = collectSUEntries(item.ruRange, item.suType, scriptStyle, metadata);
    allSUs.push(...entries.map(e => ({ 
      ...e, 
      ruId: item.id, 
      ruLabel: item.ruLabel, 
      ruType: item.ruType, 
      ruValue: item.ruValue,
      suType: item.suType
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
      // Create a truly empty day if needed
      const baseDate = startDateString 
        ? (() => {
            const [y, m, d] = startDateString.split('-').map(Number);
            return new Date(y, m - 1, d);
          })()
        : new Date();
      baseDate.setDate(baseDate.getDate() + i);
      const fsrsCard = createBaselineFSRSCard('normal');
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
        isDeleted: false,
        details: [],
      });
      continue;
    }

    // Finalize each sub-unit as its own standalone DailyTask
    const finalizeGroup = (group: typeof slice, dayIdx: number) => {
      if (group.length === 0) return;
      
      const first = group[0];
      const suType = first.suType;

      // Labeling logic
      let displayLabel = '';
      if (suType === 'Surah') displayLabel = SURAH_NAMES[first.surahNumber - 1] ?? first.label;
      else displayLabel = first.label;

      const totalRange: [number, number] = [group[0].range[0], group[group.length - 1].range[1]];

      // Page numbers for this specific RU group on this day
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
      const fsrsCard = createBaselineFSRSCard('normal');
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
      });
    };

    for (const item of slice) {
      finalizeGroup([item], i);
    }
  }

  return results;
}

/** Helper for beautiful Ayah labels in sequential scheduling */
function displayLabelFromAyahSlice(group: any[]): string {
  const first = group[0];
  const last = group[group.length - 1];
  
  // Extract ayah numbers from labels like "Ayah 5"
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

export function getRuLabel(type: string, value: string | number): string {
  if (type === 'Surah') {
    return `${value}. ${SURAH_NAMES[Number(value) - 1] || ''}`;
  }
  return `${type} ${value}`;
}

/**
 * Generates future projected tasks for a Revision Unit based on its FSRS due date
 * and its original planned duration.
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

  // Run the distribution logic for just this RU
  const items = [{
    id: ru.id,
    ruRange: range,
    suType: ru.scheduledUnitType,
    ruLabel: ruLabel,
    ruType: ru.unitType,
    ruValue: ru.unitValue
  }];

  const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
  const tasks = distributeSequentially(
    items, 
    duration, 
    scriptStyle, 
    metadata, 
    startDateStr
  );

  return tasks.map(t => {
    const d = new Date(t.fsrsCard.due);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    
    return {
      dateKey,
      ruLabel: ruLabel,
      displayLabel: t.displayLabel,
      ruId: ru.id,
      surahNumber: t.surahNumber,
      ruType: ru.unitType
    };
  });
}
