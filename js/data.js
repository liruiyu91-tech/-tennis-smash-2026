'use strict';
// ================= 常量（单位：米 / 秒）=================
// 游戏坐标：x 横向（右为正），y 纵向（你在 y>0 一侧，对手在 y<0，球网 y=0），z 高度
const HW = 4.115, HL = 11.885, SVC = 6.40, DHW = 5.485, G = 9.8, DT = 1 / 120;
const TOSS_IDEAL = 0.887;   // 抛球后最佳击球时间
const EARLY = 0.42;         // 提前出手可缓冲的时间窗
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;

const SHOTS = {
  topspin: { name: '上旋',   speed: 24, depth: 9.2, spin: 'top',   err: .8,  margin: .35, st: 1.5 },
  flat:    { name: '平击',   speed: 30, depth: 9.6, spin: 'flat',  err: 1.15, margin: .12, st: 3 },
  slice:   { name: '切削',   speed: 19, depth: 8.6, spin: 'slice', err: .75, margin: .3,  st: 1.5 },
  lob:     { name: '高吊',   speed: 12, depth: 9.9, spin: 'top',   err: .9,  margin: .9,  st: 1.5 },
  drop:    { name: '放小球', speed: 10, depth: 2.4, spin: 'drop',  err: .9,  margin: .1,  st: 1 },
  angle:   { name: '大角度', speed: 20, depth: 5.6, spin: 'heavy', err: .95, margin: .45, st: 2 },
  smash:   { name: '扣杀',   speed: 33, depth: 8.6, spin: 'flat',  err: .9,  margin: .15, st: 4 },
  volley:  { name: '截击',   speed: 21, depth: 8.2, spin: 'flat',  err: .8,  margin: .2,  st: 1.5 },
  dvolley: { name: '小球截击', speed: 8.5, depth: 2.0, spin: 'drop', err: .8, margin: .08, st: 1 },
  lvolley: { name: '高吊截击', speed: 11, depth: 9.8, spin: 'top',  err: .9,  margin: .9,  st: 1.5 },
};
// 发球类型：平击最快；切削带侧旋往外拐、把接发方拉出场外；上旋（kick）弹得高、最稳，二发常用
const SERVES = {
  flat:  { name: '平击', v: 1,   err: 1,   m: 0,   spin: 'flat' },
  slice: { name: '切削', v: .92, err: .85, m: .12, spin: 'sslice' },
  kick:  { name: '上旋', v: .84, err: .65, m: .3,  spin: 'kick' },
};
// 旋转（rad/s）：top>0 上旋、<0 下旋；side 侧旋。1 rad/s ≈ 9.55 rpm
const SPINS = { flat: { top: 60, side: 0 }, top: { top: 280, side: 0 }, slice: { top: -190, side: 45 }, drop: { top: -320, side: 0 }, kick: { top: 300, side: 110 }, heavy: { top: 380, side: 0 }, sslice: { top: 50, side: -160 } };

// ================= 赛场 =================
const ARENAS = [
  { id: 'city', name: '城市公园公开赛', short: '城市公园', surfName: '硬地', surf: { e: .76, mu: .55 },
    court: '#2f6cb8', apron: '#3f8d5f', dust: '#ffffff', sky: ['#5fb2f5', '#dff1ff'], stand: '#27375c', wall: '#163768',
    night: false, scenery: 'city', prize: 300 },
  { id: 'clay', name: '红土大师赛', short: '红土', surfName: '红土', surf: { e: .82, mu: .75 },
    court: '#c4643a', apron: '#bf5f36', dust: '#e0936a', sky: ['#6ec0f7', '#fff0d8'], stand: '#5a3326', wall: '#1d5a3a',
    night: false, scenery: 'trees', prize: 600 },
  { id: 'grass', name: '草地锦标赛', short: '草地', surfName: '草地', surf: { e: .66, mu: .38 },
    court: '#4f9b3f', apron: '#4a9440', dust: '#b5dc98', sky: ['#7cc6fb', '#f2f9ff'], stand: '#1f4a2c', wall: '#173f26',
    night: false, scenery: 'trees', stripes: true, prize: 1000 },
  { id: 'night', name: '夜场总决赛', short: '总决赛', surfName: '硬地 · 夜场', surf: { e: .76, mu: .52 },
    court: '#3b3fa0', apron: '#16475a', dust: '#ffffff', sky: ['#04060d', '#1b2552'], stand: '#171c36', wall: '#0d1330',
    night: true, scenery: 'lights', prize: 2000 },
];
const ROUNDS = ['第一轮', '半决赛', '决赛'];
const STYLE_NAME = { baseline: '底线型', defender: '防守型', aggressive: '进攻型', serve: '发球机器' };

// 每站 3 个对手（虚构角色）。av = 立绘参数（Avataaars 画风，见 tools/gen-portraits.js）
const OPPS = [
  { id: 'ajie',   name: '阿杰',   t: .00, style: 'baseline',   look: { body: 'm_asian', h: 1.76, shirt: '#e0533d', shorts: '#2b2b2b', skin: '#f1c9a5', hair: '#2a1a10', band: '#ffffff' }, av: { top: 'shortFlat' } },
  { id: 'mia',    name: 'Mia',    t: .12, style: 'defender',   look: { body: 'f_mix', h: 1.7, shirt: '#ff7eb6', shorts: '#ffffff', skin: '#f6d3b6', hair: '#9a5a2a', band: '#ff7eb6', long: true }, av: { top: 'straightAndStrand' } },
  { id: 'zhou',   name: '小周',   t: .24, style: 'aggressive', look: { body: 'm_asian', h: 1.75, shirt: '#f2c230', shorts: '#1d3557', skin: '#eac09a', hair: '#151515', band: null }, av: { top: 'shortCurly', accessories: 'round' } },
  { id: 'pablo',  name: 'Pablo',  t: .34, style: 'defender',   look: { body: 'm_big', h: 1.82, shirt: '#f4f4f4', shorts: '#c4643a', skin: '#c99068', hair: '#1c120b', band: '#c4643a' }, av: { top: 'theCaesar', facialHair: 'beardLight' } },
  { id: 'lucia',  name: 'Lucía',  t: .44, style: 'baseline',   look: { body: 'f_mix', h: 1.72, shirt: '#22b5a5', shorts: '#ffffff', skin: '#e2b08a', hair: '#3b2416', band: '#22b5a5', long: true }, av: { top: 'curvy' } },
  { id: 'mateo',  name: 'Mateo',  t: .54, style: 'aggressive', look: { body: 'm_mix', h: 1.84, shirt: '#ff8a1f', shorts: '#222222', skin: '#b67d55', hair: '#0f0f0f', band: '#ffffff' }, av: { top: 'dreads01' } },
  { id: 'oliver', name: 'Oliver', t: .60, style: 'serve',      look: { body: 'm_mix', h: 1.9, shirt: '#ffffff', shorts: '#ffffff', skin: '#f3d2b8', hair: '#c9a15a', band: null }, av: { top: 'shortWaved' } },
  { id: 'grace',  name: 'Grace',  t: .68, style: 'defender',   look: { body: 'f_mix', h: 1.75, shirt: '#ffffff', shorts: '#ffffff', skin: '#8a5a3c', hair: '#120c08', band: '#6a2c91', long: true }, av: { top: 'fro' } },
  { id: 'henry',  name: 'Henry',  t: .76, style: 'serve',      look: { body: 'm_mix', h: 1.86, shirt: '#ffffff', shorts: '#ffffff', skin: '#efc6a6', hair: '#5a3a22', band: '#2a6a3a' }, av: { top: 'sides', facialHair: 'moustacheFancy' } },
  { id: 'ivan',   name: 'Ivan',   t: .84, style: 'aggressive', look: { body: 'm_mix', h: 1.96, shirt: '#1c1c22', shorts: '#1c1c22', skin: '#f0cfb5', hair: '#d8c27a', band: '#e03a3a' }, av: { top: 'shortRound' } },
  { id: 'yingzi', name: '樱子',   t: .92, style: 'defender',   look: { body: 'f_asian', h: 1.68, shirt: '#ffb3c7', shorts: '#2c2c54', skin: '#f6d8c2', hair: '#1a1010', band: '#ffffff', long: true }, av: { top: 'bob' } },
  { id: 'wang',   name: '雷霆·王', t: 1.0, style: 'serve',      look: { body: 'm_asian', h: 1.88, shirt: '#ffd23f', shorts: '#111111', skin: '#e8bf98', hair: '#0c0c0c', band: '#111111' }, av: { top: 'shavedSides', accessories: 'wayfarers' } },
];
// 快速比赛 / 训练场的对手
const QUICK_OPPS = [
  { id: 'q0', name: '路人球友',   style: 'baseline',   look: { body: 'm_mix', h: 1.76, shirt: '#5b8c5a', shorts: '#2b2b2b', skin: '#efc6a6', hair: '#4a312c', band: null }, av: { top: 'shortFlat' } },
  { id: 'q1', name: '俱乐部高手', style: 'defender',   look: { body: 'm_mix', h: 1.8, shirt: '#3c4f9a', shorts: '#e6e6e6', skin: '#d08b5b', hair: '#2c1b18', band: '#ffffff' }, av: { top: 'shortRound' } },
  { id: 'q2', name: '职业选手',   style: 'aggressive', look: { body: 'm_mix', h: 1.86, shirt: '#262e33', shorts: '#262e33', skin: '#f0cfb5', hair: '#b58143', band: '#d7f94a' }, av: { top: 'shortWaved', accessories: 'sunglasses' } },
];
const COACH = { id: 'coach', name: '陪练', t: .3, style: 'baseline', look: { body: 'm_big', h: 1.78, shirt: '#4b5563', shorts: '#222', skin: '#efc6a6', hair: '#555555', band: '#d7f94a' }, av: { top: 'hat', facialHair: 'beardLight' } };

// 可选球员：各有专属必杀技（ult）与属性偏向（bias）。bh: 'one' 单手反手 / 'two' 双手反手
const CHARACTERS = [
  { id: 'kai', name: '阿凯', title: '全能新星', style: 'baseline', bh: 'two', cost: 0, bias: {},
    look: { body: 'm_asian', h: 1.8, skin: '#edb98a', hair: '#2c1b18', shirt: '#2f6fe0', shorts: '#13254a', band: '#ffffff' }, av: { top: 'shortFlat' },
    ult: { id: 'meteor', name: '流星重炮', desc: '下一拍时速暴涨 45%，拖着火焰尾迹，对手很难够到' } },
  { id: 'yu', name: '小雨', title: '切削魔术师', style: 'defender', bh: 'one', cost: 800, bias: { control: .9 },
    look: { body: 'f_asian', h: 1.68, skin: '#ffdbb4', hair: '#4a312c', shirt: '#22b5a5', shorts: '#ffffff', band: '#22b5a5', long: true }, av: { top: 'straight01' },
    ult: { id: 'phantom', name: '幻影弧线', desc: '强烈侧旋的低平切削，球路大幅拐弯，对手回球极易失误' } },
  { id: 'bear', name: '大熊', title: '铁壁', style: 'defender', bh: 'two', cost: 800, bias: { move: -.3, reach: .25 },
    look: { body: 'm_big', h: 1.9, skin: '#d08b5b', hair: '#2c1b18', shirt: '#8a5a2b', shorts: '#2b2b2b', band: '#ffd23f' }, av: { top: 'shortRound', facialHair: 'beardMedium' },
    ult: { id: 'wall', name: '铁壁防守', desc: '6 秒内 PERFECT 判定放宽 2.5 倍，救球范围 +1.2 米' } },
  { id: 'leo', name: 'Leo', title: '闪电', style: 'aggressive', bh: 'two', cost: 1200, bias: { move: .5 },
    look: { body: 'm_mix', h: 1.85, skin: '#f8d6b8', hair: '#d6b370', shirt: '#ffd23f', shorts: '#111111', band: '#111111' }, av: { top: 'shortWaved' },
    ult: { id: 'flash', name: '闪电步', desc: '5 秒内跑速提高 90%，再远的球都追得到' } },
  { id: 'sakura', name: '樱', title: '网前之花', style: 'net', bh: 'two', cost: 1200, bias: { control: .92 },
    look: { body: 'f_asian', h: 1.65, skin: '#ffdbb4', hair: '#2c1b18', shirt: '#ff8fbf', shorts: '#ffffff', band: '#ff8fbf', long: true }, av: { top: 'bun' },
    ult: { id: 'blossom', name: '樱吹雪', desc: '瞬间冲到网前，下一拍打出贴网小球，几乎追不到' } },
  { id: 'nova', name: 'Nova', title: '冰山女王', style: 'baseline', bh: 'two', cost: 1500, bias: { control: .88 },
    look: { body: 'f_mix', h: 1.78, skin: '#ffdbb4', hair: '#ecdcbf', shirt: '#b1e2ff', shorts: '#25557c', band: '#ffffff', long: true }, av: { top: 'longButNotTooLong' },
    ult: { id: 'freeze', name: '绝对零度', desc: '冻住对手：他下一球起步慢 1.5 秒' } },
  { id: 'rex', name: 'Rex', title: '火山', style: 'power', bh: 'one', cost: 2000, bias: { power: 1.08, control: 1.1 },
    look: { body: 'm_big', h: 1.88, skin: '#ae5d29', hair: '#a55728', shirt: '#e5412f', shorts: '#1b1b1f', band: '#ffd23f' }, av: { top: 'frizzle' },
    ult: { id: 'volcano', name: '火山扣杀', desc: '逼出对手一记高球，然后腾空重扣' } },
  { id: 'chen', name: '鹰眼·陈', title: '天鹰发球', style: 'serve', bh: 'one', cost: 2000, bias: { serve: 1.06 },
    look: { body: 'm_asian', h: 1.83, skin: '#edb98a', hair: '#2c1b18', shirt: '#f4f4f4', shorts: '#1b1b1f', band: '#e8b84a' }, av: { top: 'theCaesarAndSidePart', accessories: 'wayfarers' },
    ult: { id: 'eagle', name: '天鹰发球', desc: '下一个发球时速 230 km/h，几乎必得 ACE' } },
];
// 对手中后期的选手也会放必杀技
const AI_ULT = { serve: { id: 'eagle', name: '天鹰发球' }, aggressive: { id: 'meteor', name: '流星重炮' }, defender: { id: 'wall', name: '铁壁防守' }, baseline: { id: 'meteor', name: '流星重炮' } };
const portrait = (id, mood = 'n') => (typeof artUrl === 'function' && (artUrl(`${id}-${mood}`) || artUrl(`${id}-n`))) || `assets/portraits/${id}-${mood}.svg`;
const arenaOpps = i => OPPS.slice(i * 3, i * 3 + 3);

function aiParams(t, style) {
  const p = { move: lerp(4.7, 7.0, t), reach: lerp(1.18, 1.52, t), react: lerp(.3, .14, t), speed: lerp(20, 31, t),
    err: lerp(1.5, .55, t), depth: lerp(7.6, 9.8, t), aim: lerp(1.8, 3.4, t), srv: lerp(28, 42, t), srvErr: lerp(1, .5, t),
    netErr: lerp(.07, .012, t), outErr: lerp(.07, .012, t), drop: lerp(0, .14, t) };
  if (style === 'aggressive') { p.speed += 2; p.err *= 1.12; p.aim += .3 }
  if (style === 'defender') { p.move += .4; p.speed -= 2; p.err *= .85; p.reach += .1 }
  if (style === 'serve') { p.srv += 4; p.srvErr *= .9 }
  return p;
}
const QUICK = [{ name: '普通', t: .15 }, { name: '困难', t: .55 }, { name: 'Pro', t: .95 }];

// ================= 养成 =================
// ---------- 属性：装备和天赋都加"属性点"，换算成比赛数值见 playerStats() ----------
const STATS = [
  { id: 'power',   name: '力量', desc: p => `球速 +${Math.min(32, p * .4).toFixed(0)}%` },
  { id: 'control', name: '控制', desc: p => `误差 -${Math.min(55, p * .8).toFixed(0)}%` },
  { id: 'speed',   name: '速度', desc: p => `跑速 ${Math.min(7.4, 5.6 + .03 * p).toFixed(2)} m/s` },
  { id: 'stamina', name: '耐力', desc: p => `体力消耗 -${Math.min(60, p * .6).toFixed(0)}%` },
  { id: 'serve',   name: '发球', desc: p => `一发 ${Math.round((34 + .14 * p) * 3.6)} km/h` },
];
// ---------- 装备：4 个部位 × 4 种品质，可升级；传奇装备带特效 ----------
const RARITY = [
  { id: 'c', name: '普通', col: '#9fb0c9', max: 10, cost: 30 },
  { id: 'r', name: '稀有', col: '#4b92ff', max: 15, cost: 50 },
  { id: 'e', name: '史诗', col: '#a66bff', max: 20, cost: 80 },
  { id: 'l', name: '传奇', col: '#ffc84a', max: 25, cost: 120 },
];
const SLOTS = [{ id: 'racket', name: '球拍' }, { id: 'strings', name: '球线' }, { id: 'shoes', name: '球鞋' }, { id: 'band', name: '护腕' }];
const EQUIP = [
  { id: 'r1', slot: 'racket',  rar: 0, name: '入门球拍',   st: { power: 4, control: 3 } },
  { id: 'r2', slot: 'racket',  rar: 1, name: '碳纤维球拍', st: { power: 7, control: 4 }, price: 600 },
  { id: 'r3', slot: 'racket',  rar: 2, name: '重炮球拍',   st: { power: 11, serve: 5 }, price: 1800 },
  { id: 'r4', slot: 'racket',  rar: 3, name: '天王之拍',   st: { power: 12, control: 7, serve: 6 }, perk: 'perfectPow', perkText: 'PERFECT 击球球速再 +6%' },
  { id: 's1', slot: 'strings', rar: 0, name: '尼龙球线',   st: { control: 5 } },
  { id: 's2', slot: 'strings', rar: 1, name: '聚酯球线',   st: { control: 7, power: 2 }, price: 600 },
  { id: 's3', slot: 'strings', rar: 2, name: '旋转球线',   st: { control: 9, power: 4 }, price: 1800, perk: 'heavy', perkText: '上旋、大角度更难回：对手误差 +20%' },
  { id: 's4', slot: 'strings', rar: 3, name: '天蚕丝线',   st: { control: 13, power: 5 }, perk: 'zone', perkText: 'Zone 多持续 2 拍' },
  { id: 'h1', slot: 'shoes',   rar: 0, name: '训练球鞋',   st: { speed: 5 } },
  { id: 'h2', slot: 'shoes',   rar: 1, name: '轻量跑鞋',   st: { speed: 7, stamina: 2 }, price: 600 },
  { id: 'h3', slot: 'shoes',   rar: 2, name: '滑步战靴',   st: { speed: 9, stamina: 5 }, price: 1800, perk: 'reach', perkText: '救球范围 +0.12 米' },
  { id: 'h4', slot: 'shoes',   rar: 3, name: '闪电战靴',   st: { speed: 13, stamina: 6 }, perk: 'react', perkText: '起步反应快 0.04 秒' },
  { id: 'b1', slot: 'band',    rar: 0, name: '棉质护腕',   st: { stamina: 5 } },
  { id: 'b2', slot: 'band',    rar: 1, name: '能量护腕',   st: { stamina: 6, serve: 3 }, price: 600 },
  { id: 'b3', slot: 'band',    rar: 2, name: '发球护腕',   st: { serve: 9, stamina: 4 }, price: 1800 },
  { id: 'b4', slot: 'band',    rar: 3, name: '冠军护腕',   st: { stamina: 9, serve: 7, control: 3 }, perk: 'energy', perkText: '击球能量 +25%' },
];
const eqDef = id => EQUIP.find(e => e.id === id);
const eqStat = (id, lv) => { const d = eqDef(id), k = 1 + .14 * (lv - 1), o = {}; for (const s in d.st) o[s] = Math.round(d.st[s] * k * 10) / 10; return o };
const eqCost = (id, lv) => Math.round(RARITY[eqDef(id).rar].cost * Math.pow(lv, 1.35) / 10) * 10;
// ---------- 天赋：每升 1 级得 1 点；每系投满 5 点解锁终极天赋 ----------
const TALENTS = [
  { br: 0, id: 'pow',    name: '重炮',     max: 5, st: { power: 2.5 },   desc: '每级力量 +2.5' },
  { br: 0, id: 'srv',    name: '发球机器', max: 5, st: { serve: 3 },     desc: '每级发球 +3' },
  { br: 0, id: 'fire',   name: '爆发专精', max: 3, desc: '每级「爆发」类技能少耗 6 能量' },
  { br: 0, id: 'killer', name: '终结者',   max: 1, cap: true, desc: '对手被调动时（来球浅、你不吃力）球速 +10%，误差 -20%' },
  { br: 1, id: 'spd',    name: '疾风步',   max: 5, st: { speed: 2.5 },   desc: '每级速度 +2.5' },
  { br: 1, id: 'sta',    name: '铁人',     max: 5, st: { stamina: 3 },   desc: '每级耐力 +3' },
  { br: 1, id: 'arm',    name: '长臂',     max: 3, desc: '每级救球范围 +0.05 米' },
  { br: 1, id: 'clutch', name: '绝地反击', max: 1, cap: true, desc: '救远球时误差 -30%，回球更深' },
  { br: 2, id: 'ctl',    name: '精准',     max: 5, st: { control: 2.5 }, desc: '每级控制 +2.5' },
  { br: 2, id: 'timing', name: '时机大师', max: 3, desc: '每级 PERFECT 判定窗口 +10%' },
  { br: 2, id: 'charge', name: '能量回路', max: 3, desc: '每级击球能量 +12%' },
  { br: 2, id: 'curve',  name: '弧线大师', max: 1, cap: true, desc: '弧线球侧旋 +35%，并且不再增加误差' },
];
const TALENT_BR = [{ name: '进攻', col: '#ff5a4f' }, { name: '防守', col: '#4b92ff' }, { name: '技巧', col: '#5fe07a' }];
// ---------- 主动技能：从技能池选 2 个带进比赛（必杀技另算）----------
const SKILLS = [
  { id: 'fire',    name: '爆发',     icon: '🔥', cost: 50, desc: '下一拍更快更准', fire: true },
  { id: 'zone',    name: 'Zone',     icon: '🎯', cost: 50, desc: '3 拍内 PERFECT 判定更宽、够得更远' },
  { id: 'recover', name: '回气',     icon: '💧', cost: 40, desc: '立刻恢复 45 体力' },
  { id: 'ace',     name: '精准发球', icon: '🚀', cost: 50, desc: '下一个发球球速 +12%、误差减半', fire: true },
  { id: 'guard',   name: '神救',     icon: '🛡️', cost: 60, desc: '下一个够不到的球自动救回（挑高球）' },
  { id: 'focus',   name: '专注',     icon: '🧠', cost: 45, desc: '8 秒内来球像慢动作：起步更早、误差 -25%' },
];
const skDef = id => SKILLS.find(s => s.id === id);
const OUTFITS = [
  { id: 'sig',     name: '招牌球衣', cost: 0 },
  { id: 'fire',    name: '烈焰红', shirt: '#e5412f', shorts: '#2a2a2a', band: '#ffd23f', cost: 300 },
  { id: 'forest',  name: '森林绿', shirt: '#2f9e5b', shorts: '#f2f2f2', band: '#2f9e5b', cost: 300 },
  { id: 'sakura',  name: '樱花粉', shirt: '#ff8fbf', shorts: '#ffffff', band: '#ff8fbf', cost: 500 },
  { id: 'volt',    name: '电光紫', shirt: '#7b4dff', shorts: '#1b1440', band: '#d7f94a', cost: 800 },
  { id: 'gold',    name: '黑金',   shirt: '#1b1b1f', shorts: '#1b1b1f', band: '#e8b84a', cost: 1200 },
];
