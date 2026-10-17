'use strict';
// ================= 存档 =================
const SAVE_KEY = 'ts2026v6';
const START_ITEMS = { r1: 1, s1: 1, h1: 1, b1: 1 };
function defaultSave() {
  return { coins: 300, items: Object.assign({}, START_ITEMS), equip: { racket: 'r1', strings: 's1', shoes: 'h1', band: 'b1' }, talents: {}, skills: ['fire', 'zone'],
    outfit: 'sig', owned: ['sig'], char: 'kai', chars: CHARACTERS.map(c => c.id), lvl: 1, xp: 0,
    career: [0, 0, 0, 0], trophies: 0, wins: 0, losses: 0, bestRally: 0, bestCombo: 0, aces: 0, fastest: 0,
    settings: { sound: true, voice: true, vibe: true, hq: true, crowd: 1 }, tutorial: false, quick: { arena: 0, diff: 0, len: 3 } };
}
let SAVE = (() => {
  const d = defaultSave();
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
    if (s.outfit === 'classic') { s.outfit = 'sig'; s.owned = (s.owned || []).map(o => o === 'classic' ? 'sig' : o) }
    // 旧版"属性升级"换成装备系统：已花的金币全额退回
    if (s.gear) {
      const old = lv => Math.round(40 * Math.pow(lv, 1.5) / 10) * 10;
      let refund = 0; for (const k in s.gear) for (let l = 1; l < s.gear[k]; l++) refund += old(l);
      s.coins = (s.coins || 0) + refund; delete s.gear; s.refund = refund;
    }
    for (const k in s) d[k] = (typeof d[k] === 'object' && !Array.isArray(d[k]) && d[k]) ? Object.assign(d[k], s[k]) : s[k];
  } catch (e) {}
  d.chars = CHARACTERS.map(c => c.id);                       // 全部球员直接可选
  for (const sl of SLOTS) if (!d.equip[sl.id] || !d.items[d.equip[sl.id]]) d.equip[sl.id] = Object.keys(d.items).find(id => eqDef(id) && eqDef(id).slot === sl.id) || null;
  d.skills = (d.skills || []).filter(skDef).slice(0, 2); while (d.skills.length < 2) d.skills.push(['fire', 'zone', 'recover'].find(k => !d.skills.includes(k)));
  return d;
})();
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)) } catch (e) {} }
function resetSave() { SAVE = defaultSave(); persist() }
const arenaUnlocked = i => i === 0 || SAVE.career[i - 1] >= 3;
const playerLevel = () => SAVE.lvl || 1;
const myChar = () => CHARACTERS.find(c => c.id === SAVE.char) || CHARACTERS[0];
function playerLook() {
  const c = myChar(), o = OUTFITS.find(o => o.id === SAVE.outfit) || OUTFITS[0];
  return Object.assign({}, c.look, o.shirt ? { shirt: o.shirt, shorts: o.shorts, band: o.band } : {});
}
// ---------- 天赋点 ----------
const tal = id => (SAVE.talents && SAVE.talents[id]) || 0;
const talentPoints = () => (SAVE.lvl || 1) - 1 + 3;                   // 开局送 3 点
const talentSpent = () => TALENTS.reduce((s, t) => s + tal(t.id), 0);
const branchSpent = br => TALENTS.filter(t => t.br === br && !t.cap).reduce((s, t) => s + tal(t.id), 0);
// ---------- 属性 ----------
function statPoints() {
  const p = { power: 0, control: 0, speed: 0, stamina: 0, serve: 0 };
  for (const sl in SAVE.equip) { const id = SAVE.equip[sl]; if (!id || !SAVE.items[id]) continue; const o = eqStat(id, SAVE.items[id]); for (const k in o) p[k] += o[k] }
  for (const t of TALENTS) if (t.st && tal(t.id)) for (const k in t.st) p[k] += t.st[k] * tal(t.id);
  return p;
}
const perks = () => new Set(Object.values(SAVE.equip).map(id => id && eqDef(id) && eqDef(id).perk).filter(Boolean));
const powerRating = () => { const p = statPoints(); return Math.round((p.power + p.control + p.speed + p.stamina + p.serve) * 10 + talentSpent() * 15) };
function playerStats() {
  const p = statPoints(), b = myChar().bias, pk = perks();
  return { power: Math.min(1.32, 1 + .004 * p.power) * (b.power || 1), control: Math.max(.45, 1 - .008 * p.control) * (b.control || 1),
    move: Math.min(7.4, 5.6 + .03 * p.speed) + (b.move || 0), reach: 1.35 + .004 * p.speed + .05 * tal('arm') + (pk.has('reach') ? .12 : 0) + (b.reach || 0),
    drain: Math.max(.4, 1 - .006 * p.stamina), srv: (34 + .14 * p.serve) * (b.serve || 1), srvErr: Math.max(.5, 1 - .005 * p.serve),
    react: pk.has('react') ? .14 : .18, energy: (1 + .12 * tal('charge')) * (pk.has('energy') ? 1.25 : 1), perks: pk };
}
