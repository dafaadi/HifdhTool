import { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { DailyTask } from '../../utils/memorizationEngine';
import './SchedulingDashboard.css';

export type DayTaskType = 'empty' | 'normal' | 'today' | 'hasTasks';

interface Props {
  taskMap: Record<string, DailyTask[]>;
}

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const TYPE_CLASS: Record<DayTaskType, string> = {
  empty:    'sd-cal-day--empty',
  normal:   '',
  today:    'sd-cal-day--today',
  hasTasks: 'sd-cal-day--has-tasks',
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

export function CalendarPreview({ taskMap }: Props) {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());

  // Modal State
  const [modalDate, setModalDate] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [activeNoteText, setActiveNoteText] = useState('');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('calendarNotes');
      if (stored) setNotes(JSON.parse(stored));
    } catch { /* ignore */ }
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
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const startDayOfWeek = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sun
    
    const cells: { dateKey: string | null; day: number | null; type: DayTaskType; dailyTasks: DailyTask[] }[] = [];
    
    // Padding start
    for (let i = 0; i < startDayOfWeek; i++) {
       cells.push({ dateKey: null, day: null, type: 'empty', dailyTasks: [] });
    }
    
    // Days of month
    for (let d = 1; d <= daysInMonth; d++) {
       const dateKey = `${currentYear}-${String(currentMonth+1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
       const isToday = 
         currentYear === today.getFullYear() && 
         currentMonth === today.getMonth() && 
         d === today.getDate();
         
       const dayTasks = taskMap[dateKey] || [];
       let type: DayTaskType = isToday ? 'today' : (dayTasks.length > 0 ? 'hasTasks' : 'normal');

       cells.push({ dateKey, day: d, type, dailyTasks: dayTasks });
    }
    
    // Padding end (to complete 5 or 6 rows)
    const trailing = (7 - (cells.length % 7)) % 7;
    for (let i = 0; i < trailing; i++) {
        cells.push({ dateKey: null, day: null, type: 'empty', dailyTasks: [] });
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
            <button className="sd-cal-nav-btn" title="Previous month" onClick={prevMonth}>
              <ChevronLeft size={16} />
            </button>
            <button className="sd-cal-nav-btn" title="Next month" onClick={nextMonth}>
              <ChevronRight size={16} />
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
                className={`sd-cal-day ${c.day ? 'sd-cal-day--active' : ''} ${TYPE_CLASS[c.type]} ${c.dailyTasks.length > 0 ? 'sd-cal-day--clickable' : ''}`}
                onClick={() => { if (c.dateKey) openModal(c.dateKey) }}
              >
                 {c.day && (
                   <>
                     <span className="sd-cal-day-num">{c.day}</span>
                     <div className="sd-cal-task-list">
                       {c.dailyTasks.map((t, idx) => (
                         <div key={idx} className="sd-cal-task-label" title={t.shortLabel}>
                           {t.shortLabel}
                         </div>
                       ))}
                       {c.dailyTasks.length === 0 && notes[c.dateKey as string] && (
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
                      <h4 className="sd-modal-task-title">{task.shortLabel}</h4>
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
