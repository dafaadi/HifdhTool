import React, { useState, useMemo } from 'react';
import { Shuffle, GripVertical, ChevronDown, X as XIcon } from 'lucide-react';
import { SearchableDropdown, type DropdownOption } from '../ui/SearchableDropdown';
import {
  type ScriptStyle, type QuranMetadata, type DailyTask,
  SURAH_NAMES, isFullyContained, countSubUnits, distributeSUs, getValidSUs
} from '../../utils/memorizationEngine';
import rawMeta from '../../data/quran-metadata.json';
import './SchedulingDashboard.css';

const metadata = rawMeta as unknown as QuranMetadata;
const STORAGE_KEY = 'hifdhRangesV2';

const MADANI_UNITS  = ['Juz', 'Surah', 'Hizb', "Rub'"] as const;
const INDOPAK_UNITS = ['Manzil', 'Para', 'Surah', 'Ruku'] as const;

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
): DropdownOption[] {
  if (unitType === 'Page' || unitType === 'Ayah') return [];

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
    default: return [];
  }

  if (!map) return [];

  return Object.entries(map)
    .map(([k, r]) => ({ label: labelFn(k), value: k, range: r as [number, number] }))
    .filter(opt => isFullyContained(opt.range, mergedRanges));
}

function calculateDailyLoad(
  ruRange: [number, number],
  suType: string,
  durationDays: number,
  scriptStyle: ScriptStyle
): string {
  if (durationDays < 1) return '0 / day';
  
  const totalSUs = countSubUnits(ruRange, suType, scriptStyle, metadata);
  if (totalSUs === 0) return `0 ${suType}s/d`;
  if (durationDays >= totalSUs) return `~1 ${suType}/d`; // Less than 1 per day on average

  const base = Math.floor(totalSUs / durationDays);
  const remainder = totalSUs % durationDays;

  if (remainder === 0) {
    return `~${base} ${suType}s/d`;
  } else {
    // remainder days will take (base + 1), others will take (base)
    return `~${base} ${suType}s/d (last ${remainder}d: ${base + 1})`;
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
  scriptStyle: ScriptStyle;
  durationDays: number;
  isCustomOrder: boolean;
  onSuChange: (id: string, newSu: string) => void;
  onRemove: (id: string) => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
}

function RuListItem({
  item, index, scriptStyle, durationDays, isCustomOrder,
  onSuChange, onRemove, onDragStart, onDragOver, onDrop
}: RuListItemProps) {
  const suOptions = getValidSUs(item.ruType, item.range, scriptStyle, metadata);

  return (
    <div
      className="sd-ru-item"
      draggable={isCustomOrder}
      onDragStart={(e) => isCustomOrder && onDragStart(e, index)}
      onDragOver={isCustomOrder ? onDragOver : undefined}
      onDrop={(e) => isCustomOrder && onDrop(e, index)}
      style={{ opacity: isCustomOrder ? 1 : 0.95 }}
    >
      <div 
        className="sd-ru-handle" 
        style={{ cursor: isCustomOrder ? 'grab' : 'default', opacity: isCustomOrder ? 1 : 0.3 }}
        title={isCustomOrder ? "Drag to reorder" : "Enable Custom Priority to drag"}
      >
        <span className="sd-ru-serial">{index + 1}</span>
        <GripVertical size={13} />
      </div>
      <span className="sd-ru-name">{item.ruLabel}</span>
      <div className="sd-select-wrap">
        <select
          className="sd-select"
          value={item.suType}
          onChange={(e) => onSuChange(item.id, e.target.value)}
        >
          {suOptions.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <ChevronDown size={11} className="sd-select-chevron" />
      </div>
      <span className="sd-ru-task" style={{ fontSize: '0.75rem', fontWeight: 500 }}>
        {calculateDailyLoad(item.range, item.suType, durationDays, scriptStyle)}
      </span>
      <button
        className="sd-ru-remove"
        title="Remove from queue"
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
  const [unitType, setUnitType] = useState<string>('Surah');
  const [isCustomOrder, setIsCustomOrder] = useState<boolean>(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  
  const [hasGenerated, setHasGenerated] = useState<boolean>(false);

  const activeUnits = scriptStyle === 'madani' ? MADANI_UNITS : INDOPAK_UNITS;
  const [mergedRanges, setMergedRanges] = useState<number[][]>(() => loadStored());

  React.useEffect(() => {
    const handleUpdate = () => setMergedRanges(loadStored());
    window.addEventListener('hifdhRangesV2Updated', handleUpdate);
    return () => window.removeEventListener('hifdhRangesV2Updated', handleUpdate);
  }, []);

  const searchOptions = useMemo(
    () => buildRevisionOptions(unitType, scriptStyle, mergedRanges),
    [unitType, scriptStyle, mergedRanges]
  );

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
    if (revisionQueue.length === 0 || durationDays === '' || durationDays < 1) return;
    setHasGenerated(true);
    
    const taskMap: Record<string, DailyTask[]> = {};
    const today = new Date();
    
    for (const item of revisionQueue) {
      const daysArr = distributeSUs(item.range, item.suType, durationDays as number, scriptStyle, metadata, item.ruLabel);
      for (let i = 0; i < daysArr.length; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (!taskMap[dateKey]) taskMap[dateKey] = [];
        taskMap[dateKey].push(daysArr[i]);
      }
    }
    
    onGenerateTasks(taskMap);
  };

  const handleCancelPreview = () => {
    setHasGenerated(false);
    onClearTasks();
  };

  // "Confirm" persists the preview tasks permanently — no alert, no clear
  const handleConfirmSchedule = () => {
    setHasGenerated(false);
    setRevisionQueue([]);
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

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '8px' }}>
        <div style={{ flex: '0 0 auto' }}>
          <label className="sd-field-label">UNIT TYPE</label>
          <div className="sd-select-wrap">
            <select
              className="sd-select"
              value={unitType}
              onChange={e => setUnitType(e.target.value)}
            >
              {activeUnits.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <ChevronDown size={11} className="sd-select-chevron" />
          </div>
        </div>

        <div style={{ flex: 1, minWidth: '150px' }}>
          <label className="sd-field-label">CHOOSE (Only previously memorized)</label>
          <div className="pm-dropdown">
            <SearchableDropdown
              options={searchOptions}
              onSelect={handleSelect}
              selectedValue={null}
              activeValue={null}
              placeholder={`Add ${unitType}...`}
            />
          </div>
        </div>
        
        <div style={{ flex: '0 0 auto', maxWidth: '100px' }}>
          <label className="sd-field-label">DURATION (DAYS)</label>
          <input 
            type="number" className="sd-select" style={{width: '100%', boxSizing: 'border-box'}}
            min={1} value={durationDays} 
            onChange={e => {
              const val = e.target.value;
              setDurationDays(val === '' ? '' : Math.max(1, parseInt(val) || 1));
            }} 
          />
        </div>
      </div>

      <div className="sd-checkbox-group">
         <label className="sd-checkbox-label">
           <input type="checkbox" checked={isCustomOrder} onChange={handleToggleOrder} className="sd-checkbox" />
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
            scriptStyle={scriptStyle}
            durationDays={durationDays === '' ? 1 : durationDays}
            isCustomOrder={isCustomOrder}
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
              className="pm-btn" 
              style={{ flex: 1, padding: '8px', background: 'transparent', border: '1px solid #3f3f46', color: '#e4e4e7' }}
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
