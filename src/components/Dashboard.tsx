import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { ScriptStyle } from '../utils/memorizationEngine';
import { SettingsButton } from './SettingsButton';
import { PreviouslyMemorizedCard } from './PreviouslyMemorizedCard';
import { Logo } from './Logo';
import '../index.css';

function Dashboard() {
  const [darkMode, setDarkMode] = useState<boolean>(() =>
    localStorage.getItem('darkMode') === 'true'
  );
  const [scriptStyle, setScriptStyle] = useState<ScriptStyle>(() =>
    localStorage.getItem('mushafType') === 'indopak' ? 'indopak' : 'madani'
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark-mode', darkMode);
  }, [darkMode]);

  return (
    <div className="dashboard-root">
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <Logo />
          <Link
            to="/mushaf"
            title="Go to Annotation Tool"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: 'var(--bg-color)',
              padding: '0.375rem 0.75rem',
              borderRadius: '0.75rem',
              border: '1px solid var(--border-color)',
              textDecoration: 'none',
              color: 'var(--text-secondary)',
              fontSize: '1.2rem',
              fontWeight: 600,
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              whiteSpace: 'nowrap',
            }}
            onMouseOver={e => {
              (e.currentTarget as HTMLAnchorElement).style.background = 'var(--surface-color)';
              (e.currentTarget as HTMLAnchorElement).style.color = 'var(--primary-color)';
              (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
            }}
            onMouseOut={e => {
              (e.currentTarget as HTMLAnchorElement).style.background = 'var(--bg-color)';
              (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-secondary)';
              (e.currentTarget as HTMLAnchorElement).style.boxShadow = 'none';
            }}
          >
            Go to Mushaf →
          </Link>
        </div>
        <SettingsButton
          onDarkModeChange={setDarkMode}
          onMushafTypeChange={type => setScriptStyle(type === 'indopak' ? 'indopak' : 'madani')}
        />
      </header>

      <main className="dashboard-main">
        <PreviouslyMemorizedCard scriptStyle={scriptStyle} />
      </main>
    </div>
  );
}

export default Dashboard;
