// 用逆向运动学求解挥拍关键帧的手臂角度：给定拍头位置与球拍朝向（模型坐标，面朝 +Z，右手在 -X），
// 搜索肩/肘/腕角度，使拍头落到目标点。双手反手还会把左手放到握把上。
// 用法：node tools/solve-arms.js > /tmp/arms.json（结果粘贴进 js/scene.js 的 ARM 表）
const fs = require('fs'), path = require('path');
const THREE = require('../lib/three.min.js');
// 读取 scene.js 里的姿态表（只取纯数据部分）
const src = fs.readFileSync(path.join(__dirname, '../js/scene.js'), 'utf8');
const a = src.indexOf('  const R0 = '), b = src.indexOf('  // 挥拍时间轴');
const POSES = new Function(src.slice(a, b) + '\nreturn POSES;')();

// 与 makePlayer 相同的骨架
const root = new THREE.Group(), hips = new THREE.Group(), torso = new THREE.Group();
root.add(hips); hips.add(torso); torso.position.y = .06;
const arm = s => { const sh = new THREE.Group(); sh.position.set(s * .24, .5, 0); torso.add(sh); const el = new THREE.Group(); el.position.y = -.3; sh.add(el); const hand = new THREE.Group(); hand.position.y = -.3; el.add(hand); return { sh, el, hand } };
const R = arm(-1), L = arm(1);
const head = new THREE.Object3D(); head.position.y = -.41; R.hand.add(head);
const v = new THREE.Vector3(), w = new THREE.Vector3();
function fk(p, q) {
  hips.position.y = .95 - p.crouch + p.jump; hips.rotation.set(0, q.hipY ?? p.hipY, 0); torso.rotation.set(p.torsoX, q.torsoY ?? p.torsoY, 0);
  R.sh.rotation.set(q.rShX, q.rShY, q.rShZ); R.el.rotation.x = q.rEl; R.hand.rotation.set(q.wrist, 0, q.wristZ);
  L.sh.rotation.set(q.lShX, q.lShY, q.lShZ); L.el.rotation.x = q.lEl;
  root.updateMatrixWorld(true);
  const hd = head.getWorldPosition(new THREE.Vector3()), hn = R.hand.getWorldPosition(new THREE.Vector3()), lh = L.hand.getWorldPosition(new THREE.Vector3());
  return { hd, hn, lh, dir: hd.clone().sub(hn).normalize() };
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const N = (x, y, z) => V(x, y, z).normalize();
// 目标：h 拍头中心，d 球拍朝向（握把→拍头），lh 左手位置：'grip' = 握把上（双手），'throat' = 扶拍颈，或固定坐标
const T = {
  READY:      { h: V(-.05, 1.2, .62), d: N(.15, .5, .85), lh: 'throat' },
  FH_PREP:    { h: V(-.6, 1.75, -.3), d: N(-.25, .85, -.45) },
  FH_DROP:    { h: V(-.8, .78, -.55), d: N(-.3, -.7, -.6) },
  FH_HIT:     { h: V(-.9, 1.02, .42), d: N(-.95, 0, .3) },
  FH_WIPER:   { h: V(-.25, 1.5, .55), d: N(.3, .75, .55) },
  FH_FOLLOW:  { h: V(.38, 1.6, -.25), d: N(.25, .35, -.9), lh: 'throat' },
  FH_FLAT_FOL:{ h: V(.5, 1.35, .25), d: N(.85, .1, -.5) },
  FH_SL_PREP: { h: V(-.45, 1.8, -.3), d: N(-.1, .85, -.5) },
  FH_SL_HIT:  { h: V(-.85, .98, .42), d: N(-.92, -.12, .36) },
  FH_SL_FOL:  { h: V(-.3, .85, .9), d: N(.2, -.2, .95) },
  FH_LOB_FOL: { h: V(-.4, 2.2, .3), d: N(-.1, .95, .25) },
  FH_DR_HIT:  { h: V(-.78, .88, .48), d: N(-.8, -.2, .55) },
  FH_DR_FOL:  { h: V(-.55, .88, .75), d: N(-.3, -.1, .95) },
  B2_PREP:    { h: V(.58, 1.55, -.4), d: N(.2, .6, -.75), lh: 'grip' },
  B2_DROP:    { h: V(.6, .82, -.5), d: N(.3, -.6, -.7), lh: 'grip' },
  B2_HIT:     { h: V(.8, 1.02, .42), d: N(.95, 0, .3), lh: 'grip' },
  B2_WIPER:   { h: V(.22, 1.5, .55), d: N(-.3, .72, .6), lh: 'grip' },
  B2_FOL:     { h: V(-.38, 1.65, -.2), d: N(-.25, .4, -.88), lh: 'grip' },
  B2_FLAT_FOL:{ h: V(-.48, 1.35, .22), d: N(-.85, .1, -.5), lh: 'grip' },
  B2_LOB_FOL: { h: V(.3, 2.2, .25), d: N(.1, .95, .25), lh: 'grip' },
  B1_PREP:    { h: V(.48, 1.6, -.45), d: N(.05, .7, -.7), lh: 'throat' },
  B1_DROP:    { h: V(.58, .82, -.55), d: N(.25, -.65, -.7), lh: 'throat' },
  B1_HIT:     { h: V(.82, 1.02, .45), d: N(.95, 0, .3) },
  B1_FOL:     { h: V(-.25, 2.0, .2), d: N(-.25, .95, .15) },
  B1_LOB_FOL: { h: V(.1, 2.25, .32), d: N(0, .95, .3) },
  BS_PREP:    { h: V(.42, 1.85, -.25), d: N(.1, .85, -.45), lh: 'throat' },
  BS_HIT:     { h: V(.8, .98, .42), d: N(.9, -.15, .36) },
  BS_FOL:     { h: V(.25, .85, .85), d: N(-.25, -.2, .95) },
  BS_DR_HIT:  { h: V(.76, .88, .48), d: N(.8, -.2, .55) },
  BS_DR_FOL:  { h: V(.5, .9, .72), d: N(.3, -.1, .95) },
  VO_BACK:    { h: V(-.62, 1.5, .1), d: N(-.35, .85, .15), lh: 'throat' },
  VO_HIT:     { h: V(-.65, 1.3, .65), d: N(-.4, .55, .7) },
  VB_BACK:    { h: V(.58, 1.5, .05), d: N(.35, .85, .15), lh: 'throat' },
  VB_HIT:     { h: V(.55, 1.3, .62), d: N(.4, .55, .7) },
};
const LIM = { rShX: [-3.2, .9], rShY: [-1.6, 1.6], rShZ: [-1.7, 1.3], rEl: [-2.4, 0], wrist: [-1.7, 1.7], wristZ: [-1.2, 1.2], lShX: [-3.2, .9], lShY: [-1.6, 1.6], lShZ: [-1.3, 1.7], lEl: [-2.4, 0] };
const RK = ['rShX', 'rShY', 'rShZ', 'rEl', 'wrist', 'wristZ'], LK = ['lShX', 'lShY', 'lShZ', 'lEl'], TK = ['hipY', 'torsoY'];
// 反手需要保持侧身：允许在原值 ±0.5 内微调髋/肩转角
function solve(name) {
  const p = POSES[name], t = T[name];
  const cost = q => {
    const r = fk(p, q);
    let c = r.hd.distanceToSquared(t.h) * 6 + (1 - r.dir.dot(t.d)) * 1.2 + .015 * (q.rShY * q.rShY + q.wristZ * q.wristZ) + .08 * ((q.hipY - p.hipY) ** 2 + (q.torsoY - p.torsoY) ** 2);
    if (t.lh) { const tgt = t.lh === 'grip' ? r.hn.clone().addScaledVector(r.dir, .1) : r.hn.clone().addScaledVector(r.dir, .25); c += r.lh.distanceToSquared(tgt) * 4 + .01 * q.lShY * q.lShY }
    return c;
  };
  const turn = /^(B1|B2|BS|VB)/.test(name), keys = (t.lh ? RK.concat(LK) : RK).concat(turn ? TK : []);
  for (const k of TK) LIM[k] = [p[k] - .5, p[k] + .5];
  let best = Object.assign({}, p), bc = cost(best);
  for (let i = 0; i < 6000; i++) {                       // 随机搜索
    const q = Object.assign({}, best);
    for (const k of keys) q[k] = i < 3000 ? LIM[k][0] + Math.random() * (LIM[k][1] - LIM[k][0]) : Math.max(LIM[k][0], Math.min(LIM[k][1], best[k] + (Math.random() - .5) * .4));
    const c = cost(q); if (c < bc) { bc = c; best = q }
  }
  for (let s = .2; s > .002; s *= .6) for (let it = 0; it < 30; it++) for (const k of keys) for (const d of [-s, s]) {   // 坐标下降精修
    const q = Object.assign({}, best); q[k] = Math.max(LIM[k][0], Math.min(LIM[k][1], q[k] + d)); const c = cost(q); if (c < bc) { bc = c; best = q }
  }
  const r = fk(p, best), out = {};
  for (const k of keys) out[k] = Math.round(best[k] * 100) / 100;
  return { out, err: Math.round(r.hd.distanceTo(t.h) * 100), ang: Math.round(Math.acos(Math.min(1, r.dir.dot(t.d))) * 57) };
}
const res = {}, report = [];
for (const n in T) { const s = solve(n); res[n] = s.out; report.push(`${n}: 拍头误差 ${s.err}cm 朝向误差 ${s.ang}°`) }
console.error(report.join('\n'));
console.log(JSON.stringify(res));
