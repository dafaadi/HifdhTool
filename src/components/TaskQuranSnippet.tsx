import React, { useState, useEffect, useMemo } from 'react';
import type { ScheduleUnit } from '../types';
import './TaskQuranSnippet.css';

interface TaskQuranSnippetProps {
  unit: ScheduleUnit;
  scriptType: 'indopak' | 'madani';
  fontSize?: number; // Optional override
}

interface WordSnippet {
  id: number;
  text: string;
  isEndOfAyah?: boolean;
  isInRange: boolean;
  line_number: number;
  page_number: number;
  line_type: string;
  is_centered: boolean;
}

export const TaskQuranSnippet: React.FC<TaskQuranSnippetProps> = ({ 
  unit, 
  scriptType, 
  fontSize = 1.8 
}) => {
  const [quranData, setQuranData] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);

  const [startWordId, endWordId] = unit.wordIdRange;

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      setLoading(true);
      try {
        let data;
        if (scriptType === 'madani') {
          data = (await import('../data/quran_v2.json')).default;
        } else {
          data = (await import('../data/indopak_data.json')).default;
        }
        if (isMounted) {
          setQuranData(data as any[]);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to load snippet data", err);
        if (isMounted) setLoading(false);
      }
    };
    loadData();
    return () => { isMounted = false; };
  }, [scriptType]);

  const filteredLines = useMemo(() => {
    if (!quranData) return [];

    // 1. Identify context range (e.g., 5 words before and after for "soft clipping")
    const contextPadding = 5;
    const effectiveStart = Math.max(1, startWordId - contextPadding);
    const effectiveEnd = endWordId + contextPadding;

    const snippets: WordSnippet[] = [];

    // 2. Iterate through pages mentioned in unit (or all if not reliable)
    // unit.pageNumbers contains the pages we need to check
    const targetPages = unit.pageNumbers.length > 0 
      ? unit.pageNumbers.flatMap(p => [p - 1, p, p + 1].filter(pg => pg >= 1 && pg <= quranData.length))
      : Array.from({ length: quranData.length }, (_, i) => i + 1);

    // Filter and collect words within context range
    quranData.forEach((page) => {
      // Small optimization: only check pages that could contain our range
      if (unit.pageNumbers.length > 0 && !unit.pageNumbers.includes(page.page_number)) {
         // Still check if we need context from adjacent pages
         const isAdjacent = unit.pageNumbers.some(p => Math.abs(p - page.page_number) <= 1);
         if (!isAdjacent) return;
      }

      page.lines.forEach((line: any) => {
        const wordsInLine = (line.words || []).filter((w: any) => w.id >= effectiveStart && w.id <= effectiveEnd);
        
        if (wordsInLine.length > 0) {
          wordsInLine.forEach((w: any) => {
            snippets.push({
              ...w,
              isInRange: w.id >= startWordId && w.id <= endWordId,
              line_number: line.line_number,
              page_number: page.page_number,
              line_type: line.line_type,
              is_centered: line.is_centered
            });
          });
        } else if (line.line_type !== 'ayah' && snippets.length > 0) {
          // Check if this structural line (surah name / basmallah) is inside our range visually
          // Usually we only show these if the range starts exactly at word 1 of that surah
          // But for now, we'll skip structural lines to keep snippets focused on text
        }
      });
    });

    // 3. Group by Page + Line to maintain visual structure
    const groupedLines: { key: string, is_centered: boolean, words: WordSnippet[] }[] = [];
    snippets.forEach(word => {
      const key = `${word.page_number}-${word.line_number}`;
      let group = groupedLines.find(g => g.key === key);
      if (!group) {
        group = { key, is_centered: word.is_centered, words: [] };
        groupedLines.push(group);
      }
      group.words.push(word);
    });

    return groupedLines;
  }, [quranData, startWordId, endWordId, unit.pageNumbers]);

  if (loading) {
    return (
      <div className="quran-snippet-container snippet-loading">
        Loading snippet...
      </div>
    );
  }

  if (filteredLines.length === 0) return null;

  const isSingleLine = filteredLines.length === 1;

  return (
    <div className={`quran-snippet-container snippet-${scriptType} ${!isSingleLine ? 'snippet-clipping-mask' : 'snippet-single-line'}`}>
      <div 
        className="quran-snippet-content"
        style={{ fontSize: `${fontSize}rem` }}
      >
        {filteredLines.map((line) => (
          <div 
            key={line.key} 
            className={`snippet-line ${line.is_centered ? 'centered' : 'justified'}`}
          >
            {line.words.map((word, idx) => (
              <React.Fragment key={word.id}>
                <span 
                  className={word.isInRange ? 'word-in-range' : 'word-context'}
                  title={word.isInRange ? '' : 'Context'}
                >
                  <span className={word.isEndOfAyah ? 'snippet-ayah-marker' : ''}>
                    {word.text}
                  </span>
                </span>
                {idx < line.words.length - 1 && <span style={{ fontSize: '0.4em' }}> </span>}
              </React.Fragment>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
