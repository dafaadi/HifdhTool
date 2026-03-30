import sqlite3 from 'sqlite3';
const db = new sqlite3.Database('./src/qpc-v2-15-lines.db');

db.serialize(() => {
  db.all("SELECT name FROM sqlite_master WHERE type='table';", (err, tables) => {
    if (err) throw err;
    console.log("Tables:");
    console.log(tables.map(t => t.name).join(", "));
    
    tables.forEach(t => {
      db.all(`PRAGMA table_info(${t.name})`, (err, cols) => {
        console.log(`\nCols for ${t.name}:`, cols.map(c => c.name).join(", "));
      });
    });
  });
});
