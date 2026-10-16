'use strict';
// ================= 存档 =================
const SAVE_KEY = 'ts2026v6';
function defaultSave() {
  return { coins: 200, gear: { power: 1, control: 1, agility: 1, stamina: 1, serve: 1 }, outfit: 'sig', owned: ['sig'], char: 'kai', chars: ['kai'],
    career: [0, 0, 0, 0], trophies: 0, wins: 0, losses: 0, bestRally: 0, bestCombo: 0, aces: 0, fastest: 0,
    settings: { sound: true, voice: true, vibe: true, hq: true }, tutorial: false, quick: { arena: 0, diff: 0, len: 3 } };
}
let SAVE = (() => {
  const d = defaultSave();
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
    if (s.outfit === 'classic') { s.outfit = 'sig'; s.owned = (s.owned || []).map(o => o === 'classic' ? 'sig' : o) }
    for (const k in s) d[k] = (typeof d[k] === 'object' && !Array.isArray(d[k]) && d[k]) ? Object.assign(d[k], s[k]) : s[k];
  } catch (e) {}
  return d;
})();
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)) } catch (e) {} }
function resetSave() { SAVE = defaultSave(); persist() }
const arenaUnlocked = i => i === 0 || SAVE.career[i - 1] >= 3;
const playerLevel = () => Object.values(SAVE.gear).reduce((a, b) => a + b, 0) - 4;
const myChar = () => CHARACTERS.find(c => c.id === SAVE.char) || CHARACTERS[0];
function playerLook() {
  const c = myChar(), o = OUTFITS.find(o => o.id === SAVE.outfit) || OUTFITS[0];
  return Object.assign({}, c.look, o.shirt ? { shirt: o.shirt, shorts: o.shorts, band: o.band } : {});
}
function playerStats() {
  const g = SAVE.gear, b = myChar().bias;
  return { power: (1 + .03 * (g.power - 1)) * (b.power || 1), control: (1 - .05 * (g.control - 1)) * (b.control || 1),
    move: 5.6 + .18 * (g.agility - 1) + (b.move || 0), reach: 1.35 + .02 * (g.agility - 1) + (b.reach || 0),
    drain: 1 - .06 * (g.stamina - 1), srv: (34 + 1.2 * (g.serve - 1)) * (b.serve || 1), srvErr: 1 - .04 * (g.serve - 1) };
}
