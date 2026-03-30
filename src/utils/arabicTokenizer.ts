export interface TokenizedLetter {
  char: string;
  index: number;
}

export interface TokenizedWord {
  text: string;
  letters: TokenizedLetter[];
}

export const toArabicNumeral = (n: number | string): string => {
  const map = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  return n.toString().replace(/[0-9]/g, function (w) {
    return map[+w];
  });
};

const isTashkeel = (char: string) => {
  const code = char.charCodeAt(0);
  return (
    (code >= 0x0610 && code <= 0x061A) || // Combining marks
    (code >= 0x064B && code <= 0x065F) || // Standard Tashkeel (Tanween, Harakat, Shaddah, Sukun)
    code === 0x0670 ||                   // Superscript Alif
    (code >= 0x06D6 && code <= 0x06DC) || // Small high signs
    (code >= 0x06DF && code <= 0x06E8) || // Small high letters/circles
    (code >= 0x06EA && code <= 0x06ED) || // Small low letters
    (code >= 0x08D4 && code <= 0x08FF)    // Extended Arabic marks (Tanween variations)
  );
};

export const tokenizeWord = (wordText: string): TokenizedWord => {
  const letters: TokenizedLetter[] = [];
  let currentLetter: TokenizedLetter | null = null;
  let lIndex = 0;

  for (let i = 0; i < wordText.length; i++) {
    const char = wordText[i];
    
    if (isTashkeel(char)) {
      if (currentLetter) {
        currentLetter.char += char;
      } else {
        currentLetter = { char, index: lIndex++ };
        letters.push(currentLetter);
      }
    } else {
      currentLetter = { char, index: lIndex++ };
      letters.push(currentLetter);
    }
  }
  return { text: wordText, letters };
};
