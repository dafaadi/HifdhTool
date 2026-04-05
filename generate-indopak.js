import sqlite3 from 'sqlite3';
import fs from 'fs';

const dbPath = 'src/data/qudratullah-indopak-15-lines.db/qudratullah-indopak-15-lines.db';
const wordsPath = 'src/data/digital-khatt-indopak.json/digital-khatt-indopak.json';
const outputPath = 'src/data/indopak_data.json';

console.log('Loading word data...');
const wordsRaw = JSON.parse(fs.readFileSync(wordsPath, 'utf8'));
const wordsById = {};

const regexAyahEnd = /۝/u;

for (const key in wordsRaw) {
    const w = wordsRaw[key];
    let wText = w.text.replace(/[\u089C\u089D]/g, '\u0653');
    const isEnd = regexAyahEnd.test(wText);
    
    let mainAyahText = undefined;
    let extraChars = undefined;
    
    if (isEnd) {
        mainAyahText = wText;
        extraChars = '';
        const extraMatch = wText.match(/[^\u06DD\u0660-\u0669\u06F0-\u06F9]+$/);
        if (extraMatch) {
            mainAyahText = wText.slice(0, extraMatch.index);
            extraChars = extraMatch[0];
        }
    }

    wordsById[w.id] = {
        id: w.id,
        text: wText,
        ayah: parseInt(w.ayah, 10),
        surah: parseInt(w.surah, 10),
        wordIndex: parseInt(w.word, 10) - 1, // Madani wordIndex seems 0-indexed in our app
        isEndOfAyah: isEnd,
        ...(isEnd ? { ayahMarkerText: mainAyahText, ayahMarkerExtra: extraChars } : {})
    };
}

console.log('Loading layout data...');
const db = new sqlite3.Database(dbPath);

const getPages = () => {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM pages ORDER BY page_number, line_number", (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

const surahNames = [
    "الفاتحة", "البقرة", "آل عمران", "النساء", "المائدة", "الأنعام", "الأعراف", "الأنفال", "التوبة", "يونس", "هود", "يوسف", "الرعد", "إبراهيم", "الحجر", "النحل", "الإسراء", "الكهف", "مريم", "طه", "الأنبياء", "الحج", "المؤمنون", "النور", "الفرقان", "الشعراء", "النمل", "القصص", "العنكبوت", "الروم", "لقمان", "السجدة", "الأحزاب", "سبأ", "فاطر", "يس", "الصافات", "ص", "الزمر", "غافر", "فصلت", "الشورى", "الزخرف", "الدخان", "الجاثية", "الأحقاف", "محمد", "الفتح", "الحجرات", "ق", "الذاريات", "الطور", "النجم", "القمر", "الرحمن", "الواقعة", "الحديد", "المجادلة", "الحشر", "الممتحنة", "الصف", "الجمعة", "المنافقون", "التغابن", "الطلاق", "التحريم", "الملك", "القلم", "الحاقة", "المعارج", "نوح", "الجن", "المزمل", "المدثر", "القيامة", "الإنسان", "المرسلات", "النبأ", "النازعات", "عبس", "التكوير", "الانفطار", "المطففين", "الانشقاق", "البروج", "الطارق", "الأعلى", "الغاشية", "الفجر", "البلد", "الشمس", "الليل", "الضحى", "الشرح", "التين", "العلق", "القدر", "البينة", "الزلزلة", "العاديات", "القارعة", "التكاثر", "العصر", "الهمزة", "الفيل", "قريش", "الماعون", "الكوثر", "الكافرون", "النصر", "المسد", "الإخلاص", "الفلق", "الناس"
];

async function main() {
    const rows = await getPages();
    
    // Build tree
    const pagesMap = new Map();
    
    for (const row of rows) {
        const pageNum = row.page_number;
        if (!pagesMap.has(pageNum)) {
            pagesMap.set(pageNum, { page_number: pageNum, lines: [] });
        }
        const page = pagesMap.get(pageNum);
        
        const line = {
            line_number: row.line_number,
            line_type: row.line_type,
            is_centered: row.is_centered === 1,
            surah_number: row.surah_number ? parseInt(row.surah_number, 10) : null,
            words: []
        };

        if (line.line_type === 'surah_name' && line.surah_number) {
            line.surah_name = surahNames[line.surah_number - 1];
        }

        if (line.line_type === 'ayah' && row.first_word_id && row.last_word_id) {
            // Need to get all words between first_word_id and last_word_id
            const startId = parseInt(row.first_word_id, 10);
            const endId = parseInt(row.last_word_id, 10);
            for (let i = startId; i <= endId; i++) {
                if (wordsById[i]) {
                    line.words.push(wordsById[i]);
                }
            }
        }

        page.lines.push(line);
    }
    
    const outputData = Array.from(pagesMap.values());
    console.log(`Writing output with ${outputData.length} pages...`);
    fs.writeFileSync(outputPath, JSON.stringify(outputData));
    console.log('Done!');
}

main().catch(console.error);
