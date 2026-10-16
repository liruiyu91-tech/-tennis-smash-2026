// 生成球员立绘（SVG）。画风：Avataaars by Pablo Stanley（可免费商用），通过 DiceBear（MIT）生成。
// 用法：cd tools && npm install && npm run portraits
const fs = require('fs'), path = require('path'), vm = require('vm');
const { createAvatar } = require('@dicebear/core');
const { avataaars } = require('@dicebear/collection');

const ctx = { Math, Object, console }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/data.js'), 'utf8').replace(/^'use strict';/, '') +
  '\n;this.ALL = [...CHARACTERS, ...OPPS, ...QUICK_OPPS, COACH];', ctx);

const MOODS = {
  n: { eyes: ['default'], eyebrows: ['defaultNatural'], mouth: ['smile'] },          // 普通
  f: { eyes: ['squint'], eyebrows: ['angryNatural'], mouth: ['screamOpen'] },        // 必杀技爆发
  w: { eyes: ['happy'], eyebrows: ['raisedExcitedNatural'], mouth: ['twinkle'] },    // 胜利
};
const hex = c => c.replace('#', '').toLowerCase();
const out = path.join(__dirname, '../assets/portraits');
fs.mkdirSync(out, { recursive: true });
let n = 0, bytes = 0;
for (const c of ctx.ALL) {
  const L = c.look, a = c.av || {};
  for (const [mood, face] of Object.entries(MOODS)) {
    const svg = createAvatar(avataaars, Object.assign({
      seed: c.id, top: [a.top || 'shortFlat'], topProbability: 100,
      hairColor: [hex(L.hair || '#2c1b18')], skinColor: [hex(L.skin)], facialHairColor: [hex(L.hair || '#2c1b18')],
      clothing: ['shirtCrewNeck'], clothesColor: [hex(L.shirt)],
      facialHair: a.facialHair ? [a.facialHair] : undefined, facialHairProbability: a.facialHair ? 100 : 0,
      accessories: a.accessories ? [a.accessories] : undefined, accessoriesProbability: a.accessories ? 100 : 0,
      hatColor: [hex(L.band || L.shirt)],
    }, face)).toString();
    fs.writeFileSync(path.join(out, `${c.id}-${mood}.svg`), svg);
    n++; bytes += svg.length;
  }
}
console.log(`生成 ${n} 张立绘，共 ${(bytes / 1024).toFixed(0)} KB`);
