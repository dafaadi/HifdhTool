// schema_dump.mjs — dumps CREATE TABLE schemas from all local SQLite DBs
// Run: node schema_dump.mjs

import sqlite3 from 'sqlite3';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

// Resolve the real .db file path (handles both bare files and folder-wrapped .db)
function resolveDb(pathHint) {
  try {
    const stat = statSync(pathHint);
    if (stat.isDirectory()) {
      // Some tools wrap .db in a same-named folder — look inside
      const inner = readdirSync(pathHint).find(f => f.endsWith('.db'));
      if (inner) return join(pathHint, inner);
    }
    return pathHint;
  } catch {
    return null;
  }
}

const candidates = [
  { label: 'Madani (qpc-hafs-word-by-word)', hint: 'src/qpc-hafs-word-by-word.db' },
  { label: 'Madani v2 15-lines (qpc-v2-15-lines)', hint: 'src/qpc-v2-15-lines.db' },
  { label: 'Indo-Pak (qudratullah-indopak-15-lines)', hint: 'src/data/qudratullah-indopak-15-lines.db' },
];

function dumpSchema(label, dbPath) {
  return new Promise((resolve) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, err => {
      if (err) {
        console.error(`❌ ${label}: Could not open ${dbPath}\n   ${err.message}\n`);
        return resolve();
      }

      console.log(`\n${'='.repeat(70)}`);
      console.log(`📂 ${label}`);
      console.log(`   Path: ${dbPath}`);
      console.log('='.repeat(70));

      db.all("SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name", (err, tables) => {
        if (err) { console.error('  sqlite_master error:', err.message); return resolve(); }

        if (!tables.length) {
          console.log('  (no tables found)');
          db.close();
          return resolve();
        }

        let pending = tables.length;
        tables.forEach(({ name, sql }) => {
          console.log(`\n── Table: ${name}`);
          if (sql) console.log(sql + ';');

          // Also dump PRAGMA for a clean column list
          db.all(`PRAGMA table_info(${name})`, (err, cols) => {
            if (!err && cols.length) {
              const colList = cols.map(c =>
                `  [${c.cid}] ${c.name.padEnd(30)} ${c.type.padEnd(15)} ${c.notnull ? 'NOT NULL' : '       '} ${c.pk ? '(PK)' : ''}`
              ).join('\n');
              console.log('\n  Columns:');
              console.log(colList);
            }
            if (--pending === 0) {
              db.close();
              resolve();
            }
          });
        });
      });
    });
  });
}

(async () => {
  for (const { label, hint } of candidates) {
    const path = resolveDb(hint);
    if (!path) {
      console.log(`\n⚠️  ${label}: path not found at "${hint}", skipping.`);
      continue;
    }
    await dumpSchema(label, path);
  }
  console.log('\n\nDone.\n');
})();
