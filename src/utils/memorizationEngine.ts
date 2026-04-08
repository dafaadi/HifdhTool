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
    // Math for ayahs would require deep ayah metadata. For now, estimate or return fixed number.
    // If you need exact ayahs in a juz, it's roughly ~200. We will support it properly later.
    return 100; 
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

export interface DailyTask {
  shortLabel: string;
  details: string[];
  ruLabel?: string; // The Revision Unit name (e.g. "Juz 30" or "2. Al-Baqarah")
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
  const ruIdx = hierarchy.indexOf(ruType as any);
  
  // Start from the item AFTER ruType in hierarchy
  const candidates = ruIdx === -1 ? [...hierarchy] : hierarchy.slice(ruIdx + 1);
  
  // Filter to only include SUs that have >1 sub-unit in the RU's range
  // (or are 'Ayah' / 'Page' which are always valid if they're below the RU)
  return candidates.filter(suType => {
    if (suType === 'Ayah') return true; // Always valid as lowest granularity
    const count = countSubUnits(ruRange, suType, scriptStyle, metadata);
    // Must have at least 2 sub-units in range to make scheduling meaningful,
    // unless the RU is itself a Surah (then 1 Page is valid)
    if (ruType === 'Surah') return count >= 1;
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
  ruLabel?: string
): DailyTask[] {
  if (durationDays < 1) return [];
  
  // ── Ayah handling using surah_detail ────────────────────────────────────────
  if (suType === 'Ayah') {
    return distributeAyahs(ruRange, durationDays, metadata, ruLabel);
  }

  const { madani, indopak } = metadata;
  let map: MetadataMap | undefined;
  
  if (scriptStyle === 'madani') {
    map = (madani as any)[suType.toLowerCase()];
    if (suType === "Rub'") map = madani.rub;
  } else {
    map = (indopak as any)[suType.toLowerCase()];
  }

  if (!map) return Array(durationDays).fill({ shortLabel: `0 ${suType}s`, details: [] });

  const [tS, tE] = ruRange;
  const overlapping: { key: string, label: string }[] = [];
  
  let labelFn = (k: string) => `${suType} ${k}`;
  if (suType === 'Surah') labelFn = k => `${k}. ${SURAH_NAMES[+k - 1] ?? ''}`;

  // Sort by start word ID to ensure chronological order
  const entries = Object.entries(map).sort((a,b) => a[1][0] - b[1][0]);
  for (const [k, r] of entries) {
    if (r[0] <= tE && r[1] >= tS) {
      overlapping.push({ key: k, label: labelFn(k) });
    }
  }
  
  const total = overlapping.length;
  if (total === 0) return Array(durationDays).fill({ shortLabel: `0 ${suType}s`, details: [] });
  
  const base = Math.floor(total / durationDays);
  const remainder = total % durationDays;
  
  const days: DailyTask[] = [];
  let currentIndex = 0;
  
  for (let i = 0; i < durationDays; i++) {
    const countForDay = i < durationDays - remainder ? base : base + 1;
    const slice = overlapping.slice(currentIndex, currentIndex + countForDay);
    currentIndex += countForDay;
    
    let shortLabel = '';
    if (slice.length === 0) shortLabel = `0 ${suType}s`;
    else if (slice.length === 1) {
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
    
    days.push({
      shortLabel,
      details: slice.map(s => s.label),
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
 * Works for any ruRange that covers one or more complete/partial surahs.
 */
function distributeAyahs(
  ruRange: [number, number],
  durationDays: number,
  metadata: QuranMetadata,
  ruLabel?: string
): DailyTask[] {
  const surahDetail = (metadata as any).madani?.surah_detail as
    Record<string, { weight_pages: number; ayah_ranges: Record<string, [number, number]> }>;

  if (!surahDetail) {
    return Array(durationDays).fill({ shortLabel: 'Ayahs (Meta missing)', details: [], ruLabel });
  }

  const [rS, rE] = ruRange;
  const surahMap = (metadata as any).madani?.surah as Record<string, [number, number]>;

  // Collect all (surahNum, pageKey, ayahStart, ayahEnd) entries that fall within ruRange
  const ayahEntries: { surahNum: number; pageNum: number; firstAyah: number; lastAyah: number }[] = [];

  for (const [surahKey, detail] of Object.entries(surahDetail)) {
    const surahRange = surahMap?.[surahKey];
    if (!surahRange) continue;
    // Skip if surah is entirely outside ruRange
    if (surahRange[1] < rS || surahRange[0] > rE) continue;

    for (const [pageKey, ayahRange] of Object.entries(detail.ayah_ranges)) {
      const pageNum = parseInt(pageKey.replace('page_', ''), 10);
      const pageWordRange = (metadata as any).madani?.page?.[String(pageNum)] as [number, number] | undefined;
      if (!pageWordRange) continue;
      // Only include pages that intersect the ruRange
      if (pageWordRange[1] < rS || pageWordRange[0] > rE) continue;

      ayahEntries.push({
        surahNum: parseInt(surahKey, 10),
        pageNum,
        firstAyah: ayahRange[0],
        lastAyah: ayahRange[1],
      });
    }
  }

  ayahEntries.sort((a, b) => a.pageNum - b.pageNum || a.surahNum - b.surahNum);

  const total = ayahEntries.length;
  if (total === 0) {
    return Array(durationDays).fill({ shortLabel: '0 Ayahs', details: [], ruLabel });
  }

  const base = Math.floor(total / durationDays);
  const remainder = total % durationDays;
  const days: DailyTask[] = [];
  let idx = 0;

  for (let i = 0; i < durationDays; i++) {
    const count = i < durationDays - remainder ? base : base + 1;
    const slice = ayahEntries.slice(idx, idx + count);
    idx += count;

    if (slice.length === 0) {
      days.push({ shortLabel: '0 Ayahs', details: [], ruLabel });
      continue;
    }

    // Compact short label: first-to-last surah + first-to-last ayah bounds
    const firstEntry = slice[0];
    const lastEntry  = slice[slice.length - 1];
    const firstSurahName = SURAH_NAMES[firstEntry.surahNum - 1] ?? `Surah ${firstEntry.surahNum}`;
    const lastSurahName  = SURAH_NAMES[lastEntry.surahNum - 1]  ?? `Surah ${lastEntry.surahNum}`;

    let shortLabel: string;
    if (firstEntry.surahNum === lastEntry.surahNum) {
      shortLabel = `${firstSurahName}: ${firstEntry.firstAyah}–${lastEntry.lastAyah}`;
    } else {
      shortLabel = `${firstSurahName} ${firstEntry.firstAyah} → ${lastSurahName} ${lastEntry.lastAyah}`;
    }

    // Detailed list: one entry per page/surah block
    const details = slice.map(e => {
      const surahName = SURAH_NAMES[e.surahNum - 1] ?? `Surah ${e.surahNum}`;
      return `${surahName}: Ayahs ${e.firstAyah}–${e.lastAyah}`;
    });

    days.push({ shortLabel, details, ruLabel });
  }

  return days;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Internal helpers
// ═══════════════════════════════════════════════════════════════════════════════

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
