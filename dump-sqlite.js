import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('src/data/qudratullah-indopak-15-lines.db/qudratullah-indopak-15-lines.db');

db.serialize(() => {
  db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
    if (err) throw err;
    console.log("Tables:", rows);
    
    rows.forEach(row => {
      db.all(`PRAGMA table_info(${row.name})`, (err, cols) => {
        console.log(`Table ${row.name} schema:`, cols);
      });
      // get first 2 rows of pages
      if (row.name === 'pages') {
        db.all(`SELECT * FROM pages LIMIT 5`, (err, data) => {
          console.log("pages sample data:", data);
        });
      }
    });
  });
});
