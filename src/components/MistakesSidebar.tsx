import { useState } from 'react';
import type { MistakeEntry } from '../types';

export interface MistakesSidebarProps {
  mistakes: MistakeEntry[];
  onClear?: () => void;
  onDelete?: (id: string) => void;
  onUpdateComment?: (id: string, comment: string | undefined) => void;
  onMistakeClick?: (mistake: MistakeEntry) => void;
  activeMistakeId?: string | null;
  mobileOpen?: boolean;
  showAllMistakes?: boolean;
  onToggleShowAll?: () => void;
  width: number;
  onWidthChange: (w: number) => void;
}

const MistakeCommentEditor = ({ mistake, onUpdate }: { mistake: MistakeEntry, onUpdate?: (id: string, c: string | undefined) => void }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(mistake.comment || '');

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdate?.(mistake.id, text.trim() || undefined);
    setIsEditing(false);
  };
  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setText(mistake.comment || '');
    setIsEditing(false);
  };
  const handleDeleteComment = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdate?.(mistake.id, undefined);
  };

  if (isEditing) {
    return (
      <div className="mistake-comment-editor" onClick={e => e.stopPropagation()} style={{ marginTop: '0.5rem' }}>
         <textarea 
            value={text} 
            onChange={e => setText(e.target.value)} 
            autoFocus 
            rows={2} 
            style={{ width:'100%', padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-primary)', fontFamily: "'Montserrat', sans-serif" }} 
         />
         <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button onClick={handleSave} style={{ background: 'var(--primary-color)', color: 'white', border: 'none', padding: '0.2rem 0.6rem', borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.8rem' }}>Save</button>
            <button onClick={handleCancel} style={{ background: 'none', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', padding: '0.2rem 0.6rem', borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.8rem' }}>Cancel</button>
         </div>
      </div>
    );
  }

  if (mistake.comment) {
     return (
       <div className="mistake-comment" style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'var(--bg-color)', borderRadius: '0.25rem', borderLeft: '3px solid var(--primary-color)' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{mistake.comment}</p>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
            <button onClick={(e) => { e.stopPropagation(); setIsEditing(true); }} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.75rem', cursor: 'pointer', padding: 0 }}>Edit</button>
            <button onClick={handleDeleteComment} style={{ background: 'none', border: 'none', color: 'var(--danger-color)', fontSize: '0.75rem', cursor: 'pointer', padding: 0 }}>Delete</button>
          </div>
       </div>
     );
  }

  return (
     <button 
       onClick={(e) => { e.stopPropagation(); setIsEditing(true); }} 
       style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.8rem', cursor: 'pointer', marginTop: '0.5rem', textAlign: 'left', padding: 0, fontWeight: 500 }}
     >
       + Add Comment
     </button>
  );
};

export const MistakesSidebar = ({ mistakes, onClear, onDelete, onUpdateComment, onMistakeClick, activeMistakeId, mobileOpen, onClose, showAllMistakes, onToggleShowAll, width, onWidthChange }: MistakesSidebarProps & { onClose?: () => void }) => {
  const [confirming, setConfirming] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    
    const initialX = e.clientX;
    const initialWidth = width;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = initialX - moveEvent.clientX; // Dragging left increases width for a right-side sidebar
      const newWidth = Math.min(Math.max(initialWidth + delta, 280), 600);
      onWidthChange(newWidth);
    };

    const onMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'default';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'ew-resize';
  };

  return (
    <div 
      className={`mistakes-sidebar${mobileOpen ? ' mobile-open' : ''}${isResizing ? ' resizing' : ''}`}
      style={{ width: mobileOpen ? '100%' : `${width}px` }}
    >
      {!mobileOpen && (
        <div className="sidebar-resizer" onMouseDown={startResizing}>
          <div className="resizer-handle">
            <svg width="6" height="24" viewBox="0 0 6 24" fill="currentColor">
              <rect x="0" y="0" width="1.5" height="2" rx="0.75" />
              <rect x="3" y="0" width="1.5" height="2" rx="0.75" />
              <rect x="0" y="5" width="1.5" height="2" rx="0.75" />
              <rect x="3" y="5" width="1.5" height="2" rx="0.75" />
              <rect x="0" y="10" width="1.5" height="2" rx="0.75" />
              <rect x="3" y="10" width="1.5" height="2" rx="0.75" />
              <rect x="0" y="15" width="1.5" height="2" rx="0.75" />
              <rect x="3" y="15" width="1.5" height="2" rx="0.75" />
              <rect x="0" y="20" width="1.5" height="2" rx="0.75" />
              <rect x="3" y="20" width="1.5" height="2" rx="0.75" />
            </svg>
          </div>
        </div>
      )}
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.2rem 2rem', borderBottom: '1px solid var(--border-color)', background: 'transparent', zIndex: 10}}>
        <h2 style={{padding: 0, border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: '1.2rem'}}>Mistakes ({mistakes.length})</h2>
        {onClear && mistakes.length > 0 && (
          confirming ? (
            <div style={{display: 'flex', gap: '1rem'}}>
              <button 
                onClick={() => { onClear(); setConfirming(false); }} 
                style={{background: 'var(--danger-color)', border: 'none', color: 'white', padding: '0.2rem 0.8rem', borderRadius: '0.25rem', cursor: 'pointer', fontWeight: 600}}>Yes</button>
              <button 
                onClick={() => setConfirming(false)} 
                style={{background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '0.2rem 0.8rem', borderRadius: '0.25rem', cursor: 'pointer', fontWeight: 600}}>No</button>
            </div>
          ) : (
            <button 
             onClick={() => setConfirming(true)} 
             style={{background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem'}}>Clear All</button>
          )
        )}
      </div>
      
      {mistakes.length > 0 && (
         <div style={{ padding: '0.8rem 2rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'transparent' }}>
            <label onClick={onToggleShowAll} style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', cursor: 'pointer' }}>Show all mistakes</label>
            <div 
               onClick={onToggleShowAll}
               style={{ 
                 width: '36px', height: '20px', background: showAllMistakes ? 'var(--primary-color)' : 'var(--border-color)', 
                 borderRadius: '10px', position: 'relative', cursor: 'pointer', transition: 'background 0.2s'
               }}
            >
               <div style={{
                 position: 'absolute', top: '2px', left: showAllMistakes ? '18px' : '2px', 
                 width: '16px', height: '16px', background: 'white', borderRadius: '50%',
                 transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
               }} />
            </div>
         </div>
      )}

      <div className="mistakes-list" style={{ flex: 1, overflowY: 'auto' }}>
        {mistakes.map((mistake, i) => (
          <div 
             key={mistake.id} 
             className={`mistake-item ${activeMistakeId === mistake.id ? 'active' : ''}`}
             onClick={() => onMistakeClick?.(mistake)}
             style={{ cursor: onMistakeClick ? 'pointer' : 'default', border: activeMistakeId === mistake.id ? '2px solid var(--primary-color)' : '1px solid var(--border-color)', margin: '0.8rem 1.5rem', borderRadius: '0.75rem' }}
          >
            <div className="mistake-number">{i + 1}</div>
            <div className="mistake-details">
              <span className={`mistake-mode mistake-mode-${mistake.mode}`}>{mistake.mode.toUpperCase()}</span>
              <span className="mistake-text">{mistake.text}</span>
              <span className="mistake-loc">
                Ayah {mistake.ayahNumber} 
                {mistake.wordIndex !== undefined ? ` | Word ${mistake.wordIndex + 1}` : ''}
              </span>
              <MistakeCommentEditor mistake={mistake} onUpdate={onUpdateComment} />
            </div>
            {onDelete && (
              <button 
                 className="mistake-delete-btn"
                 onClick={(e) => { e.stopPropagation(); onDelete(mistake.id); }} 
                 title="Delete mistake"
              >
                 ×
              </button>
            )}
          </div>
        ))}
        {mistakes.length === 0 && <p className="empty-state" style={{ textAlign: 'center', marginTop: '3rem', color: 'var(--text-secondary)' }}>No mistakes recorded for this page.</p>}
      </div>

      <div className="sidebar-close-row">
        <button className="sidebar-close-btn" onClick={onClose} aria-label="Close">✕ Close</button>
      </div>
    </div>
  );
};
