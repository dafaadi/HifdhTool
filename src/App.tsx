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

const SURAH_AYAH_COUNTS = [
  7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,98,5,12,12,10,7,4,3,6,5,5,4,5,4,5,5,4,6,5,3,6,3,6,6,4,5,5,6,6,6,6,5
];

function App() {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [inputPage, setInputPage] = useState<string>('1');
  const [scrollSurah, setScrollSurah] = useState<number>(1);
  const [surahLimits, setSurahLimits] = useState<{ surah: number, limit: number }[]>([]);

  // Rigid scroll-based surah detection
  useEffect(() => {
    const wrapper = document.querySelector('.quran-wrapper');
    if (!wrapper || surahLimits.length <= 1) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = wrapper;
      if (scrollHeight <= clientHeight) return;
      const scrollPercent = scrollTop / (scrollHeight - clientHeight);
      
      let activeSurah = surahLimits[0].surah;
      for (let i = 1; i < surahLimits.length; i++) {
        if (scrollPercent >= surahLimits[i].limit) {
          activeSurah = surahLimits[i].surah;
        } else {
          break;
        }
      }
      if (activeSurah !== scrollSurah) setScrollSurah(activeSurah);
    };

    wrapper.addEventListener('scroll', handleScroll, { passive: true });
    return () => wrapper.removeEventListener('scroll', handleScroll);
  }, [surahLimits, scrollSurah]);

  // Keyboard shortcuts for modes: A, S, D, F
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in the page number input
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) return;
      
      switch (e.key.toLowerCase()) {
        case 'a': setMode('ayah'); break;
        case 's': setMode('word'); break;
        case 'd': setMode('letter'); break;
        case 'f': setMode('tashkeel'); break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [mode, setMode] = useState<SelectMode>('ayah');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [showAllMistakes, setShowAllMistakes] = useState<boolean>(false);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('darkMode');
    return saved === 'true';
  });
  const [mistakes, setMistakes] = useState<MistakeEntry[]>(() => {
    const saved = localStorage.getItem('quranMistakes');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeMistake, setActiveMistake] = useState<MistakeEntry | null>(null);

  // Memos
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

  const surahEntryWordMap = useMemo(() => {
    const map = new Map<number, number>();
    surahMap.forEach(s => {
      const page = quranData[s.page - 1];
      if (!page) return;
      for (const line of page.lines) {
        if (line.words) {
          for (const word of line.words) {
            if (word.surah === s.surah) {
              map.set(s.surah, word.id);
              return;
            }
          }
        }
      }
    });
    return map;
  }, [surahMap]);

  const ayahPageMap = useMemo(() => {
    const map = new Map<string, number>();
    quranData.forEach((page: any) => {
      page.lines.forEach((line: any) => {
        if (line.words) {
          line.words.forEach((word: any) => {
            const key = `${word.surah}-${word.ayah}`;
            if (!map.has(key)) map.set(key, page.page_number);
          });
        }
      });
    });
    return map;
  }, []);

  // Effects
  useEffect(() => {
    setInputPage(currentPage.toString());
    const pageObj = quranData[currentPage - 1] as any;
    if (pageObj) {
      for (const line of pageObj.lines) {
        if (line.surah_number) {
          setScrollSurah(line.surah_number);
          break;
        }
        if (line.words && line.words.length > 0 && line.words[0].surah) {
          setScrollSurah(line.words[0].surah);
          break;
        }
      }
    }
  }, [currentPage]);

  useEffect(() => {
    localStorage.setItem('quranMistakes', JSON.stringify(mistakes));
  }, [mistakes]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark-mode');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark-mode');
      localStorage.setItem('darkMode', 'false');
    }
  }, [darkMode]);

  useEffect(() => {
    if (!showAllMistakes) {
      setActiveMistake(null);
    }
  }, [showAllMistakes]);

  // Actions
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
      return [...prev, { ...mistakeData, pageNumber: currentPage, id: crypto.randomUUID(), number: pageMistakes.length + 1 }];
    });
  };

  const handleClear = () => setMistakes(prev => prev.filter(m => m.pageNumber !== currentPage));
  const handleDelete = (id: string) => setMistakes(prev => prev.filter(m => m.id !== id));
  const handleUpdateComment = (id: string, comment: string | undefined) => {
    setMistakes(prev => prev.map(m => m.id === id ? { ...m, comment } : m));
  };

  const scrollToMistake = (mistake: MistakeEntry | { mode: SelectMode, surahNumber: number, ayahNumber: number, wordId?: number, letterIndex?: number, tashkeelIndex?: number }) => {
    setTimeout(() => {
      let selector = '';
      if (mistake.mode === 'ayah') {
        selector = `[data-surah="${mistake.surahNumber}"][data-ayah="${mistake.ayahNumber}"]`;
      } else if (mistake.wordId !== undefined) {
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
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 300);
  };

  const handleMistakeClick = (mistake: MistakeEntry) => {
    setActiveMistake(mistake);
    setMode(mistake.mode);
    setSidebarOpen(false); 
    scrollToMistake(mistake);

    // If "Show All" is disabled, clear the highlight after a delay
    if (!showAllMistakes) {
      setTimeout(() => {
        setActiveMistake(prev => (prev?.id === mistake.id ? null : prev));
      }, 2000);
    }
  };

  const currentSurah = scrollSurah;
  const totalAyahForCurrentSurah = SURAH_AYAH_COUNTS[currentSurah - 1] ?? 0;
  const currentAyah = useMemo(() => {
    const pageObj = quranData[currentPage - 1] as any;
    if (!pageObj) return 1;
    for (const line of pageObj.lines) {
      if (line.words) {
        for (const word of line.words) {
          if (word.surah === currentSurah && word.ayah) return word.ayah;
        }
      }
    }
    return 1;
  }, [currentPage, currentSurah]);

  return (
    <div className="app-layout">
      <header className="app-header">
        <h1>Quran Hifdh Tool</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button className="toggle-btn dark-mode-toggle" onClick={() => setDarkMode(!darkMode)}>
            {darkMode ? '☀️ Light' : '🌙 Dark'}
          </button>
          <div className="mode-toggles">
            {(['ayah', 'word', 'letter', 'tashkeel'] as SelectMode[]).map((m) => (
              <button key={m} className={`toggle-btn ${mode === m ? 'active' : ''}`} onClick={() => setMode(m)}>
                {m.charAt(0).toUpperCase() + m.slice(1)} Mode
              </button>
            ))}
          </div>
          <button className="hamburger-btn" onClick={() => setSidebarOpen(o => !o)} aria-label="Toggle mistakes">
            {sidebarOpen ? '✕' : '☰'}
          </button>
        </div>
      </header>
      
      <div className="pagination-bar">
        <button onClick={() => setCurrentPage(p => Math.min(604, p + 1))} disabled={currentPage === 604}>Next Page ◀</button>
        <div className="page-inputs">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }} className="page-input-container">
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', left: '0.6rem', fontSize: '0.85rem', pointerEvents: 'none', color: 'var(--text-secondary)', fontWeight: 600 }}>Page</span>
              <input 
                type="number" min="1" max="604" value={inputPage} className="page-number-input"
                style={{ paddingLeft: '3.2rem', width: '5.8rem' }}
                onChange={e => {
                  setInputPage(e.target.value);
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val >= 1 && val <= 604) setCurrentPage(val);
                }} 
                onBlur={() => setInputPage(currentPage.toString())}
              />
            </div>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontWeight: 600 }}>of 604</span>
          </div>
          <select 
            value={currentSurah}
            onChange={e => {
              const targetSurah = parseInt(e.target.value, 10);
              const found = surahMap.find(s => s.surah === targetSurah);
              if (found) {
                setCurrentPage(found.page);
                const wordId = surahEntryWordMap.get(targetSurah);
                if (wordId !== undefined) {
                  scrollToMistake({ mode: 'word', surahNumber: targetSurah, ayahNumber: 1, wordId });
                }
              }
            }}
          >
            <option hidden value={currentSurah}>{currentSurah}. {surahMap.find(s => s.surah === currentSurah)?.name}</option>
            {surahMap.map((s, i) => (
              <option key={i} value={s.surah}>{s.surah}. {s.name} (Page {s.page})</option>
            ))}
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }} className="ayah-input-container">
            <select
              value={currentAyah} className="ayah-number-select"
              onChange={e => {
                const ayah = parseInt(e.target.value, 10);
                const page = ayahPageMap.get(`${currentSurah}-${ayah}`);
                if (page) setCurrentPage(page);
              }}
            >
              <option hidden value={currentAyah}>Ayah {currentAyah}</option>
              {Array.from({ length: totalAyahForCurrentSurah }, (_, i) => i + 1).map(ayah => {
                const pg = ayahPageMap.get(`${currentSurah}-${ayah}`);
                return <option key={ayah} value={ayah}>Ayah {ayah} (Page {pg ?? '?'})</option>;
              })}
            </select>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontWeight: 600 }}>of {totalAyahForCurrentSurah}</span>
          </div>
        </div>
        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>▶ Prev Page</button>
      </div>

      <main className="main-content">
        <div className="quran-wrapper">
          <QuranPage 
            mode={mode} pageData={quranData[currentPage - 1] as any} 
            onMistake={handleMistake} activeMistake={activeMistake}
            pageMistakes={mistakes.filter(m => m.pageNumber === currentPage)}
            showAllMistakes={showAllMistakes}
            onSurahLimitsChange={setSurahLimits}
          />
        </div>
        {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
        <MistakesSidebar 
          mistakes={mistakes.filter(m => m.pageNumber === currentPage)} 
          onClear={handleClear} onDelete={handleDelete} onUpdateComment={handleUpdateComment}
          onMistakeClick={handleMistakeClick} activeMistakeId={activeMistake?.id}
          mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)}
          showAllMistakes={showAllMistakes} onToggleShowAll={() => setShowAllMistakes(prev => !prev)}
        />
      </main>
      <div className="mobile-mode-bar">
        {(['ayah', 'word', 'letter', 'tashkeel'] as SelectMode[]).map((m) => (
          <button key={m} className={`mobile-mode-btn ${mode === m ? 'active' : ''}`} onClick={() => setMode(m)}>
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}

export default App;
