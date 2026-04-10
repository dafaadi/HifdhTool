import { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { type DailyTask, SURAH_NAMES, type ScriptStyle, generateProjectedSUs, type ProjectedTask } from '../../utils/memorizationEngine';
import metadata from '../../data/quran-metadata.json';
import type { Schedule } from '../../types';
import './SchedulingDashboard.css';

export type DayTaskType = 'empty' | 'normal' | 'today' | 'hasTasks';

interface Props {
  taskMap: Record<string, DailyTask[]>;
  scriptStyle: ScriptStyle;
}

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const TASK_COLORS = [
  { bg: 'rgba(22, 101, 52, 0.2)',  border: '#166534', tx: '#86efac' }, // Rich Green
  { bg: 'rgba(21, 128, 61, 0.2)',  border: '#15803d', tx: '#4ade80' }, // Grass
  { bg: 'rgba(5, 150, 105, 0.2)',  border: '#059669', tx: '#6ee7b7' }, // Emerald
  { bg: 'rgba(4, 120, 87, 0.2)',   border: '#047857', tx: '#34d399' }, // Teal Green
  { bg: 'rgba(63, 98, 18, 0.2)',   border: '#3f6212', tx: '#bef264' }, // Olive Green
  { bg: 'rgba(101, 163, 13, 0.2)', border: '#65a30d', tx: '#d9f99d' }, // Lime Green
];

function getTaskStyles(ruId?: string) {
  if (!ruId) return TASK_COLORS[0];
  let hash = 0;
  for (let i = 0; i < ruId.length; i++) {
    hash = ruId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % TASK_COLORS.length;
  return TASK_COLORS[index];
}

const GRAY_PALETTE = [
  { bg: 'rgba(113, 113, 122, 0.1)', border: '#52525b', tx: '#a1a1aa' }, // Zinc
  { bg: 'rgba(100, 116, 139, 0.1)', border: '#475569', tx: '#94a3b8' }, // Slate
  { bg: 'rgba(115, 115, 115, 0.1)', border: '#525252', tx: '#a3a3a3' }, // Neutral
];

function getProjectedStyles(ruId?: string) {
  if (!ruId) return GRAY_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < ruId.length; i++) {
    hash = ruId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % GRAY_PALETTE.length;
  return GRAY_PALETTE[index];
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Cleanly renders the task label, hiding redundant Surah prefixes
 * for large units or Surah-level revisions.
 */
function TaskLabel({ task }: { task: DailyTask | ProjectedTask }) {
  const surahName = SURAH_NAMES[task.surahNumber - 1];
  const isLargeUnit = ['Juz', 'Para', 'Manzil'].includes(task.ruType || '');

  // If the label identifies itself (e.g. "Al-Baqarah" or "Juz 1"), 
  // we don't need a Surah prefix based on the starting word.
  const isSelfIdentified = task.displayLabel.includes(surahName || '___') || isLargeUnit;

  if (isSelfIdentified) {
    return <span>{task.displayLabel}</span>;
  }

  return (
    <>
      <span style={{ fontWeight: 700 }}>{surahName}:</span> {task.displayLabel}
    </>
  );
}

export function CalendarPreview({ taskMap, scriptStyle }: Props) {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());

  // Visibility States
  const [showProjections, setShowProjections] = useState(true);
  const [hiddenRuIds, setHiddenRuIds] = useState<Set<string>>(new Set());

  const loadVisibility = () => {
    try {
      const stored = localStorage.getItem('hifdhVisibility');
      if (stored) {
        const parsed = JSON.parse(stored);
        setShowProjections(parsed.showProjections ?? true);
        setHiddenRuIds(new Set(parsed.hiddenRuIds || []));
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    loadVisibility();
    window.addEventListener('hifdhVisibilityUpdated', loadVisibility);
    return () => window.removeEventListener('hifdhVisibilityUpdated', loadVisibility);
  }, []);

  const saveVisibility = (show: boolean, hidden: Set<string>) => {
    localStorage.setItem('hifdhVisibility', JSON.stringify({
      showProjections: show,
      hiddenRuIds: Array.from(hidden)
    }));
    window.dispatchEvent(new Event('hifdhVisibilityUpdated'));
  };

  // Modal State
  const [modalDate, setModalDate] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [activeNoteText, setActiveNoteText] = useState('');
  
  // Highlighting State
  const [recentlyGraded, setRecentlyGraded] = useState<{id: string, timestamp: number}[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('calendarNotes');
      if (stored) setNotes(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const loadRecentlyGraded = () => {
      try {
        const stored = localStorage.getItem('recentlyGradedTasks');
        if (stored) {
          setRecentlyGraded(JSON.parse(stored));
        }
      } catch { /* ignore */ }
    };
    loadRecentlyGraded();
    window.addEventListener('hifdhSchedulesUpdated', loadRecentlyGraded);
    return () => window.removeEventListener('hifdhSchedulesUpdated', loadRecentlyGraded);
  }, []);

  const saveNotes = (dateKey: string, text: string) => {
    const updated = { ...notes, [dateKey]: text };
    setNotes(updated);
    localStorage.setItem('calendarNotes', JSON.stringify(updated));
  };

  const openModal = (dateKey: string) => {
    setModalDate(dateKey);
    setActiveNoteText(notes[dateKey] || '');
  };

  const monthName = new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long' });

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else { setCurrentMonth(m => m - 1); }
  };

  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else { setCurrentMonth(m => m + 1); }
  };

  const calendarCells = useMemo(() => {
    // 0. Load projections
    const raw = localStorage.getItem('schedules');
    const schedules: Schedule[] = raw ? JSON.parse(raw) : [];
    const projections: Record<string, ProjectedTask[]> = {};
    
    schedules.forEach(s => {
      if (s.isDeleted) return;
      s.revisionList.forEach(ru => {
        if (ru.isDeleted || hiddenRuIds.has(ru.id)) return;
        const pts = generateProjectedSUs(ru, metadata as any, scriptStyle);
        pts.forEach(pt => {
          if (!projections[pt.dateKey]) projections[pt.dateKey] = [];
          projections[pt.dateKey].push(pt);
        });
      });
    });

    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const startDayOfWeek = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sun
    
    const cells: { 
      dateKey: string | null; 
      day: number | null; 
      type: DayTaskType; 
      dailyTasks: DailyTask[];
      projectedTasks: ProjectedTask[];
    }[] = [];
    
    // Padding start
    for (let i = 0; i < startDayOfWeek; i++) {
       cells.push({ dateKey: null, day: null, type: 'empty', dailyTasks: [], projectedTasks: [] });
    }
    
    // Days of month
    for (let d = 1; d <= daysInMonth; d++) {
       const dateKey = `${currentYear}-${String(currentMonth+1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
       const isToday = 
         currentYear === today.getFullYear() && 
         currentMonth === today.getMonth() && 
         d === today.getDate();
         
       const dayTasks = (taskMap[dateKey] || []).filter(t => !hiddenRuIds.has(t.ruId || ''));
       const dayProjections = showProjections ? (projections[dateKey] || []) : [];
       let type: DayTaskType = isToday ? 'today' : ((dayTasks.length > 0 || dayProjections.length > 0) ? 'hasTasks' : 'normal');

       cells.push({ dateKey, day: d, type, dailyTasks: dayTasks, projectedTasks: dayProjections });
    }
    
    // Padding end (to complete 5 or 6 rows)
    const trailing = (7 - (cells.length % 7)) % 7;
    for (let i = 0; i < trailing; i++) {
        cells.push({ dateKey: null, day: null, type: 'empty', dailyTasks: [], projectedTasks: [] });
    }
    
    return cells;
  }, [currentYear, currentMonth, taskMap, today]);

  const activeModalTasks = modalDate ? (taskMap[modalDate] || []) : [];

  return (
    <>
      <div className="sd-cal-section">
        <div className="sd-cal-top-row">
          <div className="sd-cal-meta">
            <h2>Current Schedule</h2>
            <p>{monthName} {currentYear} &bull; Consistent Devotion</p>
          </div>
          <div className="sd-cal-nav">
            <div className="sd-cal-nav-buttons">
              <button className="sd-cal-nav-btn" title="Previous month" onClick={prevMonth}>
                <ChevronLeft size={16} />
              </button>
              <button className="sd-cal-nav-btn" title="Next month" onClick={nextMonth}>
                <ChevronRight size={16} />
              </button>
            </div>

            <button 
              className={`sd-visibility-toggle ${!showProjections ? 'sd-visibility-toggle--off' : ''}`}
              onClick={() => saveVisibility(!showProjections, hiddenRuIds)}
            >
              {showProjections ? <Eye size={16} /> : <EyeOff size={16} />}
              <span>Project next routine</span>
            </button>
          </div>
        </div>

        <div className="sd-cal-grid">
          <div className="sd-cal-weekdays">
            {WEEKDAYS.map(d => (
              <div key={d} className="sd-cal-weekday">{d}</div>
            ))}
          </div>
          <div className="sd-cal-days">
            {calendarCells.map((c, i) => (
              <div 
                key={i} 
                className={`sd-cal-day ${c.day ? 'sd-cal-day--active' : ''} ${c.type === 'today' ? 'sd-cal-day--today' : ''} ${c.type === 'empty' ? 'sd-cal-day--empty' : ''} ${c.dailyTasks.length > 0 ? 'sd-cal-day--clickable' : ''}`}
                onClick={() => { if (c.dateKey) openModal(c.dateKey) }}
              >
                 {c.day && (
                   <>
                     <span className="sd-cal-day-num">{c.day}</span>
                     <div className="sd-cal-task-list">
                       {c.dailyTasks.map((t, idx) => {
                         const theme = getTaskStyles(t.ruId);
                         const isCompleted = t.isCompleted;
                         const isHighlighted = !isCompleted && recentlyGraded.some(g => g.id === t.id);

                         return (
                           <div 
                             key={idx} 
                             className={`sd-cal-task-label ${isCompleted ? 'sd-cal-task-label--completed' : ''} ${isHighlighted ? 'sd-cal-task-label--highlight' : ''}`} 
                             style={!isCompleted ? {
                               background: theme.bg,
                               border: `1px solid ${theme.border}`,
                               color: theme.tx
                             } : undefined}
                             title={`${SURAH_NAMES[t.surahNumber - 1]}: ${t.displayLabel}`}
                           >
                             <TaskLabel task={t} />
                             {isCompleted && <CheckCircle2 size={12} style={{ display: 'inline', marginLeft: '4px', verticalAlign: 'middle', marginTop: '-2px' }}/>}
                           </div>
                         );
                       })}
                       {c.projectedTasks.map((t, idx) => {
                         const theme = getProjectedStyles(t.ruId);
                         return (
                           <div 
                             key={`p-${idx}`} 
                             className="sd-cal-task-label sd-cal-task-label--projected" 
                             style={{
                               background: theme.bg,
                               border: `1px dashed ${theme.border}`,
                               color: theme.tx
                             }}
                             title={`[Projected] ${SURAH_NAMES[t.surahNumber - 1]}: ${t.displayLabel}`}
                           >
                             <span style={{fontSize: '9px', opacity: 0.6, marginRight: '4px'}}>NEXT:</span>
                             <TaskLabel task={t} />
                           </div>
                         );
                       })}
                       {c.dailyTasks.length === 0 && c.projectedTasks.length === 0 && notes[c.dateKey as string] && (
                          <div className="sd-cal-task-label sd-cal-task-label--note">Has Notes</div>
                       )}
                     </div>
                   </>
                 )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {modalDate && (
        <div className="sd-modal-overlay" onClick={() => setModalDate(null)}>
          <div className="sd-modal-content" onClick={e => e.stopPropagation()}>
            <div className="sd-modal-header">
              <h3>{
                (() => {
                  const [y, m, d] = modalDate.split('-').map(Number);
                  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                  });
                })()
              }</h3>
              <button className="sd-modal-close" onClick={() => setModalDate(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="sd-modal-body">
              {activeModalTasks.length === 0 ? (
                <p style={{ color: '#a1a1aa' }}>No tasks scheduled for this day.</p>
              ) : (
                <div className="sd-modal-tasks">
                  {activeModalTasks.map((task, idx) => (
                    <div key={idx} className="sd-modal-task-item">
                      {task.ruLabel && (
                        <p className="sd-modal-task-ru-label">{task.ruLabel}</p>
                      )}
                      <h4 className="sd-modal-task-title">{task.displayLabel}</h4>
                      <ul className="sd-modal-task-details">
                        {task.details.map((detail, didx) => (
                          <li key={didx}>{detail}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="sd-modal-notes-section">
                <label className="sd-field-label" style={{ display: 'block', marginBottom: '8px' }}>NOTES</label>
                <textarea 
                  className="sd-textarea" 
                  placeholder="Add custom notes or reflections for this day..."
                  value={activeNoteText}
                  onChange={e => setActiveNoteText(e.target.value)}
                />
                <button 
                  className="pm-btn pm-btn--primary" 
                  style={{ marginTop: '12px', width: '100%', padding: '10px' }}
                  onClick={() => {
                    saveNotes(modalDate, activeNoteText);
                    setModalDate(null);
                  }}
                >
                  Save Notes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
