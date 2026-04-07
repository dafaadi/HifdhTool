import { useState, useEffect, useMemo, useRef } from 'react';
import './PreviouslyMemorizedCard.css';
import { BookMarked, ChevronDown, ChevronUp, Settings, X } from 'lucide-react';
import {
  generatePills,
  mergeOverlappingIntervals,
  SURAH_NAMES,
  type GraduationSettings,
  type ScriptStyle,
  type ViewMode,
  type QuranMetadata,
} from '../utils/memorizationEngine';
import { SearchableDropdown, type DropdownOption } from './ui/SearchableDropdown';
import rawMeta from '../data/quran-metadata.json';

// ── Constants ──────────────────────────────────────────────────────────────────

const metadata = rawMeta as unknown as QuranMetadata;
const STORAGE_KEY = 'hifdhRangesV2';

const MADANI_UNITS  = ['Juz', 'Surah', 'Hizb', "Rub'", 'Page', 'Ayah'] as const;
const INDOPAK_UNITS = ['Manzil', 'Para', 'Surah', 'Ruku', 'Page', 'Ayah'] as const;
type UnitType = typeof MADANI_UNITS[number] | typeof INDOPAK_UNITS[number];

type MetadataMap = Record<string, [number, number]>;

const DEFAULT_GRAD: GraduationSettings = {
  madani:  { surahToJuz: false, hizbToSurah: false, rubToHizb: false, pageToRub: false, ayahToPage: true },
  indopak: { paraToManzil: false, surahToPara: false, pageToSurah: false, ayahToRuku: false, ayahToPage: true },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function loadStored(): number[][] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch { /* empty */ }
  return [];
}

function buildOptions(
  unitType: UnitType,
  scriptStyle: ScriptStyle,
  mergedRanges: [number, number][],
): DropdownOption[] {
  if (unitType === 'Page' || unitType === 'Ayah') return [];

  const m = metadata as any;
  let map: MetadataMap;
  let labelFn: (k: string) => string;

  switch (unitType) {
    case 'Surah': {
      const src = scriptStyle === 'madani' ? m.madani.surah : m.indopak.surah;
      map = src; labelFn = k => `${k}. ${SURAH_NAMES[+k - 1] ?? ''}`; break;
    }
    case 'Juz':    map = m.madani.juz;     labelFn = k => `Juz ${k}`;     break;
    case 'Para':   map = m.indopak.para;   labelFn = k => `Para ${k}`;    break;
    case 'Hizb':   map = m.madani.hizb;    labelFn = k => `Hizb ${k}`;    break;
    case "Rub'":   map = m.madani.rub;     labelFn = k => `Rub' ${k}`;    break;
    case 'Ruku':   map = m.indopak.ruku;   labelFn = k => `Ruku ${k}`;    break;
    case 'Manzil': map = m.indopak.manzil; labelFn = k => `Manzil ${k}`;  break;
    default: return [];
  }

  return Object.entries(map)
    .map(([k, r]) => ({ label: labelFn(k), value: k, range: r as [number, number] }))
    // Exclude only FULLY contained options
    .filter(opt => !mergedRanges.some(([s, e]) => s <= opt.range[0] && e >= opt.range[1]));
}

// ── Component ──────────────────────────────────────────────────────────────────

interface Props { scriptStyle?: ScriptStyle; }

export function PreviouslyMemorizedCard({ scriptStyle = 'madani' }: Props) {

  // ── State ──
  const [stored, setStored] = useState<number[][]>(loadStored);

  const saveAndSet = (intervals: number[][]) => {
    const merged = mergeOverlappingIntervals(intervals);
    setStored(merged);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  };

  const mergedRanges = useMemo(
    () => mergeOverlappingIntervals(stored) as [number, number][],
    [stored]
  );

  // Form
  const [unitType, setUnitType]   = useState<UnitType>('Surah');
  const [selected, setSelected]   = useState<DropdownOption | null>(null);
  const [startPage, setStartPage] = useState('1');
  const [endPage, setEndPage]     = useState('1');
  const [error, setError]         = useState('');

  // Display controls
  const [viewMode, setViewMode]         = useState<ViewMode>('default');
  const [gradSettings, setGradSettings] = useState<GraduationSettings>(DEFAULT_GRAD);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sortOrder, setSortOrder]       = useState<'mushaf' | 'recent'>('mushaf');
  const [expanded, setExpanded]               = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const popoverRef = useRef<HTMLDivElement>(null);
  const gearRef    = useRef<HTMLButtonElement>(null);

  // Close popover on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        !popoverRef.current?.contains(e.target as Node) &&
        !gearRef.current?.contains(e.target as Node)
      ) setSettingsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Reset unit type when script changes to an incompatible one
  const activeUnits = scriptStyle === 'madani' ? MADANI_UNITS : INDOPAK_UNITS;
  useEffect(() => {
    if (!(activeUnits as readonly string[]).includes(unitType)) setUnitType('Surah');
  }, [scriptStyle]); // eslint-disable-line react-hooks/exhaustive-deps

  const maxPage = Object.keys(
    scriptStyle === 'madani'
      ? (metadata as any).madani.page
      : (metadata as any).indopak.page
  ).length;

  const options = useMemo(
    () => buildOptions(unitType, scriptStyle, mergedRanges),
    [unitType, scriptStyle, mergedRanges]
  );

  // ── Log handler ──
  const handleLog = () => {
    setError('');

    if (unitType === 'Ayah') {
      setError('Ayah-level precision needs extended metadata. Use Page or Surah for now.');
      return;
    }

    if (unitType === 'Page') {
      const sp = parseInt(startPage, 10);
      const ep = parseInt(endPage, 10);
      if (isNaN(sp) || isNaN(ep) || sp < 1 || ep < sp || ep > maxPage) {
        setError(`Enter valid pages 1–${maxPage} with start ≤ end.`);
        return;
      }
      const pm: MetadataMap =
        (metadata as any)[scriptStyle === 'madani' ? 'madani' : 'indopak'].page;
      const sw = pm[String(sp)]?.[0];
      const ew = pm[String(ep)]?.[1];
      if (!sw || !ew) { setError('Could not resolve page word IDs.'); return; }
      saveAndSet([...stored, [sw, ew]]);
      setStartPage('1');
      setEndPage('1');
      return;
    }

    if (!selected) { setError('Please select a unit.'); return; }
    saveAndSet([...stored, selected.range]);
    setSelected(null);
  };

  // ── Pill generation ──
  const pills = useMemo(
    () => generatePills(mergedRanges, viewMode, gradSettings, scriptStyle, metadata),
    [mergedRanges, viewMode, gradSettings, scriptStyle]
  );

  const sortedPills = useMemo(() =>
    sortOrder === 'mushaf'
      ? [...pills].sort((a, b) => a.range[0] - b.range[0])
      : pills,
    [pills, sortOrder]
  );

  const displayedPills = expanded ? sortedPills : sortedPills.slice(0, 6);

  // ── Graduation setting helpers ──
  const setMadani = (key: keyof GraduationSettings['madani'], val: boolean) =>
    setGradSettings(g => ({ ...g, madani: { ...g.madani, [key]: val } }));

  const setIndopak = (key: keyof GraduationSettings['indopak'], val: boolean) =>
    setGradSettings(g => {
      const next = { ...g.indopak, [key]: val };
      // Mutually exclusive toggles
      if (key === 'ayahToRuku' && val) next.ayahToPage = false;
      if (key === 'ayahToPage' && val) next.ayahToRuku = false;
      return { ...g, indopak: next };
    });

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="pm-card">

      {/* ── HEADER ── */}
      <div className="pm-header">
        <div className="pm-header-left">
          <div className="pm-icon"><BookMarked size={20} /></div>
          <div>
            <div className="pm-title">Previously Memorized</div>
            <div className="pm-subtitle">BUILD YOUR PROFILE OF MASTERY</div>
          </div>
        </div>
        <button className="pm-log-btn" onClick={handleLog}>
          + Log Memorization
        </button>
      </div>

      {error && <div className="pm-error">{error}</div>}

      {/* ── FORM ── */}
      <div className="pm-form">

        {/* Target input — Page inputs OR SearchableDropdown */}
        <div className="pm-field pm-field--target">
          {unitType === 'Page' ? (
            <>
              <label className="pm-label">PAGE RANGE</label>
              <div className="pm-page-range">
                <input
                  type="number" className="pm-page-input"
                  min={1} max={maxPage} value={startPage} placeholder="Start"
                  onChange={e => { setStartPage(e.target.value); setEndPage(e.target.value); }}
                />
                <span className="pm-page-to">to</span>
                <input
                  type="number" className="pm-page-input"
                  min={1} max={maxPage} value={endPage} placeholder="End"
                  onChange={e => setEndPage(e.target.value)}
                />
              </div>
            </>
          ) : unitType === 'Ayah' ? (
            <>
              <label className="pm-label">AYAH</label>
              <div className="pm-ayah-notice">
                Extended metadata required. Use Page or Surah.
              </div>
            </>
          ) : (
            <>
              <label className="pm-label">TARGET SURAH / PORTION</label>
              <SearchableDropdown
                options={options}
                onSelect={opt => { setSelected(opt); setError(''); }}
                selectedValue={selected?.value ?? null}
                activeValue={selected?.value ?? null}
                placeholder={`e.g. ${unitType === 'Surah' ? 'Al-Baqarah' : unitType + ' 1'}`}
                className="pm-dropdown"
              />
            </>
          )}
        </div>

        {/* Unit type select */}
        <div className="pm-field pm-field--unit">
          <label className="pm-label">UNIT TYPE</label>
          <div className="pm-select-wrap">
            <select
              className="pm-select"
              value={unitType}
              onChange={e => { setUnitType(e.target.value as UnitType); setSelected(null); setError(''); }}
            >
              {activeUnits.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <ChevronDown size={14} className="pm-select-chevron" />
          </div>
        </div>

      </div>

      {/* ── PILLS SECTION ── */}
      {mergedRanges.length > 0 && (
        <>
          <div className="pm-divider" />

          {/* Control row: Sort | View | Gear */}
          <div className="pm-controls-row">

            <div className="pm-control-group">
              <span className="pm-control-label">Sort:</span>
              <div className="pm-tab-group">
                <button
                  className={`pm-tab ${sortOrder === 'mushaf' ? 'pm-tab--active' : ''}`}
                  onClick={() => setSortOrder('mushaf')}
                >Mushaf</button>
                <button
                  className={`pm-tab ${sortOrder === 'recent' ? 'pm-tab--active' : ''}`}
                  onClick={() => setSortOrder('recent')}
                >Recent</button>
              </div>
            </div>

            <div className="pm-control-group">
              <span className="pm-control-label">View:</span>
              <div className="pm-select-wrap">
                <select
                  className="pm-select pm-select--sm"
                  value={viewMode}
                  onChange={e => setViewMode(e.target.value as ViewMode)}
                >
                  <option value="default">Default</option>
                  <option value="surahs-only">Surahs Only</option>
                </select>
                <ChevronDown size={12} className="pm-select-chevron" />
              </div>
            </div>

            {/* Gear + settings popover */}
            <div className="pm-gear-wrap">
              <button
                ref={gearRef}
                className={`pm-settings-btn ${settingsOpen ? 'pm-settings-btn--active' : ''}`}
                onClick={() => setSettingsOpen(o => !o)}
                title="Graduation settings"
              >
                <Settings size={15} />
              </button>

              {settingsOpen && (
                <div className="pm-settings-popover" ref={popoverRef}>
                  <div className="pm-popover-title">
                    Graduation · {scriptStyle === 'madani' ? 'Madani' : 'Indo-Pak'}
                  </div>

                  <div className="pm-checkbox-list">
                    {scriptStyle === 'madani' ? (
                      (([
                        ['ayahToPage',  "Ayahs → Pages"],
                        ['pageToRub',   "Pages → Rub'"],
                        ['rubToHizb',   "Rub' → Hizb"],
                        ['hizbToSurah', "Hizb → Surah"],
                        ['surahToJuz',  "Surahs → Juz"],
                      ]) as [keyof GraduationSettings['madani'], string][]).map(([key, lbl]) => (
                        <label className="pm-checkbox-row" key={key}>
                          <input
                            type="checkbox"
                            checked={gradSettings.madani[key]}
                            onChange={e => setMadani(key, e.target.checked)}
                          />
                          <span>{lbl}</span>
                        </label>
                      ))
                    ) : (
                      (([
                        ['ayahToPage',   "Ayahs → Pages"],
                        ['ayahToRuku',   "Ayahs → Ruku"],
                        ['pageToSurah',  "Pages → Surahs"],
                        ['surahToPara',  "Surahs → Para"],
                        ['paraToManzil', "Para → Manzil"],
                      ]) as [keyof GraduationSettings['indopak'], string][]).map(([key, lbl]) => (
                        <label className="pm-checkbox-row" key={key}>
                          <input
                            type="checkbox"
                            checked={gradSettings.indopak[key]}
                            onChange={e => setIndopak(key, e.target.checked)}
                          />
                          <span>{lbl}</span>
                          {(key === 'ayahToPage' || key === 'ayahToRuku') && (
                            <span className="pm-checkbox-hint">exclusive</span>
                          )}
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

          </div>{/* end pm-controls-row */}

          {/* Pills */}
          <div className="pm-pill-container">
            {displayedPills.map((pill, i) => (
              <div
                key={`${pill.type}-${pill.divisionKey}-${i}`}
                className={[
                  'pm-pill',
                  `pm-pill--${pill.type}`,
                  `pm-pill--${pill.level}`,
                  pill.isGrouped ? 'pm-pill--grouped' : '',
                ].filter(Boolean).join(' ')}
              >
                {pill.divisionKey && (
                  <span className="pm-pill-key">{pill.divisionKey}</span>
                )}
                <span className="pm-pill-label">{pill.label}</span>
              </div>
            ))}
          </div>

          {/* Expand / collapse */}
          {sortedPills.length > 6 && (
            <div className="pm-expand-row">
              <button className="pm-expand-btn" onClick={() => setExpanded(e => !e)}>
                {expanded
                  ? <><ChevronUp size={13} /> Show less</>
                  : <><ChevronDown size={13} /> Show all {sortedPills.length}</>}
              </button>
            </div>
          )}

          <div className="pm-actions-row">
            {confirmingClear ? (
              <div className="pm-confirm-group">
                <span className="pm-confirm-text">Permanently delete everything?</span>
                <button
                  className="pm-clear-btn pm-clear-btn--confirm"
                  onClick={() => {
                    saveAndSet([]);
                    setExpanded(false);
                    setConfirmingClear(false);
                  }}
                >
                  Yes, Clear All
                </button>
                <button
                  className="pm-cancel-btn"
                  onClick={() => setConfirmingClear(false)}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                className="pm-clear-btn"
                onClick={() => setConfirmingClear(true)}
              >
                <X size={12} /> Clear all
              </button>
            )}
          </div>
        </>
      )}

      {mergedRanges.length === 0 && (
        <div className="pm-empty">
          No memorization logged yet. Select a portion and click Log.
        </div>
      )}

    </div>
  );
}
