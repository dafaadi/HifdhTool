import React, { useState, useEffect } from 'react';
import { 
  Pencil, 
  Trash2, 
  ChevronDown, 
  Filter, 
  Check, 
  X, 
  Clock 
} from 'lucide-react';
import type { Schedule, RevisionUnitData, ScheduleUnit } from '../../types';
import { SURAH_NAMES } from '../../utils/memorizationEngine';
import './ScheduleManager.css';

// ── Helpers ────────────────────────────────────────────────────────────────────

function getRuLabel(type: string, value: string | number): string {
  if (type === 'Surah') {
    return `Surah ${SURAH_NAMES[Number(value) - 1] || value}`;
  }
  return `${type} ${value}`;
}

function formatDate(dateInput: string | Date): string {
  const d = new Date(dateInput);
  return d.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

// ── Components ──────────────────────────────────────────────────────────────────

export function ScheduleManager() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [expandedSchedules, setExpandedSchedules] = useState<Record<string, boolean>>({});
  const [expandedRUs, setExpandedRUs] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadSchedules = () => {
    try {
      const raw = localStorage.getItem('schedules');
      if (raw) {
        setSchedules(JSON.parse(raw));
      } else {
        setSchedules([]);
      }
    } catch (e) {
      console.error("Error loading schedules:", e);
      setSchedules([]);
    }
  };

  useEffect(() => {
    loadSchedules();
    window.addEventListener('hifdhSchedulesUpdated', loadSchedules);
    return () => window.removeEventListener('hifdhSchedulesUpdated', loadSchedules);
  }, []);

  const saveSchedules = (updated: Schedule[]) => {
    setSchedules(updated);
    localStorage.setItem('schedules', JSON.stringify(updated));
    // Dispatch event so other components (like Calendar) update
    window.dispatchEvent(new Event('hifdhSchedulesUpdated'));
  };

  // ── Actions ──

  const toggleSchedule = (id: string) => {
    setExpandedSchedules(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleRU = (id: string) => {
    setExpandedRUs(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const startEditing = (sched: Schedule) => {
    setEditingId(sched.id);
    setEditTitle(sched.title);
  };

  const handleTitleSubmit = (id: string) => {
    const updated = schedules.map(s => s.id === id ? { ...s, title: editTitle } : s);
    saveSchedules(updated);
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    const updated = schedules.filter(s => s.id !== id);
    saveSchedules(updated);
    setDeletingId(null);
  };

  // ── Render ──

  return (
    <div className="sm-section">
      <div className="sm-header">
        <h2 className="sm-title">Schedule Manager</h2>
        <button className="sm-filter-btn">
          <Filter size={14} />
          Filter
        </button>
      </div>

      {schedules.length === 0 ? (
        <div className="sm-empty">
          No schedules created yet. Use the Revision Scheduler to generate one.
        </div>
      ) : (
        <div className="sm-list">
          {schedules.map((schedule, sIdx) => {
            const isExpanded = expandedSchedules[schedule.id];
            const isEditing = editingId === schedule.id;
            const isDeleting = deletingId === schedule.id;

            return (
              <div key={schedule.id} className="sm-schedule-card">
                {/* Level 1: Schedule Header */}
                <div className="sm-card-header" onClick={() => toggleSchedule(schedule.id)}>
                  <span className="sm-card-serial">{sIdx + 1}.</span>
                  
                  <div className="sm-card-title-row" onClick={e => isEditing && e.stopPropagation()}>
                    {isEditing ? (
                      <input 
                        className="sm-title-input"
                        autoFocus
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        onBlur={() => handleTitleSubmit(schedule.id)}
                        onKeyDown={e => e.key === 'Enter' && handleTitleSubmit(schedule.id)}
                      />
                    ) : (
                      <span className="sm-card-title">{schedule.title}</span>
                    )}
                  </div>

                  <div className="sm-card-actions" onClick={e => e.stopPropagation()}>
                    {!isEditing && (
                      <button className="sm-icon-btn" onClick={() => startEditing(schedule)}>
                        <Pencil size={15} />
                      </button>
                    )}
                    
                    <div style={{ position: 'relative' }}>
                      <button className="sm-icon-btn sm-icon-btn--delete" onClick={() => setDeletingId(isDeleting ? null : schedule.id)}>
                        <Trash2 size={15} />
                      </button>
                      
                      {isDeleting && (
                        <div className="sm-confirm-overlay">
                          <button className="sm-confirm-btn sm-confirm-btn--yes" onClick={() => handleDelete(schedule.id)}>Delete</button>
                          <button className="sm-confirm-btn sm-confirm-btn--no" onClick={() => setDeletingId(null)}>No</button>
                        </div>
                      )}
                    </div>

                    <ChevronDown size={18} className={`sm-chevron ${isExpanded ? 'sm-chevron--open' : ''}`} />
                  </div>
                </div>

                {/* Level 1: Expandable Content (RUs) */}
                {isExpanded && (
                  <div className="sm-card-body">
                    {schedule.revisionList.map(ru => {
                      const ruIsExpanded = expandedRUs[ru.id];
                      return (
                        <div key={ru.id} className="sm-ru-container">
                          {/* Level 2: RU Header */}
                          <div className="sm-ru-header" onClick={() => toggleRU(ru.id)}>
                            <div className="sm-ru-title-col">
                              <span className="sm-ru-name">{getRuLabel(ru.unitType, ru.unitValue)}</span>
                            </div>
                            
                            <div className="sm-ru-meta-col">
                              <span className="sm-label-fixed">Next Revision Date</span>
                              <span className="sm-date">{formatDate(ru.fsrsCard.due)}</span>
                              <ChevronDown size={14} className={`sm-chevron ${ruIsExpanded ? 'sm-chevron--open' : ''}`} />
                            </div>
                          </div>

                          {/* Level 2: Expandable Content (SUs) */}
                          {ruIsExpanded && (
                            <div className="sm-ru-body">
                              <div className="sm-su-list">
                                {ru.scheduleList.map(su => (
                                  <div key={su.id} className="sm-su-row">
                                    <span className="sm-su-label">{su.displayLabel}</span>
                                    
                                    <div className="sm-su-pref">
                                      <span>{su.timePreference}</span>
                                      <ChevronDown size={11} />
                                    </div>

                                    <span className="sm-su-date">{formatDate(su.fsrsCard.due)}</span>
                                    
                                    <div className="sm-icon-btn" style={{ opacity: 0.3 }}>
                                       <ChevronDown size={14} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
