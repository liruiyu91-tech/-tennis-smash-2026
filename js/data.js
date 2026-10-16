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
  smash:   { name: '扣杀',   speed: 33, depth: 8.6, spin: 'flat',  err: .9,  margin: .15, st: 4 },
  volley:  { name: '截击',   speed: 21, depth: 8.2, spin: 'flat',  err: .8,  margin: .2,  st: 1.5 },
};
// 旋转（rad/s）：top>0 上旋、<0 下旋；side 侧旋。1 rad/s ≈ 9.55 rpm
const SPINS = { flat: { top: 60, side: 0 }, top: { top: 280, side: 0 }, slice: { top: -190, side: 45 }, drop: { top: -320, side: 0 }, kick: { top: 300, side: 110 } };

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

// 每站 3 个对手（虚构角色）
const OPPS = [
  { name: '阿杰',   t: .00, style: 'baseline',   look: { shirt: '#e0533d', shorts: '#2b2b2b', skin: '#f1c9a5', hair: '#2a1a10', band: '#ffffff' } },
  { name: 'Mia',    t: .12, style: 'defender',   look: { shirt: '#ff7eb6', shorts: '#ffffff', skin: '#f6d3b6', hair: '#9a5a2a', band: '#ff7eb6', long: true } },
  { name: '小周',   t: .24, style: 'aggressive', look: { shirt: '#f2c230', shorts: '#1d3557', skin: '#eac09a', hair: '#151515', band: null } },
  { name: 'Pablo',  t: .34, style: 'defender',   look: { shirt: '#f4f4f4', shorts: '#c4643a', skin: '#c99068', hair: '#1c120b', band: '#c4643a' } },
  { name: 'Lucía',  t: .44, style: 'baseline',   look: { shirt: '#22b5a5', shorts: '#ffffff', skin: '#e2b08a', hair: '#3b2416', band: '#22b5a5', long: true } },
  { name: 'Mateo',  t: .54, style: 'aggressive', look: { shirt: '#ff8a1f', shorts: '#222222', skin: '#b67d55', hair: '#0f0f0f', band: '#ffffff' } },
  { name: 'Oliver', t: .60, style: 'serve',      look: { shirt: '#ffffff', shorts: '#ffffff', skin: '#f3d2b8', hair: '#c9a15a', band: null } },
  { name: 'Grace',  t: .68, style: 'defender',   look: { shirt: '#ffffff', shorts: '#ffffff', skin: '#8a5a3c', hair: '#120c08', band: '#6a2c91', long: true } },
  { name: 'Henry',  t: .76, style: 'serve',      look: { shirt: '#ffffff', shorts: '#ffffff', skin: '#efc6a6', hair: '#5a3a22', band: '#2a6a3a' } },
  { name: 'Ivan',   t: .84, style: 'aggressive', look: { shirt: '#1c1c22', shorts: '#1c1c22', skin: '#f0cfb5', hair: '#d8c27a', band: '#e03a3a' } },
  { name: '樱子',   t: .92, style: 'defender',   look: { shirt: '#ffb3c7', shorts: '#2c2c54', skin: '#f6d8c2', hair: '#1a1010', band: '#ffffff', long: true } },
  { name: '雷霆·王', t: 1.0, style: 'serve',      look: { shirt: '#ffd23f', shorts: '#111111', skin: '#e8bf98', hair: '#0c0c0c', band: '#111111' } },
];
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
const QUICK_LOOK = { shirt: '#5b5f6b', shorts: '#2b2b2b', skin: '#efc6a6', hair: '#2a1a10', band: '#ffffff' };

// ================= 养成 =================
const MAXLV = 10;
const STATS = [
  { id: 'power',   name: '力量', gear: '碳纤维球拍', desc: lv => `击球速度 +${3 * (lv - 1)}%` },
  { id: 'control', name: '控制', gear: '职业球线',   desc: lv => `落点误差 -${5 * (lv - 1)}%` },
  { id: 'agility', name: '敏捷', gear: '轻量球鞋',   desc: lv => `跑速 ${(5.6 + .18 * (lv - 1)).toFixed(2)} m/s` },
  { id: 'stamina', name: '耐力', gear: '能量护腕',   desc: lv => `体力消耗 -${6 * (lv - 1)}%` },
  { id: 'serve',   name: '发球', gear: '发球特训',   desc: lv => `一发 ${Math.round((34 + 1.2 * (lv - 1)) * 3.6)} km/h` },
];
const upgradeCost = lv => Math.round(40 * Math.pow(lv, 1.5) / 10) * 10;
const OUTFITS = [
  { id: 'classic', name: '经典蓝', shirt: '#2f6fe0', shorts: '#13254a', band: '#ffffff', cost: 0 },
  { id: 'fire',    name: '烈焰红', shirt: '#e5412f', shorts: '#2a2a2a', band: '#ffd23f', cost: 300 },
  { id: 'forest',  name: '森林绿', shirt: '#2f9e5b', shorts: '#f2f2f2', band: '#2f9e5b', cost: 300 },
  { id: 'sakura',  name: '樱花粉', shirt: '#ff8fbf', shorts: '#ffffff', band: '#ff8fbf', cost: 500 },
  { id: 'volt',    name: '电光紫', shirt: '#7b4dff', shorts: '#1b1440', band: '#d7f94a', cost: 800 },
  { id: 'gold',    name: '黑金',   shirt: '#1b1b1f', shorts: '#1b1b1f', band: '#e8b84a', cost: 1200 },
];
const PLAYER_BASE_LOOK = { skin: '#f0c8a0', hair: '#2a1a10' };
