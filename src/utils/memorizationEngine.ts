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
