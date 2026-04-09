import { useState, useEffect, useMemo } from 'react';
import { RevisionScheduler } from './RevisionScheduler';
import { MemorizationScheduler } from './MemorizationScheduler';
import { CalendarPreview } from './CalendarPreview';
import { ScheduleManager } from './ScheduleManager';
import { type ScriptStyle, type DailyTask, SURAH_NAMES } from '../../utils/memorizationEngine';
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

export function SchedulingDashboard({ scriptStyle }: Props) {
  const [previewTasks, setPreviewTasks] = useState<Record<string, DailyTask[]>>({});
  const [confirmedTasks, setConfirmedTasks] = useState<Record<string, DailyTask[]>>({});

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
            if (su.isDeleted) return;
            // fsrsCard.due might be a string in JSON
            const d = new Date(su.fsrsCard.due);
            const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            
            if (!taskMap[dateKey]) taskMap[dateKey] = [];
            
            const dailyTask: DailyTask = {
              ...su,
              ruLabel,
              details: [su.displayLabel] // Reconstruct minimal details
            };
            taskMap[dateKey].push(dailyTask);
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

  return (
    <div className="sd-section">
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

      <CalendarPreview taskMap={mergedTaskMap} />
      <ScheduleManager />
    </div>
  );
}
