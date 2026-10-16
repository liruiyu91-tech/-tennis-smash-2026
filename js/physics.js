'use strict';
// ================= 网球物理引擎 =================
// 状态：位置 (x,y,z)、速度 (vx,vy,vz)、角速度 (wx,wy,wz) rad/s
// 受力：重力 + 二次空气阻力 + 马格努斯力（ω×v）；落地：法向恢复系数 + 带滑动/滚动判定的摩擦冲量（会改变旋转）
const R_BALL = .033;          // 网球半径 m
const KD = .0206;             // 阻力系数 ½ρCdA/m（Cd≈0.55）
const KM = .00075;            // 马格努斯系数：280 rad/s 上旋、25 m/s 时约 5 m/s² 下压
const ALPHA = .66;            // 空心球转动惯量系数 I = αmR²
const SPIN_DECAY = .03;       // 每秒旋转衰减
let SURF = { e: .76, mu: .55 };   // 当前场地：法向恢复系数、摩擦系数

function netH(x) { const a = Math.min(1, Math.abs(x) / 5.03); return .914 + .155 * a * a }

// 只积分受力（半隐式欧拉）
function integ(b, dt) {
  const v = Math.hypot(b.vx, b.vy, b.vz);
  const mx = b.wy * b.vz - b.wz * b.vy, my = b.wz * b.vx - b.wx * b.vz, mz = b.wx * b.vy - b.wy * b.vx;
  b.vx += (-KD * v * b.vx + KM * mx) * dt;
  b.vy += (-KD * v * b.vy + KM * my) * dt;
  b.vz += (-G - KD * v * b.vz + KM * mz) * dt;
  b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
  const k = 1 - SPIN_DECAY * dt; b.wx *= k; b.wy *= k; b.wz *= k;
}
// 落地：法向速度按恢复系数反弹；切向用冲量模型——接触点打滑则受摩擦，摩擦同时改变旋转，直到转为滚动
function bounce(b) {
  b.z = 0;
  const vzIn = Math.max(0, -b.vz), e = SURF.e;
  const ux = b.vx - R_BALL * b.wy, uy = b.vy + R_BALL * b.wx, us = Math.hypot(ux, uy);
  if (us > 1e-6) {
    const J = Math.min(us / (1 + 1 / ALPHA), SURF.mu * (1 + e) * vzIn), nx = ux / us, ny = uy / us;
    b.vx -= J * nx; b.vy -= J * ny;
    b.wx += -ny * J / (ALPHA * R_BALL); b.wy += nx * J / (ALPHA * R_BALL);
  }
  b.vz = vzIn * e;
  if (b.vz < .5) { b.vz = 0; b.roll = true }
}
// 完整一步：返回 'net' | 'cord'（擦网）| 'bounce' | null
function step(b, dt) {
  if (b.roll) { b.x += b.vx * dt; b.y += b.vy * dt; const k = 1 - 1.5 * dt; b.vx *= k; b.vy *= k; return null }
  const py = b.y, pz = b.z;
  integ(b, dt);
  if (!b.netDone && (py > 0) !== (b.y > 0) && Math.abs(b.x) < 5.6) {
    b.netDone = true;
    const f = py / (py - b.y), zc = pz + (b.z - pz) * f, h = netH(b.x);
    if (zc < h - R_BALL) { b.y = py > 0 ? .08 : -.08; b.vy *= -.12; b.vx *= .3; b.vz = Math.min(b.vz, 0); b.wx = b.wy = b.wz = 0; return 'net' }
    if (zc < h + R_BALL) {            // 擦网：球被网带挑起，大多会翻过去
      b.z = Math.max(b.z, h + R_BALL); b.vz = Math.abs(b.vz) * .25 + 1.3 + Math.random() * .4; b.vy *= .45; b.vx *= .7;
      b.wx *= .3; b.wy *= .3; b.cord = true; return 'cord';
    }
  }
  if (b.z < 0) { bounce(b); return 'bounce' }
  return null;
}

// 旋转向量：上旋轴 = ẑ × 飞行方向；side>0 为侧旋
// extraSide：额外侧旋（弧线球）。从你这边打出去时，正值让球向右拐
function spinVec(kind, dx, dy, tx, extraSide = 0) {
  const s = SPINS[kind], d = Math.hypot(dx, dy) || 1, hx = dx / d, hy = dy / d;
  return { wx: -hy * s.top, wy: hx * s.top, wz: s.side * (tx >= 0 ? 1 : -1) * (dy > 0 ? 1 : -1) + extraSide * (dy < 0 ? 1 : -1) };
}
// 只飞到第一次落地，记录过网高度（瞄准求解用，不处理碰网）
function flySim(b0) {
  const b = Object.assign({}, b0); let netZ = null, netX = 0;
  for (let i = 0; i < 900; i++) {
    const py = b.y, pz = b.z;
    integ(b, DT);
    if (netZ === null && (py > 0) !== (b.y > 0)) { const f = py / (py - b.y); netZ = pz + (b.z - pz) * f; netX = b.x }
    if (b.z <= 0) return { x: b.x, y: b.y, netZ, netX };
  }
  return { x: b.x, y: b.y, netZ, netX };
}
// 瞄准求解：给定出手点、目标落点、球速和旋转，迭代修正初速度，使球（含阻力与马格努斯力）准确落在目标点；
// 并保证过网高度 ≥ 网高 + margin（不够则降速、抬高弧线）
function launch(from, tx, ty, v, kind, margin, extraSide = 0) {
  const dx = tx - from.x, dy = ty - from.y, d = Math.hypot(dx, dy) || .1, w = spinVec(kind, dx, dy, tx, extraSide);
  const crosses = (from.y > 0) !== (ty > 0);
  let vh = v, best = null;
  for (let tries = 0; tries < 16; tries++) {
    const gEff = G + KM * SPINS[kind].top * vh * .8;
    const T = d / vh;
    let vx = dx / T, vy = dy / T;
    const vz = (.5 * gEff * T * T - from.z) / T;
    let res = null;
    for (let k = 0; k < 7; k++) {
      res = flySim(Object.assign({ x: from.x, y: from.y, z: from.z, vx, vy, vz }, w));
      if (Math.hypot(res.x - tx, res.y - ty) < .02) break;
      const lx = res.x - from.x, ly = res.y - from.y, L2 = lx * lx + ly * ly;
      if (L2 < 1e-4) break;
      let cr = (dx * lx + dy * ly) / L2, ci = (dy * lx - dx * ly) / L2;
      const m = Math.hypot(cr, ci); if (m > 1.8) { cr *= 1.8 / m; ci *= 1.8 / m }
      const nvx = vx * cr - vy * ci, nvy = vx * ci + vy * cr; vx = nvx; vy = nvy;
    }
    best = Object.assign({ vx, vy, vz }, w);
    if (!crosses || res.netZ === null || res.netZ >= netH(res.netX) + margin) return best;
    vh *= .94;
  }
  return best;
}
const inCourt = (x, y) => Math.abs(x) <= HW + .04 && Math.abs(y) <= HL + .04;
const inBox = (x, y, box) => (box.side === 0 ? y > 0 : y < 0) && Math.abs(y) <= SVC + .04 && x * box.sx >= -.04 && Math.abs(x) <= HW + .04;
const sideSign = side => side === 0 ? 1 : -1;
