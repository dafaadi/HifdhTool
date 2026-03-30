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
            style={{ width:'100%', padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-primary)', fontFamily: 'inherit' }} 
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

export const MistakesSidebar = ({ mistakes, onClear, onDelete, onUpdateComment, onMistakeClick, activeMistakeId, mobileOpen, onClose }: MistakesSidebarProps & { onClose?: () => void }) => {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className={`mistakes-sidebar${mobileOpen ? ' mobile-open' : ''}`}>
      {/* Mobile-only close row */}
      <div className="sidebar-close-row">
        <button className="sidebar-close-btn" onClick={onClose} aria-label="Close">✕ Close</button>
      </div>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2rem', borderBottom: '1px solid var(--border-color)', background: 'var(--surface-color)', backdropFilter: 'blur(10px)', zIndex: 10}}>
        <h2 style={{padding: 0, border: 'none', background: 'transparent', color: 'var(--text-primary)'}}>Mistakes ({mistakes.length})</h2>
        {onClear && mistakes.length > 0 && (
          confirming ? (
            <div style={{display: 'flex', gap: '1rem'}}>
              <button 
                onClick={() => { onClear(); setConfirming(false); }} 
                style={{background: 'var(--danger-color)', border: 'none', color: 'white', padding: '0.2rem 0.8rem', borderRadius: '0.25rem', cursor: 'pointer', fontWeight: 600}}>Yes, Clear</button>
              <button 
                onClick={() => setConfirming(false)} 
                style={{background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '0.2rem 0.8rem', borderRadius: '0.25rem', cursor: 'pointer', fontWeight: 600}}>Cancel</button>
            </div>
          ) : (
            <button 
             onClick={() => setConfirming(true)} 
             style={{background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', fontWeight: 600}}>Clear All</button>
          )
        )}
      </div>
      <div className="mistakes-list">
        {mistakes.map((mistake) => (
          <div 
             key={mistake.id} 
             className={`mistake-item ${activeMistakeId === mistake.id ? 'active' : ''}`}
             onClick={() => onMistakeClick?.(mistake)}
             style={{ cursor: onMistakeClick ? 'pointer' : 'default', border: activeMistakeId === mistake.id ? '2px solid var(--primary-color)' : '1px solid var(--border-color)' }}
          >
            <div className="mistake-number">{mistake.number}</div>
            <div className="mistake-details">
              <span className="mistake-mode">{mistake.mode.toUpperCase()}</span>
              <span className="mistake-text">{mistake.text}</span>
              <span className="mistake-loc">
                Ayah {mistake.ayahNumber} 
                {mistake.wordIndex !== undefined ? ` | Word ${mistake.wordIndex + 1}` : ''}
              </span>
              <MistakeCommentEditor mistake={mistake} onUpdate={onUpdateComment} />
            </div>
            {onDelete && (
              <button 
                 onClick={(e) => { e.stopPropagation(); onDelete(mistake.id); }} 
                 style={{background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', fontSize: '1.4rem', padding: '0 0.5rem', opacity: 1, marginLeft: 'auto'}}
                 title="Delete mistake"
              >
                 ×
              </button>
            )}
          </div>
        ))}
        {mistakes.length === 0 && <p className="empty-state">No mistakes recorded yet.</p>}
      </div>
    </div>
  );
};
