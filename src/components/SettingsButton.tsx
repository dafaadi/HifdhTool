import { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';

interface SettingsButtonProps {
  /** Called after mushafType changes so callers can react (e.g. reset page) */
  onMushafTypeChange?: (type: 'madani' | 'indopak') => void;
  /** Called when dark mode is toggled, so callers can keep their own state in sync */
  onDarkModeChange?: (dark: boolean) => void;
  /** Called when word spacing changes, so callers can keep their own state in sync */
  onWordSpacingChange?: (spacing: number) => void;
}

export function SettingsButton({ onMushafTypeChange, onDarkModeChange, onWordSpacingChange }: SettingsButtonProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [mushafType, setMushafType] = useState<'madani' | 'indopak'>(() => {
    const saved = localStorage.getItem('mushafType');
    return saved === 'indopak' ? 'indopak' : 'madani';
  });
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('darkMode') === 'true';
  });
  const [wordSpacing, setWordSpacing] = useState<number>(() =>
    parseFloat(localStorage.getItem('quranWordSpacing') || '0.15')
  );

  // Sync dark mode class + localStorage, notify parent
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark-mode');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark-mode');
      localStorage.setItem('darkMode', 'false');
    }
    onDarkModeChange?.(darkMode);
  }, [darkMode]);

  // Sync mushafType to localStorage, notify parent
  useEffect(() => {
    localStorage.setItem('mushafType', mushafType);
    onMushafTypeChange?.(mushafType);
  }, [mushafType]);

  // Sync wordSpacing to localStorage, notify parent
  useEffect(() => {
    localStorage.setItem('quranWordSpacing', wordSpacing.toString());
    onWordSpacingChange?.(wordSpacing);
  }, [wordSpacing]);

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="toggle-btn"
        onClick={() => setShowSettings(s => !s)}
        title="Settings"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.6rem' }}
      >
        <Settings size={20} />
      </button>

      {showSettings && (
        <>
          {/* Desktop Dropdown */}
          <div className="settings-dropdown desktop-settings-menu">
            <div style={{ fontSize: '0.85rem', fontWeight: 600, padding: '0.5rem', color: 'var(--text-secondary)' }}>
              Mushaf Type
            </div>
            <div
              className={`settings-option ${mushafType === 'madani' ? 'active' : ''}`}
              style={{ padding: '0.5rem', cursor: 'pointer', borderRadius: '0.25rem', backgroundColor: mushafType === 'madani' ? 'var(--accent-letter)' : 'transparent' }}
              onClick={() => { setMushafType('madani'); setShowSettings(false); }}
            >
              Uthmanic (Hafs)
            </div>
            <div
              className={`settings-option ${mushafType === 'indopak' ? 'active' : ''}`}
              style={{ padding: '0.5rem', cursor: 'pointer', borderRadius: '0.25rem', backgroundColor: mushafType === 'indopak' ? 'var(--accent-letter)' : 'transparent' }}
              onClick={() => { setMushafType('indopak'); setShowSettings(false); }}
            >
              IndoPak (15-line)
            </div>
            {mushafType === 'indopak' && (
              <div style={{ padding: '0.5rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', marginTop: '0.5rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Word Spacing</span>
                  <span>{wordSpacing.toFixed(2)}em</span>
                </div>
                <input type="range" min="-0.2" max="1" step="0.05" value={wordSpacing}
                  onChange={e => setWordSpacing(parseFloat(e.target.value))}
                  style={{ width: '100%', cursor: 'pointer' }}
                />
              </div>
            )}
            <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
              <button
                className="dark-mode-toggle"
                style={{ width: '100%', justifyContent: 'center', padding: '0.5rem', borderRadius: '0.25rem' }}
                onClick={() => { setDarkMode(d => !d); setShowSettings(false); }}
              >
                {darkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
              </button>
            </div>
          </div>

          {/* Mobile Modal */}
          <div className="settings-modal-overlay mobile-settings-menu" onClick={() => setShowSettings(false)}>
            <div className="settings-modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Settings</h3>
                <button className="modal-close" onClick={() => setShowSettings(false)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="modal-section">
                  <label>Mushaf Type</label>
                  <div className="modal-options">
                    <button
                      className={`modal-opt-btn ${mushafType === 'madani' ? 'active' : ''}`}
                      onClick={() => { setMushafType('madani'); setShowSettings(false); }}
                    >
                      Uthmanic (Hafs)
                    </button>
                    <button
                      className={`modal-opt-btn ${mushafType === 'indopak' ? 'active' : ''}`}
                      onClick={() => { setMushafType('indopak'); setShowSettings(false); }}
                    >
                      IndoPak (15-line)
                    </button>
                  </div>
                </div>
                {mushafType === 'indopak' && (
                  <div className="modal-section">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <label>Word Spacing</label>
                      <span className="val-badge">{wordSpacing.toFixed(2)}em</span>
                    </div>
                    <input type="range" min="-0.2" max="1" step="0.05" value={wordSpacing}
                      onChange={e => setWordSpacing(parseFloat(e.target.value))}
                      style={{ width: '100%', cursor: 'pointer' }}
                    />
                  </div>
                )}
                <div className="modal-section">
                  <button className="modal-toggle-btn" onClick={() => { setDarkMode(d => !d); setShowSettings(false); }}>
                    {darkMode ? '☀️ Switch to Light Mode' : '🌙 Switch to Dark Mode'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
