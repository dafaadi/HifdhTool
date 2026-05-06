import https from 'https';

const options = {
  hostname: 'api.github.com',
  path: '/repos/TarteelAI/quranic-universal-library/git/trees/main?recursive=1',
  headers: { 'User-Agent': 'Node.js' }
};

https.get(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const tree = JSON.parse(data).tree;
    if (tree) {
      const dbs = tree.filter(t => t.path.includes('.db') || t.path.includes('.sqlite') || t.path.includes('word') || t.path.includes('quran'));
      console.log('Relevant files found:', dbs.map(d => d.path));
    } else {
      console.log('No tree found', JSON.parse(data));
    }
  });
}).on('error', console.error);
