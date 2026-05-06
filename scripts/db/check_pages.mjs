import sqlite3 from 'sqlite3';
const db = new sqlite3.Database('./src/qpc-v2-15-lines.db');

db.all("SELECT * FROM pages LIMIT 20;", (err, rows) => {
  if (err) throw err;
  console.log("Pages sample:");
  console.table(rows);
});
