'use strict';
// ================= 比赛状态 =================
let M = null;                 // 当前比赛配置 {type, arenaIdx, opp, setLen, round, ai}
let phase = 'idle';           // serve | rally | dead | idle | over
let now = 0, paused = false, hitStop = 0;
const P = { x: 0, y: HL + .9, st: 100, ep: 0, run: 0, manual: null };
const A = { x: 0, y: -HL - .9, run: 0, ep: 0, net: false, home: null };
const ball = { x: 0, y: 0, z: 1, vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0, vis: false, netDone: false, roll: false, cord: false, fire: false };
let R = null, plan = null, buffered = null, toss = null, sc = null, st = null, PS = null;
let combo = 0, rallyHits = 0, fire = false, zoneN = 0, shot = 'topspin', netMode = false;
let srvType = 'flat', srvPick = 'flat';
let PH = null;                // 你的正/反手表现 {f:[击中, 失误], b:[…]}，AI 会盯着弱的一侧打
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
  combo = 0; rallyHits = 0; fire = false; zoneN = 0; netMode = false; shot = 'topspin'; srvType = srvPick = 'flat';
  PH = { f: [0, 0], b: [0, 0] }; A.net = false; A.home = null;
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
  const mk = kind => ({ side, x: b.x, y: b.y, z: b.z, t: now + t, kind, made: now, ox: o.x, oy: o.y, apex, spd: Math.hypot(b.vx, b.vy, b.vz) });
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
      if (side === 1 && A.net && M && M.ai) {                 // 对手在网前：空中截击
        const meet = Math.max(2.6, Math.abs(A.y) - M.ai.move * t);
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
  const who = side === 0 ? P : A;
  R = { hitter: side, serve: !!serve, bounces: 0, box, cord: false, fore: side === 0 ? from.x >= who.x : from.x <= who.x };
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

// 来球难度：球越快越难控；高过肩的球难压（切削/高吊影响小）；很低的球难打平击和上旋
function incomingErr(pl, k) {
  let m = 1 + Math.max(0, (pl.spd || 0) - 20) * .022;
  if (pl.kind === 'ground') {
    if (pl.z > 1.5) m *= 1 + Math.min(.45, (pl.z - 1.5) * .4) * (k === 'slice' || k === 'lob' ? .5 : 1);
    if (pl.z < .45 && (k === 'flat' || k === 'topspin' || k === 'angle')) m *= 1.15;
  }
  return m;
}
// 你更容易失误的一侧（数据不够时默认反手）
function weakSide() {
  const r = k => (PH[k][1] + 1) / (PH[k][0] + PH[k][1] + 3);
  const f = r('f'), b = r('b');
  return Math.abs(f - b) < .06 ? 'b' : f > b ? 'f' : 'b';
}
// 这一拍实际打什么：截击时按所选球路变成小球截击 / 高吊截击
function shotKind(pl) {
  if (U.blossom) return 'drop';
  if (!pl || pl.kind === 'ground') return shot;
  if (pl.kind === 'volley') return shot === 'drop' ? 'dvolley' : shot === 'lob' ? 'lvolley' : 'volley';
  return pl.kind;
}

// 瞄准：aim = {x: -1~1, d: 0~1, curve: -1~1, tap}；发球时 d 是发球力量。返回落点（不含误差）
const serving = () => phase === 'serve' && toss && toss.server === 0;
function aimTarget(aim, k, pl) {
  if (serving()) {
    const box = toss.box, first = sc.faults === 0;
    const lo = Math.min(box.sx * .35, box.sx * (HW - .35)), hi = Math.max(box.sx * .35, box.sx * (HW - .35));
    const x = aim.tap ? box.sx * 2.05 : clamp(aim.x * HW, lo, hi);
    return { x, y: -(first ? SVC - .8 : SVC - 1.5) };
  }
  pl = pl || (plan && plan.side === 0 ? plan : null);
  k = k || shotKind(pl);
  const base = SHOTS[k];
  if (k === 'angle') {                                      // 大角度：往斜线的边线外拉，落在发球线附近
    const s = Math.abs(aim.x) > .15 ? Math.sign(aim.x) : -(Math.sign((pl || P).x) || 1);
    return { x: s * lerp(2.9, 3.7, Math.min(1, Math.abs(aim.x))), y: -clamp(5.4 + (aim.d - .6) * 1.5, 4.4, 6.8) };
  }
  const span = k === 'drop' || k === 'dvolley' ? 1.2 : k === 'lob' || k === 'lvolley' ? 1.5 : 3;
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
  const pf = pl.x >= P.x ? 'f' : 'b';
  if (Math.hypot(P.x - pl.x, P.y - pl.y) > playerReach(pl)) { pop('够不到！', P.x, P.y, 2.4, '#ff7a7a'); PH[pf][1]++; emit('whiff', { side: 0 }); return }
  PH[pf][0]++;
  const q = quality(pl.t - ts);
  const kind = shotKind(pl);
  const base = SHOTS[kind];
  let v = base.speed * PS.power, err = base.err * PS.control, margin = base.margin, spin = base.spin;
  const strainP = stretch(pl, moveSpeed(), P_REACT);
  const extra = { lunge: strainP > .7 && pl.kind === 'ground', low: pl.z < .5, curve: 0, side: 0 };
  if (q === 'perfect') { v *= 1.08; err *= .45; margin += .12; st.perfect++; hitStop = .07 }
  else if (q === 'good') err *= .8;
  else { v *= .92; err *= 1.45; margin -= .3 }
  if (kind === 'drop' && !U.blossom) err *= Math.max(1, Math.abs(pl.y) / 8);   // 底线放小球很难
  err *= (1 + .7 * (1 - P.st / 100)) * (1 + 1.2 * strainP) * (1 + .09 * rallyHits) * incomingErr(pl, kind);
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
  const tgt = aimTarget(aim, kind, pl);
  let tx = tgt.x, ty = tgt.y;
  const [ex, ey] = errDisc(err); tx += ex; ty = Math.min(-.3, ty + ey);
  if (kind === 'angle' && q !== 'perfect') extra.mods = Object.assign({ reachPen: .15 }, extra.mods || {});
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

// ================= 对手 AI =================
// 按局面选战术：被调动就防守（高远球/切削争取时间），来球浅就进攻并可能随球上网，
// 你上网就穿越或挑高，平时以斜线相持为主、伺机变直线、抓空当、盯你的弱侧打
const AI_BASE_Y = { aggressive: -HL - .4, baseline: -HL - .9, serve: -HL - .8, defender: -HL - 1.5, net: -HL - .6 };
const AI_NET_P = { aggressive: .2, serve: .2, net: .35, baseline: .1, defender: .05 };
function aiContact() {
  const pl = plan; plan = null;
  const L = M.ai, train = M.type === 'train', t = M.opp.t || 0, sty = M.opp.style;
  const d = Math.hypot(A.x - pl.x, A.y - pl.y);
  const wall = AU.wallT > 0;
  if (!train && d > L.reach + (wall ? .6 : 0) - (pl.reachPen || 0)) { emit('whiff', { side: 1 }); return }
  const retSrv = !!(R && R.serve);
  if (Math.abs(pl.y) > 7) A.net = false;
  let tx, ty, v = L.speed, spin = 'top', err = L.err * (pl.errMul || 1) * (wall ? .4 : 1), margin = .3, kind = 'ground', risk = 1, home = null;
  const strain = train ? 0 : stretch(pl, L.move, L.react);
  const extra = { lunge: strain > .7 && pl.kind === 'ground', low: pl.z < .5 };
  err *= (1 + 1.6 * strain) * (1 + .08 * rallyHits) * incomingErr(pl, 'topspin');
  if (strain > .6) say(`${M.opp.name} 被调动了！`);
  const open = P.x > 0 ? -1 : 1, inside = Math.abs(pl.y) < HL - 2.3;
  if (train) { tx = rnd(-2.2, 2.2); ty = 8.5; v = 17; err = .25; spin = 'top' }
  else if (pl.kind === 'smash') { v = 31; spin = 'flat'; tx = open * 2.8; ty = 8.2; kind = 'smash'; extra.jump = true }
  else if (U.volcano === 1) {                              // 火山扣杀：逼出一记软高球
    U.volcano = 2; v = 11; spin = 'top'; tx = clamp(P.x, -2.5, 2.5) * .6; ty = 6.2; err = .4; margin = 1.4;
  } else if (pl.kind === 'volley') {                       // 网前截击：你在底线就放小球，否则压向空当
    kind = 'volley';
    if (P.y > HL - 1 && Math.random() < .2 + .25 * t) { spin = 'drop'; v = 9; tx = rnd(-2.5, 2.5); ty = 2.2; margin = .1 }
    else { spin = 'flat'; v = 18 + 3 * t; tx = open * rnd(1.8, 3.0); ty = rnd(7, 9.5); margin = .2 }
    if (pl.z < .8) err *= 1.4;                             // 低球截击（半截击）更难
    home = { x: clamp(pl.x * .5, -2, 2), y: -3.2 };
  } else if (P.y < 6.5) {                                  // 你上网了：穿越或挑高
    if (Math.random() < (P.y < 3.8 ? .55 : .3)) { v = 12.5; ty = HL - 1.3; tx = rnd(-2, 2); margin = .9 }
    else { tx = (Math.abs(P.x) < .6 ? (Math.random() < .5 ? -1 : 1) : open) * rnd(2.8, 3.5); ty = rnd(6.2, 8.5); v += 2; risk = 1.25 }
  } else if (strain > .6 || (pl.z > 2.1 && Math.abs(pl.y) > HL + 1.2)) {   // 防守：争取回位时间
    if (Math.random() < .5) { v = 14; tx = rnd(-1.5, 1.5); ty = HL - 1.6; margin = 1 }
    else { v = L.speed - 5; spin = 'slice'; tx = rnd(-1.8, 1.8); ty = L.depth; margin = .5 }
    home = { x: 0, y: -HL - 1.6 };
  } else if (retSrv && (pl.spd > 34 || strain > .35)) {   // 重发球：挡回中路深区
    v *= .8; tx = rnd(-1.8, 1.8); ty = L.depth - .6; margin = .45; err *= .9;
  } else if (P.y > HL + .5 && Math.abs(pl.y) < HL - 1 && strain < .35 && Math.random() < L.drop * .6) {   // 你退得太深：放小球
    spin = 'drop'; v = 10; ty = 2.4; tx = rnd(-2.5, 2.5); err *= .7;
    say(`${M.opp.name} 放小球！`);
  } else if (inside && pl.z > .7 && strain < .4 && !retSrv) {   // 浅球：进攻空当，可能随球上网
    spin = Math.random() < (sty === 'aggressive' ? .65 : .4) ? 'flat' : 'top';
    v = L.speed + (spin === 'flat' ? 5 : 2); tx = open * rnd(2.6, 3.4); ty = rnd(8.4, 10.4); risk = 1.2;
    if (Math.random() < (AI_NET_P[sty] || .1) * (.4 + .6 * t)) { A.net = true; say(`${M.opp.name} 随球上网！`) }
  } else {                                                 // 相持
    const from = Math.abs(pl.x) > .8 ? Math.sign(pl.x) : 0;
    let dir = from ? -from : open;                         // 斜线为主：过网低、球场长，最安全
    if (from && strain < .3 && pl.z > .6 && pl.z < 1.5 && Math.random() < .18 + .17 * t) { dir = from; risk = 1.2; err *= 1.12 }   // 变直线
    tx = dir * L.aim * rnd(.6, 1);
    if (Math.random() < .05 + .3 * t) tx = clamp(P.x + (weakSide() === 'b' ? -1 : 1) * rnd(1.8, 2.6), -L.aim, L.aim);   // 盯你的弱侧
    if (Math.abs(P.x) > 1.8 && strain < .4 && Math.random() < .35 + t * .4) { tx = open * (L.aim + .3); v += 3; risk = 1.15; say(`${M.opp.name} 抓空当！`) }
    else if (strain < .3 && Math.random() < .06 + t * .2) { tx = open * rnd(3.0, 3.4); ty = rnd(5.8, 7); v -= 2; err *= .8 }   // 斜线小角度，把你拉出场外
    if (ty === undefined) ty = L.depth + rnd(-.7, .5);
    const r = Math.random();
    if (sty === 'aggressive' && r < .35) { spin = 'flat'; v += 3; risk *= 1.15 }
    else if ((sty === 'defender' && r < .3) || r < .15) { spin = 'slice'; v -= 4 }
  }
  if (!train && Math.random() < lerp(.15, .6, t) * (1 - strain)) err *= .5;   // AI 也有打得很舒服的球
  if (!train && M.big) err *= lerp(1.25, .85, t);                             // 关键分：弱者手紧，强者更稳
  v *= 1 - .2 * strain; if (ty > 4 && margin < .8) ty -= 2.5 * strain;
  if (AU.meteor && U.volcano !== 2) { AU.meteor = false; v *= 1.4; spin = 'flat'; err *= .7; margin = .15; extra.fire = true; extra.ult = 'meteor'; extra.mods = { reachPen: .5 } }
  let [ex, ey] = errDisc(err); tx += ex; ty = Math.max(.3, ty + ey);
  if (!train && U.volcano !== 2 && !extra.ult) {
    if (Math.random() < L.outErr * risk) { if (Math.random() < .5) tx = Math.sign(tx || 1) * rnd(HW + .2, HW + 1); else ty = rnd(HL + .2, HL + 1.2) }
    if (Math.random() < L.netErr * risk) margin = -.35;
  }
  // 回位：网前就守在网前；否则站到你可能回球角度的中间（略偏向自己打过去的一侧）
  A.home = home || { x: clamp(tx * .18, -1.2, 1.2), y: A.net ? -3.2 : (AI_BASE_Y[sty] || -HL - .9) };
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
  phase = 'serve'; plan = null; buffered = null; R = null; P.manual = null; A.net = false; A.home = null;
  srvType = sc.faults ? 'kick' : srvPick;                  // 二发默认上旋（最稳），可以改
  M.big = M.type === 'train' ? null : bigPoint();
  if (M.type === 'train') { phase = 'rally'; feed(); return }
  const srv = sc.server, deuce = (sc.pts[0] + sc.pts[1]) % 2 === 0;
  const sx = srv === 0 ? (deuce ? 1 : -1) : (deuce ? -1 : 1);
  const box = { sx: -sx, side: 1 - srv };
  const server = srv === 0 ? P : A, recv = srv === 0 ? A : P, ss = sideSign(srv);
  // 双方走回发球/接发位置（不再瞬移），站定后发球方拍两下球再抛球
  const spots = { [srv]: { x: sx * .9, y: ss * (HL + .25) }, [1 - srv]: { x: -sx * 2.4, y: -ss * (HL + .9) } };
  const walkT = Math.max(Math.hypot(server.x - spots[srv].x, server.y - spots[srv].y), Math.hypot(recv.x - spots[1 - srv].x, recv.y - spots[1 - srv].y)) / 3.2;
  toss = { t0: now + Math.max(srv === 0 ? 1.1 : 1.5, walkT + 1.1), server: srv, box, jit: rnd(-.05, .05), spots, walking: { 0: true, 1: true }, lastU: 0 };
  Object.assign(ball, { x: server.x + .3 * ss, y: server.y, z: 1, vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0, vis: true, roll: false, cord: false, fire: false });
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
  ball.x = server.x + .3 * sideSign(toss.server); ball.y = server.y;
  if (t < 0 && t > -1 && !toss.walking[toss.server]) {          // 发球前拍球两下
    const u = ((t + 1) / .5) % 1;
    ball.z = .95 * (2 * u - 1) * (2 * u - 1);
    if (toss.lastU < .5 && u >= .5) emit('dribble', { side: toss.server });
    toss.lastU = u;
  } else ball.z = t < 0 ? 1 : Math.max(1, 1 + 6.26 * t - 4.9 * t * t);
  if (toss.server === 1 && t >= TOSS_IDEAL + toss.jit) serve(1, 0, null);
  else if (toss.server === 0 && t > 1.3) { toss.t0 = now + .7; say('重新抛球 · 球下落时松手') }
}
function serve(side, d, aim) {
  const first = sc.faults === 0, L = M.ai, box = toss.box;
  let tx, ty, v, err, margin, q;
  let spin = 'flat', type = 'flat';
  const extra = {};
  if (side === 0) {
    aim = aim || { x: 0, d: .6, tap: true };
    type = srvType; const S = SERVES[type]; spin = S.spin;
    const tgt = aimTarget(aim); tx = tgt.x; ty = sideSign(box.side) * Math.abs(tgt.y);
    const pw = aim.tap ? .6 : aim.d;                     // 发球力量：拖得越长越用力，也越容易失误
    q = quality(d);
    v = PS.srv * (.82 + .32 * pw) * S.v * (first ? 1 : .9);
    err = { perfect: .3, good: .65, early: 1.3, late: 1.3 }[q] * (first ? 1 : .6) * S.err * PS.srvErr * (1 + .5 * (1 - P.st / 100)) * (.6 + .9 * pw * pw);
    margin = { perfect: .2, good: .1, early: -.25, late: -.25 }[q] + S.m + (first ? 0 : .1);
    if (q === 'perfect') { v += 4; st.perfect++; hitStop = .06 }
    if (U.eagle) { U.eagle = false; v = 64; spin = 'flat'; err *= .4; margin = .12; extra.ult = 'eagle'; extra.fire = true; extra.jump = true; extra.mods = { reachPen: .9 } }
  } else {
    // 对手发球：选类型（发球型球员多平击）和落点（外角 / 中路 T 点 / 追身，会照顾你的弱侧）
    const r = Math.random(), sty = M.opp.style;
    type = first ? (r < (sty === 'serve' ? .65 : .45) ? 'flat' : r < (sty === 'serve' ? 1 : .75) ? 'slice' : 'kick') : (r < .8 ? 'kick' : 'slice');
    const S = SERVES[type]; spin = S.spin;
    const recvX = P.x, ws = weakSide(), pr = Math.random();
    const wideX = box.sx * (HW - .45), tX = box.sx * .35;
    const weakX = (ws === 'b' ? recvX - 1 : recvX + 1);
    tx = pr < .38 ? wideX : pr < .76 ? tX : clamp(recvX, Math.min(tX, wideX), Math.max(tX, wideX));
    if (Math.random() < .3 * (M.opp.t || 0)) tx = clamp(weakX, Math.min(tX, wideX), Math.max(tX, wideX));
    ty = sideSign(box.side) * (first ? SVC - .9 : SVC - 1.6);
    v = L.srv * S.v * (first ? 1 : .86);
    err = L.srvErr * S.err * (first ? 1 : .55);
    margin = S.m + (first ? .08 : .2);
    if (type === 'slice' && Math.abs(tx) > HW - 1) extra.mods = { reachPen: .2 };
    if (Math.random() < (AI_NET_P[sty] || .1) * .6 * (first ? 1 : .4)) { A.net = true; A.home = { x: tx * .2, y: -3.2 } }   // 发球上网
    if (AU.eagle) { AU.eagle = false; v = 60; spin = 'flat'; err = .3; margin = .12; extra.ult = 'eagle'; extra.fire = true; extra.jump = true; extra.mods = { reachPen: .8 } }
  }
  const [ex, ey] = errDisc(err); tx += ex; ty += ey;
  toss = null; phase = 'rally';
  if (side === 0 && type === 'slice' && Math.abs(tx) > HW - 1) extra.mods = Object.assign({ reachPen: .2 }, extra.mods || {});
  extra.srv = type;
  const kmh = hitBall(side, { x: ball.x, y: ball.y, z: Math.max(2, ball.z) }, tx, ty, v, spin, margin, true, box, 'serve', q, extra);
  if (side === 0) st.fastest = Math.max(st.fastest, kmh);
  if (side === 1 && A.net) say(`${M.opp.name} 发球上网！`);
  emit('hud');
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
      const rightSide = (ball.y > 0 ? 0 : 1) !== h, e = lineMargin(ball.x, ball.y);
      const ok = rightSide && (R.serve ? inBox(ball.x, ball.y, R.box) : inCourt(ball.x, ball.y));
      emit('bounce', { x: ball.x, y: ball.y, ok });
      if (rightSide && Math.abs(e) < .05) { emit('close'); emit('hawkeye', { x: ball.x, y: ball.y, e, ok, serve: R.serve, box: R.box }) }
      if (!ok && !R.serve) emit('linecall', { text: 'Out!' });
      if (!ok) { pop('OUT', ball.x, ball.y, .9, '#ff7a7a', true); R.serve ? fault('Fault') : endPoint(1 - h, 'out'); return }
      if (R.serve && R.cord) {           // 发球擦网落进发球区：Let，重发（不算失误）
        pop('LET', ball.x, ball.y, 1.2, '#ffd27a', true); say('擦网 Let · 重发'); emit('call', { text: 'Let' });
        plan = null; buffered = null; phase = 'dead'; deadT = now + 1.2; nextFn = startPoint; return;
      }
      R.bounces = 1;
    } else { emit('bounce', { x: ball.x, y: ball.y, ok: true, second: true }); endPoint(h, R.serve ? 'ace' : 'winner') }
  }
}
// 落点离最近边线的距离（米）：>0 出界，<0 界内（球与线有接触即算界内）
function lineMargin(x, y) {
  if (R.serve) return Math.max(Math.abs(y) - SVC, -x * R.box.sx, Math.abs(x) - HW) - .04;
  return Math.max(Math.abs(x) - HW, Math.abs(y) - HL) - .04;
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
    if (why === 'out' || why === 'net') { st.errors++; if (R && R.hitter === 0 && !R.serve) PH[R.fore ? 'f' : 'b'][1]++ }
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
// 击球站位：球在拍子那一侧（右手持拍），而不是撞在身上
function hitSpot(pl, o, side) {
  const off = pl.kind === 'smash' ? .35 : pl.kind === 'volley' ? .5 : .72;
  if (pl.fore === undefined) pl.fore = side === 0 ? o.x <= pl.x + .3 : o.x >= pl.x - .3;
  const right = side === 0 ? 1 : -1;                       // 球员右手在世界坐标的哪一侧
  return { x: pl.x - right * off * (pl.fore ? 1 : -1), y: pl.y + sideSign(side) * .25 };
}
function movePlayers(dt) {
  if (phase === 'idle' || phase === 'over') { P.run = A.run = 0; return }
  if (phase === 'serve') {
    if (!toss) return;
    for (const side of [0, 1]) {
      const o = side === 0 ? P : A, s = toss.spots[side];
      if (toss.walking[side]) { moveTo(o, s.x, s.y, 3.2, dt); if (Math.hypot(o.x - s.x, o.y - s.y) < .03) { toss.walking[side] = false; o.run = 0 } }
      else o.run = 0;
    }
    return;
  }
  if (phase === 'dead') {                                  // 一分结束：慢慢走回底线中间
    moveTo(P, P.x * .7, clamp(P.y, HL - 1, HL + 1.5), 2, dt); moveTo(A, A.x * .7, clamp(A.y, -HL - 1.5, -HL + 1), 2, dt);
    return;
  }
  let tx, ty, react = false;
  if (phase === 'rally' && plan && plan.side === 0) { const h = hitSpot(plan, P, 0); tx = h.x; ty = h.y; react = now - plan.made < P_REACT }
  else if (P.manual) { tx = P.manual.x; ty = P.manual.y }
  else { tx = P.x * .4; ty = netMode ? 3.6 : HL + .9 }
  const m = react ? (P.run = 0) : moveTo(P, tx, ty, moveSpeed(), dt);
  if (U.dash && P.y < 4.2) U.dash = false;
  P.y = clamp(P.y, .8, HL + 4); P.x = clamp(P.x, -7, 7);
  P.st = clamp(P.st - m * .9 * PS.drain * (U.flashT > 0 || U.dash ? .3 : 1) + (m < .01 ? dt * 3 : 0), 0, 100);
  const L = M.ai, aSpd = M.type === 'train' ? 14 : L.move;
  if (phase === 'rally' && plan && plan.side === 1) {
    if (now - plan.made >= L.react) { const h = hitSpot(plan, A, 1); moveTo(A, h.x, h.y, aSpd, dt) } else A.run = 0;
  } else if (A.home && phase === 'rally') moveTo(A, A.home.x, A.home.y, aSpd * (A.net ? .9 : .7), dt);
  else moveTo(A, A.x * .4, -HL - .9, aSpd * .7, dt);
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
      else if (now > plan.t + lateWin()) { PH[plan.x >= P.x ? 'f' : 'b'][1]++; plan = null; buffered = null; pop('没打到', P.x, P.y, 2.4, '#ff7a7a'); emit('whiff', { side: 0 }) }
    }
  }
  movePlayers(dt);
  for (const o of [U, AU]) for (const k of ['wallT', 'flashT']) if (o[k] > 0) o[k] -= dt;
  if (phase === 'dead' && now >= deadT) { phase = 'idle'; const f = nextFn; nextFn = null; f && f() }
}
