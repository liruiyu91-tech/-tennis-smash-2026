'use strict';
// ================= 养成：账号等级、每日签到、每日任务、宝箱 =================
const Meta = (() => {
  const xpNeed = l => 100 + 60 * (l - 1);
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` };
  // 每日任务池：goal 目标数，r 金币，x 经验
  const POOL = [
    { id: 'win1',    text: '赢下 1 场比赛',          goal: 1,  r: 80,  x: 40 },
    { id: 'win2',    text: '赢下 2 场比赛',          goal: 2,  r: 150, x: 70 },
    { id: 'perfect', text: '打出 15 次 PERFECT',     goal: 15, r: 90,  x: 40 },
    { id: 'aces',    text: '发出 3 个 ACE',          goal: 3,  r: 100, x: 45 },
    { id: 'winners', text: '打出 6 个制胜分',        goal: 6,  r: 90,  x: 40 },
    { id: 'rally',   text: '打出一个 10 拍以上的回合', goal: 1,  r: 70,  x: 35 },
    { id: 'ult',     text: '放 2 次必杀技',          goal: 2,  r: 80,  x: 35 },
    { id: 'volley',  text: '网前截击 5 次',          goal: 5,  r: 90,  x: 40 },
    { id: 'serve',   text: '发出时速 160 km/h 以上的球', goal: 1, r: 70, x: 30 },
    { id: 'train',   text: '训练场累计回球 30 拍',    goal: 30, r: 70,  x: 30 },
    { id: 'play3',   text: '完成 3 场比赛（输赢都算）', goal: 3,  r: 100, x: 50 },
  ];
  const LOGIN = [{ c: 60 }, { c: 90 }, { c: 120 }, { chest: 'common' }, { c: 180 }, { c: 240 }, { chest: 'epic' }];
  const CHESTS = {
    common: { name: '普通球包', coins: [60, 120], outfit: .05, col: '#2f7dff' },
    rare:   { name: '稀有球包', coins: [150, 260], outfit: .2, col: '#7b4dff' },
    epic:   { name: '传奇球包', coins: [320, 520], outfit: .45, col: '#ffc84a' },
  };

  function ensure() {
    if (!SAVE.lvl) { SAVE.lvl = 1; SAVE.xp = 0 }
    const d = SAVE.daily;
    if (!d || d.date !== today()) {
      const pick = POOL.slice().sort(() => Math.random() - .5).filter((m, i, a) => !(m.id === 'win2' && a.slice(0, i).some(o => o.id === 'win1'))).slice(0, 3);
      const login = (d && d.login) || { streak: 0, last: null, claimed: false };
      // 隔天没签到就从第 1 天重新开始
      const y = new Date(); y.setDate(y.getDate() - 1);
      const yk = `${y.getFullYear()}-${y.getMonth() + 1}-${y.getDate()}`;
      if (login.last !== yk && login.last !== today()) login.streak = 0;
      if (login.streak >= 7) login.streak = 0;
      SAVE.daily = { date: today(), missions: pick.map(m => ({ id: m.id, n: 0, claimed: false })), login: Object.assign(login, { claimed: login.last === today() }) };
      persist();
    }
  }
  const mDef = id => POOL.find(p => p.id === id);
  const missions = () => { ensure(); return SAVE.daily.missions.map(m => Object.assign({}, mDef(m.id), m, { done: m.n >= mDef(m.id).goal })) };
  const claimable = () => missions().filter(m => m.done && !m.claimed).length + (loginReady() ? 1 : 0);
  const loginReady = () => { ensure(); return !SAVE.daily.login.claimed };

  // 经验：返回升了几级与奖励
  function addXp(n) {
    ensure();
    const ups = [];
    SAVE.xp += Math.round(n);
    while (SAVE.xp >= xpNeed(SAVE.lvl)) {
      SAVE.xp -= xpNeed(SAVE.lvl); SAVE.lvl++;
      const coins = 80 + 20 * SAVE.lvl; SAVE.coins += coins;
      ups.push({ lvl: SAVE.lvl, coins, chest: SAVE.lvl % 5 === 0 ? 'rare' : null });
    }
    persist();
    return ups;
  }
  function bump(id, k = 1, set) {
    ensure();
    let hit = false;
    for (const m of SAVE.daily.missions) if (m.id === id && !m.claimed) { const g = mDef(id).goal; const before = m.n; m.n = Math.min(g, set ? Math.max(m.n, k) : m.n + k); if (m.n !== before) hit = true }
    if (hit) persist();
  }
  function claimMission(id) {
    const m = SAVE.daily.missions.find(m => m.id === id), d = mDef(id);
    if (!m || m.claimed || m.n < d.goal) return null;
    m.claimed = true; SAVE.coins += d.r; const ups = addXp(d.x); persist();
    return { coins: d.r, xp: d.x, ups };
  }
  function claimLogin() {
    ensure();
    const L = SAVE.daily.login; if (L.claimed) return null;
    const day = L.streak, rw = LOGIN[day];
    L.streak = day + 1; L.last = today(); L.claimed = true;
    if (rw.c) SAVE.coins += rw.c;
    persist();
    return Object.assign({ day: day + 1 }, rw);
  }
  // 开宝箱：金币 + 装备（没有的装备直接获得，已有的升 1 级）
  const DROP = { common: { n: [.4], w: [.62, .33, .05, 0] }, rare: { n: [1], w: [.2, .52, .24, .04] }, epic: { n: [1, 1], w: [0, .38, .44, .18] } };
  function rollItem(w) {
    let r = Math.random(), rar = 0; for (; rar < 3 && r > w[rar]; rar++) r -= w[rar];
    const pool = EQUIP.filter(e => e.rar === rar); return pool[Math.floor(Math.random() * pool.length)];
  }
  function openChest(kind) {
    const C = CHESTS[kind], out = { kind, name: C.name, col: C.col, coins: Math.round(rnd(C.coins[0], C.coins[1]) / 5) * 5, items: [], outfit: null };
    SAVE.coins += out.coins;
    for (const p of DROP[kind].n) if (Math.random() < p) {
      const it = rollItem(DROP[kind].w), had = SAVE.items[it.id];
      if (!had) { SAVE.items[it.id] = 1; out.items.push({ it, isNew: true }) }
      else if (had < RARITY[it.rar].max) { SAVE.items[it.id]++; out.items.push({ it, lv: SAVE.items[it.id] }) }
      else { SAVE.coins += 100; out.coins += 100 }
    }
    if (Math.random() < C.outfit) {
      const can = OUTFITS.filter(o => !SAVE.owned.includes(o.id));
      if (can.length) { const o = can[Math.floor(Math.random() * can.length)]; SAVE.owned.push(o.id); out.outfit = o }
    }
    persist();
    return out;
  }

  // 跟踪比赛事件推进任务
  let mt = null;
  onGame((t, e) => {
    if (!M) return;
    if (t === 'matchStart') mt = { ults: 0 };
    if (t === 'hit' && e.side === 0) {
      if (e.q === 'perfect') bump('perfect');
      if (e.kind === 'volley') bump('volley');
      if (e.kind === 'serve' && e.kmh >= 160) bump('serve');
      if (M.type === 'train') bump('train');
    }
    if (t === 'ult' && e.side === 0) bump('ult');
    if (t === 'point' && !e.train) {
      if (e.w === 0 && e.why === 'ace') bump('aces');
      if (e.w === 0 && e.why === 'winner') bump('winners');
      if (e.rally >= 10) bump('rally');
    }
    if (t === 'matchOver' && M.type !== 'train') { bump('play3'); if (e.w === 0) { bump('win1'); bump('win2') } }
  });

  return { ensure, xpNeed, missions, claimable, loginReady, LOGIN, CHESTS, addXp, claimMission, claimLogin, openChest,
    get level() { ensure(); return SAVE.lvl }, get xp() { ensure(); return SAVE.xp } };
})();
