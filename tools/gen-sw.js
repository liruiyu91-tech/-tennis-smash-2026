// 生成 sw.js：列出游戏用到的全部文件并按内容算版本号。改动任何游戏文件后运行：node tools/gen-sw.js
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.join(__dirname, '..');
const list = [];
const walk = d => fs.readdirSync(path.join(root, d)).forEach(f => {
  const p = path.join(d, f);
  if (fs.statSync(path.join(root, p)).isDirectory()) walk(p); else list.push(p.split(path.sep).join('/'));
});
['index.html', 'manifest.webmanifest', 'icon.svg'].forEach(f => list.push(f));
['js', 'lib', 'icons', 'assets'].forEach(d => fs.existsSync(path.join(root, d)) && walk(d));
const h = crypto.createHash('sha1');
list.sort().forEach(f => h.update(f).update(fs.readFileSync(path.join(root, f))));
const ver = h.digest('hex').slice(0, 10);
fs.writeFileSync(path.join(root, 'sw.js'), `// 由 tools/gen-sw.js 生成，请勿手改。离线缓存：首次打开后断网也能玩
const CACHE = 'ts-${ver}';
const FILES = ${JSON.stringify(['./', ...list.sort()], null, 0)};
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))) });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(caches.match(r, { ignoreSearch: true }).then(hit => hit || fetch(r).catch(() => r.mode === 'navigate' ? caches.match('./') : Response.error())));
});
`);
console.log('sw.js', ver, list.length, 'files');
