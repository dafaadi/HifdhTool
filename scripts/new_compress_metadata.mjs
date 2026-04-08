import fs from 'fs';
import Database from 'better-sqlite3';

// ── Path resolver (handles same-name folder-wrapped files) ──────────────────
function resolvePath(hint) {
    if (fs.existsSync(hint) && fs.statSync(hint).isFile()) return hint;
    const basename = hint.split(/[\\/]/).pop();
    const wrapped = `${hint}/${basename}`;
    if (fs.existsSync(wrapped) && fs.statSync(wrapped).isFile()) return wrapped;
    throw new Error(`Cannot resolve path: ${hint}`);
}

function resolveJson(hint) {
    if (fs.existsSync(hint) && fs.statSync(hint).isFile()) return hint;
    const basename = hint.split(/[\\/]/).pop();
    const wrapped = `${hint}/${basename}`;
    if (fs.existsSync(wrapped)) return wrapped;
    throw new Error(`Cannot resolve JSON: ${hint}`);
}

// 1. Initialize Databases ────────────────────────────────────────────────────
const dbWords = new Database(resolvePath('src/qpc-hafs-word-by-word.db'));
const dbMadani = new Database(resolvePath('src/qpc-v2-15-lines.db'));
const dbIndopak = new Database(resolvePath('src/data/qudratullah-indopak-15-lines.db'));

// 2. Skeleton Object ─────────────────────────────────────────────────────────
const metadata = {
    madani: { juz: {}, surah: {}, page: {}, rub: {}, hizb: {} },
    indopak: { para: {}, surah: {}, page: {}, ruku: {}, manzil: {} }
};

// 3. Helper: Convert surah:ayah to word_id range ─────────────────────────────
const stmtMin = dbWords.prepare('SELECT MIN(id) as id FROM words WHERE surah = ? AND ayah = ?');
const stmtMax = dbWords.prepare('SELECT MAX(id) as id FROM words WHERE surah = ? AND ayah = ?');

const getAyahWordRange = (firstKey, lastKey) => {
    const [fSurah, fAyah] = firstKey.split(':');
    const [lSurah, lAyah] = lastKey.split(':');
    const start = stmtMin.get(fSurah, fAyah)?.id;
    const end = stmtMax.get(lSurah, lAyah)?.id;
    if (start == null || end == null) {
        console.warn(`  ⚠️  No words found for range ${firstKey} → ${lastKey}`);
    }
    return [start, end];
};

// 4. Map Surahs (shared word_id anchors) ─────────────────────────────────────
console.log('Mapping surahs...');
const surahs = dbWords.prepare(
    'SELECT surah, MIN(id) as start, MAX(id) as end FROM words GROUP BY surah'
).all();
surahs.forEach(s => {
    metadata.madani.surah[s.surah] = [s.start, s.end];
    metadata.indopak.surah[s.surah] = [s.start, s.end];
});
console.log(`  → ${surahs.length} surahs`);

// 5. Map Pages ───────────────────────────────────────────────────────────────
console.log('Mapping Pages...');
dbMadani.prepare('SELECT page_number, MIN(first_word_id) as start, MAX(last_word_id) as end FROM pages GROUP BY page_number')
    .all().forEach(p => { metadata.madani.page[p.page_number] = [p.start, p.end]; });

dbIndopak.prepare('SELECT page_number, MIN(first_word_id) as start, MAX(last_word_id) as end FROM pages GROUP BY page_number')
    .all().forEach(p => { metadata.indopak.page[p.page_number] = [p.start, p.end]; });

// 6. Auto-Patch Null Page Ends (Moved UP so accurate pages exist for weight calculation)
const patchPageEnds = (pagesObj, absoluteMaxWord) => {
    const pageNums = Object.keys(pagesObj).map(Number).sort((a, b) => a - b);
    for (let i = 0; i < pageNums.length; i++) {
        const current = pageNums[i];
        if (!pagesObj[current][1]) {
            if (i < pageNums.length - 1) pagesObj[current][1] = pagesObj[pageNums[i + 1]][0] - 1;
            else pagesObj[current][1] = absoluteMaxWord;
        }
    }
};

const maxWord = dbWords.prepare('SELECT MAX(id) as maxId FROM words').get().maxId;
console.log(`\nPatching null page ends (max word ID: ${maxWord})...`);
patchPageEnds(metadata.madani.page, maxWord);
patchPageEnds(metadata.indopak.page, maxWord);

// 7. Process JSON Divisions ───────────────────────────────────────────────────
const processJson = (hint, targetObj, label) => {
    let filename;
    try { filename = resolveJson(hint); } catch { return; }
    console.log(`Mapping ${label}...`);
    const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
    for (const [key, val] of Object.entries(data)) {
        targetObj[key] = getAyahWordRange(val.first_verse_key, val.last_verse_key);
    }
};

processJson('src/data/quran-metadata-juz.json', metadata.madani.juz, 'Juz (Madani)');
processJson('src/data/quran-metadata-juz.json', metadata.indopak.para, 'Para (Indo-Pak)');
processJson('src/data/quran-metadata-hizb.json', metadata.madani.hizb, 'Hizb');
processJson('src/data/quran-metadata-rub.json', metadata.madani.rub, 'Rub');
processJson('src/data/quran-metadata-ruku.json', metadata.indopak.ruku, 'Ruku');
processJson('src/data/quran-metadata-manzil.json', metadata.indopak.manzil, 'Manzil');

// 8. TASK 1 & 3: Calculate Surah Weights & Ayah Ranges ───────────────────────
console.log('\nCalculating Surah Weights and Ayah Ranges...');
metadata.madani.surah_detail = {};

const allAyahs = dbWords.prepare('SELECT surah, ayah, MIN(id) as start_id, MAX(id) as end_id FROM words GROUP BY surah, ayah').all();
const allWords = dbWords.prepare('SELECT id, surah FROM words').all();

// Helpers for fast page lookups
const madaniPageEntries = Object.entries(metadata.madani.page).map(([p, r]) => ({ page: parseInt(p), start: r[0], end: r[1] }));
const getMadaniPage = (wordId) => madaniPageEntries.find(p => wordId >= p.start && wordId <= p.end)?.page;

// Track word sizes per page to calculate exact fraction weights
const pageSizes = {};
madaniPageEntries.forEach(p => pageSizes[p.page] = p.end - p.start + 1);
const surahPageWordCounts = {};

allAyahs.forEach(a => {
    const s = a.surah;
    if (!metadata.madani.surah_detail[s]) {
        metadata.madani.surah_detail[s] = { weight_pages: 0, ayah_ranges: {} };
        surahPageWordCounts[s] = {};
    }

    // Map Ayah Ranges
    const pageStart = getMadaniPage(a.start_id);
    const pageEnd = getMadaniPage(a.end_id);

    if (pageStart) {
        const pKey = `page_${pageStart}`;
        if (!metadata.madani.surah_detail[s].ayah_ranges[pKey]) metadata.madani.surah_detail[s].ayah_ranges[pKey] = [a.ayah, a.ayah];
        else metadata.madani.surah_detail[s].ayah_ranges[pKey][1] = Math.max(metadata.madani.surah_detail[s].ayah_ranges[pKey][1], a.ayah);
    }

    if (pageEnd && pageEnd !== pageStart) {
        const pKey = `page_${pageEnd}`;
        if (!metadata.madani.surah_detail[s].ayah_ranges[pKey]) metadata.madani.surah_detail[s].ayah_ranges[pKey] = [a.ayah, a.ayah];
        else metadata.madani.surah_detail[s].ayah_ranges[pKey][1] = Math.max(metadata.madani.surah_detail[s].ayah_ranges[pKey][1], a.ayah);
    }
});

// Map Word Counts for Weights
allWords.forEach(w => {
    const page = getMadaniPage(w.id);
    if (page) surahPageWordCounts[w.surah][page] = (surahPageWordCounts[w.surah][page] || 0) + 1;
});

for (const s in surahPageWordCounts) {
    let totalWeight = 0;
    for (const p in surahPageWordCounts[s]) {
        totalWeight += (surahPageWordCounts[s][p] / pageSizes[p]);
    }
    metadata.madani.surah_detail[s].weight_pages = parseFloat(totalWeight.toFixed(3));
}
console.log('  → Added `surah_detail` object mapped with `weight_pages` and `ayah_ranges`');

// 9. TASK 2: Juz 25-30 Pre-calculated Weights Map ────────────────────────────
console.log('\nPre-calculating weights map for Juz 25-30...');
metadata.madani.juz_25_30_weights = {};

for (let j = 25; j <= 30; j++) {
    if (!metadata.madani.juz[j]) continue;
    const [juzStart, juzEnd] = metadata.madani.juz[j];
    const juzSurahs = [];

    for (const [surahStr, range] of Object.entries(metadata.madani.surah)) {
        const surahNum = parseInt(surahStr);
        const [sStart, sEnd] = range;

        // Check for overlap between Surah bounds and Juz bounds
        if (sStart <= juzEnd && sEnd >= juzStart) {
            juzSurahs.push({
                surah: surahNum,
                weight_pages: metadata.madani.surah_detail[surahNum].weight_pages
            });
        }
    }
    metadata.madani.juz_25_30_weights[`juz_${j}`] = juzSurahs;
}
console.log('  → Mapped juz_25_30_weights');

// 10. Export ──────────────────────────────────────────────────────────────────
const outPath = 'src/data/quran-metadata.json';
fs.writeFileSync(outPath, JSON.stringify(metadata)); // Minified for production
const bytes = fs.statSync(outPath).size;
console.log(`\n✅ Written to ${outPath}  (${(bytes / 1024).toFixed(1)} KB)`);