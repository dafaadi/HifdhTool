import fs from 'fs';

fetch('https://api.alquran.cloud/v1/surah/2/quran-uthmani')
  .then(res => res.json())
  .then(data => {
    const ayahs = data.data.ayahs.slice(5, 16); // Ayahs 6-16
    fs.mkdirSync('src/data', { recursive: true });
    
    const fileContent = `export const page3Ayahs = ${JSON.stringify(ayahs.map(a => ({ number: a.numberInSurah, text: a.text })), null, 2)};\n`;
    fs.writeFileSync('src/data/quranPage3.ts', fileContent);
    console.log("Successfully fetched and generated Page 3 data.");
  })
  .catch(err => {
    console.error("Fetch error:", err);
    process.exit(1);
  });
