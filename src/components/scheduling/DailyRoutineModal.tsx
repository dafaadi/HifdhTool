import { useState, useEffect } from 'react';
import { X, Eye, Lightbulb, MessageSquare, RotateCw, AlertCircle, CheckCircle2, CheckCheck } from 'lucide-react';
import { type DailyTask, type QuranMetadata, type ScriptStyle } from '../../utils/memorizationEngine.v2';
import { Rating, type Card } from 'ts-fsrs';
import { quranFsrs, handleGradeScheduleUnit } from '../../utils/fsrsLogic';
import type { Schedule } from '../../types';
import rawMeta from '../../data/quran-metadata.json';
import './DailyRoutineModal.css';

const metadata = rawMeta as unknown as QuranMetadata;

interface DailyRoutineModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: DailyTask[];
  scriptStyle: ScriptStyle;
  currentDate: Date;
}

export function DailyRoutineModal({ isOpen, onClose, tasks, scriptStyle, currentDate }: DailyRoutineModalProps) {
  const [sessionQueue, setSessionQueue] = useState<DailyTask[]>([]);
  const [totalSessionTasks, setTotalSessionTasks] = useState(0);
  const [showText, setShowText] = useState(false);
  
  // Actualization Celebration State
  const [celebration, setCelebration] = useState<{ ruLabel: string, nextDueDate: string, isMegaCelebration?: boolean } | null>(null);
  
  // Visual Feedback State
  const [isFlashing, setIsFlashing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // 1. THE DECOUPLED SESSION QUEUE (The Clean Rewrite)
      // Initialize the active deck as a decoupled mutation-safe copy of the tasks.
      setSessionQueue([...tasks]);
      setTotalSessionTasks(tasks.length);
      setShowText(false);
      setCelebration(null);
      setIsFlashing(false);
    }
  }, [isOpen, tasks]);

  const isSessionComplete = sessionQueue.length === 0;

  if (!isOpen || totalSessionTasks === 0) return null;

  // Render "Routine Completed" summary when the queue is empty AND no portion actualization is pending
  if (isSessionComplete && !celebration) {
    return (
      <div className="drm-overlay">
        <div className="drm-content" style={{ alignItems: 'center', justifyContent: 'center', padding: '40px', minHeight: '300px' }}>
          <CheckCheck size={48} color="#4ade80" style={{ marginBottom: '16px' }} />
          <h2 style={{ color: '#4ade80', margin: '0 0 10px 0', fontFamily: "'Playfair Display', serif", fontSize: '1.8rem' }}>Routine Completed!</h2>
          <p style={{ color: '#a1a1aa', textAlign: 'center', margin: '0 0 24px 0', lineHeight: 1.5 }}>
            Excellent work. You've completed all scheduled portions for this session.
          </p>
          <button 
            className="pm-btn pm-btn--primary" 
            style={{ padding: '12px 32px', fontSize: '1rem' }} 
            onClick={onClose}
          >
            Close Session
          </button>
        </div>
      </div>
    );
  }

  const currentTask = sessionQueue[0];
  
  const handleGrade = (rating: Rating) => {
    if (!currentTask) return;

    // --- 1. MEMORY-ONLY "AGAIN" (Rating 1) ---
    if (rating === Rating.Again) {
      setIsFlashing(true);
      setTimeout(() => setIsFlashing(false), 300);
      
      // Calculate the FSRS penalty for current attempt
      const schedulingRecords = quranFsrs.repeat(currentTask.fsrsCard, currentDate);
      const recordLog = (schedulingRecords as any)[rating];

      // Tag the task object as failed today so we can trigger a micro-review on final pass
      const updatedTask = { 
        ...currentTask, 
        fsrsCard: recordLog.card,
        wasFailedToday: true 
      };
      
      // Move to back of the queue. CRITICAL: Do NOT call database save here to prevent duplication.
      setSessionQueue(prev => [...prev.slice(1), updatedTask]);
      setShowText(false);
      return;
    }

    // --- 2. PASSING ACTION (Ratings 2, 3, 4) ---
    const raw = localStorage.getItem('schedules');
    if (!raw) return;
    const schedules: Schedule[] = JSON.parse(raw);
    
    let targetScheduleId = '';
    for (const s of schedules) {
      if (s.revisionList.some(ru => ru.id === currentTask.ruId)) {
        targetScheduleId = s.id;
        break;
      }
    }

    if (!targetScheduleId) return;

    // Process final FSRS logic and DB persistence ONCE
    const { schedules: updatedSchedules, actualization } = handleGradeScheduleUnit(
      schedules,
      targetScheduleId,
      currentTask.ruId!,
      currentTask.id,
      rating,
      metadata,
      scriptStyle,
      currentDate,
      !!currentTask.wasFailedToday, // Carry history to the engine
      currentTask.fsrsCard         // Use the card state that may have been penalized
    );

    localStorage.setItem('schedules', JSON.stringify(updatedSchedules));

    // Calculate if this action exhausts the queue (for mega celebration tracking)
    const sessionWillBeDone = sessionQueue.length === 1;

    // Mark original task shell as isCompleted: true to persist in dashboard
    const taskShell = tasks.find(t => t.id === currentTask.id);
    if (taskShell) taskShell.isCompleted = true;

    // Track recently graded for animation state
    try {
      const recentlyGradedStr = localStorage.getItem('recentlyGradedTasks') || '[]';
      const recentlyGraded: {id: string, timestamp: number}[] = JSON.parse(recentlyGradedStr);
      recentlyGraded.push({ id: currentTask.id, timestamp: Date.now() });
      const validRecentlyGraded = recentlyGraded.filter(g => Date.now() - g.timestamp < 60000);
      localStorage.setItem('recentlyGradedTasks', JSON.stringify(validRecentlyGraded));
    } catch { /* ignore */ }

    window.dispatchEvent(new Event('hifdhSchedulesUpdated'));
    
    // UI reset and celebrations
    // We delay the queue update slightly to provide a smooth transition and prevent flickering
    setTimeout(() => {
      // 1. Remove the passed item from the active learning deck
      setSessionQueue(prev => prev.slice(1));

      // 2. Trigger Portion Actualization celebration if applicable
      if (actualization) {
        setCelebration({
           ruLabel: actualization.ruLabel,
           nextDueDate: actualization.newMacroDueDate,
           isMegaCelebration: sessionWillBeDone 
        });
      }
      
      setShowText(false);
    }, 150);
  };

  const handleContinue = () => {
    if (celebration?.isMegaCelebration) {
      onClose();
    } else {
      setCelebration(null);
    }
  };

  // FSRS Next Dates Preview
  const getIntervalLabel = (rating: Rating, now: Date) => {
    if (!currentTask) return '...';
    try {
      const card = { 
        ...currentTask.fsrsCard, 
        due: new Date(currentTask.fsrsCard.due),
        last_review: currentTask.fsrsCard.last_review ? new Date(currentTask.fsrsCard.last_review) : undefined
      };
      
      // Prevent FSRS crash in time travel if mock date is arbitrarily behind last_review (Negative delta_t)
      if (card.last_review && now < card.last_review) {
        return 'T-Travel';
      }

      const records = quranFsrs.repeat(card, now);
      const nextCard = (records as any)[rating].card as Card;
      const diff = nextCard.due.getTime() - now.getTime();
      
      const minutes = Math.floor(diff / (1000 * 60));
      if (minutes < 1) return '< 1m';
      if (minutes < 60) return `${minutes}m`;
      
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h`;
      
      const days = Math.round(hours / 24);
      if (days < 30) return `${days}d`;
      
      const months = (days / 30.4).toFixed(1);
      if (parseFloat(months) < 12) return `${months}mo`;
      
      return `${(parseFloat(months) / 12).toFixed(1)}y`;
    } catch (e) {
      return '?'; // Fallback to prevent complete UI crash
    }
  };

  return (
    <div className="drm-overlay">
      {currentTask && (
        <div 
          key={currentTask.id} 
          className={`drm-content ${isFlashing ? 'drm-content--flash' : ''} ${currentTask.isMacroRoutine === false ? 'drm-content--micro' : ''}`}
        >
        {/* Header */}
        <div className="drm-header">
          <div className="drm-header-left">
            <span className="drm-badge">DAILY ROUTINE</span>
            <span className="drm-counter">REMAINING: {sessionQueue.length}</span>
          </div>
          <button className="drm-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="drm-title-row">
          <h2 className="drm-task-title">
            {currentTask?.isMacroRoutine === false && (
              <span style={{ fontSize: '0.95em', fontWeight: 600, opacity: 0.8, marginRight: '8px' }}>
                Micro-Review:
              </span>
            )}
            Recite {currentTask?.ruLabel}
            {(currentTask?.ruLabel && currentTask?.displayLabel && !currentTask.ruLabel.includes(currentTask.displayLabel) && currentTask.ruType !== (currentTask as any).suType) && 
              `, ${currentTask.displayLabel}`
            }
          </h2>
          <div className="drm-progress-container">
             <div className="drm-progress-bar" style={{ width: `${((totalSessionTasks - sessionQueue.length + 1) / totalSessionTasks) * 100}%` }}></div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="drm-main">
          {currentTask && !showText ? (
            <div className="drm-reveal-gate">
              <button className="drm-reveal-btn" onClick={() => setShowText(true)}>
                <Eye size={20} />
                Reveal Text
              </button>
            </div>
          ) : currentTask ? (
            <div className="drm-quran-view" key={currentTask.id}>
               <div className="drm-quran-placeholder">
                  <div className="drm-quran-text">
                     بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                     <br />
                     ... {currentTask.displayLabel} content ...
                  </div>
                  <button className="drm-hint-btn">
                    <Lightbulb size={14} />
                    Show Hint
                  </button>
               </div>
            </div>
          ) : null}
        </div>

        {/* Footer Toolbar */}
        <div className="drm-toolbar">
          <button className="drm-note-btn">
            <MessageSquare size={16} />
            Add Note
          </button>
        </div>

        {/* Rating Section */}
        <div className="drm-rating-row">
           <button 
             className="drm-rating-btn drm-rating-btn--again" 
             onClick={() => handleGrade(Rating.Again)}
             title="Total blank, or completely relied on the revealed text"
           >
             <RotateCw size={24} />
             <span className="drm-rating-label">AGAIN</span>
             <span className="drm-rating-time">{getIntervalLabel(Rating.Again, currentDate)}</span>
           </button>
           
           <button 
             className="drm-rating-btn drm-rating-btn--hard" 
             onClick={() => handleGrade(Rating.Hard)}
             title="Remembered it, but with intense effort or multiple mistakes"
           >
             <AlertCircle size={24} />
             <span className="drm-rating-label">HARD</span>
             <span className="drm-rating-time">{getIntervalLabel(Rating.Hard, currentDate)}</span>
           </button>

           <button 
             className="drm-rating-btn drm-rating-btn--good" 
             onClick={() => handleGrade(Rating.Good)}
             title="Standard recitation, maybe some hesitation here and there"
           >
             <CheckCircle2 size={24} />
             <span className="drm-rating-label">GOOD</span>
             <span className="drm-rating-time">{getIntervalLabel(Rating.Good, currentDate)}</span>
           </button>

           <button 
             className="drm-rating-btn drm-rating-btn--easy" 
             onClick={() => handleGrade(Rating.Easy)}
             title="Mostly perfect, flowed like water"
           >
             <CheckCheck size={24} />
             <span className="drm-rating-label">EASY</span>
             <span className="drm-rating-time">{getIntervalLabel(Rating.Easy, currentDate)}</span>
           </button>
        </div>
      </div>
    )}

      {celebration && (
        <div className="drm-overlay" style={{ zIndex: 1100 }}>
          <div className="drm-content" style={{ maxWidth: '400px', padding: '32px', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>👏</div>
            <h2 style={{ color: '#f3f4f6', fontFamily: "'Playfair Display', serif", marginBottom: '12px' }}>أحسنت</h2>
            <p style={{ color: '#d1d5db', lineHeight: 1.6, marginBottom: '24px' }}>
              Great work on completing <strong>{celebration.ruLabel}</strong>. We ask Allah to accept your efforts 🤲
            </p>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', marginBottom: '24px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#9ca3af' }}>Next revision scheduled for:</p>
              <p style={{ margin: '4px 0 0 0', fontWeight: 'bold', color: '#74c69d' }}>
                {new Date(celebration.nextDueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            
            {celebration.isMegaCelebration && (
               <div style={{ marginBottom: '24px', color: '#74c69d', fontWeight: 500, fontSize: '0.95rem' }}>
                 Another congratulations for completing todays tasks 🎉 اللهم بارك
               </div>
            )}

            <button className="pm-btn pm-btn--primary" style={{ width: '100%', padding: '12px' }} onClick={handleContinue}>
              {celebration.isMegaCelebration ? 'Close Session' : 'Continue Session'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
