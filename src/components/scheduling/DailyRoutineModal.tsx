import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Eye, Lightbulb, MessageSquare, RotateCw, AlertCircle, CheckCircle2, CheckCheck } from 'lucide-react';
import { type DailyTask } from '../../utils/memorizationEngine';
import { Rating, type Card } from 'ts-fsrs';
import { quranFsrs, handleGradeScheduleUnit } from '../../utils/fsrsLogic';
import type { Schedule } from '../../types';
import './DailyRoutineModal.css';

interface DailyRoutineModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: DailyTask[];
}

export function DailyRoutineModal({ isOpen, onClose, tasks }: DailyRoutineModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showText, setShowText] = useState(false);

  if (!isOpen || tasks.length === 0) return null;

  const currentTask = tasks[currentIndex];
  
  const handleGrade = (rating: Rating) => {
    const raw = localStorage.getItem('schedules');
    if (!raw) return;
    const schedules: Schedule[] = JSON.parse(raw);
    
    // We need to find which schedule this task belongs to.
    // In our system, RUs have unique IDs across all schedules.
    let targetScheduleId = '';
    for (const s of schedules) {
      if (s.revisionList.some(ru => ru.id === currentTask.ruId)) {
        targetScheduleId = s.id;
        break;
      }
    }

    if (!targetScheduleId) return;

    const updatedSchedules = handleGradeScheduleUnit(
      schedules,
      targetScheduleId,
      currentTask.ruId!,
      currentTask.id,
      rating,
      { isMacroRoutine: true } // Always true for now as we want the RU to move
    );

    localStorage.setItem('schedules', JSON.stringify(updatedSchedules));
    window.dispatchEvent(new Event('hifdhSchedulesUpdated'));
    // Auto-advance after a short delay or stay?
    // Let's stay so they see the result, but provide an "advance" button or just let them click next.
  };

  const nextTask = () => {
    if (currentIndex < tasks.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowText(false);
    }
  };

  const prevTask = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setShowText(false);
    }
  };

  // FSRS Next Dates Preview
  const now = new Date();
  const getIntervalLabel = (rating: Rating) => {
    const card = { ...currentTask.fsrsCard, due: new Date(currentTask.fsrsCard.due) };
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
  };

  return (
    <div className="drm-overlay">
      <div className="drm-content">
        {/* Header */}
        <div className="drm-header">
          <div className="drm-header-left">
            <span className="drm-badge">DAILY ROUTINE</span>
            <span className="drm-counter">CARD {currentIndex + 1} OF {tasks.length}</span>
          </div>
          <button className="drm-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="drm-title-row">
          <h2 className="drm-task-title">Recite {currentTask.ruLabel}, {currentTask.displayLabel}</h2>
          <div className="drm-progress-container">
             <div className="drm-progress-bar" style={{ width: `${((currentIndex + 1) / tasks.length) * 100}%` }}></div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="drm-main">
          {!showText ? (
            <div className="drm-reveal-gate">
              <button className="drm-reveal-btn" onClick={() => setShowText(true)}>
                <Eye size={20} />
                Reveal Text
              </button>
            </div>
          ) : (
            <div className="drm-quran-view">
               {/* Placeholder for Quran Text. In real App we'd use QuranPreview component. */}
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
          )}
        </div>

        {/* Footer Toolbar */}
        <div className="drm-toolbar">
          <div className="drm-nav-group">
            <button className="drm-nav-btn" onClick={prevTask} disabled={currentIndex === 0}>
              <ChevronLeft size={20} />
            </button>
            <button className="drm-nav-btn" onClick={nextTask} disabled={currentIndex === tasks.length - 1}>
              <ChevronRight size={20} />
            </button>
          </div>
          
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
             <span className="drm-rating-time">{getIntervalLabel(Rating.Again)}</span>
           </button>
           
           <button 
             className="drm-rating-btn drm-rating-btn--hard" 
             onClick={() => handleGrade(Rating.Hard)}
             title="Remembered it, but with intense effort or multiple mistakes"
           >
             <AlertCircle size={24} />
             <span className="drm-rating-label">HARD</span>
             <span className="drm-rating-time">{getIntervalLabel(Rating.Hard)}</span>
           </button>

           <button 
             className="drm-rating-btn drm-rating-btn--good" 
             onClick={() => handleGrade(Rating.Good)}
             title="Standard recitation, maybe some hesitation here and there"
           >
             <CheckCircle2 size={24} />
             <span className="drm-rating-label">GOOD</span>
             <span className="drm-rating-time">{getIntervalLabel(Rating.Good)}</span>
           </button>

           <button 
             className="drm-rating-btn drm-rating-btn--easy" 
             onClick={() => handleGrade(Rating.Easy)}
             title="Mostly perfect, flowed like water"
           >
             <CheckCheck size={24} />
             <span className="drm-rating-label">EASY</span>
             <span className="drm-rating-time">{getIntervalLabel(Rating.Easy)}</span>
           </button>
        </div>
      </div>
    </div>
  );
}
