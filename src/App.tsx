import { useState, useEffect, useMemo } from 'react';
import { QuranPage } from './components/QuranPage';
import { MistakesSidebar } from './components/MistakesSidebar';
import type { SelectMode, MistakeEntry } from './types';
import quranDataJson from './data/quran_v2.json';
import './App.css';

const englishSurahNames = [
  "Al-Fatihah", "Al-Baqarah", "Ali 'Imran", "An-Nisa", "Al-Ma'idah", "Al-An'am", "Al-A'raf", "Al-Anfal", "At-Tawbah", "Yunus", "Hud", "Yusuf", "Ar-Ra'd", "Ibrahim", "Al-Hijr", "An-Nahl", "Al-Isra", "Al-Kahf", "Maryam", "Taha", "Al-Anbiya", "Al-Hajj", "Al-Mu'minun", "An-Nur", "Al-Furqan", "Ash-Shu'ara", "An-Naml", "Al-Qasas", "Al-'Ankabut", "Ar-Rum", "Luqman", "As-Sajdah", "Al-Ahzab", "Saba", "Fatir", "Ya-Sin", "As-Saffat", "Sad", "Az-Zumar", "Ghafir", "Fussilat", "Ash-Shura", "Az-Zukhruf", "Ad-Dukhan", "Al-Jathiyah", "Al-Ahqaf", "Muhammad", "Al-Fath", "Al-Hujurat", "Qaf", "Ad-Dhariyat", "At-Tur", "An-Najm", "Al-Qamar", "Ar-Rahman", "Al-Waqi'ah", "Al-Hadid", "Al-Mujadila", "Al-Hashr", "Al-Mumtahanah", "As-Saff", "Al-Jumu'ah", "Al-Munafiqun", "At-Taghabun", "At-Talaq", "At-Tahrim", "Al-Mulk", "Al-Qalam", "Al-Haqqah", "Al-Ma'arij", "Nuh", "Al-Jinn", "Al-Muzzammil", "Al-Muddaththir", "Al-Qiyamah", "Al-Insan", "Al-Mursalat", "An-Naba", "An-Nazi'at", "'Abasa", "At-Takwir", "Al-Infitar", "Al-Mutaffifin", "Al-Inshiqaq", "Al-Buruj", "At-Tariq", "Al-A'la", "Al-Ghashiyah", "Al-Fajr", "Al-Balad", "Ash-Shams", "Al-Lail", "Ad-Duhaa", "Ash-Sharh", "At-Tin", "Al-'Alaq", "Al-Qadr", "Al-Bayyinah", "Az-Zalzalah", "Al-'Adiyat", "Al-Qari'ah", "At-Takathur", "Al-'Asr", "Al-Humazah", "Al-Fil", "Quraysh", "Al-Ma'un", "Al-Kawthar", "Al-Kafirun", "An-Nasr", "Al-Masad", "Al-Ikhlas", "Al-Falaq", "An-Nas"
];

const quranData = quranDataJson as any[];

function App() {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [mode, setMode] = useState<SelectMode>('ayah');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [mistakes, setMistakes] = useState<MistakeEntry[]>(() => {
    const saved = localStorage.getItem('quranMistakes');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('quranMistakes', JSON.stringify(mistakes));
  }, [mistakes]);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('darkMode');
    return saved === 'true';
  });

  const handleMistake = (mistakeData: Omit<MistakeEntry, 'id' | 'number' | 'pageNumber'>) => {
    setMistakes(prev => {
      const isDuplicate = prev.some(m => 
        m.pageNumber === currentPage &&
        m.mode === mistakeData.mode &&
        m.surahNumber === mistakeData.surahNumber &&
        m.ayahNumber === mistakeData.ayahNumber &&
        (mistakeData.mode !== 'word' || m.wordId === mistakeData.wordId) &&
        (mistakeData.mode !== 'letter' || (m.wordId === mistakeData.wordId && m.letterIndex === mistakeData.letterIndex)) &&
        (mistakeData.mode !== 'tashkeel' || (m.wordId === mistakeData.wordId && m.tashkeelIndex === mistakeData.tashkeelIndex))
      );

      if (isDuplicate) return prev;

      const pageMistakes = prev.filter(m => m.pageNumber === currentPage);
      return [
        ...prev,
        { ...mistakeData, pageNumber: currentPage, id: crypto.randomUUID(), number: pageMistakes.length + 1 }
      ];
    });
  };

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark-mode');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark-mode');
      localStorage.setItem('darkMode', 'false');
    }
  }, [darkMode]);

  const handleClear = () => {
    setMistakes(prev => prev.filter(m => m.pageNumber !== currentPage));
  };
  const handleDelete = (id: string) => setMistakes(prev => prev.filter(m => m.id !== id));
  
  const handleUpdateComment = (id: string, comment: string | undefined) => {
    setMistakes(prev => prev.map(m => m.id === id ? { ...m, comment } : m));
  };

  const [activeMistake, setActiveMistake] = useState<MistakeEntry | null>(null);

  const handleMistakeClick = (mistake: MistakeEntry) => {
    setActiveMistake(mistake);
    setMode(mistake.mode);
    setSidebarOpen(false); // close drawer on mobile so the highlight is visible

    // Using a slightly longer delay to ensure React commits the mode change to the DOM
    setTimeout(() => {
      let selector = '';
      if (mistake.mode === 'ayah') {
        selector = `[data-surah="${mistake.surahNumber}"][data-ayah="${mistake.ayahNumber}"]`;
      } else if (mistake.wordId !== undefined) {
        // Base selector for word, letter, and tashkeel is the unique word ID
        const wordSelector = `[data-word-id="${mistake.wordId}"]`;
        if (mistake.mode === 'word') {
          selector = wordSelector;
        } else if (mistake.mode === 'letter' && mistake.letterIndex !== undefined) {
          selector = `${wordSelector} [data-letter="${mistake.letterIndex}"]`;
        } else if (mistake.mode === 'tashkeel' && mistake.tashkeelIndex !== undefined) {
          selector = `${wordSelector} [data-tashkeel="${mistake.tashkeelIndex}"]`;
        }
      }

      if (selector) {
        const el = document.querySelector(selector);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }

      setTimeout(() => setActiveMistake(null), 2000);
    }, 300);
  };

  const surahMap = useMemo(() => {
    const map: { page: number, surah: number, name: string }[] = [];
    quranData.forEach((page: any) => {
      page.lines.forEach((line: any) => {
        if (line.line_type === 'surah_name' && line.surah_name) {
          map.push({ page: page.page_number, surah: line.surah_number, name: englishSurahNames[line.surah_number - 1] });
        }
      });
    });
    return map;
  }, []);

  return (
    <div className="app-layout">
      <header className="app-header">
        <h1>Quran Hifdh Tool</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button 
            className="toggle-btn dark-mode-toggle" 
            onClick={() => setDarkMode(!darkMode)}
          >
            {darkMode ? '☀️ Light' : '🌙 Dark'}
          </button>
          {/* Mode toggles: visible in header on desktop, moved to bottom bar on mobile via CSS */}
          <div className="mode-toggles">
            {(['ayah', 'word', 'letter', 'tashkeel'] as SelectMode[]).map((m) => (
              <button
                key={m}
                className={`toggle-btn ${mode === m ? 'active' : ''}`}
                onClick={() => setMode(m)}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)} Mode
              </button>
            ))}
          </div>
          {/* Hamburger — only visible on mobile */}
          <button className="hamburger-btn" onClick={() => setSidebarOpen(o => !o)} aria-label="Toggle mistakes">
            {sidebarOpen ? '✕' : '☰'}
          </button>
        </div>
      </header>
      
      <div className="pagination-bar">
        {/* Next page decrements visually because Arabic reads Right to Left */}
        <button onClick={() => setCurrentPage(p => Math.min(604, p + 1))} disabled={currentPage === 604}>Next Page ◀</button>
        <div className="page-inputs">
          <input 
            type="number" 
            min="1" max="604" 
            value={currentPage} 
            onChange={e => {
              const val = parseInt(e.target.value, 10);
              if (val >= 1 && val <= 604) setCurrentPage(val);
            }} 
          />
          <select 
            value={currentPage}
            onChange={e => {
              // Note: the select sets the page value to the associated page property of the surah
              setCurrentPage(parseInt(e.target.value, 10));
            }}
          >
            <option disabled value={currentPage}>-- Surah --</option>
            {surahMap.map((s, i) => (
              <option key={i} value={s.page}>{s.name} (Page {s.page})</option>
            ))}
          </select>
        </div>
        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>▶ Prev Page</button>
      </div>

      <main className="main-content">
        <div className="quran-wrapper">
          <QuranPage 
            mode={mode} 
            pageData={quranData[currentPage - 1] as any} 
            onMistake={handleMistake} 
            activeMistake={activeMistake}
          />
        </div>
        {/* Overlay — tapping outside closes sidebar on mobile */}
        {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
        <MistakesSidebar 
          mistakes={mistakes.filter(m => m.pageNumber === currentPage)} 
          onClear={handleClear} 
          onDelete={handleDelete} 
          onUpdateComment={handleUpdateComment}
          onMistakeClick={handleMistakeClick}
          activeMistakeId={activeMistake?.id}
          mobileOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
      </main>
      {/* Mobile bottom mode bar — hidden on desktop via CSS */}
      <div className="mobile-mode-bar">
        {(['ayah', 'word', 'letter', 'tashkeel'] as SelectMode[]).map((m) => (
          <button
            key={m}
            className={`mobile-mode-btn ${mode === m ? 'active' : ''}`}
            onClick={() => setMode(m)}
          >
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}

export default App;
