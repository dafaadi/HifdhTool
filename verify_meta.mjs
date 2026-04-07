import { readFileSync, statSync } from 'fs';

const bytes = statSync('src/data/quran-metadata.json').size;
const d = JSON.parse(readFileSync('src/data/quran-metadata.json', 'utf8'));
const m = d.madani;
const ip = d.indopak;

console.log(`File size: ${(bytes / 1024).toFixed(1)} KB\n`);

console.log('── madani.juz (1–3):');
[1,2,3].forEach(k => console.log(`  ${k}: [${m.juz[k]}]`));

console.log('\n── madani.page (1–3):');
[1,2,3].forEach(k => console.log(`  ${k}: [${m.page[k]}]`));

console.log('\n── madani.surah (1–3):');
[1,2,3].forEach(k => console.log(`  ${k}: [${m.surah[k]}]`));

console.log('\n── madani.hizb (1–2):');
[1,2].forEach(k => console.log(`  ${k}: [${m.hizb[k]}]`));

console.log('\n── madani.rub (1–2):');
[1,2].forEach(k => console.log(`  ${k}: [${m.rub[k]}]`));

console.log('\n── indopak.para (1–2):');
[1,2].forEach(k => console.log(`  ${k}: [${ip.para[k]}]`));

console.log('\n── indopak.page (1–3):');
[1,2,3].forEach(k => console.log(`  ${k}: [${ip.page[k]}]`));

console.log('\n── indopak.ruku (1–2):');
[1,2].forEach(k => console.log(`  ${k}: [${ip.ruku[k]}]`));

console.log('\n── indopak.manzil (1–2):');
[1,2].forEach(k => console.log(`  ${k}: [${ip.manzil[k]}]`));

console.log('\n── Key counts:');
console.log('  madani.juz:', Object.keys(m.juz).length);
console.log('  madani.page:', Object.keys(m.page).length);
console.log('  madani.surah:', Object.keys(m.surah).length);
console.log('  madani.hizb:', Object.keys(m.hizb).length);
console.log('  madani.rub:', Object.keys(m.rub).length);
console.log('  indopak.para:', Object.keys(ip.para).length);
console.log('  indopak.page:', Object.keys(ip.page).length);
console.log('  indopak.ruku:', Object.keys(ip.ruku).length);
console.log('  indopak.manzil:', Object.keys(ip.manzil).length);
