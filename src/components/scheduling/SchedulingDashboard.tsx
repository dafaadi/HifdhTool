import { useState, useEffect, useMemo } from 'react';
import { RevisionScheduler } from './RevisionScheduler';
import { MemorizationScheduler } from './MemorizationScheduler';
import { CalendarPreview } from './CalendarPreview';
import { ScheduleManager } from './ScheduleManager';
import { DailyRoutineModal } from './DailyRoutineModal';
import { Brain, Sparkles } from 'lucide-react';
import { type ScriptStyle, type DailyTask, SURAH_NAMES } from '../../utils/memorizationEngine.v2';
import type { Schedule } from '../../types';
import './SchedulingDashboard.css';

interface Props {
  scriptStyle: ScriptStyle;
}

function getRuLabel(type: string, value: string | number): string {
  if (type === 'Surah') {
    return `${value}. ${SURAH_NAMES[Number(value) - 1] || ''}`;
  }
  return `${type} ${value}`;
}

function DailyActionCards({ 
  confirmedTasks, 
  onStartRevision,
  currentDate
}: { 
  confirmedTasks: Record<string, DailyTask[]>,
  onStartRevision: (tasks: DailyTask[]) => void,
  currentDate: Date
}) {
  const today = currentDate;
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const tasksForToday = confirmedTasks[todayKey] || [];
  
  // Group tasks by RU and consolidate into ranges
  const getConsolidatedLabels = (tasks: DailyTask[]): string[] => {
    if (tasks.length === 0) return ["None scheduled"];
    
    // Group by ruLabel (e.g. "Al-Baqarah")
    const groups: Record<string, DailyTask[]> = {};
    tasks.forEach(t => {
      const key = t.ruLabel || "Revision";
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });

    const labels = Object.entries(groups).map(([_ruLabel, ruTasks]) => {
      const sName = SURAH_NAMES[ruTasks[0].surahNumber - 1] || "";
      let finalLabel = "";

      if (ruTasks.length === 1) {
        finalLabel = ruTasks[0].displayLabel;
      } else {
        const getNum = (s: string) => {
          const m = s.match(/\d+/);
          return m ? parseInt(m[0], 10) : NaN;
        };
        const nums = ruTasks.map(t => getNum(t.displayLabel)).filter(n => !isNaN(n)).sort((a,b) => a-b);
        const typeMatch = ruTasks[0].displayLabel.match(/^[a-zA-Z']+/);
        const type = typeMatch ? typeMatch[0] : "";

        if (nums.length > 1 && (nums[nums.length-1] - nums[0] === nums.length - 1)) {
          finalLabel = `${type}s ${nums[0]}–${nums[nums.length-1]}`;
        } else {
          finalLabel = ruTasks.map(t => t.displayLabel).join(', ');
        }
      }
      
      if (finalLabel.includes(sName)) return finalLabel;
      return `${sName}: ${finalLabel}`;
    });

    if (labels.length > 3) {
      return [...labels.slice(0, 3), "..."];
    }
    return labels;
  };

  const revisionPortions = getConsolidatedLabels(tasksForToday);

  return (
    <div className="sd-action-row">
      {/* Revision Action */}
      <div className="sd-action-card sd-action-card--revision">
        <div className="sd-action-icon sd-action-icon--revision">
          <Sparkles size={24} />
        </div>
        <div className="sd-action-text-stack">
          <span className="sd-action-portion">Today's Portion</span>
          <div className="sd-action-label">
            {revisionPortions.map((lp, idx) => (
              <div key={idx}>{lp}</div>
            ))}
          </div>
        </div>
        <h3 className="sd-action-heading">Ready to revise?</h3>
        <button 
          className="sd-action-btn sd-action-btn--revision"
          onClick={() => onStartRevision(tasksForToday)}
        >
          Start Revision
        </button>
      </div>

      {/* Memorization Action */}
      <div className="sd-action-card sd-action-card--memorization">
        <div className="sd-action-icon sd-action-icon--memorization">
          <Brain size={24} />
        </div>
        <div className="sd-action-text-stack">
          <span className="sd-action-portion">Today's Portion</span>
          <div className="sd-action-label">
            {revisionPortions.map((lp, idx) => (
              <div key={idx}>{lp}</div>
            ))}
          </div>
        </div>
        <h3 className="sd-action-heading">Begin new Hifdh</h3>
        <button className="sd-action-btn sd-action-btn--memorization">Start Memorization</button>
      </div>
    </div>
  );
}

export function SchedulingDashboard({ scriptStyle }: Props) {
  const [virtualDate, setVirtualDate] = useState<Date>(new Date());
  const [isDevMode, setIsDevMode] = useState(false);

  useEffect(() => {
    setIsDevMode(localStorage.getItem('devMode') === 'true');
  }, []);

  const currentDate = isDevMode ? virtualDate : new Date();

  const [previewTasks, setPreviewTasks] = useState<Record<string, DailyTask[]>>({});
  const [confirmedTasks, setConfirmedTasks] = useState<Record<string, DailyTask[]>>({});
  const [sessionTasks, setSessionTasks] = useState<DailyTask[]>([]);
  const [isSessionOpen, setIsSessionOpen] = useState(false);

  const loadConfirmed = () => {
    try {
      const raw = localStorage.getItem('schedules');
      if (!raw) return setConfirmedTasks({});
      const schedules: Schedule[] = JSON.parse(raw);
      
      const taskMap: Record<string, DailyTask[]> = {};
      schedules.forEach(sched => {
        if (sched.isDeleted) return;
        sched.revisionList.forEach(ru => {
          if (ru.isDeleted) return;
          const ruLabel = getRuLabel(ru.unitType, ru.unitValue);
          
          ru.scheduleList.forEach(su => {
            // Reconstruct minimal details
            const dailyTask: DailyTask = {
              ...su,
              ruId: ru.id,
              ruType: ru.unitType,
              ruLabel,
              details: [su.displayLabel]
            };

            // 1. Future Scheduling (Only if not deleted/archived)
            if (!su.isDeleted) {
              const d = new Date(su.fsrsCard.due);
              const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              
              if (!taskMap[dateKey]) taskMap[dateKey] = [];
              taskMap[dateKey].push(dailyTask);
            }

            // 2. Shell pill tracking for completed tasks (even if archived/deleted)
            // We only show a shell if there is a successful review (Rating > 1)
            if (su.reviewLogs && su.reviewLogs.length > 0) {
              su.reviewLogs.forEach(log => {
                const ratingNum = typeof log.rating === 'number' ? log.rating : 3; // fallback to Good if weird
                if (ratingNum === 1) return; // Skip Anki "Again" as a completion shell

                const lrDate = new Date(log.review);
                const lrDateKey = `${lrDate.getFullYear()}-${String(lrDate.getMonth() + 1).padStart(2, '0')}-${String(lrDate.getDate()).padStart(2, '0')}`;
                
                if (!taskMap[lrDateKey]) taskMap[lrDateKey] = [];
                // Ensure we don't duplicate shells for the same task on the same day if user did Hard then Easy
                if (!taskMap[lrDateKey].some(t => t.id === dailyTask.id && t.isCompleted)) {
                  taskMap[lrDateKey].push({
                    ...dailyTask,
                    isMacroRoutine: (log as any).wasMacroRoutine ?? su.isMacroRoutine,
                    isCompleted: true
                  });
                }
              });
            }
          });
        });
      });
      setConfirmedTasks(taskMap);
    } catch (e) {
      console.error("Failed to load confirmed schedules:", e);
      setConfirmedTasks({});
    }
  };

  useEffect(() => {
    loadConfirmed();
    window.addEventListener('hifdhSchedulesUpdated', loadConfirmed);
    return () => window.removeEventListener('hifdhSchedulesUpdated', loadConfirmed);
  }, []);

  const mergedTaskMap = useMemo(() => {
    const merged = { ...confirmedTasks };
    Object.entries(previewTasks).forEach(([date, tasks]) => {
      if (!merged[date]) merged[date] = [];
      merged[date] = [...merged[date], ...tasks];
    });
    return merged;
  }, [confirmedTasks, previewTasks]);

  const handleStartRevision = (tasks: DailyTask[]) => {
    setSessionTasks(tasks);
    setIsSessionOpen(true);
  };

  return (
    <div className="sd-section">
      {isDevMode && (
        <div style={{ 
          background: 'rgba(239, 68, 68, 0.1)', 
          border: '1px solid #ef4444', 
          color: '#ef4444', 
          padding: '12px', 
          borderRadius: '8px', 
          marginBottom: '20px',
          fontWeight: 'bold',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>🛠 DEV MODE | Virtual Date: {currentDate.toLocaleDateString()}</span>
          <button 
            className="sd-cal-nav-btn" 
            onClick={() => setVirtualDate(new Date())}
            style={{ padding: '4px 12px', fontSize: '12px' }}
          >
            Reset to Today
          </button>
        </div>
      )}

      <h2 className="sd-heading">
        Create your schedule to match a pace that suits you!
      </h2>

      <div className="sd-cards-row">
        <RevisionScheduler 
          scriptStyle={scriptStyle} 
          onGenerateTasks={(tasks) => setPreviewTasks(tasks)} 
          onClearTasks={() => setPreviewTasks({})} 
        />
        <MemorizationScheduler scriptStyle={scriptStyle} />
      </div>

      <DailyActionCards 
        confirmedTasks={confirmedTasks} 
        onStartRevision={handleStartRevision}
        currentDate={currentDate}
      />

      <CalendarPreview 
        taskMap={mergedTaskMap} 
        scriptStyle={scriptStyle} 
        currentDate={currentDate}
        isDevMode={isDevMode}
        onDateClick={(d: Date) => isDevMode && setVirtualDate(d)}
      />
      <ScheduleManager />

      <DailyRoutineModal 
        isOpen={isSessionOpen}
        onClose={() => setIsSessionOpen(false)}
        tasks={sessionTasks}
        scriptStyle={scriptStyle}
        currentDate={currentDate}
      />
    </div>
  );
}
