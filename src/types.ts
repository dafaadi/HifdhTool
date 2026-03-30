export type SelectMode = 'ayah' | 'word' | 'letter' | 'tashkeel';

export interface MistakeEntry {
  id: string;
  number: number;
  pageNumber: number;
  wordId?: number;
  mode: SelectMode;
  surahNumber: number;
  ayahNumber: number;
  wordIndex?: number;
  letterIndex?: number;
  tashkeelIndex?: number;
  text: string;
  comment?: string;
}
