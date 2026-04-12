import React, { useState, useMemo } from 'react';
import { Shuffle, GripVertical, ChevronDown, X as XIcon } from 'lucide-react';
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

function buildRevisionOptions(
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
      const isMemorized = isFullyContained(opt.range, mergedRanges);
      const isAlreadyAdded = excludedKeys.has(`${unitType}-${opt.value}`);
      return isMemorized && !isAlreadyAdded;
    });
}

function calculateDailyLoad(
  itemSUs: number,
  totalQueueSUs: number,
  globalDurationDays: number,
  suType: string
): { main: string; sub: string | null } {
  if (globalDurationDays < 1 || totalQueueSUs === 0 || itemSUs === 0) {
    return { main: `0 ${suType}/day`, sub: null };
  }
  
  // Assigned days for this RU is proportional to its share of the total SUs
  const assignedDays = Math.max(1, Math.round((itemSUs / totalQueueSUs) * globalDurationDays));

  const base = Math.floor(itemSUs / assignedDays);
  const remainder = itemSUs % assignedDays;
  const unitSuffix = base === 1 ? suType : `${suType}s`;

  if (remainder === 0) {
    return { main: `~${base} ${unitSuffix.toLowerCase()}/day`, sub: null };
  } else {
    return { 
      main: `~${base} ${unitSuffix.toLowerCase()}/day`, 
      sub: `(last ${remainder} ${remainder === 1 ? 'day' : 'days'}: ${base + 1})` 
    };
  }
}

interface RevisionItem {
  id: string; // unique
  ruLabel: string;
  ruValue: string;
  ruType: string;
  suType: string;
  range: [number, number];
}

interface RuListItemProps {
  item: RevisionItem;
  index: number;
  totalQueueSUs: number;
  scriptStyle: ScriptStyle;
  durationDays: number;
  isCustomOrder: boolean;
  onSuChange: (id: string, newSu: string) => void;
  onRemove: (id: string) => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  disabled?: boolean;
}

function RuListItem({
  item, index, totalQueueSUs, scriptStyle, durationDays, isCustomOrder,
  onSuChange, onRemove, onDragStart, onDragOver, onDrop, disabled = false
}: RuListItemProps) {
  const suOptions = getValidSUs(item.ruType, item.range, scriptStyle, metadata);
  const itemSUs = countSubUnits(item.range, item.suType, scriptStyle, metadata);

  return (
    <div
      className={`sd-ru-item ${disabled ? 'sd-ru-item--disabled' : ''}`}
      draggable={isCustomOrder && !disabled}
      onDragStart={(e) => (isCustomOrder && !disabled) && onDragStart(e, index)}
      onDragOver={(isCustomOrder && !disabled) ? onDragOver : undefined}
      onDrop={(e) => (isCustomOrder && !disabled) && onDrop(e, index)}
      style={{ opacity: (isCustomOrder && !disabled) ? 1 : (disabled ? 0.5 : 0.95) }}
    >
      <div 
        className="sd-ru-handle" 
        style={{ cursor: isCustomOrder ? 'grab' : 'default', opacity: isCustomOrder ? 1 : 0.3 }}
        title={isCustomOrder ? "Drag to reorder" : "Enable Custom Priority to drag"}
      >
        <span className="sd-ru-serial">{index + 1}</span>
        <GripVertical size={13} />
      </div>
      <div className="sd-ru-content-main">
        <span className="sd-ru-name">{item.ruLabel}</span>
        <span className="sd-ru-substats">Total {item.suType}s: {itemSUs}</span>
      </div>
      <div className="sd-select-wrap">
        <select
          className="sd-select"
          value={item.suType}
          disabled={disabled}
          onChange={(e) => onSuChange(item.id, e.target.value)}
        >
          {suOptions.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <ChevronDown size={11} className="sd-select-chevron" />
      </div>
      <div className="sd-ru-task-group">
        {(() => {
          const { main, sub } = calculateDailyLoad(itemSUs, totalQueueSUs, durationDays, item.suType);
          return (
            <>
              <span className="sd-ru-task-main">{main}</span>
              {sub && <span className="sd-ru-task-sub">{sub}</span>}
            </>
          );
        })()}
      </div>
      <button
        className="sd-ru-remove"
        title="Remove from queue"
        disabled={disabled}
        onClick={() => onRemove(item.id)}
      >
        <XIcon size={12} />
      </button>
    </div>
  );
}

interface Props {
  scriptStyle: ScriptStyle;
  onGenerateTasks: (tasks: Record<string, DailyTask[]>) => void;
  onClearTasks: () => void;
}

export function RevisionScheduler({ scriptStyle, onGenerateTasks, onClearTasks }: Props) {
  const [revisionQueue, setRevisionQueue] = useState<RevisionItem[]>([]);
  const [durationDays, setDurationDays] = useState<number | ''>(30);
  const [startDateString, setStartDateString] = useState<string>(new Date().toISOString().split('T')[0]);
  const [unitType, setUnitType] = useState<string>('Surah');
  const [isCustomOrder, setIsCustomOrder] = useState<boolean>(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [hasGenerated, setHasGenerated] = useState<boolean>(false);
  const [scheduledRUs, setScheduledRUs] = useState<Set<string>>(new Set());
  
  const loadSchedules = React.useCallback(() => {
    try {
      const raw = localStorage.getItem('schedules');
      if (!raw) {
        setScheduledRUs(new Set());
        return;
      }
      const schedules: Schedule[] = JSON.parse(raw);
      const set = new Set<string>();
      for (const s of schedules) {
        if (s.isDeleted) continue;
        for (const ru of s.revisionList) {
          if (ru.isDeleted) continue;
          set.add(`${ru.unitType}-${ru.unitValue}`);
        }
      }
      setScheduledRUs(set);
    } catch {
      setScheduledRUs(new Set());
    }
  }, []);

  React.useEffect(() => {
    loadSchedules();
    window.addEventListener('hifdhSchedulesUpdated', loadSchedules);
    return () => window.removeEventListener('hifdhSchedulesUpdated', loadSchedules);
  }, [loadSchedules]);
  
  const maxAllowedDays = useMemo(() => {
    if (revisionQueue.length === 0) return 365;
    const counts = revisionQueue.map(item => countSubUnits(item.range, item.suType, scriptStyle, metadata));
    const totalCount = counts.reduce((a, b) => a + b, 0);
    return (totalCount > 0 && isFinite(totalCount)) ? totalCount : 365;
  }, [revisionQueue, scriptStyle]);

  // Cap duration if it exceeds new limit
  React.useEffect(() => {
    if (durationDays !== '' && durationDays > maxAllowedDays) {
      setDurationDays(maxAllowedDays);
    }
  }, [maxAllowedDays, durationDays]);

  const durationOptions = useMemo(() => {
    if (maxAllowedDays <= 0) return [];
    // Generate sequential options 1...N
    return Array.from({ length: maxAllowedDays }, (_, i) => i + 1);
  }, [maxAllowedDays]);

  const activeUnits = scriptStyle === 'madani' ? MADANI_UNITS : INDOPAK_UNITS;
  const [mergedRanges, setMergedRanges] = useState<number[][]>(() => loadStored());

  React.useEffect(() => {
    const handleUpdate = () => setMergedRanges(loadStored());
    window.addEventListener('hifdhRangesV2Updated', handleUpdate);
    return () => window.removeEventListener('hifdhRangesV2Updated', handleUpdate);
  }, []);

  const searchOptions = useMemo(() => {
    const queueSet = new Set(revisionQueue.map(item => `${item.ruType}-${item.ruValue}`));
    // Combine permanently scheduled and currently in-queue RUs
    const combinedExcluded = new Set([...Array.from(scheduledRUs), ...Array.from(queueSet)]);
    return buildRevisionOptions(unitType, scriptStyle, mergedRanges, combinedExcluded);
  }, [unitType, scriptStyle, mergedRanges, scheduledRUs, revisionQueue]);

  const handleSelect = (opt: DropdownOption | null) => {
    if (!opt) return;
    if (revisionQueue.some(item => item.ruType === unitType && item.ruValue === opt.value)) return;

    const suOptions = getValidSUs(unitType, opt.range, scriptStyle, metadata);
    const defaultSu = suOptions.length > 0 ? suOptions[0] : 'Page';

    const newItem: RevisionItem = {
      id: `${unitType}-${opt.value}`,
      ruLabel: opt.label,
      ruValue: opt.value,
      ruType: unitType,
      suType: defaultSu,
      range: opt.range
    };

    let newQueue = [...revisionQueue, newItem];
    if (!isCustomOrder) {
      newQueue.sort((a, b) => a.range[0] - b.range[0]);
    }
    setRevisionQueue(newQueue);
  };

  const handleSuChange = (id: string, newSu: string) => {
    setRevisionQueue(q => q.map(item => item.id === id ? { ...item, suType: newSu } : item));
  };

  const handleRemove = (id: string) => {
    setRevisionQueue(q => q.filter(item => item.id !== id));
  };

  const handleToggleOrder = () => {
    if (!isCustomOrder) {
      setIsCustomOrder(true);
    } else {
      setIsCustomOrder(false);
      setRevisionQueue(q => [...q].sort((a, b) => a.range[0] - b.range[0]));
    }
  };

  const onDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const onDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;

    const newQueue = [...revisionQueue];
    const [draggedItem] = newQueue.splice(draggedIndex, 1);
    newQueue.splice(dropIndex, 0, draggedItem);
    setRevisionQueue(newQueue);
    setDraggedIndex(null);
  };

  const handleGenerate = () => {
    if (revisionQueue.length === 0 || durationDays === '' || durationDays < 1 || !startDateString) return;
    setHasGenerated(true);
    
    const taskMap: Record<string, DailyTask[]> = {};

    const ruItems = revisionQueue.map(item => ({
      id: item.id,
      ruRange: item.range,
      suType: item.suType,
      ruLabel: item.ruLabel,
      ruType: item.ruType,
      ruValue: item.ruValue
    }));

    const allDays = distributeSequentially(ruItems, durationDays as number, scriptStyle, metadata, startDateString);
    
    for (const task of allDays) {
      const d = new Date(task.fsrsCard.due);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!taskMap[dateKey]) taskMap[dateKey] = [];
      taskMap[dateKey].push(task);
    }
    
    onGenerateTasks(taskMap);
  };

  const handleCancelPreview = () => {
    setHasGenerated(false);
    onClearTasks();
  };

  // "Confirm" persists the preview tasks permanently
  const handleConfirmSchedule = () => {
    const ruItems = revisionQueue.map(item => ({
      id: item.id,
      ruRange: item.range,
      suType: item.suType,
      ruLabel: item.ruLabel,
      ruType: item.ruType,
      ruValue: item.ruValue
    }));

    const allScheduledTasks = distributeSequentially(ruItems, durationDays as number, scriptStyle, metadata, startDateString);

    const revisionList: RevisionUnitData[] = revisionQueue.map((item, idx) => {
      // Filter tasks belonging to THIS revision unit
      const myTasks = allScheduledTasks.filter(t => t.ruId === item.id);
      // Anchor RU due date to 7 days after its LAST scheduled task
      let fsrsCard;
      if (myTasks.length > 0) {
        const latestTime = Math.max(...myTasks.map(t => new Date(t.fsrsCard.due).getTime()));
        const anchorDate = new Date(latestTime);
        fsrsCard = createBaselineFSRSCard('normal', anchorDate);
        fsrsCard.due = new Date(anchorDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      } else {
        fsrsCard = createBaselineFSRSCard('normal');
      }
      
      // Calculate active days for this RU specifically
      const uniqueDays = new Set(myTasks.map(t => new Date(t.fsrsCard.due).toDateString())).size;

      return {
        id: item.id, // Keep original ID for color consistency
        unitType: item.ruType,
        unitValue: item.ruValue,
        scheduledUnitType: item.suType,
        scheduleList: myTasks, // Don't strip metadata
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
      title: 'Revision Schedule',
      createdAt: new Date().toISOString(),
      isDeleted: false,
      revisionList,
      startDate: startDateString
    };

    // 2. Persist to localStorage
    const existingRaw = localStorage.getItem('schedules');
    const schedules: Schedule[] = existingRaw ? JSON.parse(existingRaw) : [];
    schedules.push(newSchedule);
    localStorage.setItem('schedules', JSON.stringify(schedules));

    window.dispatchEvent(new Event('hifdhSchedulesUpdated'));

    // 3. Clear UI
    setHasGenerated(false);
    setRevisionQueue([]);
    onClearTasks();
  };

  return (
    <div className="sd-card sd-card--revision">
      <div className="sd-card-header">
        <div className="sd-card-icon sd-card-icon--revision">
          <Shuffle size={20} />
        </div>
        <h3 className="sd-card-title">Revision</h3>
        <span className="sd-badge sd-badge--strengthening">STRENGTHENING</span>
      </div>

      {/* Row 1: Controls for adding to queue */}
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
          <label className="sd-field-label">CHOOSE (Only previously memorized)</label>
          <div className="pm-dropdown">
            <SearchableDropdown
              options={searchOptions}
              onSelect={handleSelect}
              selectedValue={null}
              activeValue={null}
              disabled={hasGenerated}
              placeholder={`Add ${unitType}...`}
            />
          </div>
        </div>
      </div>

      {/* Row 2: Global Configuration */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '12px' }}>
        <div style={{ flex: 1, minWidth: '140px' }}>
          <label className="sd-field-label">DURATION (DAYS)</label>
          <div className="sd-select-wrap">
            <select 
              className="sd-select" 
              style={{ width: '100%' }}
              value={durationDays} 
              disabled={hasGenerated}
              onChange={e => setDurationDays(parseInt(e.target.value) || 1)}
            >
              {durationOptions.map(o => (
                 <option key={o} value={o}>{o} Day{o > 1 ? 's' : ''}</option>
              ))}
            </select>
            <ChevronDown size={11} className="sd-select-chevron" />
          </div>
        </div>

        <div style={{ flex: 1, minWidth: '140px' }}>
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

      <div className="sd-checkbox-group">
         <label className={`sd-checkbox-label ${hasGenerated ? 'sd-checkbox-label--disabled' : ''}`}>
           <input type="checkbox" checked={isCustomOrder} disabled={hasGenerated} onChange={handleToggleOrder} className="sd-checkbox" />
           Custom Priority (Drag & Drop)
         </label>
      </div>

      <div className="sd-ru-list" style={{ minHeight: '60px', maxHeight: '200px', overflowY: 'auto' }}>
        {revisionQueue.length === 0 && (
          <div style={{ fontSize: '0.85rem', color: '#6b7280', fontStyle: 'italic', padding: '10px 0', textAlign: 'center' }}>
            No units added. Choose a unit above to add to your revision queue.
          </div>
        )}
        {revisionQueue.map((item, idx) => (
          <RuListItem 
            key={item.id} 
            item={item} 
            index={idx} 
            totalQueueSUs={maxAllowedDays} // maxAllowedDays is the sum of all SUs
            scriptStyle={scriptStyle}
            durationDays={durationDays === '' ? 1 : durationDays}
            isCustomOrder={isCustomOrder}
            disabled={hasGenerated}
            onSuChange={handleSuChange}
            onRemove={handleRemove}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
          />
        ))}
      </div>
      
      {/* Action Footer */}
      <div style={{ marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        {!hasGenerated ? (
          <button 
            className="pm-btn pm-btn--primary" 
            style={{ width: '100%', padding: '8px' }}
            onClick={handleGenerate}
            disabled={revisionQueue.length === 0}
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
