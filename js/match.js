'use strict';
// ================= 比赛状态 =================
let M = null;                 // 当前比赛配置 {type, arenaIdx, opp, setLen, round, ai}
let phase = 'idle';           // serve | rally | dead | idle | over
let now = 0, paused = false, hitStop = 0;
const P = { x: 0, y: HL + .9, st: 100, ep: 0, run: 0, manual: null };
const A = { x: 0, y: -HL - .9, run: 0, ep: 0 };
const ball = { x: 0, y: 0, z: 1, vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0, vis: false, netDone: false, roll: false, cord: false, fire: false };
let R = null, plan = null, buffered = null, toss = null, sc = null, st = null, PS = null;
let combo = 0, rallyHits = 0, fire = false, zoneN = 0, shot = 'topspin', netMode = false;
let deadT = 0, nextFn = null;
let U = {}, AU = {};          // 玩家 / 对手的必杀技状态
const P_REACT = .18;          // 玩家分腿垫步反应时间
const COST = { fire: 50, zone: 50, ult: 100 };

const listeners = [];
function onGame(fn) { listeners.push(fn) }
function emit(type, d = {}) { for (const f of listeners) f(type, d) }
function pop(text, x, y, z, col, big) { emit('pop', { text, x, y, z, col: col || '#fff', big }) }
function say(text) { emit('say', { text }) }

function startMatch(cfg) {
  M = Object.assign({}, cfg);
  M.ai = aiParams(cfg.opp.t, cfg.opp.style);
  M.char = myChar();
  M.aiUlt = cfg.type !== 'train' && cfg.opp.t >= .45 ? AI_ULT[cfg.opp.style] : null;
  PS = playerStats(); SURF = ARENAS[cfg.arenaIdx].surf;
  now = 0; paused = false; hitStop = 0; ball.vis = false;
  sc = { pts: [0, 0], games: [0, 0], tb: false, server: Math.random() < .5 ? 0 : 1, faults: 0, setLen: cfg.setLen };
  st = { winners: 0, errors: 0, aces: 0, df: 0, perfect: 0, hits: 0, maxRally: 0, fastest: 0, coinsTrain: 0, ults: 0 };
  combo = 0; rallyHits = 0; fire = false; zoneN = 0; netMode = false; shot = 'topspin';
  U = {}; AU = {};
  P.ep = 0; P.st = 100; P.x = 0; P.y = HL + .9; P.manual = null; A.x = 0; A.y = -HL - .9; A.ep = 0;
  R = null; plan = null; buffered = null; toss = null;
  phase = 'dead'; deadT = 1.2; nextFn = startPoint;
  emit('matchStart');
  if (M.type !== 'train') say(sc.server === 0 ? '掷硬币：你先发球' : `掷硬币：${M.opp.name} 先发球`);
}

// ================= 预测击球点（与主循环同一套物理）=================
function predict(side, serve, box) {
  const b = Object.assign({}, ball), s = sideSign(side), o = side === 0 ? P : A;
  let t = 0, bounced = false, apex = b.z;
  const mk = kind => ({ side, x: b.x, y: b.y, z: b.z, t: now + t, kind, made: now, ox: o.x, oy: o.y, apex });
  for (let i = 0; i < 720; i++) {
    const ev = step(b, DT); t += DT;
    if (b.z > apex) apex = b.z;
    if (ev === 'net') return null;
    const yy = b.y * s;
    if (ev === 'bounce') {
      if (bounced) return null;
      bounced = true;
      if (yy < 0 || !(serve ? inBox(b.x, b.y, box) : inCourt(b.x, b.y))) return null;  // 出界的球不接
    }
    if (!bounced && !serve && yy > 1) {
      if (b.vz < 0 && b.z <= 2.9 && b.z >= 2.1 && apex > 4.2 && yy < 8.5) return mk('smash');
      if (side === 0 && netMode) {
        const meet = Math.max(2.6, Math.abs(P.y) - moveSpeed() * t);
        if (yy >= meet && b.z <= 2.5 && b.z >= .25) return mk('volley');
      }
    }
    if (bounced && ((b.vz < 0 && b.z <= 1.05) || b.roll || yy >= HL + 2.2)) return mk('ground');
    if (yy > HL + 6) return null;
  }
  return null;
}

// ================= 击球 =================
// mods：对接球方的影响 {reachPen 够球距离减少, errMul 回球误差倍数, reactAdd 起步延迟}
function hitBall(side, from, tx, ty, v, spin, margin, serve, box, kind, q, extra = {}) {
  const vel = launch(from, tx, ty, v, spin, margin, extra.side || 0);
  Object.assign(ball, from, vel, { vis: true, netDone: false, roll: false, cord: false, fire: !!extra.fire });
  R = { hitter: side, serve: !!serve, bounces: 0, box, cord: false };
  const who = side === 0 ? P : A;
  if (side === 1) P.manual = null;
  const kmh = Math.round(Math.hypot(vel.vx, vel.vy, vel.vz) * 3.6);
  emit('hit', Object.assign({ side, kind: kind || 'ground', q, kmh, x: from.x, y: from.y, z: from.z,
    fore: side === 0 ? from.x >= who.x : from.x <= who.x, spin }, extra));
  plan = predict(1 - side, serve, box);
  if (plan && extra.mods) Object.assign(plan, extra.mods);
  if (plan && plan.reactAdd) plan.made += plan.reactAdd;
  buffered = null;
  return kmh;
}
function errDisc(r) { const d = r * Math.sqrt(Math.random()), a = Math.random() * Math.PI * 2; return [d * Math.cos(a), d * Math.sin(a) * 1.25] }
function perfectWin() { return (zoneN > 0 ? .12 : .065) * (U.wallT > 0 ? 2.5 : 1) }
function lateWin() { return (zoneN > 0 ? .25 : .15) * (U.wallT > 0 ? 1.6 : 1) }
function playerReach(pl) { return PS.reach + (zoneN > 0 ? .8 : 0) + (U.wallT > 0 ? 1.2 : 0) - ((pl || plan || {}).reachPen || 0) }
function moveSpeed() { return PS.move * (.65 + .35 * P.st / 100) * (U.flashT > 0 ? 1.9 : 1) * (U.dash ? 3 : 1) }
function quality(d) {
  if (Math.abs(d) <= perfectWin()) return 'perfect';
  if (Math.abs(d) <= .16) return 'good';
  return d > 0 ? 'early' : 'late';
}
const QTXT = { perfect: ['PERFECT', '#c8ff4d'], good: ['GOOD', '#ffffff'], early: ['偏早', '#ffd27a'], late: ['偏晚', '#ffd27a'] };
function stretch(pl, spd, react) {
  const avail = Math.max(.15, pl.t - pl.made - react);
  return clamp((Math.hypot(pl.x - pl.ox, pl.y - pl.oy) / (spd * avail) - .55) / .45, 0, 1);
}

// 瞄准：aim = {x: -1~1, d: 0~1, curve: -1~1, tap}；发球时 d 是发球力量。返回落点（不含误差）
const serving = () => phase === 'serve' && toss && toss.server === 0;
function aimTarget(aim) {
  if (serving()) {
    const box = toss.box, first = sc.faults === 0;
    const lo = Math.min(box.sx * .35, box.sx * (HW - .35)), hi = Math.max(box.sx * .35, box.sx * (HW - .35));
    const x = aim.tap ? box.sx * 2.05 : clamp(aim.x * HW, lo, hi);
    return { x, y: -(first ? SVC - .8 : SVC - 1.5) };
  }
  const k = U.blossom ? 'drop' : plan && plan.side === 0 && plan.kind !== 'ground' ? plan.kind : shot;
  const base = SHOTS[k];
  const span = k === 'drop' ? 1.2 : k === 'lob' ? 1.5 : 3;
  return { x: aim.x * 3.4, y: U.blossom ? -1.7 : -clamp(base.depth + (aim.d - .6) * span, 1.2, 11.5) };
}

// 玩家出手（松手）
function swing(aim) {
  if (paused || !M) return;
  if (serving()) {
    const t = now - toss.t0, d = TOSS_IDEAL - t;
    if (t < .1 || d > EARLY) { pop('等球抛高再出手', P.x, P.y, 2.4, '#ffd27a'); return }
    serve(0, d, aim); return;
  }
  if (phase !== 'rally' || !plan || plan.side !== 0 || buffered) return;
  const d = plan.t - now;
  if (d > EARLY) { pop('太早', P.x, P.y, 2.4, '#ffd27a'); return }
  if (d >= 0) { buffered = { ts: now, aim }; return }
  playerContact(now, aim);
}
// 球在对面时点自己半场：跑到那个位置
function canManualMove() { return M && phase === 'rally' && (!plan || plan.side === 1 || plan.t - now > EARLY + .15) }
function manualMove(x, y) {
  if (!canManualMove() || y < .5) return false;
  P.manual = { x: clamp(x, -6, 6), y: clamp(y, .8, HL + 3) };
  return true;
}
function playerContact(ts, aim) {
  const pl = plan; plan = null; buffered = null;
  if (Math.hypot(P.x - pl.x, P.y - pl.y) > playerReach(pl)) { pop('够不到！', P.x, P.y, 2.4, '#ff7a7a'); emit('whiff', { side: 0 }); return }
  const q = quality(pl.t - ts);
  let kind = pl.kind === 'ground' ? shot : pl.kind;
  if (U.blossom) kind = 'drop';
  const base = SHOTS[kind];
  let v = base.speed * PS.power, err = base.err * PS.control, margin = base.margin, spin = base.spin;
  const strainP = stretch(pl, moveSpeed(), P_REACT);
  const extra = { lunge: strainP > .7 && pl.kind === 'ground', low: pl.z < .5, curve: 0, side: 0 };
  if (q === 'perfect') { v *= 1.08; err *= .45; margin += .12; st.perfect++; hitStop = .07 }
  else if (q === 'good') err *= .8;
  else { v *= .92; err *= 1.45; margin -= .3 }
  if (kind === 'drop' && !U.blossom) err *= Math.max(1, Math.abs(pl.y) / 8);   // 底线放小球很难
  err *= (1 + .7 * (1 - P.st / 100)) * (1 + 1.2 * strainP) * (1 + .09 * rallyHits);
  // 弧线球：滑动轨迹带弧度 → 侧旋，球在空中拐弯
  if (aim && Math.abs(aim.curve || 0) > .25 && kind !== 'smash') { extra.side = aim.curve * 240; extra.curve = aim.curve; err *= 1.1; pop('弧线!', pl.x, pl.y, 3, '#9fd8ff') }
  if (fire) { v *= 1.28; err *= .7; fire = false; extra.fire = true }
  if (zoneN > 0) zoneN--;
  // 必杀技
  if (U.meteor) { U.meteor = false; spin = 'flat'; v *= 1.45; err *= .6; margin = .15; extra.fire = true; extra.ult = 'meteor'; extra.mods = { reachPen: .6 } }
  if (U.phantom) { U.phantom = false; spin = 'slice'; v = Math.max(v, 24); err *= .7; margin = .15; extra.side = (aim && aim.x < 0 ? -1 : 1) * 320; extra.curve = 1; extra.ult = 'phantom'; extra.mods = { errMul: 2.2 } }
  if (U.blossom) { U.blossom = false; spin = 'drop'; v = 9; err = .35; margin = .08; extra.ult = 'blossom'; extra.mods = { reachPen: 1.0 } }
  if (U.volcano === 2) { U.volcano = 0; v *= 1.4; err *= .4; extra.jump = true; extra.fire = true; extra.ult = 'volcano'; extra.mods = { reachPen: .8 } }
  if (U.freeze) { U.freeze = false; extra.mods = Object.assign(extra.mods || {}, { reactAdd: 1.5 }); extra.ult = extra.ult || 'freeze' }
  if (pl.kind === 'smash') extra.jump = extra.jump || q === 'perfect';
  if (pl.kind === 'ground' && pl.apex > 4 && Math.abs(pl.y) > HL + 1.3) extra.tweener = true;   // 追身后的高球：胯下击球
  const tgt = aimTarget(aim);
  let tx = tgt.x, ty = tgt.y;
  const [ex, ey] = errDisc(err); tx += ex; ty = Math.min(-.3, ty + ey);
  const kmh = hitBall(0, { x: pl.x, y: pl.y, z: pl.z }, tx, ty, v, spin, margin, false, null, pl.kind === 'ground' ? kind : pl.kind, q, extra);
  if (extra.tweener) pop('胯下击球!', pl.x, pl.y, 2.6, '#ffd27a', true);
  combo++; rallyHits++; st.hits++; st.fastest = Math.max(st.fastest, kmh);
  SAVE.bestCombo = Math.max(SAVE.bestCombo, combo);
  P.st = Math.max(0, P.st - base.st * PS.drain);
  P.ep = Math.min(100, P.ep + 8 + (q === 'perfect' ? 6 : 0) + (combo >= 3 ? 3 : 0));
  const [qt, qc] = QTXT[q];
  pop(qt, pl.x, pl.y, 2.5, qc, q === 'perfect');
  emit('hud');
}

function aiContact() {
  const pl = plan; plan = null;
  const L = M.ai, train = M.type === 'train';
  const d = Math.hypot(A.x - pl.x, A.y - pl.y);
  const wall = AU.wallT > 0;
  if (!train && d > L.reach + (wall ? .6 : 0) - (pl.reachPen || 0)) { emit('whiff', { side: 1 }); return }
  let tx, ty, v = L.speed, spin = 'top', err = L.err * (pl.errMul || 1) * (wall ? .4 : 1), margin = .3, kind = 'ground';
  const strain = train ? 0 : stretch(pl, L.move, L.react);
  const extra = { lunge: strain > .7 && pl.kind === 'ground', low: pl.z < .5 };
  err *= (1 + 1.6 * strain) * (1 + .08 * rallyHits);
  if (strain > .6) say(`${M.opp.name} 被调动了！`);
  if (pl.kind === 'smash') { v = 31; spin = 'flat'; tx = (P.x > 0 ? -1 : 1) * 2.8; ty = 8.2; kind = 'smash'; extra.jump = true }
  else if (U.volcano === 1) {                              // 火山扣杀：逼出一记软高球
    U.volcano = 2; v = 11; spin = 'top'; tx = clamp(P.x, -2.5, 2.5) * .6; ty = 6.2; err = .4; margin = 1.4;
  } else if (!train && P.y < 6.5) {                         // 你上网了：挑高球或穿越
    if (Math.random() < .45) { v = 12.5; ty = HL - 1.4; tx = rnd(-2, 2); margin = .9 }
    else { tx = (P.x > 0 ? -1 : 1) * 3.2; ty = 6.8; v += 3 }
  } else if (!train && P.y > HL - .3 && Math.abs(pl.y) < HL - 1.5 && Math.random() < L.drop) {
    spin = 'drop'; v = 10; ty = 2.4; tx = rnd(-2.5, 2.5); err *= .7;
  } else {
    const away = P.x > 0 ? -1 : 1;
    tx = away * L.aim * rnd(.55, 1); if (Math.random() < .25) tx = -tx * .5;
    ty = L.depth + rnd(-.6, .6);
    if (strain < .3 && Math.random() < .08 + M.opp.t * .22) { tx = away * rnd(3.0, 3.4); ty = rnd(5.8, 7); v -= 2; err *= .8 }   // 斜线小角度，把你拉出场外
    else if (Math.abs(P.x) > 1.8 && strain < .4 && Math.random() < .35 + M.opp.t * .4) { tx = away * (L.aim + .3); v += 3; say(`${M.opp.name} 抓空当！`) }   // 你跑偏了：打另一侧
    if (Math.random() < .2) { spin = 'slice'; v -= 4 }
  }
  if (train) { tx = rnd(-2.2, 2.2); ty = 8.5; v = 17; err = .25; spin = 'top' }
  if (!train && Math.random() < lerp(.15, .6, M.opp.t) * (1 - strain)) err *= .5;   // AI 也有打得很舒服的球
  v *= 1 - .2 * strain; if (ty > 4) ty -= 2.5 * strain;
  if (AU.meteor && U.volcano !== 2) { AU.meteor = false; v *= 1.4; spin = 'flat'; err *= .7; margin = .15; extra.fire = true; extra.ult = 'meteor'; extra.mods = { reachPen: .5 } }
  let [ex, ey] = errDisc(err); tx += ex; ty = Math.max(.3, ty + ey);
  if (!train && U.volcano !== 2 && !extra.ult) {
    if (Math.random() < L.outErr) { if (Math.random() < .5) tx = Math.sign(tx || 1) * rnd(HW + .2, HW + 1); else ty = rnd(HL + .2, HL + 1.2) }
    if (Math.random() < L.netErr) margin = -.35;
  }
  hitBall(1, { x: pl.x, y: pl.y, z: pl.z }, tx, ty, v, spin, margin, false, null, kind, null, extra);
  aiGainEnergy(8);
}
function aiGainEnergy(n) {
  if (!M.aiUlt) return;
  A.ep = Math.min(100, A.ep + n * (.6 + M.opp.t * .6));
  if (A.ep < 100) return;
  const u = M.aiUlt.id;
  if (u === 'eagle' && AU.eagle) return;
  A.ep = 0;
  if (u === 'meteor') AU.meteor = true;
  if (u === 'eagle') AU.eagle = true;
  if (u === 'wall') AU.wallT = 6;
  emit('ult', { side: 1, id: u, name: M.aiUlt.name });
  say(`${M.opp.name} 发动「${M.aiUlt.name}」！`);
}

// ================= 必杀技 / 技能 =================
function skill(k) {
  if (!M || phase === 'over' || P.ep < COST[k]) return false;
  if (k === 'ult') return useUlt();
  P.ep -= COST[k];
  if (k === 'fire') { fire = true; say('🔥 爆发：下一拍更快更准') }
  if (k === 'zone') { zoneN = 3; say('🎯 Zone：3 拍内判定更宽、够得更远') }
  emit('skill', { k }); emit('hud');
  return true;
}
function useUlt() {
  const u = M.char.ult;
  if (U.meteor || U.phantom || U.blossom || U.volcano || U.eagle || U.freeze) { say('必杀技已经准备好了'); return false }
  P.ep -= COST.ult; st.ults++;
  switch (u.id) {
    case 'meteor': U.meteor = true; break;
    case 'phantom': U.phantom = true; break;
    case 'wall': U.wallT = 6; break;
    case 'flash': U.flashT = 5; break;
    case 'blossom': netMode = true; U.dash = true; U.blossom = true; break;
    case 'freeze': if (plan && plan.side === 1) plan.made += 1.5; else U.freeze = true; emit('freeze'); break;
    case 'volcano': U.volcano = 1; break;
    case 'eagle': U.eagle = true; break;
  }
  emit('ult', { side: 0, id: u.id, name: u.name }); emit('hud');
  return true;
}

// ================= 发球 =================
function startPoint() {
  phase = 'serve'; plan = null; buffered = null; R = null; P.manual = null;
  if (M.type === 'train') { phase = 'rally'; feed(); return }
  const srv = sc.server, deuce = (sc.pts[0] + sc.pts[1]) % 2 === 0;
  const sx = srv === 0 ? (deuce ? 1 : -1) : (deuce ? -1 : 1);
  const box = { sx: -sx, side: 1 - srv };
  const server = srv === 0 ? P : A, recv = srv === 0 ? A : P, ss = sideSign(srv);
  server.x = sx * .9; server.y = ss * (HL + .25);
  recv.x = -sx * 2.4; recv.y = -ss * (HL + .9);
  toss = { t0: now + (srv === 0 ? .7 : 1.1), server: srv, box, jit: rnd(-.05, .05) };
  Object.assign(ball, { x: server.x + .35 * ss, y: server.y, z: 1, vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0, vis: true, roll: false, cord: false, fire: false });
  say(srv === 0 ? (sc.faults ? '二发 · 稳一点' : '你发球 · 拖得越长越用力') : (sc.faults ? `${M.opp.name} 二发` : `${M.opp.name} 发球`));
  if (!sc.faults) { const bp = bigPoint(); if (bp) emit('bigpoint', bp) }
  emit('pointStart'); emit('hud');
}
// 关键分：下一分能决定比赛 / 破发
function bigPoint() {
  const winsGame = w => sc.tb ? sc.pts[w] >= 6 && sc.pts[w] - sc.pts[1 - w] >= 1 : sc.pts[w] >= 3 && sc.pts[w] - sc.pts[1 - w] >= 1;
  for (const w of [0, 1]) {
    if (!winsGame(w)) continue;
    const g = sc.games[w] + 1, n = sc.setLen;
    if (sc.tb || (g >= n && g - sc.games[1 - w] >= 2)) return { kind: 'match', w };
  }
  for (const w of [0, 1]) if (!sc.tb && w !== sc.server && winsGame(w)) return { kind: 'break', w };
  return null;
}
function updateToss() {
  const t = now - toss.t0, server = toss.server === 0 ? P : A;
  ball.x = server.x + .35 * sideSign(toss.server); ball.y = server.y;
  ball.z = t < 0 ? 1 : Math.max(1, 1 + 6.26 * t - 4.9 * t * t);
  if (toss.server === 1 && t >= TOSS_IDEAL + toss.jit) serve(1, 0, null);
  else if (toss.server === 0 && t > 1.3) { toss.t0 = now + .7; say('重新抛球 · 球下落时松手') }
}
function serve(side, d, aim) {
  const first = sc.faults === 0, L = M.ai, box = toss.box;
  let tx, ty, v, err, margin, q;
  let spin = first ? 'flat' : 'kick';
  const extra = {};
  if (side === 0) {
    aim = aim || { x: 0, d: .6, tap: true };
    const tgt = aimTarget(aim); tx = tgt.x; ty = sideSign(box.side) * Math.abs(tgt.y);
    const pw = aim.tap ? .6 : aim.d;                     // 发球力量：拖得越长越用力，也越容易失误
    q = quality(d);
    v = first ? PS.srv * (.82 + .32 * pw) : 27 * (.9 + .2 * pw);
    err = { perfect: .3, good: .65, early: 1.3, late: 1.3 }[q] * (first ? 1 : .6) * PS.srvErr * (1 + .5 * (1 - P.st / 100)) * (.6 + .9 * pw * pw);
    margin = { perfect: .2, good: .1, early: -.25, late: -.25 }[q] + (first ? 0 : .25);
    if (q === 'perfect') { v += 4; st.perfect++; hitStop = .06 }
    if (U.eagle) { U.eagle = false; v = 64; spin = 'flat'; err *= .4; margin = .12; extra.ult = 'eagle'; extra.fire = true; extra.jump = true; extra.mods = { reachPen: .9 } }
  } else {
    tx = box.sx * rnd(.5, HW - .5); ty = sideSign(box.side) * (first ? SVC - .9 : SVC - 1.6);
    v = first ? L.srv : L.srv * .72;
    err = L.srvErr * (first ? 1 : .55);
    margin = first ? .08 : .3;
    if (AU.eagle) { AU.eagle = false; v = 60; spin = 'flat'; err = .3; margin = .12; extra.ult = 'eagle'; extra.fire = true; extra.jump = true; extra.mods = { reachPen: .8 } }
  }
  const [ex, ey] = errDisc(err); tx += ex; ty += ey;
  toss = null; phase = 'rally';
  const kmh = hitBall(side, { x: ball.x, y: ball.y, z: Math.max(2, ball.z) }, tx, ty, v, spin, margin, true, box, 'serve', q, extra);
  if (side === 0) st.fastest = Math.max(st.fastest, kmh);
  pop(`${kmh} km/h`, ball.x, ball.y - sideSign(side) * 1.5, 2.6, side === 0 ? (q === 'perfect' ? '#c8ff4d' : '#ffffff') : '#9fd8ff', q === 'perfect' || !!extra.ult);
}
function feed() {
  Object.assign(ball, { x: rnd(-1.5, 1.5), y: -HL + .3, z: 1 });
  A.x = ball.x; A.y = -HL - .5;
  hitBall(1, { x: ball.x, y: ball.y, z: 1 }, rnd(-2.4, 2.4), rnd(7.5, 9.5), 16, 'top', .4);
  say('训练场 · 连续回球攒金币');
}

// ================= 规则判定 =================
function onBallEvent(ev) {
  if (phase !== 'rally' || !R) return;
  const h = R.hitter;
  if (ev === 'net') { emit('net', { x: ball.x }); pop('下网', ball.x, 0, 1.5, '#ff7a7a'); R.serve ? fault('Fault') : endPoint(1 - h, 'net'); return }
  if (ev === 'cord') { R.cord = true; emit('cord', { x: ball.x }); pop('擦网!', ball.x, 0, 1.6, '#ffd27a'); return }
  if (ev === 'bounce') {
    if (R.bounces === 0) {
      const ok = (ball.y > 0 ? 0 : 1) !== h && (R.serve ? inBox(ball.x, ball.y, R.box) : inCourt(ball.x, ball.y));
      emit('bounce', { x: ball.x, y: ball.y, ok });
      if (!ok) { pop('OUT', ball.x, ball.y, .9, '#ff7a7a', true); R.serve ? fault('Fault') : endPoint(1 - h, 'out'); return }
      if (R.serve && R.cord) {           // 发球擦网落进发球区：Let，重发（不算失误）
        pop('LET', ball.x, ball.y, 1.2, '#ffd27a', true); say('擦网 Let · 重发'); emit('call', { text: 'Let' });
        plan = null; buffered = null; phase = 'dead'; deadT = now + 1.2; nextFn = startPoint; return;
      }
      R.bounces = 1;
    } else { emit('bounce', { x: ball.x, y: ball.y, ok: true, second: true }); endPoint(h, R.serve ? 'ace' : 'winner') }
  }
}
function fault(call) {
  if (sc.faults === 0) {
    sc.faults = 1; say('一发失误'); plan = null; buffered = null;
    emit('fault', { call });
    phase = 'dead'; deadT = now + 1.2; nextFn = startPoint;
  } else {
    if (R.hitter === 0) st.df++;
    pop('双误', ball.x, ball.y, 1.3, '#ff7a7a', true);
    endPoint(1 - R.hitter, 'df');
  }
}
function endPoint(w, why) {
  phase = 'dead'; plan = null; buffered = null;
  U.dash = false;
  const rally = rallyHits;
  st.maxRally = Math.max(st.maxRally, rallyHits);
  if (M.type === 'train') {
    SAVE.bestRally = Math.max(SAVE.bestRally, rallyHits);
    const coins = rallyHits >= 5 ? rallyHits : 0;
    SAVE.coins += coins; st.coinsTrain += coins; persist();
    say(`回合结束：${rallyHits} 拍` + (coins ? ` · +${coins} 金币` : ' · 5 拍以上有金币'));
    emit('point', { w, why, train: true, rally });
    rallyHits = 0; combo = 0; deadT = now + 1.3; nextFn = startPoint; emit('hud'); return;
  }
  const bp = bigPoint(), decisive = bp && bp.kind === 'match' && bp.w === w;
  if (w === 0) {
    if (why === 'ace') { st.aces++; pop('ACE!', ball.x, ball.y, 1.6, '#c8ff4d', true) }
    else if (why === 'winner') { st.winners++; pop('制胜分!', ball.x, ball.y, 1.6, '#c8ff4d', true) }
  } else {
    if (why === 'out' || why === 'net') st.errors++;
    combo = 0;
  }
  const txt = { ace: 'ACE', winner: '制胜分', out: '出界', net: '下网', df: '双误' }[why] || '';
  say((w === 0 ? '你得分' : `${M.opp.name} 得分`) + (txt ? ' · ' + txt : ''));
  emit('point', { w, why, rally, decisive, big: !!bp });
  rallyHits = 0;
  deadT = now + 1.6; nextFn = () => award(w);
  emit('hud');
}
function award(w) {
  sc.faults = 0;
  P.st = Math.min(100, P.st + 12);
  sc.pts[w]++;
  if (sc.tb) {
    if (sc.pts[w] >= 7 && sc.pts[w] - sc.pts[1 - w] >= 2) { sc.games[w]++; return matchOver(w) }
    if ((sc.pts[0] + sc.pts[1]) % 2 === 1) sc.server ^= 1;
    emit('call', { text: `${sc.pts[sc.server]} ${sc.pts[1 - sc.server]}` });
  } else if (sc.pts[w] >= 4 && sc.pts[w] - sc.pts[1 - w] >= 2) {
    const broke = w !== sc.server;
    sc.games[w]++; sc.pts = [0, 0]; sc.server ^= 1;
    const g = sc.games, n = sc.setLen;
    if (g[w] >= n && g[w] - g[1 - w] >= 2) { emit('call', { text: 'Game, set and match' }); return matchOver(w) }
    if (g[0] === n && g[1] === n) { sc.tb = true; emit('banner', { text: '抢七！先到 7 分且领先 2 分' }); emit('call', { text: 'Tie break' }) }
    else { emit('banner', { text: broke ? (w === 0 ? '破发成功！' : `被 ${M.opp.name} 破发`) : (w === 0 ? '你赢下这一局' : `${M.opp.name} 赢下这一局`) }); emit('call', { text: 'Game' }) }
    emit('game', { w, broke });
  } else emit('call', { text: callText() });
  startPoint();
}
function callText() {
  const s = sc.server, a = sc.pts[s], b = sc.pts[1 - s], f = ['love', 'fifteen', 'thirty', 'forty'];
  if (a >= 3 && b >= 3) return a === b ? 'Deuce' : a > b ? 'Advantage server' : 'Advantage receiver';
  if (a === b) return f[a] + ' all';
  return f[a] + ', ' + f[b];
}
function matchOver(w) {
  phase = 'over'; ball.vis = false; plan = null;
  emit('hud'); emit('matchOver', { w });
}

// ================= 跑位 =================
function moveTo(o, tx, ty, sp, dt) {
  const dx = tx - o.x, dy = ty - o.y, d = Math.hypot(dx, dy), m = Math.min(d, sp * dt);
  if (d > 1e-6) { o.x += dx / d * m; o.y += dy / d * m }
  o.run = m / dt; return m;
}
function movePlayers(dt) {
  if (phase === 'serve' || phase === 'idle' || phase === 'over') { P.run = A.run = 0; return }
  let tx, ty, react = false;
  if (phase === 'rally' && plan && plan.side === 0) { tx = plan.x; ty = plan.y + .25; react = now - plan.made < P_REACT }
  else if (P.manual) { tx = P.manual.x; ty = P.manual.y }
  else { tx = P.x * .4; ty = netMode ? 3.6 : HL + .9 }
  const m = react ? (P.run = 0) : moveTo(P, tx, ty, moveSpeed(), dt);
  if (U.dash && P.y < 4.2) U.dash = false;
  P.y = clamp(P.y, .8, HL + 4); P.x = clamp(P.x, -7, 7);
  P.st = clamp(P.st - m * .9 * PS.drain * (U.flashT > 0 || U.dash ? .3 : 1) + (m < .01 ? dt * 3 : 0), 0, 100);
  const L = M.ai, aSpd = M.type === 'train' ? 14 : L.move;
  if (phase === 'rally' && plan && plan.side === 1) {
    if (now - plan.made >= L.react) moveTo(A, plan.x, plan.y - .25, aSpd, dt); else A.run = 0;
  } else moveTo(A, A.x * .4, -HL - .9, aSpd * .7, dt);
  A.y = clamp(A.y, -HL - 4, -.8); A.x = clamp(A.x, -7, 7);
}

// ================= 固定步长模拟 =================
function tick(dt) {
  if ((phase === 'rally' || phase === 'dead') && ball.vis) {
    const ev = step(ball, dt);
    if (ev) onBallEvent(ev);
    if (phase === 'rally' && R && R.bounces >= 1 && (Math.abs(ball.y) > HL + 8 || Math.abs(ball.x) > 10)) endPoint(R.hitter, 'winner');
  }
  now += dt;
  if (phase === 'serve' && toss) updateToss();
  if (phase === 'rally' && plan) {
    if (plan.side === 1 && now >= plan.t - DT / 2) aiContact();
    else if (plan.side === 0) {
      if (buffered && now >= plan.t - DT / 2) playerContact(buffered.ts, buffered.aim);
      else if (now > plan.t + lateWin()) { plan = null; buffered = null; pop('没打到', P.x, P.y, 2.4, '#ff7a7a'); emit('whiff', { side: 0 }) }
    }
  }
  movePlayers(dt);
  for (const o of [U, AU]) for (const k of ['wallT', 'flashT']) if (o[k] > 0) o[k] -= dt;
  if (phase === 'dead' && now >= deadT) { phase = 'idle'; const f = nextFn; nextFn = null; f && f() }
}
