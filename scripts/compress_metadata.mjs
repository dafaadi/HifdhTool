import fs from 'fs';
import Database from 'better-sqlite3';

// ── Path resolver (handles same-name folder-wrapped files) ──────────────────
function resolvePath(hint) {
  if (fs.existsSync(hint) && fs.statSync(hint).isFile()) return hint;
  // Try folder-wrapped: hint/basename
  const basename = hint.split(/[\\/]/).pop();
  const wrapped = `${hint}/${basename}`;
  if (fs.existsSync(wrapped) && fs.statSync(wrapped).isFile()) return wrapped;
  throw new Error(`Cannot resolve path: ${hint}`);
}

function resolveJson(hint) {
  // JSON files may be flat OR folder-wrapped
  if (fs.existsSync(hint) && fs.statSync(hint).isFile()) return hint;
  const basename = hint.split(/[\\/]/).pop();
  const wrapped = `${hint}/${basename}`;
  if (fs.existsSync(wrapped)) return wrapped;
  throw new Error(`Cannot resolve JSON: ${hint}`);
}

// 1. Initialize Databases ────────────────────────────────────────────────────
const dbWords   = new Database(resolvePath('src/qpc-hafs-word-by-word.db'));
const dbMadani  = new Database(resolvePath('src/qpc-v2-15-lines.db'));
const dbIndopak = new Database(resolvePath('src/data/qudratullah-indopak-15-lines.db'));

// 2. Skeleton Object ─────────────────────────────────────────────────────────
const metadata = {
  madani:  { juz: {}, surah: {}, page: {}, rub: {}, hizb: {} },
  indopak: { para: {}, surah: {}, page: {}, ruku: {}, manzil: {} }
};

// 3. Helper: Convert surah:ayah to word_id range ─────────────────────────────
const stmtMin = dbWords.prepare('SELECT MIN(id) as id FROM words WHERE surah = ? AND ayah = ?');
const stmtMax = dbWords.prepare('SELECT MAX(id) as id FROM words WHERE surah = ? AND ayah = ?');

const getAyahWordRange = (firstKey, lastKey) => {
  const [fSurah, fAyah] = firstKey.split(':');
  const [lSurah, lAyah] = lastKey.split(':');
  const start = stmtMin.get(fSurah, fAyah)?.id;
  const end   = stmtMax.get(lSurah, lAyah)?.id;
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
  metadata.madani.surah[s.surah]  = [s.start, s.end];
  metadata.indopak.surah[s.surah] = [s.start, s.end];
});
console.log(`  → ${surahs.length} surahs`);

// 5. Map Pages (Madani) ───────────────────────────────────────────────────────
console.log('Mapping Madani pages...');
const madaniPages = dbMadani.prepare(
  'SELECT page_number, MIN(first_word_id) as start, MAX(last_word_id) as end FROM pages GROUP BY page_number'
).all();
madaniPages.forEach(p => { metadata.madani.page[p.page_number] = [p.start, p.end]; });
console.log(`  → ${madaniPages.length} pages`);

// 6. Map Pages (Indo-Pak) ─────────────────────────────────────────────────────
console.log('Mapping Indo-Pak pages...');
const indopakPages = dbIndopak.prepare(
  'SELECT page_number, MIN(first_word_id) as start, MAX(last_word_id) as end FROM pages GROUP BY page_number'
).all();
indopakPages.forEach(p => { metadata.indopak.page[p.page_number] = [p.start, p.end]; });
console.log(`  → ${indopakPages.length} pages`);

// 7. Process JSON Divisions ───────────────────────────────────────────────────
const processJson = (hint, targetObj, label) => {
  let filename;
  try { filename = resolveJson(hint); } catch {
    console.warn(`  ⚠️  Missing: ${hint}`);
    return;
  }
  console.log(`Mapping ${label}...`);
  const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
  let count = 0;
  for (const [key, val] of Object.entries(data)) {
    targetObj[key] = getAyahWordRange(val.first_verse_key, val.last_verse_key);
    count++;
  }
  console.log(`  → ${count} entries`);
};

processJson('src/data/quran-metadata-juz.json',    metadata.madani.juz,     'Juz (Madani)');
processJson('src/data/quran-metadata-juz.json',    metadata.indopak.para,   'Para (Indo-Pak, same as Juz)');
processJson('src/data/quran-metadata-hizb.json',   metadata.madani.hizb,    'Hizb');
processJson('src/data/quran-metadata-rub.json',    metadata.madani.rub,     'Rub');
processJson('src/data/quran-metadata-ruku.json',   metadata.indopak.ruku,   'Ruku');
processJson('src/data/quran-metadata-manzil.json', metadata.indopak.manzil, 'Manzil');

// 7.5 Auto-Patch Null Page Ends ──────────────────────────────────────────────
const patchPageEnds = (pagesObj, absoluteMaxWord) => {
  const pageNums = Object.keys(pagesObj).map(Number).sort((a, b) => a - b);
  for (let i = 0; i < pageNums.length; i++) {
    const current = pageNums[i];
    if (!pagesObj[current][1]) { // If end is null
      if (i < pageNums.length - 1) {
        const nextStart = pagesObj[pageNums[i + 1]][0];
        pagesObj[current][1] = nextStart - 1;
      } else {
        pagesObj[current][1] = absoluteMaxWord; // Very last page
      }
    }
  }
};

// Get absolute max word ID for the final page boundary
const maxWord = dbWords.prepare('SELECT MAX(id) as maxId FROM words').get().maxId;
console.log(`\nPatching null page ends (max word ID: ${maxWord})...`);
patchPageEnds(metadata.madani.page, maxWord);
patchPageEnds(metadata.indopak.page, maxWord);

// Count any remaining nulls as a sanity check
const madaniNulls  = Object.values(metadata.madani.page).filter(v => v[1] == null).length;
const indopakNulls = Object.values(metadata.indopak.page).filter(v => v[1] == null).length;
console.log(`  Madani  null ends remaining: ${madaniNulls}`);
console.log(`  IndoPak null ends remaining: ${indopakNulls}`);

// 8. Export ───────────────────────────────────────────────────────────────────
const outPath = 'src/data/quran-metadata.json';
fs.writeFileSync(outPath, JSON.stringify(metadata));
const bytes = fs.statSync(outPath).size;
console.log(`\n✅ Written to ${outPath}  (${(bytes / 1024).toFixed(1)} KB)`);
