import React, { useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import { tokenizeWord } from '../utils/arabicTokenizer';
import type { SelectMode, MistakeEntry } from '../types';

export interface WordData {
  id: number;
  text: string;
  ayah: number;
  surah: number;
  wordIndex: number;
  isEndOfAyah?: boolean;
  ayahMarkerText?: string;
  ayahMarkerExtra?: string;
}

export interface LineData {
  line_number: number;
  line_type: 'surah_name' | 'basmallah' | 'ayah';
  is_centered: boolean;
  surah_number: number | null;
  surah_name?: string;
  words: WordData[];
}

export interface PageData {
  page_number: number;
  lines: LineData[];
}

interface QuranPageProps {
  mode: SelectMode;
  pageData: PageData;
  onMistake: (mistake: Omit<MistakeEntry, 'id' | 'number' | 'pageNumber'>) => void;
  activeMistake?: MistakeEntry | null;
  pageMistakes?: MistakeEntry[];
  showAllMistakes?: boolean;
  onSurahLimitsChange?: (limits: { surah: number, limit: number }[]) => void;
  fontSize?: number;
  wordSpacing?: number;
}

export const QuranPage = ({ mode, pageData, onMistake, activeMistake, pageMistakes, showAllMistakes, onSurahLimitsChange, fontSize = 1.35, wordSpacing = 0 }: QuranPageProps) => {
  const [hoveredAyah, setHoveredAyah] = useState<number | null>(null);

  const tokenizedLines = useMemo(() => {
    return pageData.lines.map(line => ({
      ...line,
      words: (line.words || []).map(w => ({ ...w, tokenized: tokenizeWord(w.text) }))
    }));
  }, [pageData]);

  React.useEffect(() => {
    if (!onSurahLimitsChange) return;

    const computeLimits = () => {
      const container = document.querySelector('.quran-container');
      if (!container) return;
      if (!container) return;
      const lines = container.querySelectorAll('.quran-line[data-line-surah]');
      
      const limits: { surah: number, limit: number }[] = [];
      const seenSurahs = new Set<number>();
      
      lines.forEach((line: any) => {
        const surah = parseInt(line.getAttribute('data-line-surah'), 10);
        if (!isNaN(surah) && !seenSurahs.has(surah)) {
          seenSurahs.add(surah);
          // Calculate the true pixel offset from top
          const offsetTop = line.offsetTop;
          limits.push({ surah, limit: offsetTop });
        }
      });
      
      onSurahLimitsChange(limits.sort((a, b) => a.limit - b.limit));
    };

    // Use a small delay to ensure DOM is ready after tokenization/inline-collapse
    const timer = setTimeout(computeLimits, 150);
    window.addEventListener('resize', computeLimits);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', computeLimits);
    };
  }, [pageData, onSurahLimitsChange, mode]);

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const el = target.closest(`.${mode}`);
    if (!el) return;

    const surahNumber = parseInt(el.getAttribute('data-surah') || '0', 10);
    const wordId = el.getAttribute('data-word-id') ? parseInt(el.getAttribute('data-word-id')!, 10) : undefined;
    const ayahNumber = parseInt(el.getAttribute('data-ayah') || '0', 10);
    const wordIndex = el.getAttribute('data-word') ? parseInt(el.getAttribute('data-word')!, 10) : undefined;
    const letterIndex = el.getAttribute('data-letter') ? parseInt(el.getAttribute('data-letter')!, 10) : undefined;
    
    // We try data-text for exact tracking text 
    let text = el.getAttribute('data-text') || el.textContent || '';
    if (mode === 'ayah') {
      const ayahWords = pageData.lines
        .flatMap(l => l.words || [])
        .filter(w => w.ayah === ayahNumber && w.surah === surahNumber && !w.isEndOfAyah)
        .map(w => w.text)
        .join(' ');
      text = ayahWords;
    }

    if (ayahNumber > 0) {
      onMistake({
        mode,
        surahNumber,
        ayahNumber,
        wordId,
        wordIndex,
        letterIndex: mode === 'letter' ? letterIndex : undefined,
        tashkeelIndex: mode === 'tashkeel' ? letterIndex : undefined,
        text
      });
    }
  };

  return (
    <div 
      className={`quran-container mode-${mode}`} 
      onClick={handleClick}
      style={{ fontSize: `${fontSize}rem`, wordSpacing: `${wordSpacing}em` }}
    >
      {tokenizedLines.map((line, lIdx) => {
        // Determine surah for this line to help observer
        const lineSurah = line.surah_number || (line.words && line.words.length > 0 ? line.words[0].surah : null);
        
        return (
          <div 
            key={lIdx} 
            className={`quran-line ${line.is_centered ? 'centered-line' : 'justified-line'}`}
            data-line-surah={lineSurah}
          >
          {line.line_type === 'surah_name' && (
            <div className="surah-name">{line.surah_name}</div>
          )}
          {line.line_type === 'basmallah' && (
            <div className="basmallah">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</div>
          )}
          {line.line_type === 'ayah' && line.words.map((word, wIdx) => {
            const ayahMistake = pageMistakes?.find(m => 
              m.surahNumber === word.surah && 
              m.ayahNumber === word.ayah && 
              m.mode === 'ayah'
            );

            const activeWordMistake = activeMistake?.surahNumber === word.surah && 
                                     activeMistake.ayahNumber === word.ayah && 
                                     activeMistake.wordIndex === word.wordIndex && 
                                     activeMistake.mode === 'word' ? activeMistake : null;

            const relevantWordMistake = pageMistakes?.find(m => 
                                     m.surahNumber === word.surah && 
                                     m.ayahNumber === word.ayah && 
                                     m.wordIndex === word.wordIndex && 
                                     m.mode === 'word'
            );

            const wordMistakeToHighlight = activeWordMistake || (showAllMistakes ? relevantWordMistake : null);
            const ayahMistakeToHighlight = (activeMistake?.mode === 'ayah' && activeMistake.surahNumber === word.surah && activeMistake.ayahNumber === word.ayah) 
                                           ? activeMistake 
                                           : (showAllMistakes ? ayahMistake : null);
            
            const hasSubwordMistake = showAllMistakes && pageMistakes?.some(m => 
                                 (m.mode === 'letter' || m.mode === 'tashkeel') && 
                                 m.surahNumber === word.surah && 
                                 m.ayahNumber === word.ayah && 
                                 m.wordIndex === word.wordIndex
            );
            
            if (word.isEndOfAyah) {
              let mainAyahText = word.ayahMarkerText || word.text;
              let extraChars = word.ayahMarkerExtra || '';

              return (
                <React.Fragment key={word.id}>
                  <span 
                    className={`ayah-part ayah ${ayahMistakeToHighlight ? 'mistake-ayah' : ''} ${mode === 'ayah' && hoveredAyah === word.ayah ? 'ayah-hovered' : ''}`}
                    data-ayah={word.ayah} 
                    data-surah={word.surah} 
                    onMouseEnter={() => mode === 'ayah' && setHoveredAyah(word.ayah)}
                    onMouseLeave={() => mode === 'ayah' && setHoveredAyah(null)}
                  >
                    <span 
                      className="ayah-end-marker" 
                      data-ayah={word.ayah} 
                      data-surah={word.surah} 
                      style={{ background: 'none !important', position: 'relative', display: 'inline-block' }}
                    >
                      <span>{mainAyahText}</span>
                      {extraChars && (
                        <span style={{ 
                          position: 'absolute', 
                          top: '-0.45em', 
                          left: 0, 
                          right: 0, 
                          textAlign: 'center', 
                          fontSize: '0.7em',
                          color: 'inherit',
                          pointerEvents: 'none'
                        }}>
                          {'\u00A0' + extraChars}
                        </span>
                      )}
                    </span>
                  </span>
                  {wIdx < line.words.length - 1 && <span className="word-space"> </span>}
                </React.Fragment>
              );
            }
            return (
              <React.Fragment key={word.id}>
                <span 
                  className={`ayah-part ayah ${ayahMistakeToHighlight ? 'mistake-ayah' : ''} ${mode === 'ayah' && hoveredAyah === word.ayah ? 'ayah-hovered' : ''}`}
                  data-ayah={word.ayah} 
                  data-surah={word.surah}
                  onMouseEnter={() => mode === 'ayah' && setHoveredAyah(word.ayah)}
                  onMouseLeave={() => mode === 'ayah' && setHoveredAyah(null)}
                >
                  <span className={`word ${wordMistakeToHighlight ? 'mistake-word' : ''}`} data-ayah={word.ayah} data-surah={word.surah} data-word={word.wordIndex} data-word-id={word.id} data-text={word.text}>
                  {((mode === 'word' || mode === 'ayah') && !hasSubwordMistake) ? word.text : word.tokenized.letters.map(letter => {
                    const isLetterActiveFromClick = activeMistake?.mode === 'letter' && activeMistake.surahNumber === word.surah && activeMistake.ayahNumber === word.ayah && activeMistake.wordIndex === word.wordIndex && activeMistake.letterIndex === letter.index;
                    const isTashkeelActiveFromClick = activeMistake?.mode === 'tashkeel' && activeMistake.surahNumber === word.surah && activeMistake.ayahNumber === word.ayah && activeMistake.wordIndex === word.wordIndex && activeMistake.tashkeelIndex === letter.index;
                    
                    const isLetterActiveFromShowAll = showAllMistakes && pageMistakes?.some(m => m.mode === 'letter' && m.surahNumber === word.surah && m.ayahNumber === word.ayah && m.wordIndex === word.wordIndex && m.letterIndex === letter.index);
                    const isTashkeelActiveFromShowAll = showAllMistakes && pageMistakes?.some(m => m.mode === 'tashkeel' && m.surahNumber === word.surah && m.ayahNumber === word.ayah && m.wordIndex === word.wordIndex && m.tashkeelIndex === letter.index);

                    const finalLetterActive = isLetterActiveFromClick || isLetterActiveFromShowAll;
                    const finalTashkeelActive = isTashkeelActiveFromClick || isTashkeelActiveFromShowAll;

                    return (
                      <span key={letter.index} className={`letter tashkeel ${finalLetterActive ? 'mistake-letter' : (finalTashkeelActive ? 'mistake-tashkeel' : '')}`} data-ayah={word.ayah} data-surah={word.surah} data-word-id={word.id} data-word={word.wordIndex} data-letter={letter.index} data-tashkeel={letter.index} data-text={letter.char}>{letter.char}</span>
                    );
                  })}
                </span>
              </span>
              {wIdx < line.words.length - 1 && <span className="word-space"> </span>}
              </React.Fragment>
            );
          })}
          {/* Ensure inter-line trailing spaces exist so inline-mode boundaries flow correctly without word glue */}
          {line.line_type === 'ayah' && <span className="word-space"> </span>}
        </div>
      );})}
    </div>
  );
};
