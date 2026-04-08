import { useState } from 'react';
import { RevisionScheduler } from './RevisionScheduler';
import { MemorizationScheduler } from './MemorizationScheduler';
import { CalendarPreview } from './CalendarPreview';
import type { ScriptStyle, DailyTask } from '../../utils/memorizationEngine';
import './SchedulingDashboard.css';

interface Props {
  scriptStyle: ScriptStyle;
}

export function SchedulingDashboard({ scriptStyle }: Props) {
  const [taskMap, setTaskMap] = useState<Record<string, DailyTask[]>>({});

  return (
    <div className="sd-section">
      <h2 className="sd-heading">
        Create your schedule to match a pace that suits you!
      </h2>

      <div className="sd-cards-row">
        <RevisionScheduler 
          scriptStyle={scriptStyle} 
          onGenerateTasks={(tasks) => setTaskMap(tasks)} 
          onClearTasks={() => setTaskMap({})} 
        />
        <MemorizationScheduler scriptStyle={scriptStyle} />
      </div>

      <CalendarPreview taskMap={taskMap} />
    </div>
  );
}
