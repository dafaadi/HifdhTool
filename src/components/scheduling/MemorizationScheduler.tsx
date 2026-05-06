import { useState, useMemo, useEffect, useCallback } from 'react';
import { BookOpen, ChevronDown, X as XIcon, Lock } from 'lucide-react';
import { SearchableDropdown, type DropdownOption } from '../ui/SearchableDropdown';
import {
  type ScriptStyle, type QuranMetadata, type DailyTask,
  SURAH_NAMES, isFullyContained, countSubUnits, getValidSUs,
  distributeSequentially
} from '../../utils/memorizationEngine.v2';
import type { Schedule, RevisionUnitData } from '../../types';
import { createBaselineFSRSCard } from '../../utils/fsrsLogic';
import rawMeta from '../../data/quran-metadata.json';
import './SchedulingDashboard.css';

const metadata = rawMeta as unknown as QuranMetadata;
const STORAGE_KEY = 'hifdhRangesV2';

const MADANI_UNITS  = ['Juz', 'Surah', 'Hizb', "Rub'", 'Page'] as const;
const INDOPAK_UNITS = ['Manzil', 'Para', 'Surah', 'Ruku', 'Page'] as const;

function loadStored(): number[][] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch { /* empty */ }
  return [];
}

function buildMemorizationOptions(
  unitType: string,
  scriptStyle: ScriptStyle,
  mergedRanges: number[][],
  excludedKeys: Set<string>
): DropdownOption[] {
  if (unitType === 'Ayah') return [];

  let map: Record<string, [number, number]> | undefined;
  let labelFn: (k: string) => string;

  switch (unitType) {
    case 'Surah': {
      const src = scriptStyle === 'madani' ? metadata.madani.surah : metadata.indopak.surah;
      map = src; labelFn = k => `${k}. ${SURAH_NAMES[+k - 1] ?? ''}`; break;
    }
    case 'Juz':    map = metadata.madani.juz;     labelFn = k => `Juz ${k}`;     break;
    case 'Para':   map = metadata.indopak.para;   labelFn = k => `Para ${k}`;    break;
    case 'Hizb':   map = metadata.madani.hizb;    labelFn = k => `Hizb ${k}`;    break;
    case "Rub'":   map = metadata.madani.rub;     labelFn = k => `Rub' ${k}`;    break;
    case 'Ruku':   map = metadata.indopak.ruku;   labelFn = k => `Ruku ${k}`;    break;
    case 'Manzil': map = metadata.indopak.manzil; labelFn = k => `Manzil ${k}`;  break;
    case 'Page': {
      map = scriptStyle === 'madani' ? metadata.madani.page : metadata.indopak.page;
      labelFn = k => `Page ${k}`;
      break;
    }
    default: return [];
  }

  if (!map) return [];

  return Object.entries(map)
    .map(([k, r]) => ({ label: labelFn(k), value: k, range: r as [number, number] }))
    .filter(opt => {
      // Memorization specifically ONLY wants units that are NOT fully memorized
      const isMemorized = isFullyContained(opt.range, mergedRanges);
      const isAlreadyAdded = excludedKeys.has(`${unitType}-${opt.value}`);
      return !isMemorized && !isAlreadyAdded;
    });
}

function calculateDurationDays(totalSUs: number, pace: number): number {
  if (pace < 1) return 1;
  return Math.ceil(totalSUs / pace);
}

interface MemoItem {
  id: string; // unique
  ruLabel: string;
  ruValue: string;
  ruType: string;
  suType: string;
  range: [number, number];
}

interface Props {
  scriptStyle: ScriptStyle;
  onGenerateTasks: (tasks: Record<string, DailyTask[]>) => void;
  onClearTasks: () => void;
}

export function MemorizationScheduler({ scriptStyle, onGenerateTasks, onClearTasks }: Props) {
  const [memoQueue, setMemoQueue] = useState<MemoItem[]>([]);
  const [pace, setPace] = useState<number>(3);
  const [startDateString, setStartDateString] = useState<string>(new Date().toISOString().split('T')[0]);
  const [unitType, setUnitType] = useState<string>('Surah');
  const [hasGenerated, setHasGenerated] = useState<boolean>(false);
  const [scheduledRUs, setScheduledRUs] = useState<Set<string>>(new Set());
  const [isLocked, setIsLocked] = useState<boolean>(false);
  
  const loadSchedules = useCallback(() => {
    try {
      const raw = localStorage.getItem('schedules');
      if (!raw) {
        setScheduledRUs(new Set());
        setIsLocked(false);
        return;
      }
      const schedules: Schedule[] = JSON.parse(raw);
      const set = new Set<string>();
      
      let foundLock = false;
      for (const s of schedules) {
        if (s.isDeleted) continue;
        if (s.type === 'memorization') foundLock = true;
        for (const ru of s.revisionList) {
          if (ru.isDeleted) continue;
          set.add(`${ru.unitType}-${ru.unitValue}`);
        }
      }
      setIsLocked(foundLock);
      setScheduledRUs(set);
    } catch {
      setScheduledRUs(new Set());
      setIsLocked(false);
    }
  }, []);

  useEffect(() => {
    loadSchedules();
    window.addEventListener('hifdhSchedulesUpdated', loadSchedules);
    return () => window.removeEventListener('hifdhSchedulesUpdated', loadSchedules);
  }, [loadSchedules]);
  
  const activeUnits = scriptStyle === 'madani' ? MADANI_UNITS : INDOPAK_UNITS;
  const [mergedRanges, setMergedRanges] = useState<number[][]>(() => loadStored());

  useEffect(() => {
    const handleUpdate = () => setMergedRanges(loadStored());
    window.addEventListener('hifdhRangesV2Updated', handleUpdate);
    return () => window.removeEventListener('hifdhRangesV2Updated', handleUpdate);
  }, []);

  const searchOptions = useMemo(() => {
    const queueSet = new Set(memoQueue.map(item => `${item.ruType}-${item.ruValue}`));
    const combinedExcluded = new Set([...Array.from(scheduledRUs), ...Array.from(queueSet)]);
    return buildMemorizationOptions(unitType, scriptStyle, mergedRanges, combinedExcluded);
  }, [unitType, scriptStyle, mergedRanges, scheduledRUs, memoQueue]);

  const handleSelect = (opt: DropdownOption | null) => {
    if (!opt) return;
    
    const suOptions = getValidSUs(unitType, opt.range, scriptStyle, metadata);
    const defaultSu = suOptions.length > 0 ? suOptions[0] : 'Page';

    const newItem: MemoItem = {
      id: `${unitType}-${opt.value}`,
      ruLabel: opt.label,
      ruValue: opt.value,
      ruType: unitType,
      suType: defaultSu,
      range: opt.range
    };

    setMemoQueue([newItem]); // Singleton queue
  };

  const currentItem = memoQueue.length > 0 ? memoQueue[0] : null;
  const currentTotalSUs = currentItem ? countSubUnits(currentItem.range, currentItem.suType, scriptStyle, metadata) : 0;

  // Automatically clamp pace if the new selection is smaller than current pace
  useEffect(() => {
    if (currentTotalSUs > 0 && pace > currentTotalSUs) {
      setPace(currentTotalSUs);
    }
  }, [currentTotalSUs, pace]);

  const calculatedDuration = currentTotalSUs > 0 ? calculateDurationDays(currentTotalSUs, pace) : 0;

  const handleGenerate = () => {
    if (memoQueue.length === 0 || !startDateString || pace < 1) return;
    setHasGenerated(true);
    
    const taskMap: Record<string, DailyTask[]> = {};

    const ruItems = memoQueue.map(item => ({
      id: item.id,
      ruRange: item.range,
      suType: item.suType,
      ruLabel: item.ruLabel,
      ruType: item.ruType,
      ruValue: item.ruValue
    }));

    const allDays = distributeSequentially(ruItems, calculatedDuration, scriptStyle, metadata, startDateString);
    
    for (const task of allDays) {
      const d = new Date(task.fsrsCard.due);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!taskMap[dateKey]) taskMap[dateKey] = [];
      
      // Explicitly set 'memorization' to ensure preview is correct
      taskMap[dateKey].push({ ...task, scheduleType: 'memorization' });
    }
    
    onGenerateTasks(taskMap);
  };

  const handleCancelPreview = () => {
    setHasGenerated(false);
    onClearTasks();
  };

  const handleConfirmSchedule = () => {
    const ruItems = memoQueue.map(item => ({
      id: item.id,
      ruRange: item.range,
      suType: item.suType,
      ruLabel: item.ruLabel,
      ruType: item.ruType,
      ruValue: item.ruValue
    }));

    const allScheduledTasks = distributeSequentially(ruItems, calculatedDuration, scriptStyle, metadata, startDateString);

    const revisionList: RevisionUnitData[] = memoQueue.map((item, idx) => {
      const myTasks = allScheduledTasks.filter(t => t.ruId === item.id);
      let fsrsCard;
      if (myTasks.length > 0) {
        const latestTime = Math.max(...myTasks.map(t => new Date(t.fsrsCard.due).getTime()));
        const anchorDate = new Date(latestTime);
        fsrsCard = createBaselineFSRSCard('normal', anchorDate);
        fsrsCard.due = new Date(anchorDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      } else {
        fsrsCard = createBaselineFSRSCard('normal');
      }
      
      const uniqueDays = new Set(myTasks.map(t => new Date(t.fsrsCard.due).toDateString())).size;

      return {
        id: item.id, 
        unitType: item.ruType,
        unitValue: item.ruValue,
        scheduledUnitType: item.suType,
        scheduleList: myTasks, 
        fsrsCard,
        reviewLogs: [],
        createdAt: new Date().toISOString(),
        isDeleted: false,
        priorityValue: idx + 1,
        routineDurationDays: uniqueDays,
        ruRange: item.range
      };
    });

    const newSchedule: Schedule = {
      id: crypto.randomUUID(),
      type: 'memorization',
      title: 'Memorization Schedule',
      createdAt: new Date().toISOString(),
      isDeleted: false,
      revisionList,
      startDate: startDateString
    };

    const existingRaw = localStorage.getItem('schedules');
    const schedules: Schedule[] = existingRaw ? JSON.parse(existingRaw) : [];
    schedules.push(newSchedule);
    localStorage.setItem('schedules', JSON.stringify(schedules));

    window.dispatchEvent(new Event('hifdhSchedulesUpdated'));

    setHasGenerated(false);
    setMemoQueue([]);
    onClearTasks();
  };

  if (isLocked) {
    return (
      <div className="sd-card sd-card--memorization" data-script={scriptStyle}>
        <div className="sd-card-header" style={{ opacity: 0.7 }}>
          <div className="sd-card-icon sd-card-icon--memorization">
            <Lock size={20} />
          </div>
          <h3 className="sd-card-title">Memorization</h3>
          <span className="sd-badge sd-badge--progress">LOCKED</span>
        </div>
        <div className="sd-memo-lock-alert">
          <span className="sd-memo-lock-alert-title">Active Schedule Exists</span>
          An active memorization schedule is currently ongoing. Please complete it or delete it from the Schedule Manager before creating a new one.
        </div>
      </div>
    );
  }

  return (
    <div className="sd-card sd-card--memorization" data-script={scriptStyle}>
      <div className="sd-card-header">
        <div className="sd-card-icon sd-card-icon--memorization">
          <BookOpen size={20} />
        </div>
        <h3 className="sd-card-title">Memorization</h3>
        <span className="sd-badge sd-badge--progress">NEW PROGRESS</span>
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '12px' }}>
        <div style={{ flex: '0 0 140px' }}>
          <label className="sd-field-label">UNIT TYPE</label>
          <div className="sd-select-wrap">
            <select
              className="sd-select"
              value={unitType}
              disabled={hasGenerated}
              onChange={e => setUnitType(e.target.value)}
              style={{ width: '100%' }}
            >
              {activeUnits.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <ChevronDown size={11} className="sd-select-chevron" />
          </div>
        </div>

        <div style={{ flex: 1, minWidth: '200px' }}>
          <label className="sd-field-label">CHOOSE (Only un-memorized)</label>
          <div className="pm-dropdown">
            <SearchableDropdown
              options={searchOptions}
              onSelect={handleSelect}
              selectedValue={currentItem?.id ?? null}
              activeValue={null}
              disabled={hasGenerated}
              placeholder={`Add ${unitType}...`}
            />
          </div>
        </div>
      </div>

      {currentItem && (
        <div className="sd-ru-item" style={{ marginBottom: '12px' }}>
          <div className="sd-ru-content-main">
            <span className="sd-ru-name">{currentItem.ruLabel}</span>
            <span className="sd-ru-substats">Total {currentItem.suType}s: {currentTotalSUs}</span>
          </div>
          <div className="sd-select-wrap">
            <select
              className="sd-select"
              value={currentItem.suType}
              disabled={hasGenerated}
              onChange={(e) => setMemoQueue([{ ...currentItem, suType: e.target.value }])}
            >
              {getValidSUs(currentItem.ruType, currentItem.range, scriptStyle, metadata).map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
            <ChevronDown size={11} className="sd-select-chevron" />
          </div>
          <button
            className="sd-ru-remove"
            title="Remove from queue"
            disabled={hasGenerated}
            onClick={() => setMemoQueue([])}
          >
            <XIcon size={12} />
          </button>
        </div>
      )}

      {/* Row 2: Global Configuration */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '12px' }}>
        <div style={{ flex: 1, minWidth: '140px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <label className="sd-field-label">DAILY PACE</label>
            <span className="sd-field-label" style={{ color: '#ca8a04' }}>{pace} {currentItem ? currentItem.suType : 'unit'}{pace > 1 ? 's' : ''}/day</span>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '4px' }}>
            <input 
              type="range"
              min={1} 
              max={currentTotalSUs || 10} 
              value={pace}
              disabled={hasGenerated || !currentItem}
              onChange={(e) => setPace(parseInt(e.target.value))}
              style={{ flex: 1 }}
            />
            <input 
              type="number"
              min={1} 
              max={currentTotalSUs || 10}
              className="sd-select"
              value={pace}
              disabled={hasGenerated || !currentItem}
              onChange={(e) => setPace(Math.min(parseInt(e.target.value) || 1, currentTotalSUs || 10))}
              style={{ width: '60px', padding: '6px' }}
            />
          </div>
          {currentItem && (
            <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px' }}>
              Estimated duration: {calculatedDuration} Day{calculatedDuration > 1 ? 's' : ''}
            </div>
          )}
        </div>

        <div style={{ flex: '0 0 140px' }}>
          <label className="sd-field-label">START DATE</label>
          <input 
            type="date" 
            className="sd-select sd-date-input" 
            style={{ width: '100%', boxSizing: 'border-box' }}
            disabled={hasGenerated}
            value={startDateString} 
            onChange={e => setStartDateString(e.target.value)} 
          />
        </div>
      </div>

      <div style={{ marginTop: 'auto', paddingTop: '16px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        {!hasGenerated ? (
          <button 
            className="pm-btn pm-btn--primary" 
            style={{ width: '100%', padding: '8px' }}
            onClick={handleGenerate}
            disabled={memoQueue.length === 0}
          >
            Generate & Preview Schedule
          </button>
        ) : (
          <>
            <button 
              className="pm-btn pm-btn--cancel" 
              style={{ flex: 1, padding: '8px' }}
              onClick={handleCancelPreview}
            >
              Cancel
            </button>
            <button 
              className="pm-btn pm-btn--primary" 
              style={{ flex: 2, padding: '8px' }}
              onClick={handleConfirmSchedule}
            >
              Confirm Schedule
            </button>
          </>
        )}
      </div>
    </div>
  );
}

