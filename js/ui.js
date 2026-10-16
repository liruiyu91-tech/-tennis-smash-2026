'use strict';
// ================= 界面：菜单、HUD、输入、飘字 =================
const UI = (() => {
  const $ = id => document.getElementById(id);
  const root = $('ui'), ov = $('ov'), octx = ov.getContext('2d');
  const svg = (d, vb = '0 0 24 24', fill = 'currentColor') => `<svg viewBox="${vb}" fill="${fill}" aria-hidden="true">${d}</svg>`;
  const IC = {
    pause: svg('<rect x="6" y="4" width="4" height="16" rx="1.5"/><rect x="14" y="4" width="4" height="16" rx="1.5"/>'),
    back: svg('<path d="M15.5 4.5 8 12l7.5 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'),
    cup: svg('<path d="M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V18h3v3H8v-3h3v-3.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V5h3V3zm0 4H6v1a2 2 0 0 0 1 1.7V7zm10 0v2.7A2 2 0 0 0 18 8V7h-1z"/>'),
    racket: svg('<ellipse cx="14" cy="9" rx="6" ry="7" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M10 14.5 4 21" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M11 6h6M10 9h8M11 12h6M14 3v12" stroke="currentColor" stroke-width="1" opacity=".6"/>'),
    shirt: svg('<path d="M8 3 3 6l2 5 2-1v11h10V10l2 1 2-5-5-3a3 3 0 0 1-8 0z"/>'),
    cog: svg('<path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm8.7 5-1.9-.3a7 7 0 0 1-.6 1.5l1.1 1.6-1.9 1.9-1.6-1.1a7 7 0 0 1-1.5.6l-.3 1.9h-2.7l-.3-1.9a7 7 0 0 1-1.5-.6l-1.6 1.1-1.9-1.9 1.1-1.6a7 7 0 0 1-.6-1.5l-1.9-.3v-2.7l1.9-.3a7 7 0 0 1 .6-1.5L4.9 6.6l1.9-1.9 1.6 1.1a7 7 0 0 1 1.5-.6l.3-1.9h2.7l.3 1.9a7 7 0 0 1 1.5.6l1.6-1.1 1.9 1.9-1.1 1.6c.3.5.5 1 .6 1.5l1.9.3z"/>'),
    lock: svg('<path d="M7 10V7a5 5 0 0 1 10 0v3h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h1zm2 0h6V7a3 3 0 0 0-6 0v3z"/>'),
    star: svg('<path d="m12 2.5 2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.2 1.3-6.6-4.9-4.6 6.6-.8z"/>'),
    check: svg('<path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>'),
    swipe: svg('<path d="M12 21V9M12 9l-4 4M12 9l4 4" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><circle cx="12" cy="5" r="2.5"/>'),
    ringI: svg('<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2.6"/><circle cx="12" cy="12" r="3"/>'),
    bolt: svg('<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>'),
    top: svg('<path d="M4 15c3-9 13-9 16 0" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="m16 15 4 1 1-4" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>'),
    flat: svg('<path d="M3 12h16m-4-4 4 4-4 4" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>'),
    slice: svg('<path d="M3 9c6 7 12 7 18 4" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="m17 10 4 3-3 3" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>'),
    lob: svg('<path d="M3 20C6 2 18 2 21 20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>'),
    drop: svg('<path d="M3 14c4-8 8-8 10 4" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><circle cx="16" cy="19" r="2.4"/>'),
    net: svg('<path d="M3 20V9h18v11M3 12h18M3 15h18M7 9v11M11 9v11M15 9v11M19 9v11" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 7V2m0 0-3 3m3-3 3 3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>'),
  };
  const coinHtml = n => `<span class="pill"><i class="coin"></i><span>${n}</span></span>`;
  const starHtml = t => { const n = 1 + Math.round(t * 4); return `<span class="stars" aria-label="${n} 星">${IC.star.repeat(n)}</span>` };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let screen = 'home', lastMatch = null, aim = null, touch = null, swipeTrail = [], popups = [], tutorialOpen = false;

  function click(fn) { return e => { Sfx.init(); Sfx.ui(); fn(e) } }
  function vibrate(ms) { if (SAVE.settings.vibe) try { navigator.vibrate && navigator.vibrate(ms) } catch (e) {} }

  // ---------- 屏幕切换 ----------
  function show(name, arg) {
    screen = name;
    $('hud').classList.toggle('hidden', name !== 'match');
    root.innerHTML = '';
    if (name !== 'match') { Scene3D.setMode('menu'); Scene3D.setAim(null); Sfx.setCrowd(0) }
    ({ home, career, quick, gear, settings, vs, match: () => {} })[name](arg);
    layoutSafe();
  }
  function el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild }
  function header(title, back = 'home') {
    const h = el(`<div class="head"><button class="round" aria-label="返回">${IC.back}</button><h2>${title}</h2><div style="margin-left:auto">${coinHtml(SAVE.coins)}</div></div>`);
    h.querySelector('button').onclick = click(() => show(back));
    return h;
  }

  function home() {
    const next = nextCareer();
    const s = el(`<section class="screen" id="home">
      <div class="topbar">
        <div class="profile"><div class="avatar" style="background:${playerLook().shirt}">你</div><div><div class="pname">你</div><div class="plv">等级 ${playerLevel()} · ${SAVE.wins} 胜 ${SAVE.losses} 负</div></div></div>
        <div class="pills"><span class="pill"><span class="cup">${IC.cup}</span><span>${SAVE.trophies}</span></span>${coinHtml(SAVE.coins)}</div>
      </div>
      <div class="logo"><span class="l1">TENNIS</span><span class="l2">SMASH</span><span class="l3">2026</span></div>
      <div class="home-actions">
        <button class="btn primary big" id="bCareer">巡回赛<small>${next ? `${ARENAS[next.i].name} · ${ROUNDS[next.r]}` : '全部冠军已到手 · 可重赛刷金币'}</small></button>
        <div class="row2"><button class="btn blue" id="bQuick">快速比赛</button><button class="btn" id="bTrain">训练场</button></div>
        <div class="row3"><button class="btn" id="bGear">${IC.racket}装备</button><button class="btn" id="bWard">${IC.shirt}球衣</button><button class="btn" id="bSet">${IC.cog}设置</button></div>
      </div></section>`);
    root.appendChild(s);
    $('bCareer').onclick = click(() => show('career'));
    $('bQuick').onclick = click(() => show('quick'));
    $('bTrain').onclick = click(() => begin({ type: 'train', arenaIdx: SAVE.quick.arena, opp: { name: '陪练', t: .3, style: 'baseline', look: { shirt: '#4b5563', shorts: '#222', skin: '#efc6a6', hair: '#333', band: '#d7f94a' } }, setLen: 4 }));
    $('bGear').onclick = click(() => show('gear', 'stats'));
    $('bWard').onclick = click(() => show('gear', 'outfit'));
    $('bSet').onclick = click(() => show('settings'));
  }
  function nextCareer() {
    for (let i = 0; i < ARENAS.length; i++) if (SAVE.career[i] < 3) return arenaUnlocked(i) ? { i, r: SAVE.career[i] } : null;
    return null;
  }

  function career() {
    const s = el(`<section class="screen solid"></section>`);
    s.appendChild(header('巡回赛'));
    const list = el(`<div class="scroll"></div>`);
    ARENAS.forEach((a, i) => {
      const un = arenaUnlocked(i), done = SAVE.career[i];
      const bg = a.night ? 'linear-gradient(135deg,#2b2f7a,#0d1330)' : `linear-gradient(135deg,${a.court},${a.apron === a.court ? shade(a.court, -25) : a.apron})`;
      const c = el(`<div class="arena ${un ? '' : 'locked'}" style="background:${bg}">
        <h3>${a.name}</h3>
        <div class="meta"><span class="tag">${a.surfName}</span><span class="tag">冠军奖金 <i class="coin" style="width:12px;height:12px;vertical-align:-1px"></i> ${a.prize}</span>${done >= 3 ? '<span class="tag">🏆 已夺冠</span>' : ''}</div>
        ${un ? '' : `<div class="lockmsg"><span style="width:20px">${IC.lock}</span>赢得「${ARENAS[i - 1].short}」冠军后解锁</div>`}
        <div class="rounds" ${un ? '' : 'hidden'}>${ROUNDS.map((r, k) => `<div class="rd ${k < done ? 'done' : k === done ? 'next' : ''}">${k < done ? IC.check.replace('<svg', '<svg style="width:14px;height:14px"') : ''}${r}</div>`).join('')}</div>
        ${un ? `<button class="btn ${done >= 3 ? '' : 'primary'} go">${done >= 3 ? '重赛（决赛）' : '下一场：' + esc(arenaOpps(i)[done].name)}</button>` : ''}
      </div>`);
      if (un) c.querySelector('.go').onclick = click(() => show('vs', { type: 'career', arenaIdx: i, round: Math.min(done, 2), replay: done >= 3 }));
      list.appendChild(c);
    });
    s.appendChild(list); root.appendChild(s);
  }
  function shade(hex, amt) { const n = parseInt(hex.slice(1), 16); const f = c => clamp(c + amt, 0, 255); return `rgb(${f(n >> 16)},${f(n >> 8 & 255)},${f(n & 255)})` }

  function quick() {
    const q = SAVE.quick;
    const s = el(`<section class="screen solid"></section>`);
    s.appendChild(header('快速比赛'));
    const body = el(`<div class="scroll">
      <div class="label">赛场</div><div class="seg" id="qa" style="grid-template-columns:repeat(2,1fr)">${ARENAS.map((a, i) => `<button data-i="${i}" ${arenaUnlocked(i) ? '' : 'disabled style="opacity:.4"'}>${arenaUnlocked(i) ? '' : '🔒 '}${a.short} · ${a.surfName}</button>`).join('')}</div>
      <div class="label">对手难度</div><div class="seg" id="qd" style="grid-template-columns:repeat(3,1fr)">${QUICK.map((d, i) => `<button data-i="${i}">${d.name}</button>`).join('')}</div>
      <div class="label">比赛长度</div><div class="seg" id="ql" style="grid-template-columns:repeat(2,1fr)"><button data-i="3">快速 · 先赢 3 局</button><button data-i="6">标准 · 先赢 6 局</button></div>
      <p style="color:var(--mute);font-size:13px;line-height:1.6;margin:4px 2px">快速比赛赢一场得 <b style="color:var(--text)">${40}–${160}</b> 金币，难度越高越多。</p>
      <button class="btn primary big" id="qGo" style="margin-top:auto">开始比赛</button></div>`);
    s.appendChild(body); root.appendChild(s);
    const seg = (id, key) => { const box = $(id); const upd = () => box.querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.i === q[key])); box.querySelectorAll('button').forEach(b => b.onclick = click(() => { q[key] = +b.dataset.i; persist(); upd() })); upd() };
    if (!arenaUnlocked(q.arena)) q.arena = 0;
    if (q.len !== 3 && q.len !== 6) q.len = 3;
    seg('qa', 'arena'); seg('qd', 'diff'); seg('ql', 'len');
    $('qGo').onclick = click(() => { const d = QUICK[q.diff]; begin({ type: 'quick', arenaIdx: q.arena, opp: { name: ['路人球友', '俱乐部高手', '职业选手'][q.diff], t: d.t, style: ['baseline', 'defender', 'aggressive'][q.diff], look: QUICK_LOOK }, setLen: q.len, diff: q.diff }) });
  }

  function gear(tab) {
    const s = el(`<section class="screen solid"></section>`);
    s.appendChild(header(tab === 'outfit' ? '球衣' : '装备升级'));
    const tabs = el(`<div class="tabs"><button data-t="stats">属性升级</button><button data-t="outfit">球衣</button></div>`);
    tabs.querySelectorAll('button').forEach(b => { b.classList.toggle('on', b.dataset.t === tab); b.onclick = click(() => show('gear', b.dataset.t)) });
    s.appendChild(tabs);
    const list = el(`<div class="scroll"></div>`);
    if (tab === 'stats') {
      STATS.forEach(sd => {
        const lv = SAVE.gear[sd.id], max = lv >= MAXLV, cost = upgradeCost(lv);
        const c = el(`<div class="card stat"><div><h4>${sd.name} · Lv ${lv}</h4><div class="g">${sd.gear}</div></div>
          <button class="btn ${max ? '' : 'primary'} up" ${max || SAVE.coins < cost ? 'disabled' : ''}>${max ? '已满级' : `<i class="coin" style="width:18px;height:18px"></i>${cost}`}</button>
          <div class="lvbar">${Array.from({ length: MAXLV }, (_, k) => `<i class="${k < lv ? 'on' : ''}"></i>`).join('')}</div>
          <div class="eff">${sd.desc(lv)}${max ? '' : ` → <b style="color:var(--ball)">${sd.desc(lv + 1).replace(/^[^\d+-]*/, '')}</b>`}</div></div>`);
        c.querySelector('button').onclick = click(() => { if (SAVE.coins < cost || max) return; SAVE.coins -= cost; SAVE.gear[sd.id]++; persist(); Sfx.coin(); vibrate(20); show('gear', 'stats') });
        list.appendChild(c);
      });
      list.appendChild(el(`<p style="color:var(--mute);font-size:13px;line-height:1.6;margin:4px 2px">比赛和训练场都能赚金币。巡回赛夺冠有额外奖金。</p>`));
    } else {
      const grid = el(`<div class="outfits"></div>`);
      OUTFITS.forEach(o => {
        const owned = SAVE.owned.includes(o.id), on = SAVE.outfit === o.id;
        const c = el(`<button class="outfit ${on ? 'on' : ''}"><div class="sw" style="background:${o.shirt}"><i style="background:${o.shorts}"></i></div>${o.name}<span class="price">${on ? '穿着中' : owned ? '已拥有' : `<i class="coin" style="width:14px;height:14px"></i>${o.cost}`}</span></button>`);
        c.onclick = click(() => {
          if (!owned) { if (SAVE.coins < o.cost) { toast('金币不够'); return } SAVE.coins -= o.cost; SAVE.owned.push(o.id); Sfx.coin() }
          SAVE.outfit = o.id; persist(); Scene3D.setPlayerLook(playerLook()); show('gear', 'outfit');
        });
        grid.appendChild(c);
      });
      list.appendChild(grid);
    }
    s.appendChild(list); root.appendChild(s);
  }

  function settings() {
    const s = el(`<section class="screen solid"></section>`);
    s.appendChild(header('设置'));
    const list = el(`<div class="scroll"></div>`);
    const items = [['sound', '音效与观众声'], ['voice', '裁判英文报分'], ['vibe', '击球震动'], ['hq', '高画质（阴影、高清）']];
    items.forEach(([k, name]) => {
      const c = el(`<button class="card toggle"><span>${name}</span><span class="sw-t ${SAVE.settings[k] ? 'on' : ''}"></span></button>`);
      c.onclick = click(() => { SAVE.settings[k] = !SAVE.settings[k]; persist(); applySettings(); c.querySelector('.sw-t').classList.toggle('on', SAVE.settings[k]) });
      list.appendChild(c);
    });
    const rec = el(`<div class="card" style="line-height:1.9;font-size:14px">
      <b>生涯数据</b><br>战绩 ${SAVE.wins} 胜 ${SAVE.losses} 负 · 奖杯 ${SAVE.trophies}<br>最快球速 ${SAVE.fastest} km/h · ACE ${SAVE.aces}<br>最长连击 ${SAVE.bestCombo} · 训练最长回合 ${SAVE.bestRally} 拍</div>`);
    list.appendChild(rec);
    const reset = el(`<button class="btn" style="color:#ff8a80">重置全部进度</button>`);
    reset.onclick = click(() => confirmBox('重置全部进度？', '金币、装备、球衣和巡回赛进度都会清空，不能恢复。', '重置', () => { resetSave(); applySettings(); Scene3D.setPlayerLook(playerLook()); show('home') }));
    list.appendChild(reset);
    s.appendChild(list); root.appendChild(s);
  }
  function applySettings() { Sfx.setEnabled(SAVE.settings.sound); Scene3D.setQuality(SAVE.settings.hq); if (!SAVE.settings.voice && window.speechSynthesis) speechSynthesis.cancel() }

  function vs(cfg) {
    const a = ARENAS[cfg.arenaIdx], opp = arenaOpps(cfg.arenaIdx)[cfg.round];
    Scene3D.buildArena(a);
    const s = el(`<section class="screen dim"><div class="head"><button class="round" aria-label="返回">${IC.back}</button></div>
      <div class="vs">
        <div class="round-name">${a.name} · ${ROUNDS[cfg.round]}</div>
        <div class="duel">
          <div class="fighter" style="background:linear-gradient(180deg,${playerLook().shirt},#0f1a40)"><div class="avatar" style="background:${playerLook().shirt}">你</div><div class="nm">你</div><div class="st">等级 ${playerLevel()}</div><div class="st">一发 ${Math.round(playerStats().srv * 3.6)} km/h</div></div>
          <div class="vsx">VS</div>
          <div class="fighter" style="background:linear-gradient(180deg,${opp.look.shirt},#0f1a40)"><div class="avatar" style="background:${opp.look.shirt};color:${opp.look.shorts}">${esc(opp.name[0])}</div><div class="nm">${esc(opp.name)}</div>${starHtml(opp.t)}<div class="st">${STYLE_NAME[opp.style]}</div></div>
        </div>
        <p style="text-align:center;color:var(--mute);font-size:13px;margin:0">${a.surfName}：${{ city: '弹跳正常，速度中等', clay: '球速慢、弹得高，回合更长', grass: '球速快、弹得低，发球占优', night: '总决赛舞台，对手都是顶尖选手' }[a.id]}</p>
        <p style="text-align:center;font-size:14px;margin:0">胜利奖励 <i class="coin" style="width:14px;height:14px;vertical-align:-2px"></i> <b>${careerReward(cfg, true)}</b>${cfg.round === 2 && !cfg.replay ? ` + 冠军奖金 <b>${a.prize}</b>` : ''}</p>
      </div>
      <button class="btn primary big" id="vsGo">开始比赛</button></section>`);
    root.appendChild(s);
    s.querySelector('.head button').onclick = click(() => show('career'));
    $('vsGo').onclick = click(() => begin(Object.assign({}, cfg, { opp, setLen: cfg.round === 2 ? 4 : 3 })));
  }
  const careerReward = (cfg, win) => win ? 100 + 60 * cfg.arenaIdx + 30 * cfg.round : 25 + 10 * cfg.arenaIdx;

  // ---------- 比赛 ----------
  function begin(cfg) {
    lastMatch = cfg;
    Sfx.init();
    Scene3D.buildArena(ARENAS[cfg.arenaIdx]);
    Scene3D.setOpponentLook(cfg.opp.look);
    Scene3D.setPlayerLook(playerLook());
    show('match');
    Scene3D.setMode('game');
    buildHud(cfg);
    startMatch(cfg);
    if (!SAVE.tutorial) tutorial();
  }
  function buildHud(cfg) {
    $('nmA').textContent = cfg.opp.name;
    $('sbTag').textContent = cfg.type === 'train' ? '训练场 · 连续回球' : cfg.type === 'career' ? `${ARENAS[cfg.arenaIdx].short} · ${ROUNDS[cfg.round]}` : `快速比赛 · ${QUICK[cfg.diff].name}`;
    $('pauseBtn').innerHTML = IC.pause; $('pauseBtn').onclick = click(pauseMenu);
    const shots = [['topspin', '上旋', IC.top], ['flat', '平击', IC.flat], ['slice', '切削', IC.slice], ['lob', '高吊', IC.lob], ['drop', '放小球', IC.drop]];
    $('shots').innerHTML = shots.map(([k, n, i]) => `<button class="chip" data-s="${k}">${i}${n}</button>`).join('') + `<button class="chip net" data-net>${IC.net}上网</button>`;
    $('shots').querySelectorAll('[data-s]').forEach(b => b.onclick = click(() => { shot = b.dataset.s; hud() }));
    $('shots').querySelector('[data-net]').onclick = click(() => { netMode = !netMode; say(netMode ? '上网：下一拍后冲到网前截击' : '回到底线'); hud() });
    $('skills').innerHTML = [['fire', '爆发'], ['slow', '减速'], ['zone', 'Zone']].map(([k, n]) => `<button class="sk" data-k="${k}"><span><b>${{ fire: '🔥', slow: '❄️', zone: '🎯' }[k]}</b>${n}</span></button>`).join('');
    $('skills').querySelectorAll('[data-k]').forEach(b => b.onclick = click(() => { if (!skill(b.dataset.k)) toast('能量不足：击球攒能量') }));
  }
  const PTS = ['0', '15', '30', '40'];
  function hud() {
    if (!M || !sc || !$('shots').firstElementChild) return;
    const train = M.type === 'train';
    let p0, p1;
    if (train) { p0 = rallyHits; p1 = '' }
    else if (sc.tb) { p0 = sc.pts[0]; p1 = sc.pts[1] }
    else {
      const [a, b] = sc.pts;
      if (a >= 3 && b >= 3) { p0 = a === b ? '40' : a > b ? 'AD' : ''; p1 = a === b ? '40' : b > a ? 'AD' : '' }
      else { p0 = PTS[a]; p1 = PTS[b] }
    }
    $('ptP').textContent = p0; $('ptA').textContent = p1;
    $('gmP').textContent = train ? '' : sc.games[0]; $('gmA').textContent = train ? '' : sc.games[1];
    $('srvP').classList.toggle('on', !train && sc.server === 0); $('srvA').classList.toggle('on', !train && sc.server === 1);
    $('shots').querySelectorAll('[data-s]').forEach(b => b.classList.toggle('on', b.dataset.s === shot));
    $('shots').querySelector('[data-net]').classList.toggle('on', netMode);
    $('skills').querySelectorAll('[data-k]').forEach(b => { b.style.setProperty('--e', P.ep); b.classList.toggle('ready', P.ep >= 100) });
  }
  let sayT = 0;
  function sayText(t) { const s = $('say'); s.textContent = t; s.style.opacity = 1; sayT = 2.6 }
  let bannerTimer = 0;
  function banner(t) { const b = $('banner'); b.textContent = t; b.classList.add('show'); clearTimeout(bannerTimer); bannerTimer = setTimeout(() => b.classList.remove('show'), 1500) }
  function toast(t) { if (screen === 'match') sayText(t); else { const d = el(`<div class="pill" style="position:fixed;left:50%;bottom:calc(30px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:30;padding:0 16px">${esc(t)}</div>`); document.body.appendChild(d); setTimeout(() => d.remove(), 1600) } }

  function pauseMenu() {
    if (!M || phase === 'over') return;
    paused = true;
    const m = el(`<div class="modal"><div class="box"><h2>暂停</h2>
      <button class="btn primary" id="pmGo">继续比赛</button>
      <button class="btn" id="pmSnd">${SAVE.settings.sound ? '关闭' : '打开'}声音</button>
      <button class="btn" id="pmQuit" style="color:#ff8a80">${M.type === 'train' ? '结束训练' : '退出比赛（不计成绩）'}</button></div></div>`);
    document.body.appendChild(m);
    $('pmGo').onclick = click(() => { m.remove(); paused = false });
    $('pmSnd').onclick = click(() => { SAVE.settings.sound = !SAVE.settings.sound; persist(); applySettings(); $('pmSnd').textContent = (SAVE.settings.sound ? '关闭' : '打开') + '声音' });
    $('pmQuit').onclick = click(() => { m.remove(); quitMatch() });
  }
  function quitMatch() {
    const train = M && M.type === 'train', coins = st ? st.coinsTrain : 0;
    M = null; paused = false; phase = 'idle'; ball.vis = false;
    show('home');
    if (train && coins) toast(`训练结束 · 共获得 ${coins} 金币`);
  }
  function confirmBox(title, text, ok, fn) {
    const m = el(`<div class="modal"><div class="box"><h2>${title}</h2><p>${text}</p><div class="row2"><button class="btn" id="cfNo">取消</button><button class="btn primary" id="cfOk">${ok}</button></div></div></div>`);
    document.body.appendChild(m);
    $('cfNo').onclick = click(() => m.remove()); $('cfOk').onclick = click(() => { m.remove(); fn() });
  }
  function tutorial() {
    paused = true; tutorialOpen = true;
    const m = el(`<div class="modal"><div class="box"><h2>怎么玩</h2><div class="tut">
      <div class="tut-row"><div class="tut-ic">${IC.swipe}</div><div><b>按住屏幕往上拖</b>，对面场地会出现黄色瞄准圈；左右拖改方向，拖得越远打得越深。<b>松手就是挥拍</b>。</div></div>
      <div class="tut-row"><div class="tut-ic" style="color:var(--ball)">${IC.ringI}</div><div>球飞来时有个光圈在缩小，<b>缩到球上变绿时松手 = PERFECT</b>：更快、更准。点一下也能打，回中路。</div></div>
      <div class="tut-row"><div class="tut-ic">${IC.top}</div><div>下方选球路：上旋稳、平击快、切削低、高吊过顶、放小球骗对手上网。人物会<b>自动跑位</b>。</div></div>
      <div class="tut-row"><div class="tut-ic" style="color:var(--gold)">${IC.bolt}</div><div>击球攒能量，满了可以放技能：爆发、让对手减速、Zone 判定放宽。</div></div>
      </div><button class="btn primary" id="tutOk">开打！</button></div></div>`);
    document.body.appendChild(m);
    $('tutOk').onclick = click(() => { m.remove(); paused = false; tutorialOpen = false; SAVE.tutorial = true; persist() });
  }

  function matchOver(w) {
    const cfg = M, a = ARENAS[cfg.arenaIdx];
    let coins = 0, extra = '';
    if (w === 0) SAVE.wins++; else SAVE.losses++;
    SAVE.aces += st.aces; SAVE.fastest = Math.max(SAVE.fastest, st.fastest);
    if (cfg.type === 'career') {
      coins = careerReward(cfg, w === 0);
      if (w === 0 && !cfg.replay) {
        SAVE.career[cfg.arenaIdx] = Math.max(SAVE.career[cfg.arenaIdx], cfg.round + 1);
        if (cfg.round === 2) { coins += a.prize; SAVE.trophies++; extra = `🏆 ${a.name} 冠军！` + (cfg.arenaIdx < 3 ? ` 已解锁「${ARENAS[cfg.arenaIdx + 1].name}」` : ' 你是巡回赛总冠军！') }
      }
    } else coins = w === 0 ? 40 + 60 * cfg.diff : 10;
    const bonus = Math.min(60, st.perfect * 2 + st.aces * 5);
    coins += bonus;
    SAVE.coins += coins; persist();
    setTimeout(() => {
      const m = el(`<div class="modal"><div class="box">
        <div class="res-title ${w === 0 ? 'win' : 'lose'}">${w === 0 ? 'VICTORY' : 'DEFEAT'}</div>
        <div class="res-score">你 ${sc.games[0]} – ${sc.games[1]} ${esc(cfg.opp.name)}${sc.tb ? `（抢七 ${sc.pts[0]}-${sc.pts[1]}）` : ''}</div>
        ${extra ? `<p style="color:var(--ball);font-weight:900">${extra}</p>` : ''}
        <div class="grid-stats">
          <div class="gs"><b>${st.winners}</b><span>制胜分</span></div><div class="gs"><b>${st.aces}</b><span>ACE</span></div><div class="gs"><b>${st.errors + st.df}</b><span>失误</span></div>
          <div class="gs"><b>${st.perfect}</b><span>PERFECT</span></div><div class="gs"><b>${st.maxRally}</b><span>最长回合</span></div><div class="gs"><b>${st.fastest}</b><span>最快 km/h</span></div>
        </div>
        <div class="reward"><i class="coin"></i><span id="rwN">0</span></div>
        <p>${bonus ? `含表现奖励 ${bonus}（PERFECT 与 ACE）` : '多打 PERFECT 和 ACE 有额外奖励'}</p>
        <div class="row2"><button class="btn" id="rsBack">${cfg.type === 'career' ? '巡回赛' : '主页'}</button><button class="btn primary" id="rsAgain">${cfg.type === 'career' && w === 0 && cfg.round < 2 && !cfg.replay ? '下一轮' : '再来一场'}</button></div>
      </div></div>`);
      document.body.appendChild(m);
      let n = 0; const step = Math.max(1, Math.round(coins / 30));
      const iv = setInterval(() => { n = Math.min(coins, n + step); const e = $('rwN'); if (e) e.textContent = '+' + n; if (n >= coins) clearInterval(iv) }, 30);
      Sfx.coin();
      $('rsBack').onclick = click(() => { m.remove(); M = null; show(cfg.type === 'career' ? 'career' : 'home') });
      $('rsAgain').onclick = click(() => {
        m.remove();
        if (cfg.type === 'career') { const done = SAVE.career[cfg.arenaIdx]; show('vs', { type: 'career', arenaIdx: cfg.arenaIdx, round: Math.min(done, 2), replay: done >= 3 }) }
        else begin(cfg);
      });
    }, 2200);
  }

  // ---------- 游戏事件 ----------
  function onEvent(type, e) {
    if (type === 'say') sayText(e.text);
    else if (type === 'banner') banner(e.text);
    else if (type === 'pop') popups.push({ text: e.text, x: e.x, y: e.y, z: e.z, col: e.col, big: e.big, t: 0 });
    else if (type === 'hud') hud();
    else if (type === 'hit' && e.side === 0) vibrate(e.q === 'perfect' ? 30 : 12);
    else if (type === 'matchOver') matchOver(e.w);
    else if (type === 'matchStart' || type === 'point' || type === 'game') hud();
  }

  // ---------- 输入：按住拖动瞄准，松手出手 ----------
  function aimFromDrag(dx, dy) {
    const s = Math.min(innerWidth, innerHeight);
    return { x: clamp(dx / (s * .32), -1, 1), d: clamp(-dy / (s * .45), 0, 1), tap: false };
  }
  function canAim() { return screen === 'match' && M && !paused && (phase === 'rally' || phase === 'serve' || phase === 'dead') }
  ov.addEventListener('pointerdown', e => {
    e.preventDefault(); Sfx.init();
    if (!canAim()) return;
    touch = { x: e.clientX, y: e.clientY, id: e.pointerId };
    aim = { x: 0, d: .6, tap: true }; swipeTrail = [[e.clientX, e.clientY, performance.now()]];
  });
  ov.addEventListener('pointermove', e => {
    if (!touch || e.pointerId !== touch.id) return;
    const dx = e.clientX - touch.x, dy = e.clientY - touch.y;
    swipeTrail.push([e.clientX, e.clientY, performance.now()]); if (swipeTrail.length > 24) swipeTrail.shift();
    if (Math.hypot(dx, dy) > 14) { aim = aimFromDrag(dx, dy); aim.d = Math.max(aim.d, .15) }
    Scene3D.setAim(aim && !aim.tap ? aimTarget(aim) : null);
  });
  function release(e) {
    if (!touch || e.pointerId !== touch.id) return;
    touch = null; Scene3D.setAim(null);
    if (canAim() && aim) swing(aim);
    aim = null;
  }
  ov.addEventListener('pointerup', release); ov.addEventListener('pointercancel', e => { touch = null; aim = null; Scene3D.setAim(null) });
  ov.addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('keydown', e => {
    if (screen !== 'match' || e.repeat) return;
    const k = e.key;
    if (k === ' ' || k === 'ArrowUp') swing({ x: 0, d: .6, tap: true });
    else if (k === 'ArrowLeft') swing({ x: -.85, d: .65 });
    else if (k === 'ArrowRight') swing({ x: .85, d: .65 });
    else if (k >= '1' && k <= '5') { shot = ['topspin', 'flat', 'slice', 'lob', 'drop'][k - 1]; hud() }
    else if (k === 'Escape') pauseMenu();
  });

  // ---------- 覆盖层：滑动轨迹 + 飘字 ----------
  function frame(dt) {
    const W = innerWidth, H = innerHeight;
    octx.clearRect(0, 0, W, H);
    if (sayT > 0) { sayT -= dt; if (sayT <= 0) $('say').style.opacity = 0 }
    // 滑动轨迹
    const tnow = performance.now();
    swipeTrail = swipeTrail.filter(p => tnow - p[2] < 260);
    if (swipeTrail.length > 1) {
      octx.lineCap = 'round'; octx.lineJoin = 'round';
      for (let i = 1; i < swipeTrail.length; i++) {
        const a = swipeTrail[i - 1], b = swipeTrail[i], k = i / swipeTrail.length;
        octx.strokeStyle = `rgba(230,255,110,${k * .8})`; octx.lineWidth = 3 + k * 9;
        octx.beginPath(); octx.moveTo(a[0], a[1]); octx.lineTo(b[0], b[1]); octx.stroke();
      }
    }
    // 飘字
    popups = popups.filter(p => (p.t += dt) < 1.1);
    octx.textAlign = 'center'; octx.textBaseline = 'middle';
    for (const p of popups) {
      const s = Scene3D.project(p.x, p.y, p.z); if (!s.vis) continue;
      const k = p.t / 1.1, sz = (p.big ? 30 : 20) * (p.t < .12 ? .6 + p.t / .12 * .4 : 1);
      octx.globalAlpha = 1 - k * k;
      octx.font = `italic 900 ${sz}px "Arial Black","PingFang SC",sans-serif`;
      octx.lineWidth = 5; octx.strokeStyle = 'rgba(5,10,28,.85)';
      octx.strokeText(p.text, s.x, s.y - k * 40); octx.fillStyle = p.col; octx.fillText(p.text, s.x, s.y - k * 40);
    }
    octx.globalAlpha = 1;
    if (screen === 'match') { const m = $('stM').firstElementChild; m.style.transform = `scaleX(${P.st / 100})` }
  }
  function resizeOverlay() {
    const d = Math.min(devicePixelRatio || 1, 2);
    ov.width = innerWidth * d; ov.height = innerHeight * d; octx.setTransform(d, 0, 0, d, 0, 0);
  }
  // 告诉 3D 相机：HUD 占了哪些边，球场取景时避开
  function layoutSafe() {
    const port = innerHeight >= innerWidth;
    const s = screen === 'match' ? (port ? { top: 112, bottom: 76, left: 6, right: 6 } : { top: 40, bottom: 8, left: 200, right: 236 }) : { top: 0, bottom: 0, left: 0, right: 0 };
    Scene3D.resize(innerWidth, innerHeight, s);
  }
  return { show, onEvent, frame, resizeOverlay, layoutSafe, applySettings, get tutorialOpen() { return tutorialOpen } };
})();
