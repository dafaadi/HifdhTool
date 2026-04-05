import { useState, useEffect, useMemo } from 'react';
import { QuranPage } from './components/QuranPage';
import { MistakesSidebar } from './components/MistakesSidebar';
import type { SelectMode, MistakeEntry } from './types';
import { Settings } from 'lucide-react';
import logo from './assets/faviconhifdhtoolcropped.png';
import chevronUp from './assets/chevronup.png';
import chevronDown from './assets/chevrondown.png';
import chevronUpWhite from './assets/chevronupwhite.png';
import chevronDownWhite from './assets/chevrondownwhite.png';
import './App.css';

const englishSurahNames = [
  "Al-Fatihah", "Al-Baqarah", "Ali 'Imran", "An-Nisa", "Al-Ma'idah", "Al-An'am", "Al-A'raf", "Al-Anfal", "At-Tawbah", "Yunus", "Hud", "Yusuf", "Ar-Ra'd", "Ibrahim", "Al-Hijr", "An-Nahl", "Al-Isra", "Al-Kahf", "Maryam", "Taha", "Al-Anbiya", "Al-Hajj", "Al-Mu'minun", "An-Nur", "Al-Furqan", "Ash-Shu'ara", "An-Naml", "Al-Qasas", "Al-'Ankabut", "Ar-Rum", "Luqman", "As-Sajdah", "Al-Ahzab", "Saba", "Fatir", "Ya-Sin", "As-Saffat", "Sad", "Az-Zumar", "Ghafir", "Fussilat", "Ash-Shura", "Az-Zukhruf", "Ad-Dukhan", "Al-Jathiyah", "Al-Ahqaf", "Muhammad", "Al-Fath", "Al-Hujurat", "Qaf", "Ad-Dhariyat", "At-Tur", "An-Najm", "Al-Qamar", "Ar-Rahman", "Al-Waqi'ah", "Al-Hadid", "Al-Mujadila", "Al-Hashr", "Al-Mumtahanah", "As-Saff", "Al-Jumu'ah", "Al-Munafiqun", "At-Taghabun", "At-Talaq", "At-Tahrim", "Al-Mulk", "Al-Qalam", "Al-Haqqah", "Al-Ma'arij", "Nuh", "Al-Jinn", "Al-Muzzammil", "Al-Muddaththir", "Al-Qiyamah", "Al-Insan", "Al-Mursalat", "An-Naba", "An-Nazi'at", "'Abasa", "At-Takwir", "Al-Infitar", "Al-Mutaffifin", "Al-Inshiqaq", "Al-Buruj", "At-Tariq", "Al-A'la", "Al-Ghashiyah", "Al-Fajr", "Al-Balad", "Ash-Shams", "Al-Lail", "Ad-Duhaa", "Ash-Sharh", "At-Tin", "Al-'Alaq", "Al-Qadr", "Al-Bayyinah", "Az-Zalzalah", "Al-'Adiyat", "Al-Qari'ah", "At-Takathur", "Al-'Asr", "Al-Humazah", "Al-Fil", "Quraysh", "Al-Ma'un", "Al-Kawthar", "Al-Kafirun", "An-Nasr", "Al-Masad", "Al-Ikhlas", "Al-Falaq", "An-Nas"
];

const SURAH_AYAH_COUNTS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 98, 5, 12, 12, 10, 7, 4, 3, 6, 5, 5, 4, 5, 4, 5, 5, 4, 6, 5, 3, 6, 3, 6, 6, 4, 5, 5, 6, 6, 6, 6, 5
];

function App() {
  const [quranData, setQuranData] = useState<any[] | null>(null);
  const [mushafType, setMushafType] = useState<'madani' | 'indopak'>(() => {
    const saved = localStorage.getItem('mushafType');
    return (saved === 'indopak') ? 'indopak' : 'madani';
  });
  const [showSettings, setShowSettings] = useState<boolean>(false);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [inputPage, setInputPage] = useState<string>('1');
  const [scrollSurah, setScrollSurah] = useState<number>(1);
  const [surahLimits, setSurahLimits] = useState<{ surah: number, limit: number }[]>([]);

  const [isHeaderExpanded, setIsHeaderExpanded] = useState(true);

  // Rigid scroll-based surah detection
  useEffect(() => {
    const wrapper = document.querySelector('.quran-wrapper');
    if (!wrapper) return;

    const handleScroll = () => {
      // Surah update logic
      if (surahLimits.length > 1) {
        const { scrollTop, scrollHeight, clientHeight } = wrapper;
        if (scrollHeight > clientHeight) {
          const scrollPercent = scrollTop / (scrollHeight - clientHeight);
          let activeSurah = surahLimits[0].surah;
          for (let i = 1; i < surahLimits.length; i++) {
            if (scrollPercent >= surahLimits[i].limit) activeSurah = surahLimits[i].surah;
            else break;
          }
          if (activeSurah !== scrollSurah) setScrollSurah(activeSurah);
        }
      }
    };

    wrapper.addEventListener('scroll', handleScroll, { passive: true });
    return () => wrapper.removeEventListener('scroll', handleScroll);
  }, [surahLimits, scrollSurah]);

  // Keyboard shortcuts for modes: A, S, D, F
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
  const [showAllMistakes, setShowAllMistakes] = useState<boolean>(true);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('darkMode');
    return saved === 'true';
  });
  const [mistakes, setMistakes] = useState<MistakeEntry[]>(() => {
    const saved = localStorage.getItem('quranMistakes');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeMistake, setActiveMistake] = useState<MistakeEntry | null>(null);
  const [fontSize, setFontSize] = useState<number>(() => parseFloat(localStorage.getItem('quranFontSize') || '2.8'));
  const [wordSpacing, setWordSpacing] = useState<number>(() => parseFloat(localStorage.getItem('quranWordSpacing') || '0.15'));
  const [fontSizeInput, setFontSizeInput] = useState<string>(fontSize.toFixed(1));
  const [fontLoaded, setFontLoaded] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    setFontLoaded(false);
    
    // We add a tiny delay to ensure the DOM has painted the hidden font-forcing div below 
    // before we start listening to the document.fonts.ready promise.
    const timer = setTimeout(() => {
      document.fonts.ready.then(() => {
        if (isMounted) setFontLoaded(true);
      });
    }, 50);

    return () => { 
      isMounted = false; 
      clearTimeout(timer);
    };
  }, [mushafType]);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        let data;
        if (mushafType === 'madani') {
          data = (await import('./data/quran_v2.json')).default;
          // Prefetch indopak
          import('./data/indopak_data.json').catch(() => {});
        } else {
          data = (await import('./data/indopak_data.json')).default;
          // Prefetch madani
          import('./data/quran_v2.json').catch(() => {});
        }
        if (isMounted) {
          setQuranData(data as any[]);
        }
      } catch (err) {
        console.error("Failed to load mushaf data", err);
      }
    };
    loadData();
    localStorage.setItem('mushafType', mushafType);
    return () => { isMounted = false; };
  }, [mushafType]);

  useEffect(() => {
    setFontSizeInput(fontSize.toFixed(1));
  }, [fontSize]);

  const handleFontSizeInput = (val: string) => {
    setFontSizeInput(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0.8 && num <= 4.5) {
      setFontSize(num);
    }
  };

  const handleFontSizeBlur = () => {
    const num = parseFloat(fontSizeInput);
    if (isNaN(num) || num < 0.8) {
      setFontSize(0.8);
    } else if (num > 4.5) {
      setFontSize(4.5);
    } else {
      setFontSize(num);
    }
  };

  const [sidebarWidth, setSidebarWidth] = useState<number>(380);

  useEffect(() => {
    localStorage.setItem('quranFontSize', fontSize.toString());
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem('quranWordSpacing', wordSpacing.toString());
  }, [wordSpacing]);

  // Memos
  const surahMap = useMemo(() => {
    const map: { page: number, surah: number, name: string }[] = [];
    if (!quranData) return map;
    quranData.forEach((page: any) => {
      page.lines.forEach((line: any) => {
        if (line.line_type === 'surah_name' && line.surah_name) {
          map.push({ page: page.page_number, surah: line.surah_number, name: englishSurahNames[line.surah_number - 1] });
        }
      });
    });
    return map;
  }, [quranData]);

  const surahEntryWordMap = useMemo(() => {
    const map = new Map<number, number>();
    if (!quranData) return map;
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
  }, [surahMap, quranData]);

  const ayahPageMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!quranData) return map;
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
  }, [quranData]);

  // Effects
  useEffect(() => {
    setInputPage(currentPage.toString());
    if (quranData && quranData[currentPage - 1]) {
      const pageObj = quranData[currentPage - 1] as any;
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
    if (!showAllMistakes) setActiveMistake(null);
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
        if (mistake.mode === 'word') selector = wordSelector;
        else if (mistake.mode === 'letter' && mistake.letterIndex !== undefined) selector = `${wordSelector} [data-letter="${mistake.letterIndex}"]`;
        else if (mistake.mode === 'tashkeel' && mistake.tashkeelIndex !== undefined) selector = `${wordSelector} [data-tashkeel="${mistake.tashkeelIndex}"]`;
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
    if (!showAllMistakes) {
      setTimeout(() => {
        setActiveMistake(prev => (prev?.id === mistake.id ? null : prev));
      }, 2000);
    }
  };

  const currentSurah = scrollSurah;
  const totalAyahForCurrentSurah = SURAH_AYAH_COUNTS[currentSurah - 1] ?? 0;
  const currentAyah = useMemo(() => {
    if (!quranData) return 1;
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
  }, [currentPage, currentSurah, quranData]);

  if (!quranData || !fontLoaded) {
    return (
      <div className={`app-layout ${darkMode ? 'dark-mode' : ''}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--text-secondary)' }}>
        Loading Mushaf...
        {/* Force browser to fetch the massive font files transparently in the background */}
        <div style={{ position: 'absolute', visibility: 'hidden', fontFamily: mushafType === 'indopak' ? 'DigitalKhattIndoPak, serif' : 'UthmanicHafs, serif' }}>
          بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ ۝
        </div>
      </div>
    );
  }

  const defaultTotalPages = mushafType === 'indopak' ? 610 : 604;

  return (
    <div className={`app-layout ${!isHeaderExpanded ? 'mobile-collapsed' : ''}`}>
      <header className={`app-header ${!isHeaderExpanded ? 'hidden-mobile' : ''}`}>
        <h1
          className="app-title"
          onClick={() => {
            setCurrentPage(1);
            setScrollSurah(1);
            const wrapper = document.querySelector('.quran-wrapper');
            if (wrapper) wrapper.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          title="Go to Surah Fatihah (Page 1)"
        >
          <div className="logo-container">
            <img src={logo} alt="Hifdh Tool Logo" className="header-logo-img" />
            <span>Hifdh Tool</span>
          </div>
        </h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div className="font-size-controls desktop-only">
            <button className="font-size-btn-mini" onClick={() => setFontSize(s => Math.max(0.8, s - 0.1))}>ᴀ⁻</button>
            <input 
              type="number" step="0.1" min="0.8" max="4.5" 
              value={fontSizeInput}
              className="font-size-input"
              onChange={(e) => handleFontSizeInput(e.target.value)}
              onBlur={handleFontSizeBlur}
            />
            <button className="font-size-btn-mini" onClick={() => setFontSize(s => Math.min(4.5, s + 0.1))}>A⁺</button>
          </div>
          <div className="mode-toggles">
            {(['ayah', 'word', 'letter', 'tashkeel'] as SelectMode[]).map((m) => (
              <button key={m} className={`toggle-btn ${mode === m ? 'active' : ''}`} onClick={() => setMode(m)}>{m.charAt(0).toUpperCase() + m.slice(1)} Mode</button>
            ))}
          </div>

          <div style={{ position: 'relative' }}>
            <button className="toggle-btn" onClick={() => setShowSettings(!showSettings)} title="Settings" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.6rem' }}>
              <Settings size={20} />
            </button>
            {showSettings && (
              <div className="settings-dropdown" style={{
                position: 'absolute', top: 'calc(100% + 0.5rem)', right: '0', background: 'var(--surface-color)', 
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', 
                borderRadius: '0.5rem', padding: '0.5rem', zIndex: 100, minWidth: '180px',
                border: '1px solid var(--border-color)',
                textAlign: 'left'
              }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, padding: '0.5rem', color: 'var(--text-secondary)' }}>Mushaf Type</div>
                <div className={`settings-option ${mushafType === 'madani' ? 'active' : ''}`} style={{ padding: '0.5rem', cursor: 'pointer', borderRadius: '0.25rem', backgroundColor: mushafType === 'madani' ? 'var(--accent-letter)' : 'transparent' }} onClick={() => { setMushafType('madani'); setShowSettings(false); setCurrentPage(1); }}>
                  Uthmanic (Hafs)
                </div>
                <div className={`settings-option ${mushafType === 'indopak' ? 'active' : ''}`} style={{ padding: '0.5rem', cursor: 'pointer', borderRadius: '0.25rem', backgroundColor: mushafType === 'indopak' ? 'var(--accent-letter)' : 'transparent' }} onClick={() => { setMushafType('indopak'); setShowSettings(false); setCurrentPage(1); }}>
                  IndoPak (15-line)
                </div>
                {mushafType === 'indopak' && (
                  <div style={{ padding: '0.5rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', marginTop: '0.5rem' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Word Spacing</span>
                      <span>{wordSpacing.toFixed(2)}em</span>
                    </div>
                    <input type="range" min="-0.2" max="1" step="0.05" value={wordSpacing} onChange={e => setWordSpacing(parseFloat(e.target.value))} style={{ width: '100%', cursor: 'pointer' }} />
                  </div>
                )}
                <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                  <button className="dark-mode-toggle" style={{ width: '100%', justifyContent: 'center', padding: '0.5rem', borderRadius: '0.25rem' }} onClick={() => { setDarkMode(!darkMode); setShowSettings(false); }}>
                    {darkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className={`pagination-bar ${!isHeaderExpanded ? 'collapsed' : ''}`}>
        <button onClick={() => setCurrentPage(p => Math.min(604, p + 1))} disabled={currentPage === 604}>
          <span className="desktop-only">◀ Next Page</span>
          <span className="mobile-only">◀ Next</span>
        </button>

        <div className="mobile-center-controls mobile-only">
          <button
            className="font-size-btn"
            onClick={() => setFontSize(s => Math.max(0.8, s - 0.1))}
            title="Slightly smaller text"
          >
            ᴀ⁻
          </button>

          <button
            className="mobile-expand-btn"
            onClick={() => {
              setIsHeaderExpanded(prev => !prev);
            }}
            aria-label={isHeaderExpanded ? "Collapse controls" : "Expand controls"}
          >
            <img 
              src={darkMode 
                ? (isHeaderExpanded ? chevronUpWhite : chevronDownWhite) 
                : (isHeaderExpanded ? chevronUp : chevronDown)} 
              alt={isHeaderExpanded ? "Collapse" : "Expand"} 
              className="mobile-chevron-img"
            />
          </button>
          
          <button
            className="font-size-btn"
            onClick={() => setFontSize(s => Math.min(4.5, s + 0.1))}
            title="Slightly larger text"
          >
            A⁺
          </button>
        </div>

        <div className={`page-inputs ${!isHeaderExpanded ? 'hidden-mobile' : ''}`}>
          {/* ... inputs remain centered ... */}
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
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontWeight: 600 }}>of {defaultTotalPages}</span>
          </div>
          <select
            className="surah-select"
            value={currentSurah}
            onChange={e => {
              const targetSurah = parseInt(e.target.value, 10);
              const found = surahMap.find(s => s.surah === targetSurah);
              if (found) {
                setCurrentPage(found.page);
                const wordId = surahEntryWordMap.get(targetSurah);
                if (wordId !== undefined) scrollToMistake({ mode: 'word', surahNumber: targetSurah, ayahNumber: 1, wordId });
              }
            }}
          >
            {surahMap.map((s, i) => <option key={`${s.surah}-${i}`} value={s.surah}>{s.surah}. {s.name} (Page {s.page})</option>)}
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

        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
          <span className="desktop-only">Prev Page ▶</span>
          <span className="mobile-only">Prev ▶</span>
        </button>
      </div>

      <main className="main-content">
        <div className={`quran-wrapper ${mushafType === 'indopak' ? 'mushaf-indopak' : 'mushaf-madani'}`}>
          <QuranPage
            mode={mode} pageData={quranData[currentPage - 1] as any}
            onMistake={handleMistake} activeMistake={activeMistake}
            pageMistakes={mistakes.filter(m => m.pageNumber === currentPage)}
            showAllMistakes={showAllMistakes}
            onSurahLimitsChange={setSurahLimits}
            fontSize={fontSize}
            wordSpacing={wordSpacing}
          />
        </div>
        {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
        <MistakesSidebar
          mistakes={mistakes.filter(m => m.pageNumber === currentPage)}
          onClear={handleClear} onDelete={handleDelete} onUpdateComment={handleUpdateComment}
          onMistakeClick={handleMistakeClick} activeMistakeId={activeMistake?.id}
          mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)}
          showAllMistakes={showAllMistakes} onToggleShowAll={() => setShowAllMistakes(prev => !prev)}
          width={sidebarWidth} onWidthChange={setSidebarWidth}
        />
      </main>
      <div className="mobile-mode-bar">
        <button className={`mobile-mode-btn ${mode === 'ayah' ? 'active' : ''}`} onClick={() => setMode('ayah')}>Ayah</button>
        <button className={`mobile-mode-btn ${mode === 'word' ? 'active' : ''}`} onClick={() => setMode('word')}>Word</button>

        <button
          className={`mobile-hamburger-btn ${sidebarOpen ? 'active' : ''}`}
          onClick={() => setSidebarOpen(o => !o)}
          aria-label="Toggle mistakes"
        >
          {sidebarOpen ? '✕' : '☰'}
        </button>

        <button className={`mobile-mode-btn ${mode === 'letter' ? 'active' : ''}`} onClick={() => setMode('letter')}>Letter</button>
        <button className={`mobile-mode-btn ${mode === 'tashkeel' ? 'active' : ''}`} onClick={() => setMode('tashkeel')}>Tashkeel</button>
      </div>
    </div>
  );
}

export default App;
