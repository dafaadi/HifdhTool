const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\Imran\\Documents\\Imrans\\Coding\\Web Dev\\Projects\\Quran Hifdh Tooling\\src\\data\\digital-khatt-indopak.json\\digital-khatt-indopak.json', 'utf8');
console.log(content.substring(0, 1000));
