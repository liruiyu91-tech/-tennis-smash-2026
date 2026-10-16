// 把 MakeHuman 的 CC0 人体资源转成游戏用的蒙皮人体数据（js/human-data.js）。
// 资源来源：https://github.com/makehumancommunity/makehuman（makehuman/data，2020 年 9 月起以 CC0 发布）
// 用法：node tools/build-humans.js <makehuman 仓库里的 makehuman/data 目录>
//
// 做的事：
// 1. 读基础网格 base.obj（只取 body、头发外壳 helper-hair、眼球 helper-l/r-eye）
// 2. 按"种族 × 性别 × 肌肉 × 体重"叠加形变目标，生成几种运动员体型
// 3. 163 根原始骨骼精简成 17 根游戏骨骼，权重合并、每顶点保留 4 个
// 4. 按身体部位给每个顶点标区域（皮肤 / 球衣 / 短裤 / 袜子 / 球鞋 / 头发 / 眼睛 / 眉毛 / 嘴唇），游戏里按角色配色
// 5. 位置量化成毫米 Int16，整体 base64 写进一个 JS 文件（任何打开方式都能加载，不依赖 fetch）
const fs = require('fs'), path = require('path');
const DATA = process.argv[2];
if (!DATA) { console.error('用法：node tools/build-humans.js <makehuman/data 目录>'); process.exit(1) }

// ---------- 读网格 ----------
const verts = [], faces = {};
let cur = null;
for (const line of fs.readFileSync(path.join(DATA, '3dobjs/base.obj'), 'utf8').split('\n')) {
  if (line.startsWith('v ')) { const p = line.split(/\s+/); verts.push([+p[1], +p[2], +p[3]]) }
  else if (line.startsWith('g ')) cur = line.split(/\s+/)[1];
  else if (line.startsWith('f ')) (faces[cur] = faces[cur] || []).push(line.trim().split(/\s+/).slice(1).map(t => parseInt(t) - 1));
}
// helper-hair 是长发贴合用的辅助网格（会垂到脸前），不用；头发直接涂在头皮上
const GROUPS = { body: 0, 'helper-l-eye': 2, 'helper-r-eye': 2 };

// ---------- 形变目标 ----------
function loadTarget(name) {
  const f = path.join(DATA, 'targets/macrodetails', name + '.target');
  if (!fs.existsSync(f)) return null;
  const out = [];
  for (const l of fs.readFileSync(f, 'utf8').split('\n')) { if (!l || l[0] === '#') continue; const p = l.trim().split(/\s+/); out.push([+p[0], +p[1], +p[2], +p[3]]) }
  return out;
}
const cache = {};
const target = n => (n in cache ? cache[n] : (cache[n] = loadTarget(n)));
// MakeHuman 的宏参数插值：0.5 为平均，往两端分别混合 min / max
const tri = (v, lo, mid, hi) => v < .5 ? [[lo, (.5 - v) * 2], [mid, 1 - (.5 - v) * 2]] : [[mid, 1 - (v - .5) * 2], [hi, (v - .5) * 2]];
function buildShape(o) {
  const pos = verts.map(v => v.slice());
  const add = (name, w) => { if (w <= 0) return; const t = target(name); if (!t) return; for (const [i, dx, dy, dz] of t) { pos[i][0] += dx * w; pos[i][1] += dy * w; pos[i][2] += dz * w } };
  const genders = [['female', 1 - o.gender], ['male', o.gender]];
  for (const [g, gw] of genders) {
    for (const [race, rw] of Object.entries(o.race)) add(`${race}-${g}-young`, gw * rw);
    for (const [m, mw] of tri(o.muscle, 'minmuscle', 'averagemuscle', 'maxmuscle'))
      for (const [w, ww] of tri(o.weight, 'minweight', 'averageweight', 'maxweight')) add(`universal-${g}-young-${m}-${w}`, gw * mw * ww);
  }
  return pos;
}

// ---------- 骨骼 ----------
const skel = JSON.parse(fs.readFileSync(path.join(DATA, 'rigs/default.mhskel'), 'utf8'));
const weightsMH = JSON.parse(fs.readFileSync(path.join(DATA, 'rigs/default_weights.mhw'), 'utf8')).weights;
const jointPos = (pos, name) => { const ids = skel.joints[name]; const s = [0, 0, 0]; for (const i of ids) { s[0] += pos[i][0]; s[1] += pos[i][1]; s[2] += pos[i][2] } return s.map(v => v / ids.length) };
const head = (pos, b) => jointPos(pos, skel.bones[b].head), tail = (pos, b) => jointPos(pos, skel.bones[b].tail);
// 游戏骨骼：[名字, 父骨骼, 取哪根 MakeHuman 骨骼的起点作为位置]
const BONES = [
  ['hips', null, 'root'], ['spine', 'hips', 'spine03'], ['chest', 'spine', 'spine01'], ['neck', 'chest', 'neck01'], ['head', 'neck', 'head'],
  ['upperarm.R', 'chest', 'upperarm01.R'], ['lowerarm.R', 'upperarm.R', 'lowerarm01.R'], ['hand.R', 'lowerarm.R', 'wrist.R'],
  ['upperarm.L', 'chest', 'upperarm01.L'], ['lowerarm.L', 'upperarm.L', 'lowerarm01.L'], ['hand.L', 'lowerarm.L', 'wrist.L'],
  ['upperleg.R', 'hips', 'upperleg01.R'], ['lowerleg.R', 'upperleg.R', 'lowerleg01.R'], ['foot.R', 'lowerleg.R', 'foot.R'],
  ['upperleg.L', 'hips', 'upperleg01.L'], ['lowerleg.L', 'upperleg.L', 'lowerleg01.L'], ['foot.L', 'lowerleg.L', 'foot.L'],
];
const BI = Object.fromEntries(BONES.map((b, i) => [b[0], i]));
// 原始骨骼 → 游戏骨骼（可按比例拆分）
function mapBone(n) {
  const s = n.endsWith('.L') ? '.L' : n.endsWith('.R') ? '.R' : '';
  if (/^(root|spine05|spine04|pelvis)/.test(n)) return [['hips', 1]];
  if (/^(spine03|spine02|breast)/.test(n)) return [['spine', 1]];
  if (/^(spine01|clavicle)/.test(n)) return [['chest', 1]];
  if (/^shoulder01/.test(n)) return [['chest', .5], ['upperarm' + s, .5]];
  if (/^neck/.test(n)) return [['neck', 1]];
  if (/^upperarm/.test(n)) return [['upperarm' + s, 1]];
  if (/^lowerarm/.test(n)) return [['lowerarm' + s, 1]];
  if (/^(wrist|metacarpal|finger)/.test(n)) return [['hand' + s, 1]];
  if (/^upperleg/.test(n)) return [['upperleg' + s, 1]];
  if (/^lowerleg/.test(n)) return [['lowerleg' + s, 1]];
  if (/^(foot|toe)/.test(n)) return [['foot' + s, 1]];
  return [['head', 1]];                        // 头、下颌、眼睛、面部表情骨骼
}

// ---------- 保留的顶点与三角形 ----------
const keep = new Map(), vgroup = [];
const tris = [];
for (const [g, gi] of Object.entries(GROUPS)) for (const f of faces[g]) {
  const ids = f.map(v => { if (!keep.has(v)) { keep.set(v, keep.size); vgroup.push(gi) } return keep.get(v) });
  for (let k = 1; k + 1 < ids.length; k++) tris.push(ids[0], ids[k], ids[k + 1]);
}
const order = [...keep.keys()], N = order.length;
// 权重
const wsum = Array.from({ length: N }, () => new Float64Array(BONES.length));
for (const [b, list] of Object.entries(weightsMH)) for (const [gb, f] of mapBone(b)) for (const [v, w] of list) { const i = keep.get(v); if (i !== undefined) wsum[i][BI[gb]] += w * f }
const skinIdx = new Uint8Array(N * 4), skinW = new Uint8Array(N * 4), dom = new Uint8Array(N);
for (let i = 0; i < N; i++) {
  const top = [...wsum[i]].map((w, b) => [w, b]).sort((a, b) => b[0] - a[0]).slice(0, 4);
  const tot = top.reduce((s, t) => s + t[0], 0) || 1;
  let rest = 255;
  top.forEach(([w, b], k) => { skinIdx[i * 4 + k] = b; const q = k === 3 ? rest : Math.round(w / tot * 255); skinW[i * 4 + k] = Math.min(rest, q); rest -= skinW[i * 4 + k] });
  dom[i] = top[0][1];
}

// ---------- 衣物：布料下的身体细节抹平 + 向外鼓一点 ----------
const nbr = Array.from({ length: N }, () => new Set());
for (let i = 0; i < tris.length; i += 3) { const [a, b, c] = [tris[i], tris[i + 1], tris[i + 2]]; nbr[a].add(b).add(c); nbr[b].add(a).add(c); nbr[c].add(a).add(b) }
const nb = nbr.map(s => [...s]);
function clothify(p) {
  const R = REG_LATE.region; if (!R) return;
  const cloth = i => R[i] === 1 || R[i] === 2 || R[i] === 4 || R[i] === 5;   // 球衣、短裤、球鞋
  const smooth = (lam, idx) => {
    const d = idx.map(i => { const n = nb[i]; let x = 0, y = 0, z = 0; for (const j of n) { x += p[j][0]; y += p[j][1]; z += p[j][2] } return [x / n.length - p[i][0], y / n.length - p[i][1], z / n.length - p[i][2]] });
    idx.forEach((i, k) => { p[i][0] += lam * d[k][0]; p[i][1] += lam * d[k][1]; p[i][2] += lam * d[k][2] });
  };
  const idx = []; for (let i = 0; i < N; i++) if (cloth(i)) idx.push(i);
  for (let it = 0; it < 14; it++) { smooth(.5, idx); smooth(-.53, idx) }   // Taubin 平滑：去掉细节但不缩水
  // 胸前：强力拉平（边界固定），像运动上衣一样收住胸部轮廓
  const chestFront = idx.filter(i => R[i] === 1 && /^(spine|chest)$/.test(BONES[dom[i]][0]) && p[i][2] > CHEST_Z.z && p[i][1] > CHEST_Z.y0 && p[i][1] < CHEST_Z.y1);
  if (chestFront.length) {
    const orig = chestFront.map(i => p[i].slice());
    for (let it = 0; it < 1500; it++) smooth(.6, chestFront);
    chestFront.forEach((i, k) => { for (let c = 0; c < 3; c++) p[i][c] = orig[k][c] * .06 + p[i][c] * .94 });
  }
  const shirt = idx.filter(i => R[i] === 1);
  for (let it = 0; it < 40; it++) { smooth(.6, shirt); smooth(-.62, shirt) }   // 上衣再多抹几遍，胸前不留起伏
  // 顶点法线（面积加权）
  const nrm = Array.from({ length: N }, () => [0, 0, 0]);
  for (let i = 0; i < tris.length; i += 3) {
    const [a, b, c] = [p[tris[i]], p[tris[i + 1]], p[tris[i + 2]]];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    for (const k of [tris[i], tris[i + 1], tris[i + 2]]) { nrm[k][0] += n[0]; nrm[k][1] += n[1]; nrm[k][2] += n[2] }
  }
  const PUSH = { 1: .007, 2: .009, 3: .002, 4: .012, 5: .01 };
  for (let i = 0; i < N; i++) { const pu = PUSH[R[i]]; if (!pu) continue; const n = nrm[i], l = Math.hypot(...n) || 1; p[i][0] += n[0] / l * pu; p[i][1] += n[1] / l * pu; p[i][2] += n[2] / l * pu }
}
const REG_LATE = { region: null }, CHEST_Z = { z: 0, y0: 0, y1: 0 };

// ---------- 体型 ----------
const VARIANTS = {
  m_asian: { gender: 1, race: { asian: .75, caucasian: .25 }, muscle: .68, weight: .45 },
  m_mix:   { gender: 1, race: { caucasian: .5, african: .25, asian: .25 }, muscle: .7, weight: .45 },
  m_big:   { gender: 1, race: { caucasian: .4, african: .4, asian: .2 }, muscle: .85, weight: .75 },
  f_asian: { gender: 0, race: { asian: .75, caucasian: .25 }, muscle: .6, weight: .4 },
  f_mix:   { gender: 0, race: { caucasian: .5, african: .3, asian: .2 }, muscle: .62, weight: .42 },
};
const REG = { skin: 0, shirt: 1, shorts: 2, sock: 3, shoe: 4, sole: 5, hair: 6, eye: 7, iris: 8, brow: 9, lips: 10 };
const meta = { bones: BONES.map(b => ({ name: b[0], parent: b[1] })), N, T: tris.length / 3, variants: {}, regions: REG,
  source: 'MakeHuman system assets (CC0 1.0), github.com/makehumancommunity/makehuman' };
const chunks = [];
const pushBuf = (name, arr) => { meta[name] = { off: chunks.reduce((s, c) => s + c.byteLength, 0), len: arr.length, type: arr.constructor.name }; chunks.push(Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength)); while (chunks.reduce((s, c) => s + c.byteLength, 0) % 4) chunks.push(Buffer.alloc(1)) };
pushBuf('index', new Uint16Array(tris)); pushBuf('skinIndex', skinIdx); pushBuf('skinWeight', skinW);
let region = null;
for (const [vn, opt] of Object.entries(VARIANTS)) {
  const full = buildShape(opt);
  const S = .1;                                             // MakeHuman 单位是分米
  const p = order.map(v => full[v].map(c => c * S));
  const minY = Math.min(...p.filter((_, i) => vgroup[i] === 0).map(q => q[1]));
  p.forEach(q => q[1] -= minY);
  const J = (b, which = 'head') => { const j = (which === 'head' ? head : tail)(full, b).map(c => c * S); j[1] -= minY; return j };
  const bonePos = BONES.map(b => J(b[2]));
  const dir = (a, b) => { const d = b.map((v, i) => v - a[i]); const l = Math.hypot(...d); return d.map(v => v / l) };
  // 每根骨骼的静止朝向（指向子骨骼 / 末端）
  const tipOf = { hips: J('spine03'), spine: J('spine01'), chest: J('neck01'), neck: J('head'), head: J('head', 'tail'),
    'upperarm.R': J('lowerarm01.R'), 'lowerarm.R': J('wrist.R'), 'hand.R': J('finger3-1.R'), 'upperarm.L': J('lowerarm01.L'), 'lowerarm.L': J('wrist.L'), 'hand.L': J('finger3-1.L'),
    'upperleg.R': J('lowerleg01.R'), 'lowerleg.R': J('foot.R'), 'foot.R': J('toe3-1.R'), 'upperleg.L': J('lowerleg01.L'), 'lowerleg.L': J('foot.L'), 'foot.L': J('toe3-1.L') };
  const bdir = BONES.map((b, i) => dir(bonePos[i], tipOf[b[0]]));
  const eyeL = J('eye.L'), eyeR = J('eye.R'), mouth = J('oris01'), headTop = Math.max(...p.filter((_, i) => vgroup[i] === 0).map(q => q[1]));
  // 区域（只在第一个体型上计算，所有体型拓扑相同）
  if (!region) {
    region = new Uint8Array(N);
    const B = n => bonePos[BI[n]];
    const kneeY = B('lowerleg.R')[1], hipY = B('upperleg.R')[1], ankleY = B('foot.R')[1], waistY = (B('spine')[1] + B('hips')[1]) / 2;
    const eyeY = (eyeL[1] + eyeR[1]) / 2, eyeZ = (eyeL[2] + eyeR[2]) / 2, neckY = B('neck')[1], collarY = neckY - .03;
    const eyeC = [0, 0, 0], eyeCR = [0, 0, 0]; let nl = 0, nr = 0;
    for (let i = 0; i < N; i++) if (vgroup[i] === 2) { if (p[i][0] > 0) { eyeC.forEach((_, k) => eyeC[k] += p[i][k]); nl++ } else { eyeCR.forEach((_, k) => eyeCR[k] += p[i][k]); nr++ } }
    eyeC.forEach((_, k) => eyeC[k] /= nl); eyeCR.forEach((_, k) => eyeCR[k] /= nr);
    for (let i = 0; i < N; i++) {
      const [x, y, z] = p[i], bn = BONES[dom[i]][0];
      let r = REG.skin;
      if (vgroup[i] === 1) r = REG.hair;
      else if (vgroup[i] === 2) { const c = x > 0 ? eyeC : eyeCR, d = [x - c[0], y - c[1], z - c[2]], l = Math.hypot(...d); r = d[2] / l > .82 ? REG.iris : REG.eye }
      else if (/^foot/.test(bn) || y < ankleY + .02) r = y < .018 ? REG.sole : REG.shoe;
      else if (/^lowerleg/.test(bn) && y < ankleY + .11) r = REG.sock;
      else if (/^upperleg/.test(bn)) r = y > kneeY + (hipY - kneeY) * .42 ? REG.shorts : REG.skin;
      else if (bn === 'hips') r = y < waistY ? REG.shorts : REG.shirt;
      else if (bn === 'spine' || bn === 'chest' || bn === 'neck') r = y < collarY - (z > B('neck')[2] + .03 ? .025 : 0) ? REG.shirt : REG.skin;
      else if (/^upperarm/.test(bn)) { const s = B(bn), d = bdir[dom[i]], t = (x - s[0]) * d[0] + (y - s[1]) * d[1] + (z - s[2]) * d[2]; r = t < .13 ? REG.shirt : REG.skin }
      else if (bn === 'head') {
        const front = z > eyeZ - .025;
        if ((y > eyeY + .058) || (y > eyeY + .015 && !front) || (z < eyeZ - .075 && y > eyeY - .025) || (z < eyeZ - .12 && y > mouth[1] - .01)) r = REG.hair;
        else if (front && y > eyeY + .017 && y < eyeY + .026 && Math.min(Math.abs(x - eyeL[0]), Math.abs(x - eyeR[0])) < .022 && z > eyeZ - .008) r = REG.brow;
        else if (Math.abs(x) < .024 && y > mouth[1] - .014 && y < mouth[1] + .008 && z > mouth[2] - .012) r = REG.lips;
      }
      region[i] = r;
    }
    pushBuf('region', region); REG_LATE.region = region;
  }
  CHEST_Z.z = bonePos[BI['spine']][2] + .02; CHEST_Z.y0 = bonePos[BI['spine']][1] + .02; CHEST_Z.y1 = bonePos[BI['upperarm.R']][1] - .02;
  clothify(p);
  const q = new Int16Array(N * 3); p.forEach((v, i) => { q[i * 3] = Math.round(v[0] * 1000); q[i * 3 + 1] = Math.round(v[1] * 1000); q[i * 3 + 2] = Math.round(v[2] * 1000) });
  pushBuf('pos_' + vn, q);
  const eY = (eyeL[1] + eyeR[1]) / 2, ring = p.filter((q, i) => vgroup[i] === 0 && BONES[dom[i]][0] === 'head' && q[1] > eY + .035 && q[1] < eY + .055);
  const band = { y: eY + .045, rx: Math.max(...ring.map(q => Math.abs(q[0]))), zf: Math.max(...ring.map(q => q[2])), zb: Math.min(...ring.map(q => q[2])) };
  meta.variants[vn] = { band: { y: +band.y.toFixed(4), cz: +((band.zf + band.zb) / 2).toFixed(4), rx: +band.rx.toFixed(4), rz: +((band.zf - band.zb) / 2).toFixed(4) }, bonePos: bonePos.map(v => v.map(c => +c.toFixed(4))), boneDir: bdir.map(v => v.map(c => +c.toFixed(4))),
    eyeL: eyeL.map(c => +c.toFixed(4)), eyeR: eyeR.map(c => +c.toFixed(4)), headTop: +headTop.toFixed(4), height: +Math.max(...p.map(v => v[1])).toFixed(3) };
}
const bin = Buffer.concat(chunks);
const out = `// 由 tools/build-humans.js 生成，请勿手改。人体模型：MakeHuman 系统资源（CC0 1.0）
const HUMAN_META = ${JSON.stringify(meta)};
const HUMAN_BIN = "${bin.toString('base64')}";
`;
fs.writeFileSync(path.join(__dirname, '../js/human-data.js'), out);
console.log(`顶点 ${N}，三角形 ${tris.length / 3}，体型 ${Object.keys(VARIANTS).length} 个，二进制 ${(bin.length / 1024).toFixed(0)} KB，JS 文件 ${(out.length / 1024).toFixed(0)} KB`);
for (const [k, v] of Object.entries(meta.variants)) console.log(k, '身高', v.height, 'm');
