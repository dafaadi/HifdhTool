import sqlite3 from 'sqlite3';
import fs from 'fs';

const surahNames = [
  "الفاتحة", "البقرة", "آل عمران", "النساء", "المائدة", "الأنعام", "الأعراف", "الأنفال", "التوبة", "يونس",
  "هود", "يوسف", "الرعد", "إبراهيم", "الحجر", "النحل", "الإسراء", "الكهف", "مريم", "طه",
  "الأنبياء", "الحج", "المؤمنون", "النور", "الفرقان", "الشعراء", "النمل", "القصص", "العنكبوت", "الروم",
  "لقمان", "السجدة", "الأحزاب", "سبأ", "فاطر", "يس", "الصافات", "ص", "الزمر", "غافر",
  "فصلت", "الشورى", "الزخرف", "الدخان", "الجاثية", "الأحقاف", "محمد", "الفتح", "الحجرات", "ق",
  "الذاريات", "الطور", "النجم", "القمر", "الرحمن", "الواقعة", "الحديد", "المجادلة", "الحشر", "الممتحنة",
  "الصف", "الجمعة", "المنافقون", "التغابن", "الطلاق", "التحريم", "الملك", "القلم", "الحاقة", "المعارج",
  "نوح", "الجن", "المزمل", "المدثر", "القيامة", "الإنسان", "المرسلات", "النبأ", "النازعات", "عبس",
  "التكوير", "الانفطار", "المطففين", "الانشقاق", "البروج", "الطارق", "الأعلى", "الغاشية", "الفجر", "البلد",
  "الشمس", "الليل", "الضحى", "الشرح", "التين", "العلق", "القدر", "البينة", "الزلزلة", "العاديات",
  "القارعة", "التكاثر", "العصر", "الهمزة", "الفيل", "قريش", "الماعون", "الكوثر", "الكافرون", "النصر",
  "المسد", "الإخلاص", "الفلق", "الناس"
];

const extract = async () => {
  console.log("Reading Tarteel Hafs Word-By-Word DB...");
  const wordsDb = new sqlite3.Database('./src/qpc-hafs-word-by-word.db/qpc-hafs-word-by-word.db');
  
  // Load words into a massive lookup array (1 indexed)
  const globalWords = [];
  await new Promise((resolve, reject) => {
    wordsDb.all("SELECT id, text, surah, ayah, word FROM words ORDER BY id", (err, rows) => {
      if (err) return reject(err);
      rows.forEach(row => {
        globalWords[row.id] = {
          id: row.id,
          text: row.text,
          ayah: row.ayah,
          surah: row.surah,
          wordIndex: row.word - 1, // 0-indexed for frontend
          isEndOfAyah: !row.text.match(/[\u0600-\u06ff]/) && row.text.match(/[٠-٩0-9]/) ? true : undefined // rudimentary check
        };
      });
      console.log(`Loaded ${rows.length} words from Tarteel Words DB!`);
      resolve();
    });
  });

  console.log("Reading KFGQPC V2 SQLite layout...");
  const layoutDb = new sqlite3.Database('./src/qpc-v2-15-lines.db');
  
  layoutDb.all("SELECT * FROM pages ORDER BY page_number, line_number", (err, rows) => {
    if (err) throw err;
    
    const pages = {};
    rows.forEach(row => {
      if (!pages[row.page_number]) {
        pages[row.page_number] = { page_number: row.page_number, lines: [] };
      }
      
      const lineData = {
        line_number: row.line_number,
        line_type: row.line_type,
        is_centered: row.is_centered === 1,
        surah_number: row.surah_number || null,
        words: []
      };

      if (row.line_type === 'surah_name' && lineData.surah_number) {
        lineData.surah_name = surahNames[lineData.surah_number - 1]; // 1-indexed mapping
      }
      
      if (row.first_word_id && row.last_word_id) {
        for (let i = row.first_word_id; i <= row.last_word_id; i++) {
          if (globalWords[i]) {
            // Precise detection for Ayah end marker in word list natively
            // If it's an end marker, ensure UI flags it exactly as Tarteel gives it
            let isSymbol = false;
            if (globalWords[i].text.includes('\u06DD') || (!globalWords[i].text.match(/[\u0610-\u061A\u064B-\u065F\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06EDa-zA-Z]/) && globalWords[i].text.match(/[٠-٩0-9]/))) {
               isSymbol = true;
            }
            lineData.words.push({ ...globalWords[i], isEndOfAyah: isSymbol });
          } else {
            console.error(`Missing word mapped at ID: ${i} on Page ${row.page_number}`);
          }
        }
      }
      
      pages[row.page_number].lines.push(lineData);
    });
    
    fs.mkdirSync('./src/data', { recursive: true });
    fs.writeFileSync('./src/data/quran_v2.json', JSON.stringify(Object.values(pages)));
    console.log(`Successfully mapped EXACT Tarteel Word IDs to all 604 pages -> 'src/data/quran_v2.json'!`);
  });
};

extract().catch(console.error);
