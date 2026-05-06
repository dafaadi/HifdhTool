import { readFileSync } from 'fs';

const files = [
  { name: 'quran-metadata-juz',    path: 'src/data/quran-metadata-juz.json/quran-metadata-juz.json' },
  { name: 'quran-metadata-ruku',   path: 'src/data/quran-metadata-ruku.json/quran-metadata-ruku.json' },
  { name: 'quran-metadata-manzil', path: 'src/data/quran-metadata-manzil.json/quran-metadata-manzil.json' },
  { name: 'quran-metadata-hizb',   path: 'src/data/quran-metadata-hizb.json/quran-metadata-hizb.json' },
];

for (const { name, path } of files) {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const isArr = Array.isArray(raw);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`FILE: ${name}.json`);
  console.log(`Type: ${isArr ? `Array  (length: ${raw.length})` : `Object (keys: ${Object.keys(raw).length})`}`);

  if (isArr) {
    console.log('First 3 items:');
    console.log(JSON.stringify(raw.slice(0, 3), null, 2));
  } else {
    const top3 = Object.fromEntries(Object.entries(raw).slice(0, 3));
    console.log('Top-level keys (first 5):', Object.keys(raw).slice(0, 5));
    console.log('First 3 entries:');
    console.log(JSON.stringify(top3, null, 2));
  }
}
